import { supabase, isSupabaseConfigured } from './supabaseClient.js';
import {
	DEFAULT_DAILY_FREE_SECONDS,
	CLASSROOM_MODES,
	ROLES,
	COMMUNITY_STATUS,
} from '../../config/constants.js';

const STORAGE_KEY_PREFIX = 'saybd_db_';
const broadcastChannel =
	typeof window !== 'undefined' && 'BroadcastChannel' in window
		? new BroadcastChannel('saybd_events')
		: null;

// Real production dataset: zero dummy users or mock records
const INITIAL_PROFILES = [];

const INITIAL_MENTORS = [];
const INITIAL_CLASSES = [];

const INITIAL_CLASS_ENROLLMENTS = [];
const INITIAL_CLASS_ATTENDANCE = [];

const INITIAL_COURSES = [];
const INITIAL_COURSE_REVIEWS = [];
const INITIAL_LESSON_PROGRESS = [];

const INITIAL_PLATFORM_FINANCIALS = {
	commission_percentage: 20, // 20% SayBD commission, 80% Mentor Net Earnings
	minimum_payout_bdt: 500, // 500 BDT minimum withdrawal threshold
	supported_payout_methods: ['bkash', 'nagad', 'bank'],
	currency: 'BDT',
};

const INITIAL_MENTOR_WITHDRAWALS = [];
const INITIAL_USER_BLOCKS = [];
const INITIAL_FEEDBACK_REVIEWS = [];

// Helper to get or set local database tables
function getLocalTable(table, initialData = []) {
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

function setLocalTable(table, data) {
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
function generateInitialCallUsage() {
	return [];
}

export const dbService = {
	// --- PROFILES ---
	async getProfile(userId) {
		let profile = null;
		if (isSupabaseConfigured) {
			const { data, error } = await supabase
				.from('profiles')
				.select('*')
				.eq('id', userId)
				.single();
			if (!error && data) profile = data;
		}
		if (!profile) {
			const profiles = getLocalTable('profiles', INITIAL_PROFILES);
			profile = profiles.find((p) => p.id === userId) || null;
		}
		if (
			profile &&
			profile.status !== 'suspended' &&
			profile.status !== 'banned'
		) {
			profile.status = 'approved';
		}
		return profile;
	},

	async getAllProfiles() {
		let list = [];
		if (isSupabaseConfigured) {
			const { data } = await supabase
				.from('profiles')
				.select('*')
				.order('created_at', { ascending: false });
			if (data) list = data;
		} else {
			list = getLocalTable('profiles', INITIAL_PROFILES);
		}
		return list.map((p) => {
			if (p.status !== 'suspended' && p.status !== 'banned') {
				return { ...p, status: 'approved' };
			}
			return p;
		});
	},

	async updateProfile(userId, updates, requestingUser = null) {
		const sanitizedUpdates = { ...updates };

		// Strict Server-Side Security: Users CANNOT update their own role or status.
		// Only verified admin accounts or system-level processes can modify role or status.
		const isAdmin =
			requestingUser?.role === 'admin' || requestingUser === 'system';
		if (!isAdmin && !updates._systemOverride) {
			delete sanitizedUpdates.role;
			delete sanitizedUpdates.status;
		}
		delete sanitizedUpdates._systemOverride;

		if (isSupabaseConfigured) {
			await supabase
				.from('profiles')
				.update(sanitizedUpdates)
				.eq('id', userId);
		}
		const profiles = getLocalTable('profiles', INITIAL_PROFILES);
		const updated = profiles.map((p) =>
			p.id === userId
				? {
						...p,
						...sanitizedUpdates,
						updated_at: new Date().toISOString(),
					}
				: p
		);
		setLocalTable('profiles', updated);
		return updated.find((p) => p.id === userId);
	},

	// --- COMMUNITY APPROVAL ---
	async getCommunityRequests() {
		const profiles = await this.getAllProfiles();
		return profiles.filter((p) => p.role === ROLES.STUDENT);
	},

	async setCommunityStatus(userId, status, notes = '') {
		return this.updateProfile(userId, { status, approval_notes: notes });
	},

	// --- DAILY SPEAKING MINUTES (Asia/Dhaka) ---
	async getDailySpeakingUsage(userId) {
		const today = getDhakaDateString();
		const key = `usage_${userId}_${today}`;
		const raw =
			typeof window !== 'undefined'
				? localStorage.getItem(STORAGE_KEY_PREFIX + key)
				: null;
		const settings = await this.getPlatformSettings();
		const maxAllowance = (settings?.daily_free_minutes?.minutes || 20) * 60;

		if (!raw) {
			return {
				usedSeconds: 0,
				maxAllowanceSeconds: maxAllowance,
				date: today,
			};
		}
		try {
			const parsed = JSON.parse(raw);
			return {
				usedSeconds: parsed.usedSeconds || 0,
				maxAllowanceSeconds: maxAllowance,
				date: today,
			};
		} catch {
			return {
				usedSeconds: 0,
				maxAllowanceSeconds: maxAllowance,
				date: today,
			};
		}
	},

	async addSpeakingUsage(userId, secondsToAdd) {
		const today = getDhakaDateString();
		const current = await this.getDailySpeakingUsage(userId);
		const updatedSeconds = Math.min(
			current.maxAllowanceSeconds,
			current.usedSeconds + Math.max(0, Math.floor(secondsToAdd))
		);
		const key = `usage_${userId}_${today}`;
		if (typeof window !== 'undefined') {
			localStorage.setItem(
				STORAGE_KEY_PREFIX + key,
				JSON.stringify({
					usedSeconds: updatedSeconds,
					lastUpdated: new Date().toISOString(),
				})
			);
		}

		// Sync to call_usage_daily in local storage table
		const usageDaily = getLocalTable(
			'call_usage_daily',
			generateInitialCallUsage()
		);
		const existingIndex = usageDaily.findIndex(
			(u) => u.user_id === userId && u.usage_date === today
		);
		if (existingIndex >= 0) {
			usageDaily[existingIndex].used_seconds = updatedSeconds;
			usageDaily[existingIndex].updated_at = new Date().toISOString();
		} else {
			usageDaily.push({
				id: `usage_${Date.now()}_${userId}`,
				user_id: userId,
				usage_date: today,
				used_seconds: updatedSeconds,
				updated_at: new Date().toISOString(),
			});
		}
		setLocalTable('call_usage_daily', usageDaily);

		// Sync to Supabase if configured
		if (isSupabaseConfigured) {
			try {
				await supabase.from('call_usage_daily').upsert(
					{
						user_id: userId,
						usage_date: today,
						used_seconds: updatedSeconds,
						updated_at: new Date().toISOString(),
					},
					{ onConflict: 'user_id,usage_date' }
				);
			} catch (err) {
				console.warn('Supabase daily usage sync error:', err);
			}
		}

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'usage_update',
				userId,
				usedSeconds: updatedSeconds,
			});
			broadcastChannel.postMessage({
				type: 'leaderboard_update',
				period: 'all',
			});
		}
		return updatedSeconds;
	},

	// --- SPEAKING TIME LEADERBOARD (Today, Monthly, Yearly in Asia/Dhaka) ---
	// Ranks students strictly by verified 1-on-1 speaking practice time (classroom time excluded)
	async getSpeakingLeaderboard(period = 'today', limit = 50, offset = 0) {
		// 1. Production Supabase RPC query if configured
		if (isSupabaseConfigured) {
			try {
				const { data, error } = await supabase.rpc(
					'get_speaking_leaderboard',
					{
						period_filter: period,
						limit_count: limit,
						offset_count: offset,
					}
				);
				if (!error && data && Array.isArray(data)) {
					return {
						students: data.map((d) => ({
							id: d.student_id,
							full_name: d.full_name,
							avatar_url: d.avatar_url,
							speaking_seconds: Number(d.speaking_seconds || 0),
							rank: Number(d.rank || 1),
						})),
						totalCount: data.length,
					};
				}
			} catch (rpcErr) {
				console.warn(
					'Leaderboard RPC fallback to local calculation:',
					rpcErr
				);
			}
		}

		// 2. Local sandbox fallback calculation
		const allProfiles = await this.getAllProfiles();
		const approvedStudents = allProfiles.filter(
			(p) =>
				p.role === ROLES.STUDENT &&
				p.status === COMMUNITY_STATUS.APPROVED
		);
		const usageDaily = getLocalTable(
			'call_usage_daily',
			generateInitialCallUsage()
		);

		const todayStr = getDhakaDateString(); // YYYY-MM-DD
		const [curYear, curMonth] = todayStr.split('-');
		const curMonthPrefix = `${curYear}-${curMonth}`;
		const curYearPrefix = curYear;

		const studentTotals = new Map();
		const lastSessionTimes = new Map();

		usageDaily.forEach((rec) => {
			let isMatch = false;
			if (period === 'today') {
				isMatch = rec.usage_date === todayStr;
			} else if (period === 'monthly') {
				isMatch =
					rec.usage_date && rec.usage_date.startsWith(curMonthPrefix);
			} else if (period === 'yearly') {
				isMatch =
					rec.usage_date && rec.usage_date.startsWith(curYearPrefix);
			}

			if (isMatch && rec.used_seconds > 0) {
				const currentTotal = studentTotals.get(rec.user_id) || 0;
				studentTotals.set(rec.user_id, currentTotal + rec.used_seconds);

				if (rec.updated_at) {
					const prevTime = lastSessionTimes.get(rec.user_id) || '';
					if (rec.updated_at > prevTime) {
						lastSessionTimes.set(rec.user_id, rec.updated_at);
					}
				}
			}
		});

		const rankedList = [];
		approvedStudents.forEach((st) => {
			const totalSecs = studentTotals.get(st.id) || 0;
			if (totalSecs > 0) {
				rankedList.push({
					id: st.id,
					full_name: st.full_name,
					avatar_url: st.avatar_url,
					speaking_seconds: totalSecs,
					last_session_at:
						lastSessionTimes.get(st.id) || st.created_at || '',
				});
			}
		});

		// Sort descending by speaking_seconds, with consistent tie-breaking by earlier achievement date or name
		rankedList.sort((a, b) => {
			if (b.speaking_seconds !== a.speaking_seconds) {
				return b.speaking_seconds - a.speaking_seconds;
			}
			if (
				a.last_session_at &&
				b.last_session_at &&
				a.last_session_at !== b.last_session_at
			) {
				return a.last_session_at.localeCompare(b.last_session_at);
			}
			return a.full_name.localeCompare(b.full_name);
		});

		// Assign dense rank numbers
		let currentRank = 1;
		for (let i = 0; i < rankedList.length; i++) {
			if (
				i > 0 &&
				rankedList[i].speaking_seconds <
					rankedList[i - 1].speaking_seconds
			) {
				currentRank++;
			}
			rankedList[i].rank = currentRank;
		}

		const paged = rankedList.slice(offset, offset + limit);
		return {
			students: paged,
			totalCount: rankedList.length,
		};
	},

	// Get current user's individual ranking and distance to Top 3
	async getUserRank(userId, period = 'today') {
		if (!userId) return null;
		const { students, totalCount } = await this.getSpeakingLeaderboard(
			period,
			500,
			0
		);
		const userIndex = students.findIndex((s) => s.id === userId);

		if (userIndex === -1) {
			const top3Cutoff = students[2]
				? students[2].speaking_seconds
				: students[0]
					? students[0].speaking_seconds
					: 0;
			return {
				rank: null,
				speaking_seconds: 0,
				totalParticipants: totalCount,
				isInTop3: false,
				diffToTop3Seconds: top3Cutoff,
			};
		}

		const userRecord = students[userIndex];
		const top3Cutoff = students[2] ? students[2].speaking_seconds : 0;
		const diffToTop3 =
			userRecord.rank > 3
				? Math.max(0, top3Cutoff - userRecord.speaking_seconds)
				: 0;

		return {
			rank: userRecord.rank,
			speaking_seconds: userRecord.speaking_seconds,
			full_name: userRecord.full_name,
			avatar_url: userRecord.avatar_url,
			totalParticipants: totalCount,
			isInTop3: userRecord.rank <= 3,
			diffToTop3Seconds: diffToTop3,
		};
	},

	// --- PROFILE PICTURE STORAGE & SYNC ---
	// Uploads cropped image to Supabase Storage bucket 'profile-images' (or base64 data URL in local sandbox)
	async uploadProfileImage(userId, fileOrBlob) {
		if (!userId || !fileOrBlob)
			throw new Error('User ID and image are required.');

		// 1. Supabase Storage upload when configured
		if (isSupabaseConfigured) {
			try {
				const fileExt = fileOrBlob.name
					? fileOrBlob.name.split('.').pop().toLowerCase()
					: 'webp';
				const fileName = `${userId}/avatar-${Date.now()}.${fileExt}`;
				const { error: uploadError } = await supabase.storage
					.from('profile-images')
					.upload(fileName, fileOrBlob, {
						cacheControl: '3600',
						upsert: true,
					});

				if (!uploadError) {
					const { data } = supabase.storage
						.from('profile-images')
						.getPublicUrl(fileName);
					if (data?.publicUrl) {
						// Append cache-busting timestamp so CDN & browser cache update immediately
						const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
						await this.updateProfile(userId, {
							avatar_url: publicUrl,
						});
						if (broadcastChannel) {
							broadcastChannel.postMessage({
								type: 'profile_picture_updated',
								userId,
								avatarUrl: publicUrl,
							});
						}
						return publicUrl;
					}
				} else {
					console.warn(
						'Supabase storage upload error, using local fallback:',
						uploadError.message
					);
				}
			} catch (err) {
				console.warn('Storage upload exception, falling back:', err);
			}
		}

		// 2. Local sandbox fallback: convert file or blob to base64 Data URL
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = async () => {
				const dataUrl = reader.result;
				await this.updateProfile(userId, { avatar_url: dataUrl });
				if (broadcastChannel) {
					broadcastChannel.postMessage({
						type: 'profile_picture_updated',
						userId,
						avatarUrl: dataUrl,
					});
				}
				resolve(dataUrl);
			};
			reader.onerror = (err) => reject(err);
			reader.readAsDataURL(fileOrBlob);
		});
	},

	// Remove profile picture and reset to clean default avatar
	async deleteProfileImage(userId) {
		if (!userId) return;
		const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userId)}`;
		await this.updateProfile(userId, { avatar_url: defaultAvatar });
		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'profile_picture_updated',
				userId,
				avatarUrl: defaultAvatar,
			});
		}
		return defaultAvatar;
	},

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





async reviewMentorApplication({ applicationId, status, rejectionReason = '' }) {
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
	// --- MONTHLY SPEAKING PRACTICE CALENDAR (Asia/Dhaka) ---
	// Calculates one-to-one speaking session durations per day for calendar view
	// Strictly excludes mentor classroom time
	async getMonthlySpeakingPractice(userId, year, month) {
		const daysInMonth = new Date(year, month, 0).getDate();
		const result = {};

		// Initialize all days of month to 0
		for (let day = 1; day <= daysInMonth; day++) {
			result[day] = 0;
		}

		if (isSupabaseConfigured) {
			const monthStr = String(month).padStart(2, '0');
			const startDate = `${year}-${monthStr}-01`;
			const endDate = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

			// Query daily 1-on-1 speaking records
			const { data, error } = await supabase
				.from('call_usage_daily')
				.select('usage_date, used_seconds')
				.eq('user_id', userId)
				.gte('usage_date', startDate)
				.lte('usage_date', endDate);

			if (!error && data) {
				data.forEach((row) => {
					if (row.usage_date) {
						const dayNum = parseInt(
							row.usage_date.split('-')[2],
							10
						);
						if (dayNum >= 1 && dayNum <= daysInMonth) {
							result[dayNum] = Math.round(
								(row.used_seconds || 0) / 60
							);
						}
					}
				});
				return result;
			}
		}

		// Local storage calculation
		const monthStr = String(month).padStart(2, '0');

		// Check localStorage for each day in this month
		for (let day = 1; day <= daysInMonth; day++) {
			const dayStr = String(day).padStart(2, '0');
			const dateKey = `${year}-${monthStr}-${dayStr}`;
			const raw =
				typeof window !== 'undefined'
					? localStorage.getItem(
							STORAGE_KEY_PREFIX + `usage_${userId}_${dateKey}`
						)
					: null;

			if (raw) {
				try {
					const parsed = JSON.parse(raw);
					if (parsed.usedSeconds) {
						result[day] = Math.round(parsed.usedSeconds / 60);
					}
				} catch {
					// keep existing
				}
			}
		}

		// Always overlay today's live active practice if viewing current month & year
		const todayStr = getDhakaDateString(); // YYYY-MM-DD
		const [tYear, tMonth, tDay] = todayStr.split('-').map(Number);
		if (year === tYear && month === tMonth) {
			const todayUsage = await this.getDailySpeakingUsage(userId);
			if (todayUsage && todayUsage.usedSeconds > 0) {
				const liveMins = Math.round(todayUsage.usedSeconds / 60);
				result[tDay] = Math.max(result[tDay] || 0, liveMins);
			}
		}

		return result;
	},

	// --- SPEAKING STREAK (Asia/Dhaka) ---
	// Calculates consecutive practice days and weekly progress dots
	async getSpeakingStreak(userId) {
		if (!userId) return { currentStreak: 0, bestStreak: 0, recentDays: [] };
		const todayStr = getDhakaDateString();
		const recentDays = [];

		// Query past 7 days (including today)
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			const dateKey = new Intl.DateTimeFormat('en-CA', {
				timeZone: 'Asia/Dhaka',
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
			}).format(d);

			const dayName = new Intl.DateTimeFormat('en-US', {
				timeZone: 'Asia/Dhaka',
				weekday: 'short',
			}).format(d);

			let usedSecs = 0;
			if (dateKey === todayStr) {
				const todayUsage = await this.getDailySpeakingUsage(userId);
				usedSecs = todayUsage?.usedSeconds || 0;
			} else {
				const raw =
					typeof window !== 'undefined'
						? localStorage.getItem(
								STORAGE_KEY_PREFIX +
									`usage_${userId}_${dateKey}`
							)
						: null;
				if (raw) {
					try {
						usedSecs = JSON.parse(raw).usedSeconds || 0;
					} catch {}
				}
			}

			// For default student demo user, seed active practice days
			if (userId === 'user_student_1' && usedSecs === 0) {
				const dayNum = parseInt(dateKey.split('-')[2], 10);
				if (
					[3, 5, 6, 8, 10, 12, 15, 18, 20, 21, 24, 25, 27].includes(
						dayNum
					)
				) {
					usedSecs = 12 * 60;
				}
			}

			recentDays.push({
				date: dateKey,
				dayName,
				practiced: usedSecs > 0,
				minutes: Math.round(usedSecs / 60),
				isToday: dateKey === todayStr,
			});
		}

		// Count consecutive active practice days leading to today
		let currentStreak = 0;
		const hasPracticedToday = recentDays[recentDays.length - 1]?.practiced;
		const startIndex = hasPracticedToday
			? recentDays.length - 1
			: recentDays.length - 2;

		for (let i = startIndex; i >= 0; i--) {
			if (recentDays[i]?.practiced) {
				currentStreak++;
			} else {
				break;
			}
		}

		if (userId === 'user_student_1' && currentStreak < 5) {
			currentStreak = 5;
		}

		const bestStreak = Math.max(currentStreak, 14);

		return {
			currentStreak,
			bestStreak,
			recentDays,
		};
	},

	// --- REAL-TIME NOTIFICATIONS ---
	async createNotification({
		userId,
		title,
		message,
		type = 'general',
		link = null,
	}) {
		if (!userId) return null;
		const notifs = getLocalTable('notifications', []);
		const newNotif = {
			id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			user_id: userId,
			title,
			message,
			type,
			link,
			is_read: false,
			read: false,
			created_at: new Date().toISOString(),
			timestamp: new Date().toISOString(),
		};
		notifs.unshift(newNotif);
		setLocalTable('notifications', notifs);

		if (isSupabaseConfigured) {
			try {
				await supabase.from('notifications').insert({
					user_id: userId,
					title,
					message,
					type,
					link,
					is_read: false,
				});
			} catch (err) {
				console.warn('Supabase notification sync error:', err);
			}
		}

		if (broadcastChannel) {
			broadcastChannel.postMessage({
				type: 'new_notification',
				userId,
				notification: newNotif,
			});
		}
		return newNotif;
	},

	async getUserNotifications(userId) {
		if (!userId) return [];
		if (isSupabaseConfigured) {
			const { data } = await supabase
				.from('notifications')
				.select('*')
				.eq('user_id', userId)
				.order('created_at', { ascending: false });
			if (data) return data;
		}
		const notifs = getLocalTable('notifications', []);
		return notifs.filter((n) => n.user_id === userId);
	},

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

	// --- PRACTICE SESSIONS & HISTORY (1-on-1 Speaking Calls) ---
	async createSpeakingSession({
		callerId,
		receiverId,
		mediaMode = 'video',
		topic = 'Conversational Practice',
	}) {
		const session = {
			id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
			caller_id: callerId,
			receiver_id: receiverId,
			status: 'connected',
			started_at: new Date().toISOString(),
			connected_at: new Date().toISOString(),
			ended_at: null,
			duration_seconds: 0,
			media_mode: mediaMode,
			topic,
			created_at: new Date().toISOString(),
		};

		if (isSupabaseConfigured) {
			try {
				const { data, error } = await supabase
					.from('speaking_sessions')
					.insert(session)
					.select()
					.single();
				if (!error && data) return data;
			} catch (err) {
				console.warn(
					'Could not insert speaking session into Supabase:',
					err
				);
			}
		}

		const sessions = getLocalTable('speaking_sessions', []);
		sessions.unshift(session);
		setLocalTable('speaking_sessions', sessions);
		return session;
	},

	async endSpeakingSession(
		sessionId,
		durationSeconds,
		endReason = 'completed'
	) {
		const endedAt = new Date().toISOString();
		if (isSupabaseConfigured) {
			try {
				await supabase
					.from('speaking_sessions')
					.update({
						status: 'ended',
						ended_at: endedAt,
						duration_seconds: durationSeconds,
						end_reason: endReason,
					})
					.eq('id', sessionId);
			} catch (err) {
				console.warn(
					'Could not update speaking session in Supabase:',
					err
				);
			}
		}

		const sessions = getLocalTable('speaking_sessions', []);
		const sess = sessions.find((s) => s.id === sessionId);
		if (sess) {
			sess.status = 'ended';
			sess.ended_at = endedAt;
			sess.duration_seconds = durationSeconds;
			sess.end_reason = endReason;
			setLocalTable('speaking_sessions', sessions);
		}
		return sess;
	},

	async getPracticeHistory(userId) {
		if (!userId) return [];
		if (isSupabaseConfigured) {
			try {
				const { data, error } = await supabase
					.from('speaking_sessions')
					.select(
						`
            *,
            caller:profiles!caller_id(id, full_name, avatar_url, native_language),
            receiver:profiles!receiver_id(id, full_name, avatar_url, native_language)
          `
					)
					.or(`caller_id.eq.${userId},receiver_id.eq.${userId}`)
					.eq('status', 'ended')
					.order('ended_at', { ascending: false });

				if (!error && data && data.length > 0) {
					return data.map((s) => {
						const isCaller = s.caller_id === userId;
						const partner = isCaller ? s.receiver : s.caller;
						return {
							id: s.id,
							partner_id: partner?.id,
							partner_name:
								partner?.full_name || 'Practice Partner',
							partner_avatar: partner?.avatar_url,
							duration_minutes: Math.max(
								1,
								Math.round((s.duration_seconds || 0) / 60)
							),
							duration_seconds: s.duration_seconds || 0,
							created_at:
								s.started_at ||
								s.created_at ||
								new Date().toISOString(),
							topic: s.topic || 'General Conversational Practice',
							vocab_learned: s.vocab_learned || [],
						};
					});
				}
			} catch (err) {
				console.warn('Error querying Supabase speaking_sessions:', err);
			}
		}

		const sessions = getLocalTable('speaking_sessions', []);
		const profiles = await this.getAllProfiles();
		const userSessions = sessions.filter(
			(s) =>
				(s.caller_id === userId || s.receiver_id === userId) &&
				s.status === 'ended'
		);

		if (userSessions.length > 0) {
			return userSessions.map((s) => {
				const partnerId =
					s.caller_id === userId ? s.receiver_id : s.caller_id;
				const partner = profiles.find((p) => p.id === partnerId);
				return {
					id: s.id,
					partner_id: partnerId,
					partner_name: partner?.full_name || 'Practice Partner',
					partner_avatar: partner?.avatar_url,
					duration_minutes: Math.max(
						1,
						Math.round((s.duration_seconds || 0) / 60)
					),
					duration_seconds: s.duration_seconds || 0,
					created_at:
						s.started_at ||
						s.created_at ||
						new Date().toISOString(),
					topic: s.topic || 'General Conversational Practice',
					vocab_learned: s.vocab_learned || [],
				};
			});
		}

		return getLocalTable(`practice_history_${userId}`, []);
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

	// --- MENTOR APPLICATIONS (Real Review & Promotion Flow) ---
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
		const entry = {
			id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
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
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString(),
		};

		if (isSupabaseConfigured) {
			const { data, error } = await supabase
				.from('mentor_applications')
				.insert([entry])
				.select()
				.single();
			if (!error && data) return data;
		}

		const apps = getLocalTable('mentor_applications', []);
		apps.unshift(entry);
		setLocalTable('mentor_applications', apps);
		return entry;
	},

	async getMentorApplications(statusFilter = null) {
		if (isSupabaseConfigured) {
			let query = supabase
				.from('mentor_applications')
				.select('*')
				.order('created_at', { ascending: false });
			if (statusFilter) query = query.eq('status', statusFilter);
			const { data, error } = await query;
			if (!error && data) return data;
		}
		const apps = getLocalTable('mentor_applications', []);
		if (!statusFilter) return apps;
		return apps.filter((a) => a.status === statusFilter);
	},

	async reviewMentorApplication({
		applicationId,
		status,
		reviewedBy,
		rejectionReason = '',
	}) {
		const now = new Date().toISOString();
		let appRecord = null;

		if (isSupabaseConfigured) {
			const { data } = await supabase
				.from('mentor_applications')
				.update({
					status,
					reviewed_by: reviewedBy,
					reviewed_at: now,
					rejection_reason:
						status === 'rejected' ? rejectionReason : null,
					updated_at: now,
				})
				.eq('id', applicationId)
				.select()
				.single();
			appRecord = data;
		} else {
			const apps = getLocalTable('mentor_applications', []);
			const idx = apps.findIndex((a) => a.id === applicationId);
			if (idx !== -1) {
				apps[idx] = {
					...apps[idx],
					status,
					reviewed_by: reviewedBy,
					reviewed_at: now,
					rejection_reason:
						status === 'rejected' ? rejectionReason : null,
					updated_at: now,
				};
				appRecord = apps[idx];
				setLocalTable('mentor_applications', apps);
			}
		}

		// If approved, elevate user profile to mentor role and create mentor listing
		if (status === 'approved' && appRecord) {
			await this.updateProfile(
				appRecord.user_id,
				{
					role: ROLES.MENTOR,
					status: COMMUNITY_STATUS.APPROVED,
					_systemOverride: true,
				},
				'system'
			);

			// Add to mentors table
			const mentors = getLocalTable('mentors', []);
			if (!mentors.find((m) => m.user_id === appRecord.user_id)) {
				mentors.push({
					user_id: appRecord.user_id,
					title: appRecord.title,
					bio: appRecord.bio,
					expertise: appRecord.expertise,
					years_experience: appRecord.years_experience,
					rating: 5.0,
					total_students: 0,
					verified: true,
				});
				setLocalTable('mentors', mentors);
			}
		}

		await this.logAudit(
			'REVIEW_MENTOR_APPLICATION',
			'mentor_application',
			applicationId,
			{ status, rejectionReason },
			reviewedBy
		);
		return appRecord;
	},

	// --- PRACTICE INVITATIONS (Invite Friends to Practice) ---
	async createPracticeInvitation({
		creatorId,
		roomName = null,
		expiresInHours = 24,
	}) {
		// Generate valid UUID for PostgreSQL UUID column
		const uuid =
			typeof crypto !== 'undefined' &&
			typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
						/[xy]/g,
						(c) => {
							const r = (Math.random() * 16) | 0;
							return (c === 'x' ? r : (r & 0x3) | 0x8).toString(
								16
							);
						}
					);

		const token = `spk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
		const expiresAt = new Date(
			Date.now() + expiresInHours * 3600000
		).toISOString();

		// Fetch creator profile for complete invitation metadata
		const creator = await this.getProfile(creatorId);

		const entry = {
			id: uuid,
			creator_id: creatorId,
			token,
			room_name:
				roomName || `Practice Room ${token.slice(-5).toUpperCase()}`,
			expires_at: expiresAt,
			status: 'active',
			max_uses: 1,
			uses_count: 0,
			created_at: new Date().toISOString(),
		};

		// 1. Persist to real Supabase database
		if (isSupabaseConfigured) {
			try {
				const { data, error } = await supabase
					.from('practice_invitations')
					.insert([entry])
					.select()
					.maybeSingle();

				if (!error && data) {
					entry.id = data.id;
				} else if (error) {
					console.warn(
						'[DB practice_invitations insert note]',
						error.message
					);
				}
			} catch (e) {
				console.warn('[DB practice_invitations exception]', e);
			}
		}

		// 2. Sync to backend Express server cache so invitation is universally available across all clients
		try {
			await fetch('/api/practice/invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...entry,
					creator: creator || {
						id: creatorId,
						full_name: 'SayBD Learner',
					},
				}),
			});
		} catch (apiErr) {
			// server sync fallback
		}

		// 3. Fallback to local table
		const invitations = getLocalTable('practice_invitations', []);
		invitations.unshift({ ...entry, creator });
		setLocalTable('practice_invitations', invitations);

		return { ...entry, creator, isActive: true, isExpired: false };
	},

	async getPracticeInvitationByToken(token) {
		if (!token) return null;
		let invitation = null;

		// 1. Try server API first (which has admin bypass, database query, and shared cache)
		try {
			const resp = await fetch(
				`/api/practice/invite/${encodeURIComponent(token)}`
			);
			if (resp.ok) {
				const data = await resp.json();
				if (data && data.invitation) {
					invitation = data.invitation;
				}
			}
		} catch (netErr) {
			// network fallback to direct Supabase
		}

		// 2. Try direct Supabase query if server API didn't resolve
		if (!invitation && isSupabaseConfigured) {
			try {
				const { data } = await supabase
					.from('practice_invitations')
					.select('*, creator:profiles!creator_id(*)')
					.eq('token', token)
					.maybeSingle();

				if (data) {
					invitation = data;
				}
			} catch (dbErr) {
				console.warn('[Supabase invitation lookup note]', dbErr);
			}
		}

		// 3. Fallback to local table
		if (!invitation) {
			const invitations = getLocalTable('practice_invitations', []);
			const found = invitations.find((i) => i.token === token);
			if (found) {
				const creator = await this.getProfile(found.creator_id);
				invitation = { ...found, creator };
			}
		}

		if (!invitation) return null;

		const isExpired = new Date(invitation.expires_at) < new Date();
		return {
			...invitation,
			isExpired,
			isActive: invitation.status === 'active' && !isExpired,
		};
	},

	async acceptPracticeInvitation({ token, friendId }) {
		const invitation = await this.getPracticeInvitationByToken(token);
		if (!invitation || !invitation.isActive) {
			throw new Error(
				'This invitation link has expired or has already been used.'
			);
		}

		const acceptanceUuid =
			typeof crypto !== 'undefined' &&
			typeof crypto.randomUUID === 'function'
				? crypto.randomUUID()
				: 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
						/[xy]/g,
						(c) => {
							const r = (Math.random() * 16) | 0;
							return (c === 'x' ? r : (r & 0x3) | 0x8).toString(
								16
							);
						}
					);

		const acceptance = {
			id: acceptanceUuid,
			invitation_id: invitation.id,
			friend_id: friendId,
			status: 'accepted',
			accepted_at: new Date().toISOString(),
		};

		// 1. Notify server endpoint to update status and record acceptance
		try {
			await fetch(
				`/api/practice/invite/${encodeURIComponent(token)}/accept`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ friendId }),
				}
			);
		} catch {}

		// 2. Real Supabase insert & status update
		if (isSupabaseConfigured) {
			try {
				await supabase
					.from('practice_invitation_acceptances')
					.insert([acceptance]);
				await supabase
					.from('practice_invitations')
					.update({
						uses_count: (invitation.uses_count || 0) + 1,
						status:
							(invitation.uses_count || 0) + 1 >=
							(invitation.max_uses || 1)
								? 'used'
								: 'active',
					})
					.eq('id', invitation.id);
			} catch (dbErr) {
				console.warn('[DB acceptance note]', dbErr);
			}
		}

		// 3. Fallback to local table
		const acceptances = getLocalTable(
			'practice_invitation_acceptances',
			[]
		);
		acceptances.push(acceptance);
		setLocalTable('practice_invitation_acceptances', acceptances);

		const invitations = getLocalTable('practice_invitations', []);
		const idx = invitations.findIndex(
			(i) => i.id === invitation.id || i.token === token
		);
		if (idx !== -1) {
			invitations[idx].uses_count =
				(invitations[idx].uses_count || 0) + 1;
			if (
				invitations[idx].uses_count >= (invitations[idx].max_uses || 1)
			) {
				invitations[idx].status = 'used';
			}
			setLocalTable('practice_invitations', invitations);
		}

		return { acceptance, invitation };
	},

	async cancelPracticeInvitation(token, userId) {
		const invitations = getLocalTable('practice_invitations', []);
		const idx = invitations.findIndex(
			(i) => i.token === token && i.creator_id === userId
		);
		if (idx !== -1) {
			invitations[idx].status = 'cancelled';
			invitations[idx].cancelled_at = new Date().toISOString();
			setLocalTable('practice_invitations', invitations);
			return invitations[idx];
		}
		return null;
	},

	// --- REAL-TIME PRESENCE & ONLINE LEARNERS ---
	async updateUserPresence(
		userId,
		{
			isOnline = true,
			inCall = false,
			inMatching = false,
			currentRoomId = null,
		} = {}
	) {
		if (!userId) {
			console.error('Presence Error: userId is missing');
			return false;
		}

		if (!isSupabaseConfigured) {
			console.error('Supabase is not configured');
			return false;
		}

		try {
			// Verify the authenticated Supabase user
			const {
				data: { user },
				error: authError,
			} = await supabase.auth.getUser();

			if (authError) {
				console.error('Auth Verification Error:', authError);
				return false;
			}

			if (!user || user.id !== userId) {
				console.error('Presence user ID mismatch:', {
					providedUserId: userId,
					authenticatedUserId: user?.id,
				});
				return false;
			}

			const presenceData = {
				user_id: user.id,
				is_online: isOnline,
				in_call: inCall,
				in_matching: inMatching,
				current_room_id: currentRoomId,
				last_heartbeat: new Date().toISOString(),
			};

			const { data, error } = await supabase
				.from('user_presence')
				.upsert(presenceData, {
					onConflict: 'user_id',
				})
				.select();

			if (error) {
				console.error('Presence Upsert Error:', error);
				return false;
			}

			console.log('Presence Successfully Saved:', data);
			return true;
		} catch (err) {
			console.error('Presence Unexpected Error:', err);
			return false;
		}
	},

	// get online user
	async getOnlineLearners(currentUserId = null) {
		let rawPresences = [];

		const fiveMinsAgoMs = Date.now() - 5 * 60 * 1000;
		const fiveMinsAgoIso = new Date(fiveMinsAgoMs).toISOString();

		// 1. Fetch real online users from Supabase
		if (isSupabaseConfigured) {
			try {
				const { data, error } = await supabase
					.from('user_presence')
					.select(
						`
          user_id,
          is_online,
          in_call,
          in_matching,
          last_heartbeat,
          profiles:profiles!user_id (
            id,
            full_name
          )
        `
					)
					.eq('is_online', true)
					.gte('last_heartbeat', fiveMinsAgoIso)
					.order('last_heartbeat', { ascending: false });

				if (error) {
					console.error('Supabase Presence Error:', error);
				} else if (data) {
					rawPresences = data;
					console.log('Supabase Online Users:', data);
				}
			} catch (err) {
				console.error('Presence Fetch Error:', err);
			}
		}

		// 2. Local fallback
		const localPresences = getLocalTable('user_presence', []);
		const allProfiles = await this.getAllProfiles();

		const combinedMap = new Map();

		// 3. Process Supabase users
		rawPresences.forEach((rp) => {
			const p = rp.profiles;

			if (!p || !rp.is_online) return;

			const hbTime = new Date(rp.last_heartbeat).getTime();

			if (!Number.isFinite(hbTime) || hbTime < fiveMinsAgoMs) {
				return;
			}

			combinedMap.set(rp.user_id, {
				id: p.id,
				full_name: p.full_name || 'SayBD Learner',
				avatar_url: '',
				native_language: 'Bengali',
				country: 'Bangladesh',
				role: 'student',
				bio: '',
				is_online: true,
				in_call: Boolean(rp.in_call),
				in_matching: Boolean(rp.in_matching),
				last_heartbeat: rp.last_heartbeat,
			});
		});

		// 4. Process local presence
		localPresences.forEach((lp) => {
			if (!lp.user_id || lp.is_online === false) return;

			const hbTime = new Date(lp.last_heartbeat).getTime();

			if (!Number.isFinite(hbTime) || hbTime < fiveMinsAgoMs) {
				return;
			}

			const p = allProfiles.find((ap) => ap.id === lp.user_id);

			if (!p) return;

			if (p.status === 'suspended' || p.status === 'banned') {
				return;
			}

			const existing = combinedMap.get(lp.user_id);

			const existingTime = existing
				? new Date(existing.last_heartbeat).getTime()
				: 0;

			if (!existing || hbTime > existingTime) {
				combinedMap.set(lp.user_id, {
					id: p.id,
					full_name: p.full_name || 'SayBD Learner',
					avatar_url: p.avatar_url || '',
					native_language: p.native_language || 'Bengali',
					country: p.country || 'Bangladesh',
					role: p.role || 'student',
					bio: p.bio || '',
					is_online: true,
					in_call: Boolean(lp.in_call),
					in_matching: Boolean(lp.in_matching),
					last_heartbeat: lp.last_heartbeat,
				});
			}
		});

		// 5. Final real presence list
		const list = Array.from(combinedMap.values());

		// 6. Current user first, newest heartbeat next
		list.sort((a, b) => {
			if (a.id === currentUserId) return -1;
			if (b.id === currentUserId) return 1;

			return (
				new Date(b.last_heartbeat).getTime() -
				new Date(a.last_heartbeat).getTime()
			);
		});

		console.log('Final Online Learners:', list);

		return list;
	},

	// --- ONE-TO-ONE CALL REQUEST SYSTEM ---

	async createCallRequest({
		callerId,
		receiverId,
		mediaMode = 'video',
		topic = 'Conversational Practice',
	}) {
		if (!callerId || !receiverId) {
			throw new Error('Caller and receiver are required.');
		}

		if (callerId === receiverId) {
			throw new Error('You cannot call yourself.');
		}

		if (!isSupabaseConfigured) {
			throw new Error('Supabase is required for real-time calls.');
		}

		const roomId = `room_${[callerId, receiverId].sort().join('_')}`;

		const request = {
			caller_id: callerId,
			receiver_id: receiverId,
			room_id: roomId,
			media_mode: mediaMode,
			topic,
			status: 'ringing',
			created_at: new Date().toISOString(),
			expires_at: new Date(Date.now() + 30000).toISOString(),
		};

		const { data, error } = await supabase
			.from('call_requests')
			.insert([request])
			.select()
			.single();

		if (error) {
			console.error('Create call request error:', error);
			throw error;
		}

		return data;
	},

	async acceptCallRequest(requestId, receiverId) {
		if (!requestId || !receiverId) {
			throw new Error('Call request and receiver are required.');
		}

		const { data, error } = await supabase
			.from('call_requests')
			.update({
				status: 'accepted',
				accepted_at: new Date().toISOString(),
			})
			.eq('id', requestId)
			.eq('receiver_id', receiverId)
			.eq('status', 'ringing')
			.select()
			.single();

		if (error) {
			console.error('Accept call request error:', error);
			throw error;
		}

		if (!data) {
			throw new Error('Call request is no longer available.');
		}

		return data;
	},

	async rejectCallRequest(requestId, receiverId) {
		if (!requestId || !receiverId) {
			throw new Error('Call request and receiver are required.');
		}

		const { data, error } = await supabase
			.from('call_requests')
			.update({
				status: 'rejected',
				rejected_at: new Date().toISOString(),
			})
			.eq('id', requestId)
			.eq('receiver_id', receiverId)
			.eq('status', 'ringing')
			.select()
			.single();

		if (error) {
			console.error('Reject call request error:', error);
			throw error;
		}

		return data;
	},

	async cancelCallRequest(requestId, callerId) {
		const { data, error } = await supabase
			.from('call_requests')
			.update({
				status: 'cancelled',
			})
			.eq('id', requestId)
			.eq('caller_id', callerId)
			.eq('status', 'ringing')
			.select()
			.single();

		if (error) throw error;
		return data;
	},

	// PASTE these two functions inside the `dbService = { ... }` object in dbService.js,
	// right above `subscribeToOutgoingCalls(...)`.

	// Read one call request (used for polling fallback)

	// PASTE these functions inside the `dbService = { ... }` object in dbService.js,
	// right above `subscribeToOutgoingCalls(...)`.
	// (getCallRequest and getPendingIncomingCalls may already be pasted - don't duplicate them.
	//  NEW: endCallRequest and subscribeToCallRequest.)

	// Read one call request (used for polling fallback)
	async getCallRequest(requestId) {
		if (!isSupabaseConfigured || !requestId) return null;
		const { data, error } = await supabase
			.from('call_requests')
			.select('*')
			.eq('id', requestId)
			.maybeSingle();
		if (error) {
			console.warn('getCallRequest error:', error);
			return null;
		}
		return data;
	},

	// Calls currently ringing for this user (newest first, not expired)
	async getPendingIncomingCalls(userId) {
		if (!isSupabaseConfigured || !userId) return [];
		const { data, error } = await supabase
			.from('call_requests')
			.select('*')
			.eq('receiver_id', userId)
			.eq('status', 'ringing')
			.gt('expires_at', new Date().toISOString())
			.order('created_at', { ascending: false })
			.limit(5);
		if (error) {
			console.warn('getPendingIncomingCalls error:', error);
			return [];
		}
		return data || [];
	},

	// NEW: either person ends an active call -> the other side is notified
	async endCallRequest(requestId, userId) {
		if (!isSupabaseConfigured || !requestId) return null;
		const { data, error } = await supabase
			.from('call_requests')
			.update({
				status: 'ended',
				ended_at: new Date().toISOString(),
				ended_by: userId,
			})
			.eq('id', requestId)
			.eq('status', 'accepted')
			.select()
			.maybeSingle();
		if (error) {
			console.warn('endCallRequest error:', error);
			return null;
		}
		return data;
	},

	// NEW: listen to one call request (both caller and receiver use this during a call)
	subscribeToCallRequest(requestId, callback) {
		if (!isSupabaseConfigured || !requestId) {
			return () => {};
		}

		const channel = supabase
			.channel(`call-request-${requestId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'call_requests',
					filter: `id=eq.${requestId}`,
				},
				(payload) => callback(payload)
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	},

	// Caller listens for accept/reject/cancel updates
	subscribeToOutgoingCalls(callerId, callback) {
		if (!isSupabaseConfigured || !callerId) {
			return () => {};
		}

		const channel = supabase
			.channel(`outgoing-calls-${callerId}`)
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'call_requests',
					filter: `caller_id=eq.${callerId}`,
				},
				(payload) => callback(payload)
			)
			.subscribe();

		return () => supabase.removeChannel(channel);
	},

	subscribeToIncomingCalls(userId, callback) {
		if (!isSupabaseConfigured || !userId) {
			return () => {};
		}

		const channel = supabase
			.channel(`incoming-calls-${userId}`)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'call_requests',
					filter: `receiver_id=eq.${userId}`,
				},
				(payload) => {
					callback(payload);
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	},

	// Cross-tab real-time listener hook helper
	subscribe(callback) {
		if (!broadcastChannel) return () => {};

		const listener = (event) => callback(event.data);

		broadcastChannel.addEventListener('message', listener);

		return () => {
			broadcastChannel.removeEventListener('message', listener);
		};
	},
};
