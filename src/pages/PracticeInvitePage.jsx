import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { dbService } from '../services/supabase/dbService.js';
import { PhoneCall, Users, Clock, AlertCircle, CheckCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export function PracticeInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadInvitation() {
      try {
        setLoading(true);
        setError(null);
        const data = await dbService.getPracticeInvitationByToken(token);
        if (!data) {
          setError('Invitation not found. The link may be incorrect.');
        } else if (data.isExpired) {
          setError('This invitation link has expired.');
        } else if (data.status === 'cancelled') {
          setError('This invitation was cancelled by the host.');
        } else if (data.status === 'used') {
          setError('This single-use invitation has already been accepted.');
        }
        if (active) setInvitation(data);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load invitation.');
      } finally {
        if (active) setLoading(false);
      }
    }

    if (token) loadInvitation();

    return () => { active = false; };
  }, [token]);

  const handleAcceptAndJoin = async () => {
    if (!currentUser) {
      navigate(`/signup?redirect=${encodeURIComponent(`/practice/invite/${token}`)}`);
      return;
    }

    if (currentUser.id === invitation?.creator_id) {
      navigate(`/practice?room=${encodeURIComponent(invitation.room_name || token)}`);
      return;
    }

    setJoining(true);
    try {
      await dbService.acceptPracticeInvitation({ token, friendId: currentUser.id });
      navigate(`/practice?room=${encodeURIComponent(invitation.room_name || token)}&partnerId=${encodeURIComponent(invitation.creator_id)}`);
    } catch (err) {
      setError(err.message || 'Could not accept invitation.');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Validating practice invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl text-center shadow-xl">
        <div className="w-14 h-14 mx-auto mb-4 bg-rose-50 dark:bg-rose-950/40 text-rose-500 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Invitation Unavailable</h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
          {error || 'This invitation is no longer active or could not be found.'}
        </p>
        <Link
          to="/practice"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-md shadow-indigo-600/20"
        >
          <PhoneCall className="w-4 h-4" />
          Go to Practice Hub
        </Link>
      </div>
    );
  }

  const creator = invitation.creator || {};

  return (
    <div className="max-w-xl mx-auto my-8 sm:my-16 px-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 mb-4">
            <CheckCircle className="w-3.5 h-3.5" />
            Active Practice Invitation
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            You're Invited to Practice Speaking
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            Practice English one-to-one in a secure, real-time audio session.
          </p>
        </div>

        {/* Inviter Card */}
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-700/80 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-md">
            {creator.avatar_url && creator.avatar_url.trim() ? (
              <img
                src={creator.avatar_url}
                alt={creator.full_name || 'Host'}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              (creator.full_name || 'U').charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white text-base truncate">
              {creator.full_name || 'SayBD Member'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>{creator.country || 'Bangladesh'}</span>
              <span>•</span>
              <span>Speaks {creator.native_language || 'Bengali'}</span>
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
            Host
          </span>
        </div>

        {/* Room Details */}
        <div className="grid grid-cols-2 gap-3 mb-8 text-xs text-slate-600 dark:text-slate-400">
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
            <Users className="w-4 h-4 text-indigo-500 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-200">1-on-1 Practice</p>
              <p className="text-[11px] text-slate-500">20 min allowance</p>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-emerald-500 shrink-0" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-200">Asia/Dhaka Bucket</p>
              <p className="text-[11px] text-slate-500">Real-time WebRTC</p>
            </div>
          </div>
        </div>

        {/* Call to action */}
        {currentUser ? (
          currentUser.id === invitation?.creator_id ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/60 text-xs text-indigo-700 dark:text-indigo-300 text-center font-medium">
                You created this practice invitation. Share this link with your friend to connect.
              </div>
              <button
                onClick={handleAcceptAndJoin}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-base transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer"
              >
                <PhoneCall className="w-5 h-5" />
                <span>Enter Practice Room Now</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAcceptAndJoin}
              disabled={joining}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold text-base transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2.5 disabled:opacity-50 cursor-pointer"
            >
              {joining ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <PhoneCall className="w-5 h-5" />
                  <span>Accept & Start Practice Call</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          )
        ) : (
          <div className="space-y-3">
            <button
              onClick={() => navigate(`/signup?redirect=${encodeURIComponent(`/practice/invite/${token}`)}`)}
              className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              <span>Create Account to Join Practice</span>
            </button>
            <p className="text-center text-xs text-slate-500">
              Already have an account?{' '}
              <button
                onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/practice/invite/${token}`)}`)}
                className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
              >
                Log in
              </button>
            </p>
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Peer-to-peer encrypted audio • Zero recordings</span>
        </div>
      </div>
    </div>
  );
}
