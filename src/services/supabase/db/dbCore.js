// Shared helpers for all db services (local-storage fallback tables, Dhaka date helpers)

export const STORAGE_KEY_PREFIX = 'saybd_db_';
export const broadcastChannel =
	typeof window !== 'undefined' && 'BroadcastChannel' in window
		? new BroadcastChannel('saybd_events')
		: null;

// Real production dataset: zero dummy users or mock records
export const INITIAL_PROFILES = [];

export const INITIAL_MENTORS = [];
export const INITIAL_CLASSES = [];

export const INITIAL_CLASS_ENROLLMENTS = [];
export const INITIAL_CLASS_ATTENDANCE = [];

export const INITIAL_COURSES = [];
export const INITIAL_COURSE_REVIEWS = [];
export const INITIAL_LESSON_PROGRESS = [];

export const INITIAL_PLATFORM_FINANCIALS = {
	commission_percentage: 20, // 20% SayBD commission, 80% Mentor Net Earnings
	minimum_payout_bdt: 500, // 500 BDT minimum withdrawal threshold
	supported_payout_methods: ['bkash', 'nagad', 'bank'],
	currency: 'BDT',
};

export const INITIAL_MENTOR_WITHDRAWALS = [];
export const INITIAL_USER_BLOCKS = [];
export const INITIAL_FEEDBACK_REVIEWS = [];

// Helper to get or set local database tables
export function getLocalTable(table, initialData = []) {
	if (typeof window === 'undefined') return initialData;
	const raw =
		localStorage.getItem('saybd_db_' + table) ||
		localStorage.getItem('speakmate_db_' + table);
	if (!raw) {
		localStorage.setItem(
			STORAGE_KEY_PREFIX + table,
			JSON.stringify(initialData)
		);
		return initialData;
	}
	try {
		return JSON.parse(raw);
	} catch {
		return initialData;
	}
}

export function setLocalTable(table, data) {
	if (typeof window === 'undefined') return;
	localStorage.setItem(STORAGE_KEY_PREFIX + table, JSON.stringify(data));
	if (broadcastChannel) {
		broadcastChannel.postMessage({
			type: 'table_update',
			table,
			timestamp: Date.now(),
		});
	}
}

// Today's date string in Asia/Dhaka timezone (YYYY-MM-DD)
export function getDhakaDateString() {
	try {
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone: 'Asia/Dhaka',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		});
		return formatter.format(new Date());
	} catch {
		return new Date().toISOString().split('T')[0];
	}
}

export function getDhakaMonthName(date = new Date()) {
	try {
		return new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Dhaka',
			month: 'long',
		}).format(date);
	} catch {
		return 'Current Month';
	}
}

export function getDhakaYear(date = new Date()) {
	try {
		return new Intl.DateTimeFormat('en-US', {
			timeZone: 'Asia/Dhaka',
			year: 'numeric',
		}).format(date);
	} catch {
		return String(new Date().getFullYear());
	}
}

// Real historical call usage: returns empty array, only recorded from actual sessions
export function generateInitialCallUsage() {
	return [];
}
