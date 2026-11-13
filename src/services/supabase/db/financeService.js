import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import {
	broadcastChannel,
	INITIAL_PLATFORM_FINANCIALS,
	INITIAL_MENTOR_WITHDRAWALS,
	getLocalTable,
	setLocalTable,
} from './dbCore.js';

export const financeService = {
	// --- MENTOR EARNINGS, WITHDRAWALS & PLATFORM FINANCIALS (SECTIONS 3, 15, 16) ---
	// ============================================================================

	// Get financial configuration
	async getPlatformFinancialSettings() {
		return getLocalTable(
			'platform_financials',
			INITIAL_PLATFORM_FINANCIALS
		);
	},

	async savePlatformFinancialSettings(settings, adminId = 'user_admin_1') {
		setLocalTable('platform_financials', settings);
		await this.logAudit(
			'update_financial_settings',
			'finance',
			'settings',
			settings,
			adminId
		);
		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'financial_settings_updated',
			});
		}
		return settings;
	},

	// Calculate comprehensive mentor financial metrics
	async getMentorEarnings(mentorId) {
		if (!mentorId) return null;

		const enrollments = getLocalTable('course_enrollments', []);
		const courses = getLocalTable('courses', []);
		const withdrawals = getLocalTable(
			'mentor_withdrawals',
			INITIAL_MENTOR_WITHDRAWALS
		);
		const settings = await this.getPlatformFinancialSettings();
		const commissionRate = (settings.commission_percentage || 20) / 100;

		// Filter courses owned by this mentor
		const mentorCourseIds = courses
			.filter((c) => c.mentor_id === mentorId)
			.map((c) => c.id);

		// Filter sales/enrollments for this mentor's courses
		const mentorEnrollments = enrollments.filter((e) =>
			mentorCourseIds.includes(e.course_id)
		);

		// Calculate total gross sales (in BDT)
		const grossSalesBdt = mentorEnrollments.reduce((acc, e) => {
			const course = courses.find((c) => c.id === e.course_id);
			return acc + (course?.price || 0);
		}, 0);

		// Platform commission (20%) and net earnings (80%)
		const platformCommissionBdt = Math.round(
			grossSalesBdt * commissionRate
		);
		const netEarningsBdt = grossSalesBdt - platformCommissionBdt;

		// Withdrawals by this mentor
		const mentorWithdrawals = withdrawals.filter(
			(w) => w.mentor_id === mentorId
		);

		// Total already paid out or approved
		const paidWithdrawalsBdt = mentorWithdrawals
			.filter((w) => w.status === 'approved' || w.status === 'paid')
			.reduce((acc, w) => acc + (w.amount || 0), 0);

		// Pending withdrawal requests currently under review
		const pendingWithdrawalsBdt = mentorWithdrawals
			.filter((w) => w.status === 'pending')
			.reduce((acc, w) => acc + (w.amount || 0), 0);

		// Current available balance that can be withdrawn
		const availableBalanceBdt = Math.max(
			0,
			netEarningsBdt - paidWithdrawalsBdt - pendingWithdrawalsBdt
		);

		return {
			mentorId,
			grossSalesBdt,
			platformCommissionBdt,
			commissionPercentage: settings.commission_percentage || 20,
			netEarningsBdt,
			paidWithdrawalsBdt,
			pendingWithdrawalsBdt,
			availableBalanceBdt,
			minimumPayoutThreshold: settings.minimum_payout_bdt || 500,
			totalStudentsEnrolled: mentorEnrollments.length,
			withdrawals: mentorWithdrawals.sort(
				(a, b) => new Date(b.requested_at) - new Date(a.requested_at)
			),
			recentSales: mentorEnrollments.slice(0, 10).map((e) => {
				const c = courses.find((course) => course.id === e.course_id);
				return {
					id: e.id,
					courseTitle: c?.title || 'English Masterclass',
					amount: c?.price || 0,
					mentorShare: Math.round(
						(c?.price || 0) * (1 - commissionRate)
					),
					enrolledAt:
						e.enrolled_at ||
						e.created_at ||
						new Date().toISOString(),
				};
			}),
		};
	},

	// Mentor submits a new payout withdrawal request
	async requestWithdrawal(
		mentorId,
		{ amount, method, accountNumber, accountDetails, notes = '' }
	) {
		if (!mentorId || !amount || amount <= 0) {
			throw new Error('Please enter a valid payout amount.');
		}

		const earnings = await this.getMentorEarnings(mentorId);
		if (amount > earnings.availableBalanceBdt) {
			throw new Error(
				`Insufficient available balance. You can withdraw up to ৳${earnings.availableBalanceBdt.toLocaleString()}.`
			);
		}

		if (amount < earnings.minimumPayoutThreshold) {
			throw new Error(
				`Minimum payout request threshold is ৳${earnings.minimumPayoutThreshold}.`
			);
		}

		if (!accountNumber || !method) {
			throw new Error(
				'Please provide payout method and valid account/wallet details.'
			);
		}

		const profiles = await this.getAllProfiles();
		const mentor = profiles.find((p) => p.id === mentorId);

		const withdrawals = getLocalTable(
			'mentor_withdrawals',
			INITIAL_MENTOR_WITHDRAWALS
		);
		const newRequest = {
			id: `wdr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			mentor_id: mentorId,
			mentor_name: mentor?.full_name || 'Mentor',
			mentor_email: mentor?.email || '',
			amount: Math.round(amount),
			payment_method: method, // 'bkash' | 'nagad' | 'bank'
			account_number: accountNumber.trim(),
			account_details: accountDetails || '',
			status: 'pending',
			transaction_ref: '',
			requested_at: new Date().toISOString(),
			processed_at: null,
			notes: notes || 'Withdrawal requested',
		};

		withdrawals.unshift(newRequest);
		setLocalTable('mentor_withdrawals', withdrawals);

		await this.logAudit(
			'mentor_withdrawal_requested',
			'finance',
			newRequest.id,
			{
				amount,
				method,
				accountNumber: accountNumber.replace(/\d(?=\d{4})/g, '*'),
			},
			mentorId
		);

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'withdrawal_status_updated',
				mentorId,
			});
		}

		return newRequest;
	},

	// Admin: View all withdrawal requests
	async getAllWithdrawalsAdmin() {
		const withdrawals = getLocalTable(
			'mentor_withdrawals',
			INITIAL_MENTOR_WITHDRAWALS
		);
		return withdrawals.sort(
			(a, b) => new Date(b.requested_at) - new Date(a.requested_at)
		);
	},

	// Admin: Approve and record payout reference
	async adminApproveWithdrawal(
		withdrawalId,
		transactionRef = '',
		adminId = 'user_admin_1'
	) {
		const withdrawals = getLocalTable(
			'mentor_withdrawals',
			INITIAL_MENTOR_WITHDRAWALS
		);
		const idx = withdrawals.findIndex((w) => w.id === withdrawalId);
		if (idx === -1) throw new Error('Withdrawal request not found.');

		const w = withdrawals[idx];
		w.status = 'approved';
		w.transaction_ref = transactionRef || `TXN${Date.now()}`;
		w.processed_at = new Date().toISOString();
		w.notes = 'Approved & disbursed by Administrator';

		withdrawals[idx] = w;
		setLocalTable('mentor_withdrawals', withdrawals);

		await this.logAudit(
			'admin_approve_withdrawal',
			'finance',
			withdrawalId,
			{ amount: w.amount, ref: w.transaction_ref },
			adminId
		);

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'withdrawal_status_updated',
				mentorId: w.mentor_id,
			});
		}

		return w;
	},

	// Admin: Reject withdrawal request and restore available balance
	async adminRejectWithdrawal(
		withdrawalId,
		reason = 'Account details mismatched',
		adminId = 'user_admin_1'
	) {
		const withdrawals = getLocalTable(
			'mentor_withdrawals',
			INITIAL_MENTOR_WITHDRAWALS
		);
		const idx = withdrawals.findIndex((w) => w.id === withdrawalId);
		if (idx === -1) throw new Error('Withdrawal request not found.');

		const w = withdrawals[idx];
		w.status = 'rejected';
		w.notes = reason || 'Rejected by Administrator';
		w.processed_at = new Date().toISOString();

		withdrawals[idx] = w;
		setLocalTable('mentor_withdrawals', withdrawals);

		await this.logAudit(
			'admin_reject_withdrawal',
			'finance',
			withdrawalId,
			{ reason },
			adminId
		);

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'withdrawal_status_updated',
				mentorId: w.mentor_id,
			});
		}

		return w;
	},

	// Overall platform financials summary for Admin Dashboard
	async getPlatformFinancialSummary() {
		const courses = getLocalTable('courses', []);
		const enrollments = getLocalTable('course_enrollments', []);
		const withdrawals = getLocalTable(
			'mentor_withdrawals',
			INITIAL_MENTOR_WITHDRAWALS
		);
		const settings = await this.getPlatformFinancialSettings();
		const commissionRate = (settings.commission_percentage || 20) / 100;

		let totalGrossSalesBdt = 0;
		enrollments.forEach((e) => {
			const c = courses.find((course) => course.id === e.course_id);
			if (c?.price) totalGrossSalesBdt += c.price;
		});

		const platformCommissionBdt = Math.round(
			totalGrossSalesBdt * commissionRate
		);
		const mentorNetPoolBdt = totalGrossSalesBdt - platformCommissionBdt;

		const totalDisbursedBdt = withdrawals
			.filter((w) => w.status === 'approved' || w.status === 'paid')
			.reduce((acc, w) => acc + (w.amount || 0), 0);

		const pendingPayoutRequests = withdrawals.filter(
			(w) => w.status === 'pending'
		);
		const totalPendingPayoutBdt = pendingPayoutRequests.reduce(
			(acc, w) => acc + (w.amount || 0),
			0
		);

		return {
			totalGrossSalesBdt,
			platformCommissionBdt,
			mentorNetPoolBdt,
			totalDisbursedBdt,
			totalPendingPayoutBdt,
			pendingPayoutCount: pendingPayoutRequests.length,
			commissionPercentage: settings.commission_percentage || 20,
			withdrawals: withdrawals.slice(0, 20),
		};
	},

	// Order payment record helper (called upon SSLCommerz / gateway completion)
	async recordOrderPayment({
		orderId,
		courseId,
		studentId,
		amountBdt,
		paymentMethod = 'sslcommerz',
		transactionRef = '',
	}) {
		const orders = getLocalTable('payment_orders', []);
		const exists = orders.find(
			(o) =>
				o.order_id === orderId ||
				(transactionRef && o.transaction_ref === transactionRef)
		);
		if (exists) {
			return exists; // Idempotent: prevent duplicate processing
		}

		const newOrder = {
			id: `ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			order_id: orderId || `SM-${Date.now()}`,
			course_id: courseId,
			student_id: studentId,
			amount: amountBdt,
			currency: 'BDT',
			payment_method: paymentMethod,
			transaction_ref: transactionRef || `SSL_${Date.now()}`,
			status: 'completed',
			created_at: new Date().toISOString(),
		};

		orders.unshift(newOrder);
		setLocalTable('payment_orders', orders);

		// Auto-enroll user if not already enrolled
		if (courseId && studentId) {
			await this.enrollInCourse(studentId, courseId);
		}

		await this.logAudit('order_payment_completed', 'order', newOrder.id, {
			amount: amountBdt,
			method: paymentMethod,
			courseId,
			studentId,
		});

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'table_update',
				table: 'payment_orders',
			});
		}

		return newOrder;
	},

	async getUserPaymentOrders(userId) {
		if (!userId) return [];
		if (isSupabaseConfigured) {
			const { data, error } = await supabase
				.from('payment_orders')
				.select('*')
				.eq('user_id', userId)
				.order('created_at', { ascending: false });
			if (!error && data) return data;
		}
		const orders = getLocalTable('payment_orders', []);
		return orders.filter(
			(o) => o.student_id === userId || o.user_id === userId
		);
	},

	async getAllPaymentOrders() {
		if (isSupabaseConfigured) {
			const { data, error } = await supabase
				.from('payment_orders')
				.select('*')
				.order('created_at', { ascending: false });
			if (!error && data) return data;
		}
		return getLocalTable('payment_orders', []);
	},

	// ============================================================================

	// --- REFUNDS & PAYMENT MANAGEMENT (Admin) ---
	async getRefunds() {
		return getLocalTable('payment_refunds', []);
	},

	async processRefund({ orderId, reason, adminId }) {
		const refunds = getLocalTable('payment_refunds', []);
		const orders = await this.getAllOrders();
		const order = orders.find((o) => o.order_id === orderId);

		const newRefund = {
			id: `ref_${Date.now()}`,
			order_id: orderId,
			student_name: order?.student_name || 'Enrolled Student',
			course_title: order?.course_title || 'Course / Workshop',
			amount_bdt: order?.amount_bdt || 0,
			reason,
			status: 'completed',
			processed_at: new Date().toISOString(),
		};
		refunds.unshift(newRefund);
		setLocalTable('payment_refunds', refunds);

		await this.logAudit(
			'PROCESS_REFUND',
			'order',
			orderId,
			{ amount_bdt: newRefund.amount_bdt, reason },
			adminId
		);
		return newRefund;
	},
};
