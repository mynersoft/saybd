import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import {
	matchingEngine,
	MATCH_STATES,
} from '../../services/matching/matchingEngine.js';
import { OneToOneCall } from '../speaking/OneToOneCall.jsx';
import { UpgradeModal } from '../../components/common/UpgradeModal.jsx';
import { formatSecondsToTimer } from '../../utils/formatters.js';
import { PRACTICE_TOPICS } from '../../config/constants.js';
import { OnlineLearnersList } from './OnlineLearnersList.jsx';
import {
	Mic,
	Video,
	Clock,
	Sparkles,
	Users,
	ShieldCheck,
	AlertCircle,
	CheckCircle2,
	Download,
	Film,
	X,
	Share2,
} from 'lucide-react';
import { InviteFriendsModal } from '../../components/practice/InviteFriendsModal.jsx';

export function MatchingLobby() {
	const { currentUser, remainingSeconds, recordSpeakingTime } = useAuth();
	const { addToast } = useNotification();

	const [matchState, setMatchState] = useState(MATCH_STATES.IDLE);
	const [candidate, setCandidate] = useState(null);
	const [countdown, setCountdown] = useState(15);
	const [audioOnly, setAudioOnly] = useState(false);
	const [activePartner, setActivePartner] = useState(null);
	const [lastPartnerName, setLastPartnerName] = useState('');
	const [isUpgradeOpen, setIsUpgradeOpen] = useState(false);
	const [completedDuration, setCompletedDuration] = useState(0);
	const [recordedVideo, setRecordedVideo] = useState(null);
	const [isInviteOpen, setIsInviteOpen] = useState(false);
	const [onlineLearners, setOnlineLearners] = useState([]);
	const [loadingOnline, setLoadingOnline] = useState(true);
	const [activeRequestId, setActiveRequestId] = useState(null);

	// Keep latest addToast in a ref so the engine subscription effect runs only once.
	// (Otherwise a changing addToast re-runs cleanup -> cancelMatching() and resets the call.)
	const addToastRef = useRef(addToast);
	useEffect(() => {
		addToastRef.current = addToast;
	}, [addToast]);

	// Load online learners
	const loadOnlineLearners = useCallback(async () => {
		try {
			const list = await dbService.getOnlineLearners(currentUser?.id);
			setOnlineLearners(list);
		} catch (err) {
			console.warn('Could not load online learners:', err);
		} finally {
			setLoadingOnline(false);
		}
	}, [currentUser?.id]);

	useEffect(() => {
		loadOnlineLearners();
	}, [loadOnlineLearners]);

	// Real-time presence heartbeat & subscription
	useEffect(() => {
		if (!currentUser?.id) return;

		const updatePresence = (isOnline = true) => {
			try {
				dbService.updateUserPresence(currentUser.id, {
					isOnline,
					inCall: Boolean(activePartner),
					inMatching:
						matchState === MATCH_STATES.SEARCHING ||
						matchState === MATCH_STATES.REQUEST_SENT,
				});
			} catch (err) {
				console.warn('Presence update failed:', err);
			}
		};

		updatePresence(true);

		const heartbeatTimer = setInterval(() => {
			updatePresence(true);
			loadOnlineLearners();
		}, 25000);

		const unsubPresence = dbService.subscribe((event) => {
			if (
				event?.type === 'presence_update' ||
				event?.type === 'table_update'
			) {
				loadOnlineLearners();
			}
		});

		return () => {
			clearInterval(heartbeatTimer);
			if (unsubPresence) unsubPresence();
			updatePresence(false);
		};
	}, [currentUser?.id, activePartner, matchState, loadOnlineLearners]);

	// Subscribe to matching engine state transitions (runs ONCE)
	useEffect(() => {
		const unsubscribe = matchingEngine.subscribe((event, payload) => {
			if (event === 'state_change') {
				setMatchState(payload.state);
				if (payload.candidate) setCandidate(payload.candidate);
				if (payload.timeoutSeconds)
					setCountdown(payload.timeoutSeconds);

				if (payload.state === MATCH_STATES.CONNECTED) {
					setActiveRequestId(payload.requestId || null);
					setActivePartner(payload.candidate);
					addToastRef.current(
						`Connected with ${payload.candidate.full_name}!`,
						'success'
					);
				} else if (payload.state === MATCH_STATES.EXHAUSTED) {
					setIsUpgradeOpen(true);
				} else if (payload.state === MATCH_STATES.NOT_APPROVED) {
					addToastRef.current(
						'Your account is currently restricted from practice.',
						'warning'
					);
				} else if (payload.error) {
					addToastRef.current(payload.error, 'info');
				}
			}

			if (event === 'countdown_tick') {
				setCountdown(payload.secondsLeft);
			}
		});

		return () => {
			unsubscribe();
			matchingEngine.cancelMatching();
		};
	}, []);

	const handleStartSpeaking = async () => {
		if (remainingSeconds <= 0) {
			setIsUpgradeOpen(true);
			return;
		}
		setCompletedDuration(0);
		await matchingEngine.startMatching(currentUser, {
			mediaMode: audioOnly ? 'audio' : 'video',
		});
	};

	const handleCancelMatching = () => {
		matchingEngine.cancelMatching();
		setCandidate(null);
	};

	const handleDirectPractice = async (partner) => {
		if (remainingSeconds <= 0) {
			setIsUpgradeOpen(true);
			return;
		}
		setCompletedDuration(0);
		await matchingEngine.startMatchingWithCandidate(currentUser, partner, {
			mediaMode: audioOnly ? 'audio' : 'video',
		});
	};

	// Save a finished session in the background (never blocks the UI)
	const saveSession = async (partner, durationSeconds, endReason) => {
		if (!partner || durationSeconds <= 0) return;
		try {
			const sess = await dbService.createSpeakingSession({
				callerId: currentUser.id,
				receiverId: partner.id,
				mediaMode: audioOnly ? 'audio' : 'video',
			});
			if (sess?.id) {
				await dbService.endSpeakingSession(
					sess.id,
					durationSeconds,
					endReason
				);
			}
		} catch (err) {
			console.warn('Could not record speaking session:', err);
		}
		try {
			await recordSpeakingTime(durationSeconds);
		} catch (err) {
			console.warn('Could not record speaking time:', err);
		}
	};

	// Called when call ends
	const handleEndCall = async (durationSeconds, video = null) => {
		const partner = activePartner;

		// 1. Close call UI immediately
		setActivePartner(null);
		setMatchState(MATCH_STATES.IDLE);
		setCandidate(null);
		matchingEngine.cancelMatching();
		if (partner) setLastPartnerName(partner.full_name);
		if (video) setRecordedVideo(video);

		// 2. Save data afterwards
		if (partner && durationSeconds > 0) {
			setCompletedDuration(durationSeconds);
			addToastRef.current(
				`Practice completed: ${formatSecondsToTimer(durationSeconds)} recorded!`,
				'success'
			);
			saveSession(partner, durationSeconds, 'completed');
		}
	};

	// Called when user clicks "Next Partner"
	const handleNextPartner = async (prevDurationSeconds, video = null) => {
		const partner = activePartner;

		// 1. Close current call UI immediately
		setActivePartner(null);
		setCandidate(null);
		matchingEngine.cancelMatching();
		if (video) setRecordedVideo(video);
		if (partner) setLastPartnerName(partner.full_name);

		// 2. Save in background
		if (partner && prevDurationSeconds > 0) {
			setCompletedDuration(prevDurationSeconds);
			saveSession(partner, prevDurationSeconds, 'next_partner');
		}

		// 3. Start searching again
		setMatchState(MATCH_STATES.IDLE);
		handleStartSpeaking();
	};

	// Download recorded video (Client-side only)
	const handleDownloadVideo = () => {
		if (!recordedVideo?.url) return;
		const a = document.createElement('a');
		a.href = recordedVideo.url;
		a.download =
			recordedVideo.filename || `saybd-session-${Date.now()}.webm`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	};

	// Active call view
	if (activePartner) {
		return (
			<OneToOneCall
				partner={activePartner}
				currentUser={currentUser}
				initialAudioOnly={audioOnly}
				callRequestId={activeRequestId}
				onEndCall={handleEndCall}
				onNextPartner={handleNextPartner}
			/>
		);
	}

	return (
		<div className="max-w-4xl mx-auto space-y-6">
			{/* Header Banner */}
			<div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white p-5 sm:p-10 shadow-xl border border-indigo-700/50">
				<div className="relative z-10 max-w-xl">
					<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/30 backdrop-blur-md border border-indigo-400/30 text-indigo-200 mb-2 sm:mb-3">
						<Sparkles className="w-3.5 h-3.5 text-amber-300" />
						<span>Real Spoken Practice Engine</span>
					</div>
					<h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white leading-tight">
						Speak English 1-on-1 with Approved Members
					</h1>
					<p className="mt-2 text-xs sm:text-base text-indigo-100/90 leading-relaxed">
						Automatic real-time partner matching. Connect instantly,
						talk naturally, build confidence, and get better every
						single day.
					</p>

					<div className="flex flex-wrap items-center gap-3 mt-6">
						<div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-950/40 backdrop-blur-md border border-white/10 text-xs font-bold">
							<Clock className="w-4 h-4 text-indigo-300 animate-pulse" />
							<span>Daily Allowance:</span>
							<span className="font-mono text-sm text-amber-300">
								{formatSecondsToTimer(remainingSeconds)}
							</span>
							<span className="text-white/60">/ 20m</span>
						</div>

						<button
							onClick={() => setIsUpgradeOpen(true)}
							className="text-xs font-bold text-indigo-200 hover:text-white underline underline-offset-4">
							Extend limit →
						</button>
					</div>
				</div>

				<div className="absolute -right-10 -bottom-10 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
			</div>

			{/* If completed a session recently */}
			{completedDuration > 0 && (
				<div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100 flex items-center justify-between text-xs sm:text-sm">
					<div className="flex items-center gap-3">
						<CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
						<div>
							<strong>Well done!</strong> You just completed{' '}
							{formatSecondsToTimer(completedDuration)} of active
							English conversation.
						</div>
					</div>
					<span className="font-bold text-emerald-700 dark:text-emerald-300">
						Added to Today's Record
					</span>
				</div>
			)}

			{/* Recorded Video Download Card (client-side only) */}
			{recordedVideo && (
				<div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60 shadow-lg space-y-4 animate-in fade-in duration-300">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
								<Film className="w-5 h-5" />
							</div>
							<div>
								<div className="flex items-center gap-2">
									<h3 className="text-base font-bold text-slate-900 dark:text-white">
										Your Practice Recording is Ready to
										Download
									</h3>
									<span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
										Browser RAM Only
									</span>
								</div>
								<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
									Manual recording of your speaking session
									{lastPartnerName
										? ` with ${lastPartnerName}`
										: ''}
									.
								</p>
							</div>
						</div>

						<button
							onClick={() => setRecordedVideo(null)}
							className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
							title="Dismiss recording preview">
							<X className="w-5 h-5" />
						</button>
					</div>

					<div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video max-h-72 flex items-center justify-center">
						<video
							src={recordedVideo.url}
							controls
							playsInline
							className="w-full h-full object-contain"
						/>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
							<span className="text-[10px] font-bold uppercase text-slate-400 block">
								Duration
							</span>
							<p className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
								{formatSecondsToTimer(
									recordedVideo.durationSeconds ||
										completedDuration
								)}
							</p>
						</div>
						<div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
							<span className="text-[10px] font-bold uppercase text-slate-400 block">
								File Size
							</span>
							<p className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
								{recordedVideo.sizeMB} MB
							</p>
						</div>
						<div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
							<span className="text-[10px] font-bold uppercase text-slate-400 block">
								Format
							</span>
							<p className="text-sm font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5 uppercase">
								{recordedVideo.mimeType?.includes('mp4')
									? 'MP4'
									: 'WebM HD'}
							</p>
						</div>
					</div>

					<div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
						<ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
						<div className="space-y-0.5">
							<strong className="block text-emerald-800 dark:text-emerald-300 font-bold">
								100% Client-Side Privacy:
							</strong>
							<p className="text-[11px] leading-relaxed text-emerald-700 dark:text-emerald-400">
								This recording is kept strictly in your local
								device browser memory. It is{' '}
								<strong>
									never uploaded or saved to our database or
									servers
								</strong>
								. Download it now to keep your video file
								locally.
							</p>
						</div>
					</div>

					<div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
						<button
							onClick={() => setRecordedVideo(null)}
							className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors">
							Dismiss
						</button>

						<button
							onClick={handleDownloadVideo}
							className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 hover:scale-102 transition-all active:scale-95">
							<Download className="w-4 h-4 animate-bounce" />
							<span>Download Recorded Video</span>
						</button>
					</div>
				</div>
			)}

			{/* Main Matching Card */}
			<div className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-sm">
				{/* State: IDLE */}
				{matchState === MATCH_STATES.IDLE && (
					<div className="space-y-5 sm:space-y-6">
						<div className="pb-4 border-b border-slate-100 dark:border-slate-800">
							<label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
								Call Mode
							</label>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 max-w-md">
								<button
									type="button"
									onClick={() => setAudioOnly(false)}
									className={`flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-bold border transition-all ${
										!audioOnly
											? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
											: 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
									}`}>
									<Video className="w-4 h-4" /> Video & Audio
								</button>

								<button
									type="button"
									onClick={() => setAudioOnly(true)}
									className={`flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-bold border transition-all ${
										audioOnly
											? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
											: 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
									}`}>
									<Mic className="w-4 h-4" /> Audio-Only Mode
								</button>
							</div>
						</div>

						<div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex items-start gap-2.5 sm:gap-3 text-xs text-slate-600 dark:text-slate-400">
							<ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
							<div>
								<strong className="text-slate-900 dark:text-white font-semibold">
									SayBD Safe Community:
								</strong>{' '}
								Only verified and approved members are admitted.
								Personal contact details (phone, email) are
								strictly kept private.
							</div>
						</div>

						<div className="text-center pt-2">
							<button
								onClick={handleStartSpeaking}
								className="w-full sm:w-auto px-6 sm:px-10 py-4 sm:py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm sm:text-base shadow-xl shadow-indigo-600/25 hover:shadow-indigo-600/40 hover:scale-102 transition-all flex items-center justify-center gap-2.5 sm:gap-3 mx-auto">
								<Mic className="w-5 h-5 animate-pulse" />
								<span>Start Speaking Practice</span>
							</button>

							<div className="pt-2">
								<button
									type="button"
									onClick={() => setIsInviteOpen(true)}
									className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all shadow-sm">
									<Share2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
									<span>
										Invite Friends to Practice (Direct Link)
									</span>
								</button>
							</div>

							<p className="text-xs text-slate-400 mt-2">
								Connects in seconds • WebRTC Encrypted • Mute
								and skip anytime
							</p>
						</div>
					</div>
				)}

				{/* State: SEARCHING */}
				{matchState === MATCH_STATES.SEARCHING && (
					<div className="py-12 text-center space-y-4">
						<div className="relative w-24 h-24 mx-auto flex items-center justify-center">
							<div className="absolute inset-0 rounded-full border-4 border-indigo-600/20 border-t-indigo-600 animate-spin" />
							<div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
								<Users className="w-8 h-8 animate-pulse" />
							</div>
						</div>
						<div>
							<h3 className="text-xl font-bold text-slate-900 dark:text-white">
								Finding an Online Speaking Partner...
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
								Checking online community pool for available
								speaking partners.
							</p>
						</div>
						<button
							onClick={handleCancelMatching}
							className="px-5 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
							Cancel
						</button>
					</div>
				)}

				{/* State: REQUEST SENT (15s Countdown) */}
				{matchState === MATCH_STATES.REQUEST_SENT && candidate && (
					<div className="py-8 text-center space-y-5 max-w-sm mx-auto">
						<div className="relative w-24 h-24 mx-auto">
							{candidate.avatar_url ? (
								<img
									src={candidate.avatar_url}
									alt={candidate.full_name}
									className="w-24 h-24 rounded-full object-cover ring-4 ring-indigo-500 shadow-xl"
								/>
							) : (
								<div className="w-24 h-24 rounded-full bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 font-extrabold text-2xl flex items-center justify-center ring-4 ring-indigo-500 shadow-xl uppercase">
									{(candidate.full_name || 'P').charAt(0)}
								</div>
							)}
							<div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-indigo-600 text-white font-mono text-xs font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900 animate-bounce">
								{countdown}s
							</div>
						</div>

						<div>
							<span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2 py-0.5 rounded-full">
								Partner Found
							</span>
							<h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
								Calling {candidate.full_name}
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
								Community Member •{' '}
								{candidate.country || 'Bangladesh'}
							</p>
							<p className="text-xs text-slate-400 mt-2">
								Waiting for partner to accept ({countdown}s
								left). If no response, we automatically try the
								next partner!
							</p>
						</div>

						<button
							onClick={handleCancelMatching}
							className="px-6 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800">
							Cancel Request
						</button>
					</div>
				)}

				{/* State: RESTRICTED ACCOUNT */}
				{matchState === MATCH_STATES.NOT_APPROVED && (
					<div className="py-8 text-center space-y-4">
						<div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950 text-amber-600 flex items-center justify-center mx-auto">
							<AlertCircle className="w-7 h-7" />
						</div>
						<div>
							<h3 className="text-xl font-bold text-slate-900 dark:text-white">
								Account Access Restricted
							</h3>
							<p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
								Your account is currently restricted from
								participating in 1-on-1 practice. If you believe
								this is a mistake, please contact SayBD support.
							</p>
						</div>
						<div className="flex items-center justify-center gap-3">
							<button
								onClick={() => setMatchState(MATCH_STATES.IDLE)}
								className="px-6 py-2.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200">
								Back to Lobby
							</button>
						</div>
					</div>
				)}
			</div>

			{/* Online Now: Active Members Section */}
			<OnlineLearnersList
				learners={onlineLearners}
				currentUserId={currentUser?.id}
				onPracticeWithUser={handleDirectPractice}
				isLoading={loadingOnline}
				onRefresh={loadOnlineLearners}
			/>

			{/* Suggested Topics Card */}
			<div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800">
				<div className="flex items-center justify-between mb-4">
					<div className="flex items-center gap-2">
						<Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
						<h4 className="font-bold text-sm text-slate-900 dark:text-white">
							Today's Curated Practice Prompts
						</h4>
					</div>
					<span className="text-xs text-slate-400">
						Great for overcoming awkward silences
					</span>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{PRACTICE_TOPICS.slice(0, 4).map((topic, i) => (
						<div
							key={i}
							className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
							<p className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
								{topic.title}
							</p>
							<p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
								{topic.prompt}
							</p>
						</div>
					))}
				</div>
			</div>

			<UpgradeModal
				isOpen={isUpgradeOpen}
				onClose={() => setIsUpgradeOpen(false)}
				remainingSeconds={remainingSeconds}
			/>

			<InviteFriendsModal
				isOpen={isInviteOpen}
				onClose={() => setIsInviteOpen(false)}
			/>
		</div>
	);
}
