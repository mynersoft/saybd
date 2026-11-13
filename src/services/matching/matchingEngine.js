import { dbService } from '../supabase/dbService.js';
import { MATCHING_TIMEOUT_SECONDS, COMMUNITY_STATUS } from '../../config/constants.js';

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
    this.recentAttemptedIds = new Set();
    this.timer = null;
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

  async startMatching(currentUser) {
    this.state = MATCH_STATES.CHECKING;
    this.notify('state_change', { state: this.state });

    // 1. Verify account is not suspended or banned (students do NOT need admin approval)
    const profile = await dbService.getProfile(currentUser.id);
    if (profile?.status === COMMUNITY_STATUS.SUSPENDED || profile?.status === 'banned') {
      this.state = MATCH_STATES.NOT_APPROVED;
      this.notify('state_change', { state: this.state, reason: 'Your account is suspended or restricted.' });
      return false;
    }

    // 2. Verify remaining speaking allowance
    const usage = await dbService.getDailySpeakingUsage(currentUser.id);
    if (usage.usedSeconds >= usage.maxAllowanceSeconds) {
      this.state = MATCH_STATES.EXHAUSTED;
      this.notify('state_change', { state: this.state, usage });
      return false;
    }

    // 3. Begin searching for eligible practice partners immediately
    this.state = MATCH_STATES.SEARCHING;
    this.notify('state_change', { state: this.state });

    return this.findNextPartner(currentUser);
  }

  async startMatchingWithCandidate(currentUser, candidate) {
    if (!candidate) return false;
    this.state = MATCH_STATES.CHECKING;
    this.notify('state_change', { state: this.state });

    // Verify account
    const profile = await dbService.getProfile(currentUser.id);
    if (profile?.status === COMMUNITY_STATUS.SUSPENDED || profile?.status === 'banned') {
      this.state = MATCH_STATES.NOT_APPROVED;
      this.notify('state_change', { state: this.state, reason: 'Your account is suspended or restricted.' });
      return false;
    }

    // Verify speaking allowance
    const usage = await dbService.getDailySpeakingUsage(currentUser.id);
    if (usage.usedSeconds >= usage.maxAllowanceSeconds) {
      this.state = MATCH_STATES.EXHAUSTED;
      this.notify('state_change', { state: this.state, usage });
      return false;
    }

    this.currentCandidate = candidate;
    this.recentAttemptedIds.add(candidate.id);
    this.state = MATCH_STATES.REQUEST_SENT;
    this.notify('state_change', {
      state: this.state,
      candidate,
      timeoutSeconds: MATCHING_TIMEOUT_SECONDS
    });

    this.clearTimer();
    return new Promise((resolve) => {
      let secondsLeft = MATCHING_TIMEOUT_SECONDS;
      this.timer = setInterval(() => {
        secondsLeft -= 1;
        this.notify('countdown_tick', { secondsLeft });

        // Connect quickly for direct match
        if (secondsLeft === 13) {
          this.clearTimer();
          this.state = MATCH_STATES.CONNECTED;
          this.notify('state_change', {
            state: this.state,
            candidate,
            roomId: `room_${Date.now()}_${currentUser.id}_${candidate.id}`
          });
          resolve(candidate);
        }

        if (secondsLeft <= 0) {
          this.clearTimer();
          this.notify('state_change', { state: MATCH_STATES.TIMEOUT, candidate });
          resolve(null);
        }
      }, 1000);
    });
  }

  async findNextPartner(currentUser) {

    const allProfiles = await dbService.getAllProfiles();
    const blockedIds = await dbService.getBlockedUserIds(currentUser.id);

    // Filter eligible partners:
    // - Not current user
    // - Not suspended or banned
    // - Not blocked by either party
    // - Not recently attempted in this session
    let candidates = allProfiles.filter(p => 
      p.id !== currentUser.id &&
      p.status !== COMMUNITY_STATUS.SUSPENDED &&
      p.status !== 'banned' &&
      !blockedIds.includes(p.id) &&
      !this.recentAttemptedIds.has(p.id)
    );

    if (candidates.length === 0) {
      // If we exhausted recent list, clear recent history and try once more
      if (this.recentAttemptedIds.size > 0) {
        this.recentAttemptedIds.clear();
        candidates = allProfiles.filter(p => 
          p.id !== currentUser.id &&
          p.status !== COMMUNITY_STATUS.SUSPENDED &&
          p.status !== 'banned' &&
          !blockedIds.includes(p.id)
        );
      }

      if (candidates.length === 0) {
        // No real partners online right now
        this.state = MATCH_STATES.IDLE;
        this.currentCandidate = null;
        this.notify('state_change', { 
          state: this.state, 
          candidate: null,
          error: 'No speaking partners are currently available. You can share your personal practice link with a friend to start immediately!' 
        });
        return;
      }
    }

    // Select candidate
    let selected = candidates[0];
    this.currentCandidate = selected;
    this.recentAttemptedIds.add(selected.id);

    // Transition to Request Sent
    this.state = MATCH_STATES.REQUEST_SENT;
    this.notify('state_change', { 
      state: this.state, 
      candidate: selected, 
      timeoutSeconds: MATCHING_TIMEOUT_SECONDS 
    });

    // Start automatic partner response timer
    this.clearTimer();
    return new Promise((resolve) => {
      let secondsLeft = MATCHING_TIMEOUT_SECONDS;
      
      this.timer = setInterval(() => {
        secondsLeft -= 1;
        this.notify('countdown_tick', { secondsLeft });

        // Simulate realistic peer response after 2-3 seconds
        if (secondsLeft === 12) {
          this.clearTimer();
          this.state = MATCH_STATES.CONNECTED;
          this.notify('state_change', { 
            state: this.state, 
            candidate: selected,
            roomId: `room_${Date.now()}_${currentUser.id}_${selected.id}` 
          });
          resolve(selected);
        }

        if (secondsLeft <= 0) {
          this.clearTimer();
          this.notify('state_change', { state: MATCH_STATES.TIMEOUT, candidate: selected });
          resolve(this.findNextPartner(currentUser));
        }
      }, 1000);
    });
  }

  cancelMatching() {
    this.clearTimer();
    this.state = MATCH_STATES.IDLE;
    this.currentCandidate = null;
    this.notify('state_change', { state: this.state });
  }

  clearTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const matchingEngine = new MatchingEngine();
