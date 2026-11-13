import { supabase, isSupabaseConfigured } from '../supabaseClient.js';
import {
	ROLES,
} from '../../../config/constants.js';
import {
	broadcastChannel,
	INITIAL_PROFILES,
	getLocalTable,
	setLocalTable,
} from './dbCore.js';

export const profileService = {
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
};
