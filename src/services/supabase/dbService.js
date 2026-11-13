import { profileService } from './db/profileService.js';
import { speakingService } from './db/speakingService.js';
import { mentorService } from './db/mentorService.js';
import { classService } from './db/classService.js';
import { courseService } from './db/courseService.js';
import { financeService } from './db/financeService.js';
import { adminService } from './db/adminService.js';
import { callService } from './db/callService.js';

// Re-exported so existing imports keep working
export { getDhakaDateString, getDhakaMonthName, getDhakaYear } from './db/dbCore.js';

/**
 * dbService is the single object the rest of the app uses (dbService.getProfile(), ...).
 * The real code now lives in separate files inside ./db/ :
 *   profileService   - profiles, community approval, avatars, notifications
 *   speakingService  - daily minutes, leaderboard, calendar, streak, practice sessions
 *   mentorService    - mentor profile, mentor dashboard stats, mentor applications
 *   classService     - live classes, enrollments, attendance, hand raising
 *   courseService    - courses, students/progress, reviews, purchases
 *   financeService   - earnings, withdrawals, payments, refunds
 *   adminService     - settings, reports, blocks, feedback, audit logs, announcements
 *   callService      - practice invitations, online presence, 1-to-1 call requests
 */
export const dbService = {
	...profileService,
	...speakingService,
	...mentorService,
	...classService,
	...courseService,
	...financeService,
	...adminService,
	...callService,
};
