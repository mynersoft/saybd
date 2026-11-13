import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import {
	ROLES,
	COMMUNITY_STATUS,
} from '../../../config/constants.js';
import {
	STORAGE_KEY_PREFIX,
	broadcastChannel,
	getLocalTable,
	setLocalTable,
	getDhakaDateString,
	generateInitialCallUsage,
} from './dbCore.js';

export const speakingService = {
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
};
