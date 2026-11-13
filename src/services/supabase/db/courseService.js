import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import {
	broadcastChannel,
	INITIAL_COURSES,
	INITIAL_COURSE_REVIEWS,
	INITIAL_LESSON_PROGRESS,
	getLocalTable,
	setLocalTable,
} from './dbCore.js';

export const courseService = {
	// --- COURSES (MY COURSES) ---
	async getCourses() {
		if (isSupabaseConfigured) {
			const { data } = await supabase
				.from('courses')
				.select('*')
				.eq('is_published', true);
			if (data) return data;
		}
		return getLocalTable('courses', INITIAL_COURSES);
	},

	async getMyCourses(mentorId) {
		if (!mentorId) return [];
		const courses = getLocalTable('courses', INITIAL_COURSES);
		return courses.filter((c) => c.mentor_id === mentorId);
	},

	async getCourseById(courseId) {
		const courses = getLocalTable('courses', INITIAL_COURSES);
		return courses.find((c) => c.id === courseId) || null;
	},

	async saveCourse(courseData) {
		// Validate pricing
		const priceNum = Number(courseData.price || courseData.price_bdt || 0);
		if (isNaN(priceNum) || priceNum < 0) {
			throw new Error('Course price must be a valid positive amount.');
		}

		const courses = getLocalTable('courses', INITIAL_COURSES);
		const index = courses.findIndex((c) => c.id === courseData.id);

		const coursePayload = {
			...courseData,
			price: priceNum,
			price_bdt: priceNum,
			price_cents: priceNum * 100,
			currency: 'BDT',
			updated_at: new Date().toISOString(),
		};

		if (index >= 0) {
			courses[index] = { ...courses[index], ...coursePayload };
		} else {
			const newCourse = {
				id: `course_${Date.now()}`,
				is_published: courseData.is_published || false,
				approval_status: courseData.approval_status || 'draft',
				total_enrollments: 0,
				rating: 5.0,
				created_at: new Date().toISOString(),
				...coursePayload,
			};
			courses.unshift(newCourse);
		}

		setLocalTable('courses', courses);

		if (isSupabaseConfigured) {
			try {
				await supabase
					.from('courses')
					.upsert(coursePayload, { onConflict: 'id' });
			} catch (err) {
				console.warn('Supabase saveCourse error:', err);
			}
		}

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'courses',
			});
		}
		return courses.find((c) => c.id === (courseData.id || courses[0].id));
	},

	async submitCourseForApproval(courseId) {
		const courses = getLocalTable('courses', INITIAL_COURSES);
		const course = courses.find((c) => c.id === courseId);
		if (!course) throw new Error('Course not found.');

		course.approval_status = 'pending_review';
		course.submitted_at = new Date().toISOString();
		setLocalTable('courses', courses);

		await this.createNotification({
			userId: course.mentor_id,
			title: 'Course Submitted for Review 📑',
			message: `"${course.title}" was submitted to administrators. You will be notified upon verification.`,
			type: 'info',
		});

		return course;
	},

	async publishCourse(courseId) {
		const courses = getLocalTable('courses', INITIAL_COURSES);
		const course = courses.find((c) => c.id === courseId);
		if (!course) throw new Error('Course not found.');

		course.is_published = true;
		course.approval_status = 'published';
		course.updated_at = new Date().toISOString();
		setLocalTable('courses', courses);

		await this.createNotification({
			userId: course.mentor_id,
			title: 'Course Published Successfully! 🚀',
			message: `"${course.title}" is now publicly visible in the SayBD course marketplace.`,
			type: 'success',
			link: `/courses`,
		});

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'courses',
			});
		}
		return course;
	},

	async unpublishCourse(courseId) {
		const courses = getLocalTable('courses', INITIAL_COURSES);
		const course = courses.find((c) => c.id === courseId);
		if (!course) throw new Error('Course not found.');

		course.is_published = false;
		course.approval_status = 'unpublished';
		course.updated_at = new Date().toISOString();
		setLocalTable('courses', courses);

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'courses',
			});
		}
		return course;
	},

	async archiveCourse(courseId) {
		const courses = getLocalTable('courses', INITIAL_COURSES);
		const course = courses.find((c) => c.id === courseId);
		if (!course) throw new Error('Course not found.');

		course.is_published = false;
		course.approval_status = 'archived';
		course.updated_at = new Date().toISOString();
		setLocalTable('courses', courses);

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'courses',
			});
		}
		return course;
	},

	async deleteCourse(courseId) {
		const courses = getLocalTable('courses', INITIAL_COURSES);
		const course = courses.find((c) => c.id === courseId);
		if (!course) throw new Error('Course not found.');

		// Check if any student has purchased this course
		const allEnrollments = getLocalTable('course_enrollments', []);
		const orders = getLocalTable('payment_orders', []);
		const hasPurchasers =
			allEnrollments.some((e) => e.course_id === courseId) ||
			orders.some(
				(o) => o.courseId === courseId || o.item_id === courseId
			);

		if (hasPurchasers) {
			throw new Error(
				'Cannot permanently delete this course because students have already purchased it. To preserve access for existing students and uphold financial records, please Archive or Unpublish the course instead.'
			);
		}

		const filtered = courses.filter((c) => c.id !== courseId);
		setLocalTable('courses', filtered);

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'courses',
			});
		}
		return true;
	},

	// --- COURSE STUDENTS & PROGRESS ---
	async getCourseStudents(courseId) {
		if (!courseId) return [];
		const enrollments = getLocalTable('course_enrollments', []);
		const profiles = await this.getAllProfiles();
		const course = await this.getCourseById(courseId);
		const lessonProgress = getLocalTable(
			'lesson_progress',
			INITIAL_LESSON_PROGRESS
		);

		const matchingEnrs = enrollments.filter(
			(e) => e.course_id === courseId
		);

		const totalLessons =
			course?.sections?.reduce(
				(acc, s) => acc + (s.lessons?.length || 0),
				0
			) || 1;

		return matchingEnrs.map((e) => {
			const student = profiles.find((p) => p.id === e.user_id);
			const studentCompleted = lessonProgress.filter(
				(lp) =>
					lp.user_id === e.user_id &&
					lp.course_id === courseId &&
					lp.is_completed
			).length;
			const progressPercent =
				Math.min(
					100,
					Math.round((studentCompleted / totalLessons) * 100)
				) ||
				e.progress_percentage ||
				25;

			return {
				id: e.id,
				user_id: e.user_id,
				student_name: student?.full_name || 'Enrolled Student',
				student_avatar: student?.avatar_url,
				student_email: student?.email || 'student@saybd.com',
				enrolled_at:
					e.enrolled_at || e.created_at || new Date().toISOString(),
				progress_percentage: progressPercent,
				completed_lessons: studentCompleted,
				total_lessons: totalLessons,
				payment_status: 'Completed (SSLCommerz)',
				last_activity: new Date(
					Date.now() - 86400000 * 1
				).toISOString(),
			};
		});
	},

	async updateLessonProgress(userId, courseId, lessonId, isCompleted = true) {
		if (!userId || !courseId || !lessonId) return null;
		const progressList = getLocalTable(
			'lesson_progress',
			INITIAL_LESSON_PROGRESS
		);
		const existing = progressList.find(
			(p) =>
				p.user_id === userId &&
				p.course_id === courseId &&
				p.lesson_id === lessonId
		);

		if (existing) {
			existing.is_completed = isCompleted;
			existing.updated_at = new Date().toISOString();
		} else {
			progressList.push({
				id: `prog_${Date.now()}`,
				user_id: userId,
				course_id: courseId,
				lesson_id: lessonId,
				is_completed: isCompleted,
				updated_at: new Date().toISOString(),
			});
		}
		setLocalTable('lesson_progress', progressList);

		// Calculate updated course progress percentage
		const course = await this.getCourseById(courseId);
		const totalLessons =
			course?.sections?.reduce(
				(acc, s) => acc + (s.lessons?.length || 0),
				0
			) || 1;
		const completedCount = progressList.filter(
			(p) =>
				p.user_id === userId &&
				p.course_id === courseId &&
				p.is_completed
		).length;
		const progressPercent = Math.min(
			100,
			Math.round((completedCount / totalLessons) * 100)
		);

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'progress_updated',
				userId,
				courseId,
				progressPercent,
			});
		}
		return { isCompleted, progressPercent };
	},

	async getCourseProgress(userId, courseId) {
		if (!userId || !courseId)
			return { completedLessons: [], progressPercentage: 0 };
		const progressList = getLocalTable(
			'lesson_progress',
			INITIAL_LESSON_PROGRESS
		);
		const completed = progressList
			.filter(
				(p) =>
					p.user_id === userId &&
					p.course_id === courseId &&
					p.is_completed
			)
			.map((p) => p.lesson_id);

		const course = await this.getCourseById(courseId);
		const totalLessons =
			course?.sections?.reduce(
				(acc, s) => acc + (s.lessons?.length || 0),
				0
			) || 1;
		const progressPercentage = Math.min(
			100,
			Math.round((completed.length / totalLessons) * 100)
		);

		return {
			completedLessons: completed,
			progressPercentage,
			totalLessons,
			completedCount: completed.length,
		};
	},

	// --- COURSE REVIEWS & FEEDBACK ---
	async getCourseReviews(courseId) {
		const reviews = getLocalTable('course_reviews', INITIAL_COURSE_REVIEWS);
		if (!courseId) return reviews;
		return reviews.filter((r) => r.course_id === courseId);
	},

	async getAllMentorReviews(mentorId) {
		const courses = await this.getMyCourses(mentorId);
		const courseIds = courses.map((c) => c.id);
		const reviews = getLocalTable('course_reviews', INITIAL_COURSE_REVIEWS);
		return reviews.filter((r) => courseIds.includes(r.course_id));
	},

	async submitCourseReview({ courseId, studentId, rating, reviewText }) {
		if (!courseId || !studentId)
			throw new Error('Course and student ID are required.');
		if (!rating || rating < 1 || rating > 5)
			throw new Error('Rating must be between 1 and 5 stars.');
		if (!reviewText || !reviewText.trim())
			throw new Error('Please enter your review feedback.');

		const reviews = getLocalTable('course_reviews', INITIAL_COURSE_REVIEWS);
		const existing = reviews.find(
			(r) => r.course_id === courseId && r.student_id === studentId
		);
		if (existing) {
			throw new Error(
				'You have already submitted a review for this course.'
			);
		}

		const profiles = await this.getAllProfiles();
		const student = profiles.find((p) => p.id === studentId);
		const course = await this.getCourseById(courseId);

		const newReview = {
			id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			course_id: courseId,
			student_id: studentId,
			student_name: student?.full_name || 'Student',
			student_avatar: student?.avatar_url,
			rating: Number(rating),
			review_text: reviewText.trim(),
			mentor_response: null,
			mentor_responded_at: null,
			is_reported: false,
			report_reason: null,
			created_at: new Date().toISOString(),
		};

		reviews.unshift(newReview);
		setLocalTable('course_reviews', reviews);

		// Notify mentor
		if (course?.mentor_id) {
			await this.createNotification({
				userId: course.mentor_id,
				title: `New Course Review (${rating} ⭐)`,
				message: `${student?.full_name || 'A student'} left a review for "${course.title}".`,
				type: 'info',
				link: `/mentor`,
			});
		}

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'course_reviews',
			});
		}
		return newReview;
	},

	async respondToCourseReview(reviewId, mentorResponse) {
		if (!reviewId || !mentorResponse || !mentorResponse.trim()) {
			throw new Error('Response message is required.');
		}
		const reviews = getLocalTable('course_reviews', INITIAL_COURSE_REVIEWS);
		const review = reviews.find((r) => r.id === reviewId);
		if (!review) throw new Error('Review not found.');

		review.mentor_response = mentorResponse.trim();
		review.mentor_responded_at = new Date().toISOString();
		setLocalTable('course_reviews', reviews);

		// Notify student
		await this.createNotification({
			userId: review.student_id,
			title: 'Mentor Responded to Your Review 💬',
			message: `Your mentor replied: "${mentorResponse.slice(0, 80)}..."`,
			type: 'info',
		});

		return review;
	},

	async reportCourseReview(reviewId, reason = 'Inappropriate content') {
		const reviews = getLocalTable('course_reviews', INITIAL_COURSE_REVIEWS);
		const review = reviews.find((r) => r.id === reviewId);
		if (!review) throw new Error('Review not found.');

		review.is_reported = true;
		review.report_reason = reason;
		setLocalTable('course_reviews', reviews);
		return review;
	},

	// --- ENROLLMENTS & PAYMENTS ---
	async getEnrollments(userId) {
		const key = `enrollments_${userId}`;
		return getLocalTable(key, []);
	},

	async getPurchasedCourses(userId) {
		if (isSupabaseConfigured) {
			const { data, error } = await supabase
				.from('course_enrollments')
				.select(
					`
          id,
          course_id,
          enrolled_at,
          progress_percentage,
          courses:course_id (
            id,
            title,
            subtitle,
            mentor_id,
            thumbnail_url,
            category,
            level,
            profiles:mentor_id (full_name)
          ),
          payment_orders:payment_order_id (
            id,
            status
          )
        `
				)
				.eq('user_id', userId);

			if (!error && data && data.length > 0) {
				// Enforce: Never show unpaid, pending, failed, or cancelled purchases
				const valid = data.filter(
					(e) =>
						!e.payment_orders ||
						e.payment_orders.status === 'completed'
				);
				return valid.map((e) => ({
					id: e.courses.id,
					title: e.courses.title,
					subtitle: e.courses.subtitle,
					mentor_name:
						e.courses.profiles?.full_name || 'David Miller',
					thumbnail_url: e.courses.thumbnail_url,
					category: e.courses.category,
					level: e.courses.level,
					enrolled_at: e.enrolled_at,
					progress_percentage: e.progress_percentage || 0,
					enrollment_status: 'Active Enrollment',
				}));
			}
			return [];
		}

		// Local reactive store fallback
		const enrolledIds = await this.getEnrollments(userId);
		if (!enrolledIds || enrolledIds.length === 0) return [];

		const allCourses = await this.getCourses();
		const allOrders = getLocalTable('payment_orders', []);

		// Filter to only courses with completed status (or verified enrollment)
		const purchased = [];
		for (const courseId of enrolledIds) {
			const course = allCourses.find((c) => c.id === courseId);
			if (course) {
				const order = allOrders.find(
					(o) => o.courseId === courseId && o.userId === userId
				);
				if (order && order.status !== 'completed') {
					continue; // do not include failed or pending
				}
				const progress = await this.getCourseProgress(userId, courseId);
				purchased.push({
					...course,
					enrollment_status: 'Active Enrollment',
					progress_percentage: progress.progressPercentage || 25,
				});
			}
		}
		return purchased;
	},

	async enrollInCourse(userId, courseId, orderDetails = {}) {
		const key = `enrollments_${userId}`;
		const enrollments = getLocalTable(key, []);
		if (!enrollments.includes(courseId)) {
			enrollments.push(courseId);
			setLocalTable(key, enrollments);
		}

		// Record in course_enrollments table
		const courseEnrs = getLocalTable('course_enrollments', []);
		if (
			!courseEnrs.some(
				(e) => e.course_id === courseId && e.user_id === userId
			)
		) {
			courseEnrs.push({
				id: `cenr_${Date.now()}`,
				course_id: courseId,
				user_id: userId,
				enrolled_at: new Date().toISOString(),
				progress_percentage: 0,
			});
			setLocalTable('course_enrollments', courseEnrs);
		}

		// Record payment order
		const orders = getLocalTable('payment_orders', []);
		orders.unshift({
			id: `order_${Date.now()}`,
			userId,
			courseId,
			amount: orderDetails.amount || 1200,
			currency: orderDetails.currency || 'BDT',
			provider: orderDetails.provider || 'bkash',
			transactionId:
				orderDetails.trxId ||
				`TXN${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
			status: 'completed',
			createdAt: new Date().toISOString(),
		});
		setLocalTable('payment_orders', orders);

		// Notify student and mentor
		const course = await this.getCourseById(courseId);
		const profiles = await this.getAllProfiles();
		const student = profiles.find((p) => p.id === userId);

		await this.createNotification({
			userId,
			title: 'Course Enrollment Confirmed! 📚',
			message: `You now have full lifetime access to "${course?.title || 'Course'}". Start watching lessons anytime!`,
			type: 'success',
			link: `/courses`,
		});

		if (course?.mentor_id) {
			await this.createNotification({
				userId: course.mentor_id,
				title: 'New Course Sale! 💰',
				message: `${student?.full_name || 'A student'} enrolled in "${course.title}". Net earnings credited to your balance.`,
				type: 'success',
				link: `/mentor`,
			});
		}

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'course_enrollments',
			});
		}
		return true;
	},
};
