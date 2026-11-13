import {
	INITIAL_USER_BLOCKS,
	INITIAL_FEEDBACK_REVIEWS,
	getLocalTable,
	setLocalTable,
} from './dbCore.js';

export const adminService = {
	// --- PLATFORM SETTINGS ---
	async getPlatformSettings() {
		return getLocalTable('platform_settings', {
			daily_free_minutes: { minutes: 20 },
			matching_timeout_seconds: { seconds: 15 },
			max_classroom_attendees: { limit: 50 },
			max_active_mics_open_discussion: { limit: 10 },
			payment_gateways: { bkash: true, nagad: true, sslcommerz: true },
		});
	},

	async savePlatformSettings(newSettings) {
		setLocalTable('platform_settings', newSettings);
	},

	// --- USER REPORTS & BLOCKS ---
	async reportUser(reportData) {
		const reports = getLocalTable('user_reports', []);
		reports.unshift({
			id: `rep_${Date.now()}`,
			...reportData,
			status: 'pending',
			createdAt: new Date().toISOString(),
		});
		setLocalTable('user_reports', reports);
		return true;
	},

	async getReports() {
		return getLocalTable('user_reports', []);
	},

	// ============================================================================

	// --- COMMUNITY SAFETY: BLOCKING & REVIEWS (SECTIONS 12 & 14) ---
	// ============================================================================

	async blockUser(blockerId, blockedId) {
		const blocks = getLocalTable('user_blocks', INITIAL_USER_BLOCKS);
		if (
			!blocks.some(
				(b) =>
					(b.blockerId === blockerId || b.user_id === blockerId) &&
					(b.blockedId === blockedId ||
						b.blocked_user_id === blockedId)
			)
		) {
			blocks.push({
				blockerId,
				blockedId,
				user_id: blockerId,
				blocked_user_id: blockedId,
				createdAt: new Date().toISOString(),
			});
			setLocalTable('user_blocks', blocks);
		}
	},

	async getBlockedUserIds(userId) {
		if (!userId) return [];
		const blocks = getLocalTable('user_blocks', INITIAL_USER_BLOCKS);
		return blocks
			.filter((b) => b.blockerId === userId || b.user_id === userId)
			.map((b) => b.blockedId || b.blocked_user_id);
	},

	async isUserBlocked(userA, userB) {
		if (!userA || !userB) return false;
		const blocks = getLocalTable('user_blocks', INITIAL_USER_BLOCKS);
		return blocks.some(
			(b) =>
				((b.blockerId === userA || b.user_id === userA) &&
					(b.blockedId === userB || b.blocked_user_id === userB)) ||
				((b.blockerId === userB || b.user_id === userB) &&
					(b.blockedId === userA || b.blocked_user_id === userA))
		);
	},

	async unblockUser(userId, blockedUserId) {
		const blocks = getLocalTable('user_blocks', INITIAL_USER_BLOCKS);
		const filtered = blocks.filter(
			(b) =>
				!(
					(b.blockerId === userId || b.user_id === userId) &&
					(b.blockedId === blockedUserId ||
						b.blocked_user_id === blockedUserId)
				)
		);
		setLocalTable('user_blocks', filtered);
		return true;
	},

	// Feedback and Ratings
	async submitFeedback({
		userId,
		targetId,
		targetType = 'course',
		rating = 5,
		comment = '',
	}) {
		const reviews = getLocalTable(
			'feedback_reviews',
			INITIAL_FEEDBACK_REVIEWS
		);
		const profiles = await this.getAllProfiles();
		const user = profiles.find((p) => p.id === userId);

		const newFeedback = {
			id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			user_id: userId,
			user_name: user?.full_name || 'Member',
			target_id: targetId,
			target_type: targetType,
			rating: Math.max(1, Math.min(5, Number(rating))),
			comment: (comment || '').trim(),
			created_at: new Date().toISOString(),
		};

		reviews.unshift(newFeedback);
		setLocalTable('feedback_reviews', reviews);
		return newFeedback;
	},

	async getFeedback(targetId, targetType = 'course') {
		const reviews = getLocalTable(
			'feedback_reviews',
			INITIAL_FEEDBACK_REVIEWS
		);
		return reviews.filter(
			(r) => r.target_id === targetId && r.target_type === targetType
		);
	},

	// Audit Logging
	async logAudit(
		action,
		entityType,
		entityId,
		metadata = {},
		actorId = 'system'
	) {
		const logs = getLocalTable('audit_logs', []);
		const entry = {
			id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			action,
			entity_type: entityType,
			entity_id: entityId,
			metadata,
			actor_id: actorId,
			created_at: new Date().toISOString(),
		};
		logs.unshift(entry);
		setLocalTable('audit_logs', logs.slice(0, 100)); // retain latest 100 logs
		return entry;
	},

	async getAuditLogs() {
		return getLocalTable('audit_logs', []);
	},

	// --- PLATFORM ANNOUNCEMENTS (Role-Targeted Broadcasts) ---
	async getAnnouncements(targetRole = 'all') {
		const announcements = getLocalTable('platform_announcements', []);
		return announcements.filter(
			(a) =>
				a.target_role === 'all' ||
				a.target_role === targetRole ||
				targetRole === 'admin'
		);
	},

	async createAnnouncement({
		title,
		message,
		targetRole = 'all',
		createdBy,
	}) {
		const announcements = getLocalTable('platform_announcements', []);
		const entry = {
			id: `ann_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			title,
			message,
			target_role: targetRole,
			created_by: createdBy,
			created_at: new Date().toISOString(),
			is_active: true,
		};
		announcements.unshift(entry);
		setLocalTable('platform_announcements', announcements);
		await this.logAudit(
			'CREATE_ANNOUNCEMENT',
			'announcement',
			entry.id,
			{ title, targetRole },
			createdBy
		);
		return entry;
	},

	// --- ADMIN OVERVIEW STATS (Real Database Aggregations) ---
	async getAdminOverviewStats() {
		const profiles = await this.getAllProfiles();
		const classes = await this.getLiveClasses();
		const courses = await this.getCourses();
		const reports = await this.getReports();
		const withdrawals = await this.getAllWithdrawalsAdmin();
		const financials = await this.getPlatformFinancialSummary();

		const students = profiles.filter((p) => p.role === 'student');
		const mentors = profiles.filter((p) => p.role === 'mentor');
		const pendingMentors = mentors.filter((m) => m.status === 'pending');
		const liveClassrooms = classes.filter((c) => c.status === 'live');
		const pendingCourses = courses.filter(
			(c) => c.approval_status === 'pending_review'
		);
		const pendingWithdrawals = withdrawals.filter(
			(w) => w.status === 'pending'
		);

		return {
			totalStudents: students.length,
			totalMentors: mentors.length,
			pendingMentorApprovals: pendingMentors.length,
			totalCourses: courses.length,
			pendingCourseApprovals: pendingCourses.length,
			liveClassrooms: liveClassrooms.length,
			verifiedPaymentTotalsBdt: financials?.totalGrossSalesBdt || 0,
			pendingWithdrawalRequests: pendingWithdrawals.length,
			recentReportsCount: reports.length,
			totalClasses: classes.length,
			commissionBdt: financials?.platformCommissionBdt || 0,
		};
	},
};
