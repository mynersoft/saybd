import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import {
	broadcastChannel,
	getLocalTable,
	setLocalTable,
} from './dbCore.js';

export const callService = {
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
