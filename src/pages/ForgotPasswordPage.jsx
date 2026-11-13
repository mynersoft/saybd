import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNotification } from '../contexts/NotificationContext.jsx';
import {
  KeyRound,
  Mail,
  Lock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Loader2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Copy,
  Check
} from 'lucide-react';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sendPasswordResetOtp, verifyPasswordResetOtp, updateRecoveryPassword } = useAuth();
  const { addToast } = useNotification();

  const queryParams = new URLSearchParams(location.search);
  const paramEmail = queryParams.get('email') || '';
  const paramToken = queryParams.get('token') || queryParams.get('code') || '';

  // Form State
  const [email, setEmail] = useState(() => location.state?.email || paramEmail || '');
  const [otpDigits, setOtpDigits] = useState(() => {
    if (paramToken && paramToken.length === 6) {
      return paramToken.split('').slice(0, 6);
    }
    return ['', '', '', '', '', ''];
  });

  // Steps: 1: 'request_otp', 2: 'verify_otp', 3: 'reset_password', 4: 'success'
  const [currentStep, setCurrentStep] = useState(() => {
    if ((paramEmail || location.state?.email) && paramToken && paramToken.length === 6) {
      return 2;
    }
    return 1;
  });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState('');
  const [showSupabaseGuide, setShowSupabaseGuide] = useState(false);

  // Resend Cooldown Timer
  const [resendCooldown, setResendCooldown] = useState(0);

  // Brute-force rate limiting attempts
  const [failedAttempts, setFailedAttempts] = useState(0);

  // Refs for 6-digit OTP inputs
  const inputRefs = useRef([]);

  // Resend cooldown timer countdown
  useEffect(() => {
    let interval = null;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [resendCooldown]);

  // Focus first input when moving to OTP step
  useEffect(() => {
    if (currentStep === 2) {
      const firstEmptyIndex = otpDigits.findIndex(d => !d);
      const targetIndex = firstEmptyIndex !== -1 ? firstEmptyIndex : 0;
      setTimeout(() => {
        inputRefs.current[targetIndex]?.focus();
      }, 100);
    }
  }, [currentStep]);

  // --------------------------------------------------------------------------
  // STEP 1: SEND RECOVERY OTP TO EMAIL
  // --------------------------------------------------------------------------
  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    setErrorMessage('');
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await sendPasswordResetOtp(cleanEmail);
      setSuccessNotice(res?.message || `A 6-digit recovery code has been sent to ${cleanEmail}.`);
      setResendCooldown(60);
      setCurrentStep(2);
      addToast(res?.message || 'Verification code dispatched to your email.', 'success');
    } catch (err) {
      console.warn('[Recovery OTP Dispatch]', err);
      const msg = err.message || '';
      if (msg.includes('Too many attempts') || msg.includes('rate limit')) {
        setErrorMessage(msg);
        addToast(msg, 'error');
        return;
      }
      setSuccessNotice(`If an account exists for ${cleanEmail}, a verification code has been dispatched.`);
      setResendCooldown(60);
      setCurrentStep(2);
      addToast('A verification code has been dispatched to your email.', 'info');
    } finally {
      setIsLoading(false);
    }
  };

  // Core verification execution
  const executeVerification = async (codeToVerify) => {
    if (isLoading) return;
    setErrorMessage('');

    if (failedAttempts >= 5) {
      setErrorMessage('Too many failed attempts. Please wait 60 seconds before trying again.');
      return;
    }

    const fullCode = (codeToVerify || otpDigits.join('')).trim();
    if (fullCode.length !== 6) {
      setErrorMessage('Please enter all 6 digits of your verification code.');
      return;
    }

    setIsLoading(true);
    try {
      await verifyPasswordResetOtp(email.trim().toLowerCase(), fullCode);
      setFailedAttempts(0);
      setCurrentStep(3);
      addToast('Verification code confirmed! Please set your new password.', 'success');
    } catch (err) {
      setFailedAttempts((prev) => prev + 1);
      const msg = err.message || 'Invalid or expired verification code. Please check the code and try again.';
      setErrorMessage(msg);
      addToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 2: VERIFY 6-DIGIT OTP
  // --------------------------------------------------------------------------
  const handleOtpChange = (index, value) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, '');
    const newDigits = [...otpDigits];

    if (cleaned.length > 0) {
      newDigits[index] = cleaned.charAt(cleaned.length - 1);
      setOtpDigits(newDigits);
      if (errorMessage) setErrorMessage('');

      // Auto-advance to next input
      if (index < 5) {
        inputRefs.current[index + 1]?.focus();
      } else {
        // If 6th digit entered and all digits complete, auto-verify
        if (newDigits.every(d => d.length === 1)) {
          setTimeout(() => {
            executeVerification(newDigits.join(''));
          }, 150);
        }
      }
    } else {
      newDigits[index] = '';
      setOtpDigits(newDigits);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted.charAt(i) || '';
    }
    setOtpDigits(newDigits);
    if (errorMessage) setErrorMessage('');

    // Focus last filled box or next empty
    const lastFilledIndex = Math.min(pasted.length - 1, 5);
    inputRefs.current[lastFilledIndex]?.focus();

    // If complete 6-digit paste, auto-verify
    if (pasted.length === 6) {
      setTimeout(() => {
        executeVerification(pasted);
      }, 150);
    }
  };

  const handleVerifyOtp = (e) => {
    e?.preventDefault();
    executeVerification();
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await sendPasswordResetOtp(email.trim().toLowerCase());
      setResendCooldown(60);
      setOtpDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      addToast(res?.message || 'A new 6-digit verification code has been sent.', 'success');
    } catch (err) {
      setErrorMessage(err.message || 'Failed to resend code. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // --------------------------------------------------------------------------
  // STEP 3: SUBMIT NEW PASSWORD
  // --------------------------------------------------------------------------
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setIsLoading(true);
    try {
      await updateRecoveryPassword(newPassword);
      setCurrentStep(4);
      addToast('Your password has been reset successfully!', 'success');
    } catch (err) {
      setErrorMessage(err.message || 'Unable to update password. Please try the verification flow again.');
      addToast('Password update error.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const isOtpComplete = otpDigits.every((d) => d.length === 1);

  return (
    <div className="max-w-md mx-auto py-8 sm:py-14 px-4 space-y-6">
      {/* Top Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50">
          <KeyRound className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span>SayBD Account Recovery</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          {currentStep === 1 && 'Forgot Your Password?'}
          {currentStep === 2 && 'Verify 6-Digit Code'}
          {currentStep === 3 && 'Create New Password'}
          {currentStep === 4 && 'Password Reset Complete!'}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          {currentStep === 1 && 'Enter your registered email address to receive a secure 6-digit recovery code.'}
          {currentStep === 2 && `We've sent a 6-digit verification code to ${email}.`}
          {currentStep === 3 && 'Choose a strong, secure new password for your SayBD account.'}
          {currentStep === 4 && 'Your password has been updated. You can now log in.'}
        </p>
      </div>

      {/* Progress Steps Indicator */}
      {currentStep < 4 && (
        <div className="flex items-center justify-center gap-2 px-4">
          {[
            { step: 1, label: 'Email' },
            { step: 2, label: 'Verify Code' },
            { step: 3, label: 'New Password' }
          ].map((item, idx) => {
            const isActive = currentStep === item.step;
            const isCompleted = currentStep > item.step;
            return (
              <React.Fragment key={item.step}>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : item.step}
                  </div>
                  <span
                    className={`text-[11px] font-semibold hidden sm:inline ${
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                        : isCompleted
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {item.label}
                  </span>
                </div>
                {idx < 2 && (
                  <div
                    className={`flex-1 h-0.5 max-w-8 transition-colors ${
                      currentStep > item.step ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Main Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl space-y-5">
        {/* Error Notice */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed font-medium">{errorMessage}</div>
          </div>
        )}

        {/* STEP 1: EMAIL INPUT */}
        {currentStep === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Registered Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoFocus
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all hover:scale-101 active:scale-99 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <>
                  <span>Send Recovery Code</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 2: VERIFY 6-DIGIT OTP */}
        {currentStep === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  6-Digit Verification Code *
                </label>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
                >
                  Change Email
                </button>
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="flex items-center justify-between gap-1.5 sm:gap-2.5 my-2" onPaste={handleOtpPaste}>
                {otpDigits.map((digit, index) => {
                  const isFilled = digit.length > 0;
                  return (
                    <input
                      key={index}
                      ref={(el) => (inputRefs.current[index] = el)}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={1}
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      className={`w-11 h-13 sm:w-12 sm:h-14 text-center font-mono text-xl sm:text-2xl font-black rounded-xl border transition-all select-all ${
                        isFilled
                          ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white hover:border-slate-300 dark:hover:border-slate-600'
                      } focus:border-indigo-600 focus:ring-3 focus:ring-indigo-500/30 focus:outline-none`}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-2 text-center">
                Paste the 6-digit code or type it digit-by-digit.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || !isOtpComplete}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all hover:scale-101 active:scale-99 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify & Proceed to New Password</span>
                </>
              )}
            </button>

            {/* Resend Action */}
            <div className="text-center pt-1">
              {resendCooldown > 0 ? (
                <span className="text-xs text-slate-400">
                  Resend code in <strong className="font-mono text-indigo-600 dark:text-indigo-400">{resendCooldown}s</strong>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={isLoading}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Resend 6-Digit Code</span>
                </button>
              )}
            </div>

            {/* Supabase Dashboard Setup Helper Accordion */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowSupabaseGuide(!showSupabaseGuide)}
                className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors py-1 cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Supabase Email OTP Setup Guide</span>
                </span>
                {showSupabaseGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {showSupabaseGuide && (
                <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-[11px] text-slate-600 dark:text-slate-300 space-y-2">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    To send 6-digit numeric codes instead of magic links in Supabase:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-500 dark:text-slate-400">
                    <li>Go to <strong>Authentication &gt; Email Templates &gt; Reset Password</strong>.</li>
                    <li>Subject: <code className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-[10px]">SayBD Verification Code: &#123;&#123; .Token &#125;&#125;</code></li>
                    <li>Replace <code className="text-rose-500">&#123;&#123; .ConfirmationURL &#125;&#125;</code> with <code className="text-emerald-500 font-bold">&#123;&#123; .Token &#125;&#125;</code> in the email body.</li>
                  </ol>
                  <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
                    See <code className="text-indigo-500 font-mono">/supabase/email-templates/recovery.html</code> for the ready-to-paste template.
                  </p>
                </div>
              )}
            </div>
          </form>
        )}

        {/* STEP 3: RESET PASSWORD */}
        {currentStep === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            {/* New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                New Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
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

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Confirm New Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  className="w-full text-xs font-semibold pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Password Validation checklist */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${newPassword.length >= 6 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <span className={newPassword.length >= 6 ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-400'}>
                  At least 6 characters long
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${newPassword && newPassword === confirmPassword ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                <span className={newPassword && newPassword === confirmPassword ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-400'}>
                  Passwords match
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all hover:scale-101 active:scale-99 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 4: SUCCESS */}
        {currentStep === 4 && (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Password Successfully Reset!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
                Your SayBD account credentials have been updated securely. You can now log in with your new password.
              </p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/login', { state: { registeredEmail: email } })}
                className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/25 transition-all hover:scale-101 active:scale-99 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Back to Login</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Bottom Navigation */}
        {currentStep < 4 && (
          <div className="pt-2 text-center text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
            Remembered your password?{' '}
            <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Login</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
