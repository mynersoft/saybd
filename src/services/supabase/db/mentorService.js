import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import {
	broadcastChannel,
	INITIAL_MENTORS,
	INITIAL_CLASS_ENROLLMENTS,
	getLocalTable,
	setLocalTable,
} from './dbCore.js';

export const mentorService = {
	// --- MENTOR PROFILE MANAGEMENT ---
	async getMentor(userId) {
		if (isSupabaseConfigured) {
			const { data } = await supabase
				.from('mentors')
				.select('*')
				.eq('user_id', userId)
				.single();
			if (data) return data;
		}
		const mentors = getLocalTable('mentors', INITIAL_MENTORS);
		return mentors.find((m) => m.user_id === userId) || null;
	},

	async updateMentor(userId, updates) {
		const mentors = getLocalTable('mentors', INITIAL_MENTORS);
		const idx = mentors.findIndex((m) => m.user_id === userId);
		if (idx >= 0) {
			mentors[idx] = {
				...mentors[idx],
				...updates,
				updated_at: new Date().toISOString(),
			};
		} else {
			mentors.push({
				user_id: userId,
				...updates,
				created_at: new Date().toISOString(),
			});
		}
		setLocalTable('mentors', mentors);

		if (isSupabaseConfigured) {
			try {
				await supabase
					.from('mentors')
					.upsert(
						{ user_id: userId, ...updates },
						{ onConflict: 'user_id' }
					);
			} catch (err) {
				console.warn('Supabase mentor update error:', err);
			}
		}

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'mentors',
				userId,
			});
		}
		return mentors.find((m) => m.user_id === userId);
	},

	// --- MENTOR DASHBOARD OVERVIEW METRICS (SECTION 2) ---
	async getMentorOverviewStats(mentorId) {
		if (!mentorId) return null;

		const myClasses = await this.getMyClasses(mentorId);
		const myCourses = await this.getMyCourses(mentorId);
		const earnings = await this.getMentorEarnings(mentorId);

		// Unique enrolled students across all classes and courses
		const classEnrollments = getLocalTable(
			'class_enrollments',
			INITIAL_CLASS_ENROLLMENTS
		);
		const myClassIds = myClasses.map((c) => c.id);
		const enrolledInMyClasses = classEnrollments
			.filter((e) => myClassIds.includes(e.class_id))
			.map((e) => e.student_id);

		const courseEnrollments = getLocalTable('course_enrollments', []);
		const myCourseIds = myCourses.map((c) => c.id);
		const enrolledInMyCourses = courseEnrollments
			.filter((e) => myCourseIds.includes(e.course_id))
			.map((e) => e.user_id);

		const uniqueStudents = new Set([
			...enrolledInMyClasses,
			...enrolledInMyCourses,
		]);

		return {
			totalClasses: myClasses.length,
			upcomingClasses: myClasses.filter((c) => c.status === 'scheduled')
				.length,
			liveClasses: myClasses.filter((c) => c.status === 'live').length,
			completedClasses: myClasses.filter((c) => c.status === 'completed')
				.length,
			draftClasses: myClasses.filter((c) => c.status === 'draft').length,
			cancelledClasses: myClasses.filter((c) => c.status === 'cancelled')
				.length,

			totalCourses: myCourses.length,
			publishedCourses: myCourses.filter(
				(c) => c.is_published || c.approval_status === 'published'
			).length,
			draftCourses: myCourses.filter((c) => c.approval_status === 'draft')
				.length,
			pendingApprovalCourses: myCourses.filter(
				(c) => c.approval_status === 'pending_review'
			).length,

			totalEnrolledStudents: uniqueStudents.size,
			verifiedCourseSalesBdt: earnings?.grossSalesBdt || 0,
			mentorNetEarningsBdt: earnings?.netEarningsBdt || 0,
			availableEarningsBdt: earnings?.availableBalanceBdt || 0,
			totalPaidOutBdt: earnings?.paidWithdrawalsBdt || 0,
			pendingPayoutBdt: earnings?.pendingWithdrawalsBdt || 0,
		};
	},

	// --- MENTOR APPLICATIONS (Review & Promotion Flow) ---
	async createMentorApplication({
		userId,
		fullName,
		email,
		title,
		bio,
		yearsExperience,
		expertise,
		resumeUrl,
		videoIntroUrl,
	}) {
		if (!isSupabaseConfigured) throw new Error('Supabase is not configured');

		// Do not set id: the database generates a proper UUID
		const entry = {
			user_id: userId,
			full_name: fullName,
			email,
			title,
			bio,
			years_experience: Number(yearsExperience || 0),
			expertise: Array.isArray(expertise)
				? expertise
				: [expertise].filter(Boolean),
			resume_url: resumeUrl || null,
			video_intro_url: videoIntroUrl || null,
			status: 'pending',
		};

		const { data, error } = await supabase
			.from('mentor_applications')
			.insert([entry])
			.select()
			.single();

		if (error) throw new Error(error.message);
		return data;
	},

	async getMentorApplications(statusFilter = null) {
		if (!isSupabaseConfigured) return [];

		let query = supabase
			.from('mentor_applications')
			.select('*')
			.order('created_at', { ascending: false });
		if (statusFilter) query = query.eq('status', statusFilter);

		const { data, error } = await query;
		if (error) {
			console.error('Could not load mentor applications:', error.message);
			return [];
		}
		return data || [];
	},

	// Approves/rejects in ONE safe database step (see review_mentor_application SQL function):
	// updates the application, promotes the user to mentor, creates the mentor row and a notification.
	async reviewMentorApplication({
		applicationId,
		status,
		rejectionReason = '',
	}) {
		if (!isSupabaseConfigured) throw new Error('Supabase is not configured');

		const { data, error } = await supabase.rpc('review_mentor_application', {
			p_application_id: applicationId,
			p_status: status,
			p_reason: rejectionReason || null,
		});
		if (error) throw new Error(error.message);

		// Email (best effort: approval still works if email fails)
		try {
			await supabase.functions.invoke('send-mentor-email', {
				body: { to: data.email, name: data.full_name, status },
			});
		} catch (e) {
			console.warn('Mentor email not sent:', e);
		}
		return data;
	},
};
