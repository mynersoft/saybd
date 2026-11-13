import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { dbService, getDhakaDateString } from '../services/supabase/dbService.js';
import {
  supabase,
  isSupabaseConfigured,
  getSupabaseConfigStatus,
  formatSupabaseAuthError,
} from '../services/supabase/supabaseClient.js';
import { ROLES, COMMUNITY_STATUS, DEFAULT_DAILY_FREE_SECONDS } from '../config/constants.js';

const AuthContext = createContext();

const ADMIN_EMAIL = 'mdmahir.ds@gmail.com';

export function AuthProvider({ children }) {
  // Real authentication state: initialize to null; only authenticated after verifying Supabase session
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [usage, setUsage] = useState({
    usedSeconds: 0,
    maxAllowanceSeconds: DEFAULT_DAILY_FREE_SECONDS,
    date: getDhakaDateString(),
  });

  // Safe configuration status diagnostics
  const configStatus = getSupabaseConfigStatus();

  // -------------------------------------------------------------
  // 1. SESSION RESTORATION & AUTH STATE LISTENER
  // -------------------------------------------------------------
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      try {
        // Trigger server-side bootstrap check for initial admin account if server is active
        try {
          await fetch('/api/auth/bootstrap-admin', { method: 'POST' });
        } catch {
          // ignore network failure in detached environment
        }

        if (!isSupabaseConfigured || !supabase) {
          if (mounted) {
            setCurrentUser(null);
            try {
              localStorage.removeItem('saybd_auth_user');
            } catch {}
          }
          return;
        }

        // Restore real session from Supabase Auth
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.warn('[Supabase getSession notice]', formatSupabaseAuthError(sessionError));
        }

        const session = sessionData?.session;
        if (session?.user && mounted) {
          let profile = await dbService.getProfile(session.user.id);

          // If user exists in auth but profile record is not yet in public.profiles table, auto-provision
          if (!profile) {
            const isInitialAdmin = session.user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
            const fallbackProfile = {
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Learner',
              avatar_url: session.user.user_metadata?.avatar_url || '',
              native_language: session.user.user_metadata?.native_language || 'Bengali',
              country: session.user.user_metadata?.country || 'Bangladesh',
              role: isInitialAdmin ? ROLES.ADMIN : (session.user.user_metadata?.role || ROLES.STUDENT),
              status: COMMUNITY_STATUS.APPROVED,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };

            try {
              await supabase.from('profiles').upsert(fallbackProfile, { onConflict: 'id' });
              profile = fallbackProfile;
            } catch (err) {
              console.warn('[Profile fallback creation notice]', err);
              profile = fallbackProfile;
            }
          }

          const userObj = {
            id: session.user.id,
            email: session.user.email,
            ...profile,
          };

          setCurrentUser(userObj);
          try {
            localStorage.setItem('saybd_auth_user', JSON.stringify(userObj));
          } catch {}
        } else if (mounted) {
          setCurrentUser(null);
          try {
            localStorage.removeItem('saybd_auth_user');
          } catch {}
        }

        // Realtime Auth State Change Listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (!mounted) return;

          if (event === 'SIGNED_OUT' || !newSession) {
            setCurrentUser(null);
            try {
              localStorage.removeItem('saybd_auth_user');
            } catch {}
          } else if (newSession?.user) {
            const p = await dbService.getProfile(newSession.user.id);
            const userObj = {
              id: newSession.user.id,
              email: newSession.user.email,
              ...p,
            };
            setCurrentUser(userObj);
            try {
              localStorage.setItem('saybd_auth_user', JSON.stringify(userObj));
            } catch {}
          }
        });

        return () => {
          subscription?.unsubscribe();
        };
      } catch (err) {
        console.error('[SayBD initAuth critical error]', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    initAuth();

    return () => {
      mounted = false;
    };
  }, []);

  // -------------------------------------------------------------
  // 2. DAILY USAGE SYNCHRONIZATION
  // -------------------------------------------------------------
  const refreshUsage = useCallback(async (userId = currentUser?.id) => {
    if (!userId) return;
    const currentUsage = await dbService.getDailySpeakingUsage(userId);
    setUsage(currentUsage);
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      refreshUsage(currentUser.id);
    }
  }, [currentUser?.id, refreshUsage]);

  // Subscribe to real-time events across tabs & windows
  useEffect(() => {
    const unsubscribe = dbService.subscribe(msg => {
      if (msg.type === 'usage_update' && msg.userId === currentUser?.id) {
        setUsage(prev => ({ ...prev, usedSeconds: msg.usedSeconds }));
      }
      if (msg.type === 'table_update' && msg.table === 'profiles' && currentUser?.id) {
        dbService.getProfile(currentUser.id).then(p => {
          if (p) {
            setCurrentUser(prev => {
              const updated = { ...prev, ...p };
              try {
                localStorage.setItem('saybd_auth_user', JSON.stringify(updated));
              } catch {}
              return updated;
            });
          }
        });
      }
      if (msg.type === 'profile_picture_updated' && msg.userId === currentUser?.id) {
        setCurrentUser(prev => {
          const updated = { ...prev, avatar_url: msg.avatarUrl };
          try {
            localStorage.setItem('saybd_auth_user', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }
    });
    return unsubscribe;
  }, [currentUser?.id]);

  const recordSpeakingTime = useCallback(async (seconds) => {
    if (!currentUser?.id || seconds <= 0) return;
    const updatedUsed = await dbService.addSpeakingUsage(currentUser.id, seconds);
    setUsage(prev => ({ ...prev, usedSeconds: updatedUsed }));
  }, [currentUser?.id]);

  // -------------------------------------------------------------
  // 3. REAL SUPABASE LOGIN
  // -------------------------------------------------------------
  const login = async (email, password) => {
    setLoading(true);
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      if (!cleanEmail || !password) {
        throw new Error('Please enter both your email address and password.');
      }

      if (!isSupabaseConfigured || !supabase) {
        throw new Error(
          'Supabase is not configured. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in your environment variables to connect your real database.'
        );
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        throw new Error(formatSupabaseAuthError(error));
      }

      if (!data.user) {
        throw new Error('Login failed. No authenticated user record returned by Supabase.');
      }

      // Fetch authentic profile from database
      let profile = await dbService.getProfile(data.user.id);

      // Auto-provision profile if database record was not yet generated
      if (!profile) {
        const isDefaultAdmin = cleanEmail === ADMIN_EMAIL.toLowerCase();
        const initialProfile = {
          id: data.user.id,
          email: cleanEmail,
          full_name: data.user.user_metadata?.full_name || cleanEmail.split('@')[0],
          avatar_url: data.user.user_metadata?.avatar_url || '',
          native_language: data.user.user_metadata?.native_language || 'Bengali',
          country: data.user.user_metadata?.country || 'Bangladesh',
          role: isDefaultAdmin ? ROLES.ADMIN : (data.user.user_metadata?.role || ROLES.STUDENT),
          status: COMMUNITY_STATUS.APPROVED,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          await supabase.from('profiles').upsert(initialProfile, { onConflict: 'id' });
          profile = initialProfile;
        } catch (pErr) {
          console.warn('[Initial profile setup note]', pErr);
          profile = initialProfile;
        }
      }

      // Check account suspension or ban
      if (profile.status === 'suspended' || profile.status === 'banned') {
        const restrictedUser = {
          id: data.user.id,
          email: data.user.email,
          ...profile,
        };
        setCurrentUser(restrictedUser);
        try {
          localStorage.setItem('saybd_auth_user', JSON.stringify(restrictedUser));
        } catch {}
        return restrictedUser;
      }

      const userObj = {
        id: data.user.id,
        email: data.user.email,
        ...profile,
      };

      setCurrentUser(userObj);
      try {
        localStorage.setItem('saybd_auth_user', JSON.stringify(userObj));
      } catch {}
      return userObj;
    } catch (err) {
      throw new Error(formatSupabaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 4. REAL SUPABASE STUDENT REGISTRATION
  // -------------------------------------------------------------
  const register = async (email, password, fullName, metadata = {}) => {
    setLoading(true);
    try {
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanName = (fullName || '').trim();

      if (!cleanName || !cleanEmail || !password) {
        throw new Error('Please fill in all required fields.');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      if (!isSupabaseConfigured || !supabase) {
        throw new Error(
          'Supabase is not configured. Please define VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY) in your environment variables to enable real account creation.'
        );
      }

      // Public registration securely enforces Student role
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: cleanName,
            native_language: metadata.nativeLanguage || 'Bengali',
            country: metadata.country || 'Bangladesh',
            role: ROLES.STUDENT,
            status: COMMUNITY_STATUS.APPROVED,
          },
        },
      });

      if (error) {
        throw new Error(formatSupabaseAuthError(error));
      }

      // Handle duplicate user where Supabase returned empty identities (obfuscated anti-enumeration response)
      if (data.user?.identities && data.user.identities.length === 0) {
        throw new Error('An account with this email address already exists. Please log in instead.');
      }

      if (!data.user) {
        throw new Error('Registration failed. Please verify your details and try again.');
      }

      // Ensure profile row exists in public.profiles table
      try {
        const studentProfile = {
          id: data.user.id,
          email: cleanEmail,
          full_name: cleanName,
          avatar_url: '',
          native_language: metadata.nativeLanguage || 'Bengali',
          country: metadata.country || 'Bangladesh',
          bio: 'SayBD learner practicing conversational English.',
          role: ROLES.STUDENT,
          status: COMMUNITY_STATUS.APPROVED,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await supabase.from('profiles').upsert(studentProfile, { onConflict: 'id' });
      } catch (profileErr) {
        console.warn('[Registration profile sync notice]', profileErr);
      }

      return { user: data.user, success: true, email: cleanEmail };
    } catch (err) {
      throw new Error(formatSupabaseAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 5. PASSWORD RESET & MANAGEMENT
  // -------------------------------------------------------------
  // 5. PASSWORD RESET & EMAIL OTP RECOVERY FLOW
  // -------------------------------------------------------------
  const sendPasswordResetOtp = async (email) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Please enter your account email address.');
    }

    if (!isSupabaseConfigured || !supabase) {
      // Sandbox preview mode
      const simulatedOtp = '123456';
      try {
        sessionStorage.setItem('saybd_simulated_otp_' + cleanEmail, simulatedOtp);
      } catch {}
      return {
        success: true,
        message: `Verification code dispatched! (Preview test code: ${simulatedOtp})`,
        isSimulated: true
      };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);

    if (error) {
      throw new Error(formatSupabaseAuthError(error));
    }

    return {
      success: true,
      message: `A 6-digit recovery code has been sent to ${cleanEmail}.`
    };
  };

  const verifyPasswordResetOtp = async (email, token) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanToken = (token || '').trim();

    if (!cleanEmail || !cleanToken) {
      throw new Error('Please provide both your email address and 6-digit verification code.');
    }

    if (!isSupabaseConfigured || !supabase) {
      let storedSim = null;
      try {
        storedSim = sessionStorage.getItem('saybd_simulated_otp_' + cleanEmail);
      } catch {}
      if (cleanToken === '123456' || cleanToken === storedSim) {
        return {
          success: true,
          user: { email: cleanEmail, id: 'sim_user_' + cleanEmail.replace(/[^a-z0-9]/g, '') },
          session: { access_token: 'sim_session_token' }
        };
      }
      throw new Error('Invalid verification code. (Sandbox preview code: 123456)');
    }

    // Verify recovery OTP code via Supabase Auth server-side verification
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'recovery',
    });

    if (error) {
      throw new Error(formatSupabaseAuthError(error));
    }

    if (!data?.session) {
      throw new Error('Verification succeeded but no authenticated recovery session was returned. Please try again.');
    }

    return {
      success: true,
      user: data.user,
      session: data.session
    };
  };

  const updateRecoveryPassword = async (newPassword) => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    if (!isSupabaseConfigured || !supabase) {
      return { success: true, message: 'Password updated successfully.' };
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(formatSupabaseAuthError(error));
    }

    // Terminate recovery session cleanly so user logs in with new credentials
    try {
      await supabase.auth.signOut();
    } catch {}

    setCurrentUser(null);
    try {
      localStorage.removeItem('saybd_auth_user');
    } catch {}

    return { success: true, message: 'Password updated successfully.' };
  };

  const resetPassword = async (email) => {
    return sendPasswordResetOtp(email);
  };

  const changePassword = async (newPassword) => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(formatSupabaseAuthError(error));
    }

    return { success: true, message: 'Password updated successfully.' };
  };

  const completeInitialPasswordChange = async (newPassword) => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured.');
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { must_change_password: false }
    });
    if (error) {
      throw new Error(formatSupabaseAuthError(error));
    }

    if (currentUser?.id) {
      try {
        await supabase.from('profiles').update({ must_change_password: false }).eq('id', currentUser.id);
      } catch {}
      await updateProfile({ must_change_password: false });
    }

    setCurrentUser(prev => prev ? ({ ...prev, must_change_password: false }) : null);
    return { success: true, message: 'Your password has been changed successfully.' };
  };

  // -------------------------------------------------------------
  // 6. REAL SUPABASE LOGOUT
  // -------------------------------------------------------------
  const logout = async (navigate) => {
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          console.warn('[Supabase signOut notice]', error);
        }
      }
    } catch (err) {
      console.warn('[Logout cleanup note]', err);
    } finally {
      try {
        localStorage.removeItem('saybd_auth_user');
      } catch {}
      setCurrentUser(null);

      if (typeof navigate === 'function') {
        navigate('/login', { replace: true });
      } else if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  // -------------------------------------------------------------
  // 7. PROFILE UPDATE
  // -------------------------------------------------------------
  const updateProfile = async (updates) => {
    if (!currentUser?.id) return;
    const updated = await dbService.updateProfile(currentUser.id, updates, currentUser);
    const finalUser = { ...currentUser, ...updated };
    setCurrentUser(finalUser);
    try {
      localStorage.setItem('saybd_auth_user', JSON.stringify(finalUser));
    } catch {}
    return finalUser;
  };

  const remainingSeconds = Math.max(
    0,
    (usage.maxAllowanceSeconds || DEFAULT_DAILY_FREE_SECONDS) - usage.usedSeconds
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        usage,
        remainingSeconds,
        totalAvailableSeconds: remainingSeconds,
        maxAllowanceSeconds: usage.maxAllowanceSeconds || DEFAULT_DAILY_FREE_SECONDS,
        login,
        register,
        resetPassword,
        sendPasswordResetOtp,
        verifyPasswordResetOtp,
        updateRecoveryPassword,
        changePassword,
        completeInitialPasswordChange,
        mustChangePassword: Boolean(currentUser?.must_change_password),
        logout,
        updateProfile,
        recordSpeakingTime,
        refreshUsage,
        configStatus,
        isConfigured: isSupabaseConfigured,
        isApproved:
          Boolean(currentUser) &&
          currentUser?.status !== COMMUNITY_STATUS.SUSPENDED &&
          currentUser?.status !== 'banned',
        isMentor:
          currentUser?.role === ROLES.MENTOR ||
          currentUser?.role === ROLES.ADMIN,
        isAdmin:
          currentUser?.role === ROLES.ADMIN ||
          currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
        isSuspended:
          currentUser?.status === COMMUNITY_STATUS.SUSPENDED ||
          currentUser?.status === 'banned',
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
