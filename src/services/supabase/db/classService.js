import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import {
	broadcastChannel,
	INITIAL_CLASSES,
	INITIAL_CLASS_ENROLLMENTS,
	INITIAL_CLASS_ATTENDANCE,
	getLocalTable,
	setLocalTable,
} from './dbCore.js';

export const classService = {
	// --- LIVE CLASSES (MY CLASSES) ---
	async getLiveClasses() {
		if (isSupabaseConfigured) {
			const { data } = await supabase
				.from('live_classes')
				.select('*')
				.order('scheduled_at', { ascending: true });
			if (data) return data;
		}
		return getLocalTable('live_classes', INITIAL_CLASSES);
	},

	async getClasses() {
		return this.getLiveClasses();
	},

	async getMyClasses(mentorId) {
		if (!mentorId) return [];
		const classes = await this.getLiveClasses();
		return classes.filter((c) => c.mentor_id === mentorId);
	},

	async getClassById(classId) {
		const classes = await this.getLiveClasses();
		return classes.find((c) => c.id === classId) || null;
	},

	async createClass(classData) {
		// Validate required fields
		if (!classData.title || !classData.title.trim()) {
			throw new Error('Class title is required.');
		}
		if (!classData.scheduled_at) {
			throw new Error(
				'Please select a valid scheduled date and start time.'
			);
		}
		if (
			classData.is_free === false &&
			(classData.price_bdt === undefined ||
				Number(classData.price_bdt) <= 0)
		) {
			throw new Error(
				'Paid classes must have a valid price in BDT greater than 0.'
			);
		}

		const newClass = {
			id: `class_${Date.now()}`,
			status: classData.status || 'scheduled',
			is_locked: false,
			enrolled_count: 0,
			student_join_window_minutes:
				classData.student_join_window_minutes || 15,
			mentor_enter_window_minutes:
				classData.mentor_enter_window_minutes || 5,
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
			...classData,
		};

		const classes = getLocalTable('live_classes', INITIAL_CLASSES);
		classes.unshift(newClass);
		setLocalTable('live_classes', classes);

		if (isSupabaseConfigured) {
			try {
				await supabase.from('live_classes').insert(newClass);
			} catch (err) {
				console.warn('Supabase createClass error:', err);
			}
		}

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'live_classes',
			});
		}
		return newClass;
	},

	async updateClass(classId, updates) {
		const classes = getLocalTable('live_classes', INITIAL_CLASSES);
		const updated = classes.map((c) =>
			c.id === classId
				? { ...c, ...updates, updated_at: new Date().toISOString() }
				: c
		);
		setLocalTable('live_classes', updated);

		if (isSupabaseConfigured) {
			try {
				await supabase
					.from('live_classes')
					.update(updates)
					.eq('id', classId);
			} catch (err) {
				console.warn('Supabase updateClass error:', err);
			}
		}

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'live_classes',
			});
		}
		return updated.find((c) => c.id === classId);
	},

	async rescheduleClass(
		classId,
		{ scheduled_at, duration_minutes, reason = '', mentorId }
	) {
		if (!scheduled_at)
			throw new Error(
				'Please specify the new scheduled date and start time.'
			);
		const cls = await this.getClassById(classId);
		if (!cls) throw new Error('Class not found.');

		const oldScheduledAt = cls.scheduled_at;
		const oldDuration = cls.duration_minutes;

		// Record audit trail in class_schedule_history
		const history = getLocalTable('class_schedule_history', []);
		const enrollments = await this.getClassEnrollments(classId);

		const historyEntry = {
			id: `sch_${Date.now()}`,
			class_id: classId,
			mentor_id: mentorId || cls.mentor_id,
			old_scheduled_at: oldScheduledAt,
			new_scheduled_at: scheduled_at,
			old_duration_minutes: oldDuration,
			new_duration_minutes: duration_minutes || oldDuration,
			reason: reason || 'Schedule adjusted by instructor',
			notified_students_count: enrollments.length,
			changed_at: new Date().toISOString(),
		};
		history.unshift(historyEntry);
		setLocalTable('class_schedule_history', history);

		// Update the class schedule
		const updatedClass = await this.updateClass(classId, {
			scheduled_at,
			duration_minutes: duration_minutes || oldDuration,
			status: 'scheduled',
			cancellation_reason: null,
		});

		// Notify ALL enrolled students
		const dateFormatted = new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Dhaka',
			dateStyle: 'medium',
			timeStyle: 'short',
		}).format(new Date(scheduled_at));

		for (const enrollment of enrollments) {
			await this.createNotification({
				userId: enrollment.student_id,
				title: `Class Rescheduled: ${cls.title}`,
				message: `Your class has been rescheduled to ${dateFormatted} (Asia/Dhaka). Reason: ${reason || 'Schedule update'}.`,
				type: 'warning',
				link: `/classes`,
			});
		}

		return updatedClass;
	},

	async cancelClass(classId, reason = 'Cancelled by instructor', mentorId) {
		const cls = await this.getClassById(classId);
		if (!cls) throw new Error('Class not found.');

		const updatedClass = await this.updateClass(classId, {
			status: 'cancelled',
			cancellation_reason: reason,
			cancelled_at: new Date().toISOString(),
		});

		// Notify all enrolled students
		const enrollments = await this.getClassEnrollments(classId);
		for (const enrollment of enrollments) {
			await this.createNotification({
				userId: enrollment.student_id,
				title: `Class Cancelled: ${cls.title}`,
				message: `The live class scheduled for ${new Date(cls.scheduled_at).toLocaleDateString()} has been cancelled. ${reason ? `Reason: ${reason}.` : ''} Any paid credits remain protected.`,
				type: 'error',
				link: `/classes`,
			});
		}

		return updatedClass;
	},

	async deleteClass(classId) {
		const cls = await this.getClassById(classId);
		if (!cls) throw new Error('Class not found.');

		const enrollments = await this.getClassEnrollments(classId);
		const hasPaidEnrollments = enrollments.some(
			(e) => e.payment_status === 'paid' || e.amount_bdt > 0
		);

		// Strict rule: Classes with existing paid enrollments must preserve financial and enrollment records
		if (hasPaidEnrollments) {
			throw new Error(
				'Cannot permanently delete a class with existing paid student enrollments. To preserve financial audit history, please Cancel the class instead.'
			);
		}

		if (cls.status === 'live') {
			throw new Error(
				'Live classes must be ended before deletion or archival.'
			);
		}

		const classes = getLocalTable('live_classes', INITIAL_CLASSES);
		const filtered = classes.filter((c) => c.id !== classId);
		setLocalTable('live_classes', filtered);

		if (isSupabaseConfigured) {
			try {
				await supabase.from('live_classes').delete().eq('id', classId);
			} catch (err) {
				console.warn('Supabase deleteClass error:', err);
			}
		}

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'live_classes',
			});
		}
		return true;
	},

	async startLiveClass(classId) {
		const cls = await this.getClassById(classId);
		if (!cls) throw new Error('Class not found.');

		const updated = await this.updateClass(classId, {
			status: 'live',
			started_at: new Date().toISOString(),
		});

		// Notify enrolled students that class is live now
		const enrollments = await this.getClassEnrollments(classId);
		for (const enrollment of enrollments) {
			await this.createNotification({
				userId: enrollment.student_id,
				title: `Class is Live Now! 🎙️`,
				message: `Mentor has started "${cls.title}". Click here to enter the live classroom immediately!`,
				type: 'success',
				link: `/classes`,
			});
		}

		return updated;
	},

	async endLiveClass(classId) {
		const cls = await this.getClassById(classId);
		if (!cls) throw new Error('Class not found.');

		const updated = await this.updateClass(classId, {
			status: 'completed',
			ended_at: new Date().toISOString(),
		});

		// Finalize open attendance records for active participants
		const attendance = getLocalTable(
			'class_attendance',
			INITIAL_CLASS_ATTENDANCE
		);
		const now = new Date().toISOString();
		attendance.forEach((att) => {
			if (att.class_id === classId && !att.actual_leave_time) {
				att.actual_leave_time = now;
				const startMs = new Date(att.actual_join_time).getTime();
				att.duration_seconds = Math.max(
					0,
					Math.floor((Date.now() - startMs) / 1000)
				);
				att.class_end_time = now;
			}
		});
		setLocalTable('class_attendance', attendance);

		return updated;
	},

	// --- CLASSROOM ACCESS & TIME RULES (SECTION 4) ---
	getClassroomAccessStatus(classObj, userId, userRole = 'student') {
		if (!classObj)
			return {
				status: 'unknown',
				canEnter: false,
				message: 'Class unavailable',
			};

		if (classObj.status === 'cancelled') {
			return {
				status: 'cancelled',
				canEnter: false,
				message: 'This class has been cancelled by the instructor.',
				badgeColor: 'bg-rose-500 text-white',
			};
		}

		if (classObj.status === 'completed') {
			return {
				status: 'completed',
				canEnter: false,
				message: 'This class session has concluded.',
				badgeColor: 'bg-slate-500 text-white',
			};
		}

		if (classObj.status === 'live') {
			return {
				status: 'live',
				canEnter: true,
				message: 'Classroom is currently LIVE!',
				badgeColor: 'bg-rose-500 text-white animate-pulse',
			};
		}

		// Evaluate scheduled window
		const now = Date.now();
		const scheduledTime = new Date(classObj.scheduled_at).getTime();
		const studentWindowMins = classObj.student_join_window_minutes || 15;
		const mentorWindowMins = classObj.mentor_enter_window_minutes || 5;

		const isMentorOrAdmin =
			userRole === 'mentor' ||
			userRole === 'admin' ||
			classObj.mentor_id === userId;
		const allowedWindowMins = isMentorOrAdmin
			? mentorWindowMins
			: studentWindowMins;
		const windowOpenTime = scheduledTime - allowedWindowMins * 60 * 1000;

		const diffToWindowMs = windowOpenTime - now;
		const diffToStartMs = scheduledTime - now;

		if (now >= windowOpenTime) {
			return {
				status: 'ready_to_join',
				canEnter: true,
				minutesUntilStart: Math.max(
					0,
					Math.round(diffToStartMs / 60000)
				),
				message: isMentorOrAdmin
					? 'Classroom Lounge Open: Prepare your audio & video before starting class.'
					: 'Classroom Lounge Open: You may join and wait for the mentor to begin.',
				badgeColor: 'bg-emerald-500 text-white',
			};
		}

		const minutesUntilOpen = Math.ceil(diffToWindowMs / 60000);
		return {
			status: 'scheduled',
			canEnter: false,
			minutesUntilOpen,
			message: isMentorOrAdmin
				? `Mentor entry opens ${mentorWindowMins}m before class (in ${minutesUntilOpen} mins).`
				: `Classroom access opens ${studentWindowMins}m before class (in ${minutesUntilOpen} mins).`,
			badgeColor:
				'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
		};
	},

	// --- CLASS ENROLLMENTS & STUDENT MANAGEMENT ---
	async getClassEnrollments(classId) {
		const enrollments = getLocalTable(
			'class_enrollments',
			INITIAL_CLASS_ENROLLMENTS
		);
		const profiles = await this.getAllProfiles();

		const classEnrs = enrollments.filter((e) => e.class_id === classId);
		return classEnrs.map((e) => {
			const studentProfile = profiles.find((p) => p.id === e.student_id);
			return {
				...e,
				student_name:
					studentProfile?.full_name ||
					e.student_name ||
					'Enrolled Student',
				student_avatar: studentProfile?.avatar_url || e.student_avatar,
				student_email: studentProfile?.email || 'student@saybd.com',
			};
		});
	},

	async enrollStudentInClass(
		classId,
		studentId,
		paymentOrderId = null,
		amountBdt = 0
	) {
		if (!classId || !studentId)
			throw new Error('Class ID and Student ID are required.');
		const cls = await this.getClassById(classId);
		if (!cls) throw new Error('Class not found.');

		const enrollments = getLocalTable(
			'class_enrollments',
			INITIAL_CLASS_ENROLLMENTS
		);
		const existing = enrollments.find(
			(e) => e.class_id === classId && e.student_id === studentId
		);
		if (existing) {
			return existing; // Idempotent
		}

		const profiles = await this.getAllProfiles();
		const student = profiles.find((p) => p.id === studentId);

		const newEnrollment = {
			id: `cenr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			class_id: classId,
			student_id: studentId,
			student_name: student?.full_name || 'Student',
			student_avatar: student?.avatar_url,
			payment_order_id: paymentOrderId,
			payment_status: cls.is_free ? 'free' : 'paid',
			amount_bdt: cls.is_free ? 0 : cls.price_bdt || amountBdt,
			status: 'confirmed',
			enrolled_at: new Date().toISOString(),
		};

		enrollments.push(newEnrollment);
		setLocalTable('class_enrollments', enrollments);

		// Increment enrolled_count on live_classes
		await this.updateClass(classId, {
			enrolled_count: (cls.enrolled_count || 0) + 1,
		});

		// Notify student
		await this.createNotification({
			userId: studentId,
			title: `Class Enrollment Confirmed! 🎉`,
			message: `You are confirmed for "${cls.title}". Access opens 15 minutes before scheduled start.`,
			type: 'success',
			link: `/classes`,
		});

		// Notify mentor
		await this.createNotification({
			userId: cls.mentor_id,
			title: `New Student Enrolled in Class! 🎓`,
			message: `${student?.full_name || 'A student'} enrolled in your scheduled class "${cls.title}".`,
			type: 'info',
			link: `/mentor`,
		});

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'class_enrollments',
			});
		}
		return newEnrollment;
	},

	async getStudentUpcomingClasses(studentId) {
		if (!studentId) return [];
		const enrollments = getLocalTable(
			'class_enrollments',
			INITIAL_CLASS_ENROLLMENTS
		);
		const classes = await this.getLiveClasses();
		const studentEnrs = enrollments.filter(
			(e) => e.student_id === studentId && e.status !== 'cancelled'
		);
		const classIds = studentEnrs.map((e) => e.class_id);

		return classes
			.filter((c) => classIds.includes(c.id))
			.map((c) => {
				const enr = studentEnrs.find((e) => e.class_id === c.id);
				const access = this.getClassroomAccessStatus(
					c,
					studentId,
					'student'
				);
				return {
					...c,
					enrollment: enr,
					accessStatus: access,
				};
			})
			.sort(
				(a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)
			);
	},

	// --- ATTENDANCE & CLASS HISTORY (SECTION 7) ---
	// Server-verified attendance records.
	// Strictly isolated: never counts toward 1-on-1 daily free allowance or leaderboard.
	async recordClassAttendanceJoin(
		classId,
		mentorId,
		studentId,
		studentName = ''
	) {
		if (!classId || !studentId) return null;
		const attendance = getLocalTable(
			'class_attendance',
			INITIAL_CLASS_ATTENDANCE
		);
		const existing = attendance.find(
			(a) =>
				a.class_id === classId &&
				a.student_id === studentId &&
				!a.actual_leave_time
		);
		if (existing) return existing;

		const newRecord = {
			id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			class_id: classId,
			mentor_id: mentorId,
			student_id: studentId,
			student_name: studentName,
			actual_join_time: new Date().toISOString(),
			actual_leave_time: null,
			duration_seconds: 0,
			class_start_time: new Date().toISOString(),
			class_end_time: null,
			attendance_status: 'present',
			created_at: new Date().toISOString(),
		};

		attendance.push(newRecord);
		setLocalTable('class_attendance', attendance);
		return newRecord;
	},

	async recordClassAttendanceLeave(classId, studentId) {
		if (!classId || !studentId) return null;
		const attendance = getLocalTable(
			'class_attendance',
			INITIAL_CLASS_ATTENDANCE
		);
		const record = attendance.find(
			(a) =>
				a.class_id === classId &&
				a.student_id === studentId &&
				!a.actual_leave_time
		);
		if (record) {
			const now = new Date().toISOString();
			record.actual_leave_time = now;
			const joinMs = new Date(record.actual_join_time).getTime();
			record.duration_seconds = Math.max(
				0,
				Math.floor((Date.now() - joinMs) / 1000)
			);
			setLocalTable('class_attendance', attendance);
			return record;
		}
		return null;
	},

	async getClassAttendance(classId) {
		const attendance = getLocalTable(
			'class_attendance',
			INITIAL_CLASS_ATTENDANCE
		);
		const profiles = await this.getAllProfiles();
		return attendance
			.filter((a) => a.class_id === classId)
			.map((a) => {
				const student = profiles.find((p) => p.id === a.student_id);
				return {
					...a,
					student_name:
						student?.full_name || a.student_name || 'Student',
					student_avatar: student?.avatar_url,
					student_email: student?.email || 'student@saybd.com',
				};
			});
	},

	// --- CLASS PARTICIPANTS & HAND RAISING ---
	async getClassParticipants(classId) {
		const key = `class_participants_${classId}`;
		return getLocalTable(key, [
			{
				id: 'user_mentor_1',
				name: 'David Miller',
				role: 'mentor',
				hasMic: true,
				isMuted: false,
				avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200',
			},
			{
				id: 'peer_tanvir',
				name: 'Tanvir Hasan',
				role: 'student',
				hasMic: false,
				isMuted: true,
				avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200',
			},
			{
				id: 'peer_sophia',
				name: 'Sophia Chen',
				role: 'student',
				hasMic: false,
				isMuted: true,
				avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200',
			},
		]);
	},

	async setClassParticipants(classId, participants) {
		const key = `class_participants_${classId}`;
		setLocalTable(key, participants);
	},

	async getSpeakingQueue(classId) {
		const key = `class_queue_${classId}`;
		return getLocalTable(key, []);
	},

	async raiseHand(classId, user) {
		const queue = await this.getSpeakingQueue(classId);
		if (queue.some((item) => item.userId === user.id)) return queue;
		const item = {
			id: `hand_${Date.now()}`,
			userId: user.id,
			userName: user.name || user.full_name,
			userAvatar: user.avatar_url,
			raisedAt: new Date().toISOString(),
			status: 'waiting',
		};
		const updated = [...queue, item];
		const key = `class_queue_${classId}`;
		setLocalTable(key, updated);
		return updated;
	},

	async lowerHand(classId, userId) {
		const queue = await this.getSpeakingQueue(classId);
		const updated = queue.filter((item) => item.userId !== userId);
		const key = `class_queue_${classId}`;
		setLocalTable(key, updated);
		return updated;
	},
};
