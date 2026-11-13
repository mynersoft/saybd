import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, PhoneOff } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { OneToOneCall } from '../../../src/features/speaking/OneToOneCall.jsx';
import { formatSecondsToTimer } from '../../utils/formatters.js';

/**
 * Mount ONCE in your app layout so incoming calls ring on every page:
 *
 *   <IncomingCallHandler />
 *
 * Uses your existing dbService functions:
 *   subscribeToIncomingCalls, acceptCallRequest, rejectCallRequest
 * plus two small additions (getCallRequest, getPendingIncomingCalls).
 */

const RING_SECONDS = 15;

export function IncomingCallHandler() {
	const { currentUser, recordSpeakingTime } = useAuth();
	const { addToast } = useNotification();

	const [incoming, setIncoming] = useState(null); // { request, caller }
	const [secondsLeft, setSecondsLeft] = useState(RING_SECONDS);
	const [activeCall, setActiveCall] = useState(null); // { request, caller }

	const incomingRef = useRef(null);
	const activeRef = useRef(null);
	const addToastRef = useRef(addToast);
	const userId = currentUser?.id;

	useEffect(() => {
		addToastRef.current = addToast;
	}, [addToast]);
	useEffect(() => {
		incomingRef.current = incoming;
	}, [incoming]);
	useEffect(() => {
		activeRef.current = activeCall;
	}, [activeCall]);

	const showRequest = useCallback(
		async (request) => {
			if (!request || request.status !== 'ringing' || !userId) return;
			if (
				request.expires_at &&
				new Date(request.expires_at).getTime() < Date.now()
			)
				return;
			if (incomingRef.current?.request.id === request.id) return;

			// Already ringing or already in a call -> auto reject
			if (incomingRef.current || activeRef.current) {
				dbService.rejectCallRequest(request.id, userId).catch(() => {});
				return;
			}

			let caller = null;
			try {
				caller = await dbService.getProfile(request.caller_id);
			} catch {}

			const ageSec = Math.max(
				0,
				(Date.now() - new Date(request.created_at).getTime()) / 1000
			);
			const left = Math.min(
				RING_SECONDS,
				Math.max(2, Math.ceil(RING_SECONDS - ageSec))
			);

			setSecondsLeft(left);
			setIncoming({
				request,
				caller: caller || {
					id: request.caller_id,
					full_name: 'SayBD Learner',
				},
			});
		},
		[userId]
	);

	// Realtime listener
	useEffect(() => {
		if (!userId) return;

		const unsubscribe = dbService.subscribeToIncomingCalls(
			userId,
			(payload) => {
				const row = payload?.new;
				if (!row) return;

				if (payload.eventType === 'INSERT') {
					showRequest(row);
				} else if (payload.eventType === 'UPDATE') {
					// Caller cancelled / expired -> close the popup
					if (
						incomingRef.current?.request.id === row.id &&
						row.status !== 'ringing'
					) {
						setIncoming(null);
					}
				}
			}
		);

		return () => {
			if (typeof unsubscribe === 'function') unsubscribe();
		};
	}, [userId, showRequest]);

	// Polling fallback (works even if Realtime is not enabled yet)
	useEffect(() => {
		if (!userId) return;
		let stopped = false;

		const poll = async () => {
			if (stopped || activeRef.current) return;
			try {
				if (incomingRef.current) {
					const row = await dbService.getCallRequest(
						incomingRef.current.request.id
					);
					if (!stopped && row && row.status !== 'ringing')
						setIncoming(null);
				} else {
					const pending =
						await dbService.getPendingIncomingCalls(userId);
					if (!stopped && pending?.length) showRequest(pending[0]);
				}
			} catch {}
		};

		poll();
		const timer = setInterval(poll, 4000);
		return () => {
			stopped = true;
			clearInterval(timer);
		};
	}, [userId, showRequest]);

	const handleDecline = useCallback(async () => {
		const current = incomingRef.current;
		if (!current) return;
		setIncoming(null);
		try {
			await dbService.rejectCallRequest(current.request.id, userId);
		} catch {}
	}, [userId]);

	const handleAccept = async () => {
		const current = incomingRef.current;
		if (!current) return;
		setIncoming(null);
		try {
			await dbService.acceptCallRequest(current.request.id, userId);
			setActiveCall(current);
		} catch (err) {
			console.warn('Accept failed:', err);
			addToastRef.current('This call is no longer available.', 'info');
		}
	};

	// Ring countdown -> auto decline
	useEffect(() => {
		if (!incoming) return;
		if (secondsLeft <= 0) {
			handleDecline();
			return;
		}
		const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
		return () => clearTimeout(t);
	}, [incoming, secondsLeft, handleDecline]);

	// Receiver finished the call
	const handleEndCall = async (durationSeconds) => {
		setActiveCall(null);
		if (durationSeconds > 0) {
			addToastRef.current(
				`Practice completed: ${formatSecondsToTimer(durationSeconds)} recorded!`,
				'success'
			);
			try {
				await recordSpeakingTime(durationSeconds);
			} catch (err) {
				console.warn('Could not record speaking time:', err);
			}
		}
	};

	if (activeCall) {
		return (
			<div className="fixed inset-0 z-[100] bg-slate-950 p-2 sm:p-6 overflow-auto">
				<OneToOneCall
					key={activeCall.request.id}
					partner={activeCall.caller}
					currentUser={currentUser}
					initialAudioOnly={activeCall.request.media_mode === 'audio'}
					callRequestId={activeCall.request.id}
					onEndCall={handleEndCall}
					onNextPartner={handleEndCall}
				/>
			</div>
		);
	}

	if (!incoming) return null;
	const { caller } = incoming;

	return (
		<div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
			<div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 text-center space-y-5">
				<div className="relative w-24 h-24 mx-auto">
					{caller.avatar_url ? (
						<img
							src={caller.avatar_url}
							alt={caller.full_name}
							className="w-24 h-24 rounded-full object-cover ring-4 ring-emerald-500 shadow-xl"
						/>
					) : (
						<div className="w-24 h-24 rounded-full bg-indigo-600/20 text-indigo-600 font-extrabold text-2xl flex items-center justify-center ring-4 ring-emerald-500 shadow-xl uppercase">
							{(caller.full_name || 'U').charAt(0)}
						</div>
					)}
					<div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-emerald-600 text-white font-mono text-xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-bounce">
						{secondsLeft}s
					</div>
				</div>

				<div>
					<span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
						Incoming Practice Call
					</span>
					<h3 className="text-xl font-bold text-slate-900 dark:text-white mt-2">
						{caller.full_name} is calling you
					</h3>
					<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
						{incoming.request.media_mode === 'audio'
							? 'Audio call'
							: 'Video call'}{' '}
						• {caller.country || 'Bangladesh'}
					</p>
				</div>

				<div className="flex items-center justify-center gap-3">
					<button
						onClick={handleDecline}
						className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-600/30">
						<PhoneOff className="w-4 h-4" /> Decline
					</button>
					<button
						onClick={handleAccept}
						className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 animate-pulse">
						<Phone className="w-4 h-4" /> Accept
					</button>
				</div>
			</div>
		</div>
	);
}
