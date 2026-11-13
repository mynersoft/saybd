import { createClient } from '@supabase/supabase-js';

// Sanitize input helper: removes surrounding quotes, trailing slashes, and whitespace
function cleanEnvString(val) {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/^["']|["']$/g, '');
}

// Read public environment variables safely (supporting both standard and modern Vite conventions)
const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const cleanUrl = cleanEnvString(rawUrl).replace(/\/+$/, '');
const cleanAnonKey = cleanEnvString(rawAnonKey);

export const isSupabaseConfigured = Boolean(
  cleanUrl &&
  cleanAnonKey &&
  (cleanUrl.startsWith('https://') || cleanUrl.startsWith('http://localhost') || cleanUrl.startsWith('http://127.0.0.1')) &&
  !cleanUrl.includes('example.supabase.co') &&
  !cleanUrl.includes('your-project-id.supabase.co')
);

// Initialize single reusable Supabase client
export const supabase = isSupabaseConfigured
  ? createClient(cleanUrl, cleanAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// Safe diagnostics for status indicator without leaking secrets
export function getSupabaseConfigStatus() {
  let maskedUrl = 'Not Configured';
  if (cleanUrl) {
    try {
      const parsed = new URL(cleanUrl);
      const host = parsed.hostname;
      if (host.length > 12) {
        maskedUrl = `${host.substring(0, 8)}...${host.substring(host.length - 8)}`;
      } else {
        maskedUrl = host;
      }
    } catch {
      maskedUrl = cleanUrl.substring(0, 15) + '...';
    }
  }

  const missing = [];
  if (!cleanUrl) missing.push('VITE_SUPABASE_URL');
  if (!cleanAnonKey) missing.push('VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)');

  return {
    isConfigured: isSupabaseConfigured,
    maskedUrl,
    hasAnonKey: Boolean(cleanAnonKey),
    missingVariables: missing,
    cleanUrl,
  };
}

// User-facing friendly error mapper to eliminate raw "Failed to fetch"
export function formatSupabaseAuthError(err) {
  if (!err) return 'An unexpected error occurred. Please try again.';

  const rawMessage = (err.message || String(err)).trim();
  const lower = rawMessage.toLowerCase();

  // Failed to fetch / network failures
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network request failed') ||
    lower.includes('load failed')
  ) {
    return 'Unable to reach the Supabase authentication server. This usually happens if the Supabase project is paused, the project URL is incorrect, or your network/browser is blocking cross-origin requests. Please check your Supabase project status at supabase.com and verify your internet connection.';
  }

  // Invalid login credentials
  if (lower.includes('invalid login credentials') || lower.includes('invalid_grant')) {
    return 'Invalid email or password. Please verify your credentials and try again.';
  }

  // Email confirmation required
  if (lower.includes('email not confirmed')) {
    return 'Email confirmation required. Please check your inbox and verify your email address before logging in.';
  }

  // User already registered
  if (lower.includes('user already registered') || lower.includes('already registered')) {
    return 'An account with this email address already exists. Please log in instead.';
  }

  // Password length
  if (lower.includes('password should be at least') || lower.includes('password is too short')) {
    return 'Password must be at least 6 characters long.';
  }

  // Expired JWT / Session
  if (lower.includes('jwt expired') || lower.includes('session expired') || lower.includes('token expired')) {
    return 'Your session has expired. Please log in again to continue.';
  }

  // Rate limiting
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Too many attempts. Please wait a few moments before trying again.';
  }

  // OTP / Recovery Token
  if (
    lower.includes('token has expired or is invalid') ||
    lower.includes('token is expired') ||
    lower.includes('otp expired') ||
    lower.includes('invalid token') ||
    lower.includes('invalid otp')
  ) {
    return 'The 6-digit verification code is invalid or has expired. Please verify the code from your email or request a new one.';
  }

  // Database / Trigger error
  if (lower.includes('database error saving new user')) {
    return 'Database error during registration. Your account may have been created; please try logging in or contact support.';
  }

  return rawMessage;
}
