import { dbService } from '../supabase/dbService.js';
import {
	MATCHING_TIMEOUT_SECONDS,
	COMMUNITY_STATUS,
} from '../../config/constants.js';

export const MATCH_STATES = {
	IDLE: 'idle',
	CHECKING: 'checking',
	SEARCHING: 'searching',
	REQUEST_SENT: 'request_sent',
	CONNECTED: 'connected',
	TIMEOUT: 'timeout',
	REJECTED: 'rejected',
	EXHAUSTED: 'exhausted',
	NOT_APPROVED: 'not_approved',
};

class MatchingEngine {
	constructor() {
		this.state = MATCH_STATES.IDLE;
		this.currentCandidate = null;
		this.currentRequest = null;
		this.recentAttemptedIds = new Set();
		this.timer = null;
		this.unsubscribeOutgoing = null;
		this.abortCurrent = null;
		this.runId = 0; // bumped on every start/cancel so stale async work stops
		this.listeners = new Set();
	}

	subscribe(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	notify(event, payload) {
		for (const listener of this.listeners) {
			try {
				listener(event, payload);
			} catch (err) {
				console.error('MatchingEngine listener error:', err);
			}
		}
	}

	setState(state, extra = {}) {
		this.state = state;
		this.notify('state_change', { state, ...extra });
	}

	// ---- Checks shared by both entry points ----
	async preflight(currentUser) {
		const profile = await dbService.getProfile(currentUser.id);
		if (
			profile?.status === COMMUNITY_STATUS.SUSPENDED ||
			profile?.status === 'banned'
		) {
			this.setState(MATCH_STATES.NOT_APPROVED, {
				reason: 'Your account is suspended or restricted.',
			});
			return false;
		}

		const usage = await dbService.getDailySpeakingUsage(currentUser.id);
		if (usage.usedSeconds >= usage.maxAllowanceSeconds) {
			this.setState(MATCH_STATES.EXHAUSTED, { usage });
			return false;
		}
		return true;
	}

	// ---- Auto matching: pick online partners one by one ----
	async startMatching(currentUser, options = {}) {
		this.abortActive();
		const runId = ++this.runId;

		this.setState(MATCH_STATES.CHECKING);
		if (!(await this.preflight(currentUser))) return false;
		if (runId !== this.runId) return null;

		this.setState(MATCH_STATES.SEARCHING);
		return this.findNextPartner(currentUser, options, runId);
	}

	// ---- Direct call to one chosen learner ----
	async startMatchingWithCandidate(currentUser, candidate, options = {}) {
		if (!candidate) return false;
		this.abortActive();
		const runId = ++this.runId;

		this.setState(MATCH_STATES.CHECKING);
		if (!(await this.preflight(currentUser))) return false;
		if (runId !== this.runId) return null;

		return this.sendRequest(currentUser, candidate, options, runId, false);
	}

	async findNextPartner(currentUser, options = {}, runId = this.runId) {
		let online = [];
		let blockedIds = [];
		try {
			online = await dbService.getOnlineLearners(currentUser.id);
			blockedIds = await dbService.getBlockedUserIds(currentUser.id);
		} catch (err) {
			console.warn('Could not load online partners:', err);
		}
		if (runId !== this.runId) return null;

		// Only people who are online right now, not in a call, not blocked
		const eligible = online.filter(
			(p) =>
				p.id !== currentUser.id &&
				!p.in_call &&
				!blockedIds.includes(p.id)
		);
		const candidates = eligible.filter(
			(p) => !this.recentAttemptedIds.has(p.id)
		);

		if (candidates.length === 0) {
			this.recentAttemptedIds.clear(); // fresh start next time
			this.currentCandidate = null;
			this.setState(MATCH_STATES.IDLE, {
				candidate: null,
				error:
					eligible.length === 0
						? 'No speaking partners are online right now. Share your practice link with a friend to start immediately!'
						: 'Nobody answered. Please try again in a moment.',
			});
			return null;
		}

		return this.sendRequest(
			currentUser,
			candidates[0],
			options,
			runId,
			true
		);
	}

	// ---- Real call request: create row, wait for accept / reject / timeout ----
	async sendRequest(currentUser, candidate, options, runId, autoNext) {
		const mediaMode = options.mediaMode || 'video';
		this.currentCandidate = candidate;
		this.recentAttemptedIds.add(candidate.id);

		let request;
		try {
			request = await dbService.createCallRequest({
				callerId: currentUser.id,
				receiverId: candidate.id,
				mediaMode,
			});
		} catch (err) {
			console.warn('Could not create call request:', err);
			if (runId !== this.runId) return null;
			this.currentCandidate = null;
			this.setState(MATCH_STATES.IDLE, {
				candidate: null,
				error: 'Could not send the call request. Please try again.',
			});
			return null;
		}

		// User cancelled while the request was being created
		if (runId !== this.runId) {
			dbService
				.cancelCallRequest(request.id, currentUser.id)
				.catch(() => {});
			return null;
		}

		this.currentRequest = request;
		this.setState(MATCH_STATES.REQUEST_SENT, {
			candidate,
			timeoutSeconds: MATCHING_TIMEOUT_SECONDS,
		});

		return new Promise((resolve) => {
			let finished = false;
			let secondsLeft = MATCHING_TIMEOUT_SECONDS;
			let polling = false;

			const finish = (outcome) => {
				if (finished) return;
				finished = true;
				this.teardown();
				const name = candidate.full_name || 'Partner';

				if (outcome === 'accepted') {
					this.currentRequest = null;
					this.recentAttemptedIds.clear();
					this.setState(MATCH_STATES.CONNECTED, {
						candidate,
						roomId: request.room_id,
						requestId: request.id,
					});
					resolve(candidate);
					return;
				}

				// Not accepted: close the request so the partner's popup disappears
				if (outcome !== 'rejected') {
					dbService
						.cancelCallRequest(request.id, currentUser.id)
						.catch(() => {});
				}
				this.currentRequest = null;

				if (outcome === 'cancelled') {
					resolve(null);
					return;
				}

				if (autoNext) {
					this.setState(MATCH_STATES.SEARCHING);
					resolve(this.findNextPartner(currentUser, options, runId));
				} else {
					this.currentCandidate = null;
					this.setState(MATCH_STATES.IDLE, {
						candidate: null,
						error:
							outcome === 'rejected'
								? `${name} declined your call.`
								: `${name} did not answer.`,
					});
					resolve(null);
				}
			};

			this.abortCurrent = () => finish('cancelled');

			// Realtime: partner accepted / rejected
			this.unsubscribeOutgoing = dbService.subscribeToOutgoingCalls(
				currentUser.id,
				(payload) => {
					const row = payload?.new;
					if (!row || row.id !== request.id) return;
					if (row.status === 'accepted') finish('accepted');
					else if (row.status === 'rejected') finish('rejected');
				}
			);

			// Countdown + polling fallback (in case Realtime is slow or disabled)
			this.timer = setInterval(async () => {
				secondsLeft -= 1;
				this.notify('countdown_tick', { secondsLeft });

				if (secondsLeft <= 0) {
					finish('timeout');
					return;
				}

				if (secondsLeft % 2 === 0 && !polling) {
					polling = true;
					try {
						const row = await dbService.getCallRequest(request.id);
						if (row?.status === 'accepted') finish('accepted');
						else if (row?.status === 'rejected') finish('rejected');
					} catch {
						// ignore, next tick retries
					} finally {
						polling = false;
					}
				}
			}, 1000);
		});
	}

	teardown() {
		this.clearTimer();
		if (this.unsubscribeOutgoing) {
			try {
				this.unsubscribeOutgoing();
			} catch {}
			this.unsubscribeOutgoing = null;
		}
		this.abortCurrent = null;
	}

	// Stop whatever is running without notifying IDLE
	abortActive() {
		const abort = this.abortCurrent;
		this.runId += 1;
		if (abort) abort();
		this.teardown();
	}

	cancelMatching() {
		this.abortActive();
		this.currentCandidate = null;
		this.currentRequest = null;
		this.setState(MATCH_STATES.IDLE);
	}

	clearTimer() {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}
}

export const matchingEngine = new MatchingEngine();
