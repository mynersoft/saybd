import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotification } from '../contexts/NotificationContext.jsx';
import {
  Sparkles,
  Lock,
  Mail,
  LogIn,
  ArrowRight,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Database,
  HelpCircle
} from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, login, resetPassword, loading, configStatus, isConfigured } = useAuth();
  const { addToast } = useNotification();

  // If already authenticated and approved, redirect to appropriate destination
  useEffect(() => {
    if (currentUser && !loading) {
      if (currentUser.status === 'suspended' || currentUser.status === 'banned') {
        return; // stay or allow suspended view
      }
      const redirectParam = new URLSearchParams(location.search).get('redirect');
      const destination = redirectParam || location.state?.from?.pathname || (
        currentUser.role === 'admin' ? '/dashboard/admin' :
        currentUser.role === 'mentor' ? '/dashboard/mentor' :
        '/dashboard/student'
      );
      navigate(destination, { replace: true });
    }
  }, [currentUser, loading, navigate, location.state, location.search]);

  const [email, setEmail] = useState(() => location.state?.registeredEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const user = await login(cleanEmail, password);

      if (user.status === 'suspended' || user.status === 'banned') {
        setErrorMessage('Your SayBD account has been suspended or restricted. Please contact support.');
        addToast('Account access restricted.', 'error');
        return;
      }

      addToast(`Welcome back, ${user.full_name || 'Learner'}!`, 'success');

      const destination = location.state?.from?.pathname || (
        user.role === 'admin' ? '/dashboard/admin' :
        user.role === 'mentor' ? '/dashboard/mentor' :
        '/dashboard/student'
      );
      navigate(destination, { replace: true });
    } catch (err) {
      const msg = err.message || 'Unable to log in. Please check your credentials.';
      setErrorMessage(msg);
      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8 sm:py-14 px-4 space-y-6">
      
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Practice English. Connect. Improve.</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          Log in to SayBD
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Continue your real-time 1-on-1 English speaking practice & live classes.
        </p>
      </div>

      {/* Database Connection Status Diagnostic */}
      {!isConfigured ? (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-100">
            <Database className="w-4 h-4 text-amber-600" />
            <span>Supabase Database Connection Pending</span>
          </div>
          <p className="leading-relaxed">
            Please add your Supabase credentials to your environment variables to enable real authentication:
          </p>
          <ul className="list-disc list-inside font-mono text-[11px] space-y-0.5 text-amber-900/80 dark:text-amber-200/80">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY (or VITE_SUPABASE_PUBLISHABLE_KEY)</li>
          </ul>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 text-[11px] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Database: Connected</span>
          </div>
          <span className="font-mono text-[10px] text-slate-400">{configStatus.maskedUrl}</span>
        </div>
      )}

      {/* Main Login Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
        
        {location.state?.registrationSuccess && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">
              Your student account has been registered and auto-approved! Enter your password to log in.
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{errorMessage}</div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          
          {/* Email Field */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Email Address *
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                className="w-full text-xs font-semibold pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Password *
              </label>
              <Link
                to="/forgot-password"
                state={{ email: email.trim() }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMessage) setErrorMessage('');
                }}
                className="w-full text-xs font-semibold pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all hover:scale-101 active:scale-99 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Log In</span>
              </>
            )}
          </button>

        </form>

        <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
          Don't have a SayBD account yet?{' '}
          <Link
            to={new URLSearchParams(location.search).get('redirect') ? `/signup?redirect=${encodeURIComponent(new URLSearchParams(location.search).get('redirect'))}` : '/signup'}
            className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1"
          >
            <span>Sign up free</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

      </div>

    </div>
  );
}
