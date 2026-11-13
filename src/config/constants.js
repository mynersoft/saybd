/**
 * SayBD - Application Constants & Configuration
 */

export const APP_NAME = 'SayBD';
export const TAGLINE = 'Practice English. Connect. Improve.';

// Timezone for daily speaking allowance reset
export const DEFAULT_TIMEZONE = 'Asia/Dhaka';

// Daily speaking limits (in seconds)
export const DEFAULT_DAILY_FREE_SECONDS = 20 * 60; // 20 minutes = 1200 seconds
export const MATCHING_TIMEOUT_SECONDS = 15; // 15s prompt timeout per partner

// Roles
export const ROLES = {
  STUDENT: 'student',
  MENTOR: 'mentor',
  ADMIN: 'admin',
};

// Community Approval Status
export const COMMUNITY_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  SUSPENDED: 'suspended',
};

// Classroom Speaking Modes
export const CLASSROOM_MODES = {
  RAISE_HAND: 'raise_hand',
  OPEN_DISCUSSION: 'open_discussion',
};

// Default WebRTC STUN/TURN configuration
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

// Speaking Topics for practice inspiration
export const PRACTICE_TOPICS = [
  { title: 'Travel & Cultures', prompt: 'Tell me about the most memorable place you have visited or dream to explore.' },
  { title: 'Career & Work Life', prompt: 'What skills are most important for your future career or current job?' },
  { title: 'Technology & AI', prompt: 'How do you think artificial intelligence is going to change education and daily life?' },
  { title: 'Food & Cooking', prompt: 'What is your favorite traditional dish, and how would you explain it to a foreigner?' },
  { title: 'Hobbies & Passions', prompt: 'What activity makes you lose track of time when you do it?' },
  { title: 'Current Events & Society', prompt: 'What is a positive trend you notice in modern society today?' },
];

// Bangladesh Payment Methods
export const PAYMENT_METHODS = [
  { id: 'bkash', name: 'bKash', logoColor: '#D12053', badge: 'Popular in BD' },
  { id: 'nagad', name: 'Nagad', logoColor: '#F7941D', badge: 'Instant' },
  { id: 'sslcommerz', name: 'SSLCommerz', logoColor: '#005E9E', badge: 'All BD Banks' },
  { id: 'card', name: 'Credit / Debit Card', logoColor: '#4F46E5', badge: 'Visa / Mastercard' },
];
