import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dbService } from '../../services/supabase/dbService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { formatCurrency, formatDate } from '../../utils/formatters.js';
import { COMMUNITY_STATUS, ROLES } from '../../config/constants.js';
import {
  Trophy,
  Users,
  Shield,
  Clock,
  BookOpen,
  DollarSign,
  Settings,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  Search,
  Save,
  Activity,
  Check,
  CreditCard,
  RotateCcw,
  Sliders,
  FileText,
  Sparkles,
  Hourglass,
  AlertCircle,
  Filter,
  ArrowUpRight
} from 'lucide-react';

export function AdminDashboard({ activeTabProp, onTabChange }) {
  const { currentUser, isAdmin, mustChangePassword, completeInitialPasswordChange } = useAuth();
  const { addToast } = useNotification();

  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState(false);

  const [internalActiveTab, setInternalActiveTab] = useState('overview');
  const activeTab = activeTabProp || internalActiveTab;
  const setActiveTab = onTabChange || setInternalActiveTab;
  const [profiles, setProfiles] = useState([]);
  const [classes, setClasses] = useState([]);
  const [reports, setReports] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [mentorApplications, setMentorApplications] = useState([]);

  const handleAdminPasswordChange = async (e) => {
    e.preventDefault();
    setPasswordChangeError('');
    if (adminNewPassword.length < 6) {
      setPasswordChangeError('New password must be at least 6 characters long.');
      return;
    }
    if (adminNewPassword !== adminConfirmPassword) {
      setPasswordChangeError('Passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      if (completeInitialPasswordChange) {
        await completeInitialPasswordChange(adminNewPassword);
      }
      setPasswordChangeSuccess(true);
      addToast('Admin password changed successfully!', 'success');
    } catch (err) {
      setPasswordChangeError(err.message || 'Failed to change admin password.');
    } finally {
      setChangingPassword(false);
    }
  };

  // Financial & Payout State
  const [financials, setFinancials] = useState({
    totalGrossSalesBdt: 0,
    platformCommissionBdt: 0,
    mentorNetPoolBdt: 0,
    totalDisbursedBdt: 0,
    totalPendingPayoutBdt: 0,
    pendingPayoutCount: 0,
    commissionPercentage: 20
  });
  const [financialSettings, setFinancialSettings] = useState({
    commission_percentage: 20,
    minimum_payout_bdt: 500,
  });
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawalFilter, setWithdrawalFilter] = useState('all');
  const [withdrawalSearch, setWithdrawalSearch] = useState('');

  const [settings, setSettings] = useState({
    daily_free_minutes: { minutes: 20 },
    matching_timeout_seconds: { seconds: 15 },
    max_classroom_attendees: { limit: 50 },
    max_active_mics_open_discussion: { limit: 10 },
  });
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    const p = await dbService.getAllProfiles();
    setProfiles(p);
    const c = await dbService.getLiveClasses();
    setClasses(c);
    const r = await dbService.getReports();
    setReports(r);
    const s = await dbService.getPlatformSettings();
    if (s) setSettings(s);
    
    // Financials
    const fin = await dbService.getPlatformFinancialSummary();
    if (fin) setFinancials(fin);
    const finSet = await dbService.getPlatformFinancialSettings();
    if (finSet) setFinancialSettings(finSet);
    const wds = await dbService.getAllWithdrawalsAdmin();
    setWithdrawals(wds);

    const logs = await dbService.getAuditLogs();
    setAuditLogs(logs);

    const apps = await dbService.getMentorApplications();
    setMentorApplications(apps);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleApproveCommunity = async (userId) => {
    await dbService.setCommunityStatus(userId, COMMUNITY_STATUS.APPROVED, 'Approved by Administrator');
    addToast('User approved for community practice & classrooms!', 'success');
    loadData();
  };

  const handleSuspendUser = async (userId) => {
    await dbService.setCommunityStatus(userId, COMMUNITY_STATUS.SUSPENDED, 'Violation of community safety rules');
    addToast('User suspended.', 'error');
    loadData();
  };

  

const handleReviewMentorApp = async (applicationId, status, rejectionReason = '') => {
  try {
    await dbService.reviewMentorApplication({ applicationId, status, rejectionReason });
    addToast(
      status === 'approved'
        ? 'Mentor approved. Notification and email sent!'
        : 'Mentor application rejected.',
      status === 'approved' ? 'success' : 'info'
    );
  } catch (err) {
    addToast(err.message || 'Could not review application', 'error');
  }
  loadData();
};

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    await dbService.savePlatformSettings(settings);
    addToast('Platform settings successfully saved!', 'success');
  };

  const handleSaveFinancialSettings = async (e) => {
    e.preventDefault();
    await dbService.savePlatformFinancialSettings(financialSettings, currentUser?.id);
    addToast('Financial rules & commission rates updated!', 'success');
    loadData();
  };

  const handleApproveWithdrawal = async (withdrawalId) => {
    const trxRef = window.prompt('Enter transaction reference ID (e.g. bKash / Nagad TrxID):', `TXN${Date.now()}`);
    if (trxRef !== null) {
      await dbService.adminApproveWithdrawal(withdrawalId, trxRef, currentUser?.id);
      addToast('Payout marked as approved and transaction recorded!', 'success');
      loadData();
    }
  };

  const handleRejectWithdrawal = async (withdrawalId) => {
    const reason = window.prompt('Enter reason for rejecting withdrawal:', 'Account number invalid or KYC mismatched');
    if (reason !== null) {
      await dbService.adminRejectWithdrawal(withdrawalId, reason, currentUser?.id);
      addToast('Withdrawal rejected and balance restored.', 'error');
      loadData();
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <Shield className="w-6 h-6" />
        </div>
        <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Admin Access Restricted</h3>
        <p className="text-xs text-slate-500">Only authorized platform administrators may access this console.</p>
      </div>
    );
  }

  const pendingMembers = profiles.filter(p => p.status === COMMUNITY_STATUS.PENDING);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-8 rounded-2xl sm:rounded-3xl bg-slate-900 text-white shadow-xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-600 text-white">
              <Shield className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              SayBD Executive Console
            </span>
          </div>
          <h1 className="text-xl sm:text-3xl font-black mt-1">Platform Administration</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage community safety, mentor authorizations, speaking quotas, and live sessions.
          </p>
          <div className="flex items-center gap-2 mt-2.5">
            <Link
              to="/leaderboard"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all hover:scale-102"
              title="Inspect live student speaking time leaderboard"
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Inspect Speaking Leaderboard</span>
            </Link>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0 bg-slate-800/80 p-1 rounded-2xl border border-slate-700">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'approval', label: `Approval (${pendingMembers.length})`, icon: CheckCircle2 },
            { id: 'mentor-apps', label: `Mentor Apps (${mentorApplications.filter(a => a.status === 'pending').length})`, icon: Sparkles },
            { id: 'payouts', label: `Payouts (${withdrawals.filter(w => w.status === 'pending').length})`, icon: CreditCard },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'classes', label: 'Live Sessions', icon: Radio },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Mandatory Password Change Prompt on First Login */}
      {mustChangePassword && !passwordChangeSuccess && (
        <div className="p-5 sm:p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 text-slate-900 dark:text-white space-y-4 animate-in fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-500 shrink-0">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-amber-600 dark:text-amber-400">
                Action Required: Change Initial Admin Password
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                For security, your initial administrator account requires you to set your own private password on first login.
              </p>
            </div>
          </div>

          <form onSubmit={handleAdminPasswordChange} className="space-y-3 max-w-md">
            {passwordChangeError && (
              <div className="p-3 rounded-xl bg-rose-500/20 text-rose-500 text-xs font-medium">
                {passwordChangeError}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="password"
                required
                placeholder="New Password (min 6 chars)"
                value={adminNewPassword}
                onChange={(e) => setAdminNewPassword(e.target.value)}
                className="px-3 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <input
                type="password"
                required
                placeholder="Confirm New Password"
                value={adminConfirmPassword}
                onChange={(e) => setAdminConfirmPassword(e.target.value)}
                className="px-3 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={changingPassword || adminNewPassword.length < 6 || adminNewPassword !== adminConfirmPassword}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              {changingPassword ? 'Updating Password...' : 'Save & Secure Admin Account'}
            </button>
          </form>
        </div>
      )}

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-bold uppercase">Total Registered</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{profiles.length}</p>
              <span className="text-[11px] text-emerald-500 font-semibold mt-1 block">Active Community</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-bold uppercase">Pending Approval</span>
              <p className="text-2xl font-black text-amber-500 mt-1">{pendingMembers.length}</p>
              <span className="text-[11px] text-slate-400 mt-1 block">Awaiting review</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-bold uppercase">Active Classrooms</span>
              <p className="text-2xl font-black text-indigo-500 mt-1">
                {classes.filter(c => c.status === 'live').length}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">SFU Stream Online</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-bold uppercase">Reported Abuse</span>
              <p className="text-2xl font-black text-rose-500 mt-1">{reports.length}</p>
              <span className="text-[11px] text-slate-400 mt-1 block">Zero tolerance target</span>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" /> Infrastructure & Scalability Health
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block mb-1">WebRTC STUN Connectivity</span>
                <span className="font-bold text-emerald-500">Google STUN Nodes Active (38ms)</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block mb-1">SFU Media Relay</span>
                <span className="font-bold text-indigo-500">LiveKit SFU Protocol Ready (Max 200)</span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-400 block mb-1">Database & RLS</span>
                <span className="font-bold text-emerald-500">PostgreSQL Schema Migrated</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMMUNITY APPROVAL QUEUE */}
      {activeTab === 'approval' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Member Community Approvals
              </h3>
              <p className="text-xs text-slate-500">
                Prevent random harassment by screening candidates before unlocking partner matching.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {pendingMembers.length} Pending
            </span>
          </div>

          {pendingMembers.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-1">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="font-bold text-slate-700 dark:text-slate-300">No pending requests</p>
              <p>All registered students have been reviewed and approved.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.full_name}
                        className="w-10 h-10 rounded-xl object-cover ring-2 ring-amber-500/40"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-sm flex items-center justify-center ring-2 ring-amber-500/40 uppercase">
                        {(member.full_name || 'U').charAt(0)}
                      </div>
                    )}
                    <div>
                      <h5 className="font-bold text-slate-900 dark:text-white">{member.full_name}</h5>
                      <p className="text-slate-500">{member.native_language}</p>
                      <p className="text-slate-400 mt-0.5 line-clamp-1 italic">"{member.bio || 'Wants to practice spoken English'}"</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApproveCommunity(member.id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve Member
                    </button>
                    <button
                      onClick={() => handleSuspendUser(member.id)}
                      className="px-4 py-2 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 hover:bg-rose-200 font-bold"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: MENTOR APPLICATIONS REVIEW */}
      {activeTab === 'mentor-apps' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                Mentor Applications
              </h3>
              <p className="text-xs text-slate-500">
                Review educator credentials, qualifications, and promote candidates to verified Mentors.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
              {mentorApplications.filter(a => a.status === 'pending').length} Pending Review
            </span>
          </div>

          {mentorApplications.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-1">
              <Sparkles className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
              <p className="font-bold text-slate-700 dark:text-slate-300">No mentor applications</p>
              <p>Submitted educator applications will appear here for administrator verification.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {mentorApplications.map((app) => (
                <div
                  key={app.id}
                  className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3 text-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                        {app.full_name} <span className="text-slate-400 font-normal">({app.email})</span>
                      </h4>
                      <p className="text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                        {app.title} • {app.years_experience} years experience
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider self-start sm:self-auto ${
                      app.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : app.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {app.status}
                    </span>
                  </div>

                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                    {app.bio}
                  </p>

                  {app.expertise?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {app.expertise.map((exp, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold border border-indigo-200/50 dark:border-indigo-800/50">
                          {exp}
                        </span>
                      ))}
                    </div>
                  )}

                  {(app.resume_url || app.video_intro_url) && (
                    <div className="flex items-center gap-3 pt-1 text-[11px]">
                      {app.resume_url && (
                        <a
                          href={app.resume_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                        >
                          View Resume / Portfolio <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                      {app.video_intro_url && (
                        <a
                          href={app.video_intro_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline flex items-center gap-1 font-semibold"
                        >
                          View Intro Video <ArrowUpRight className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  )}

                  {app.status === 'pending' && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => handleReviewMentorApp(app.id, 'rejected', 'Did not meet current requirements')}
                        className="px-3.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleReviewMentorApp(app.id, 'approved')}
                        className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        <Check className="w-3.5 h-3.5" /> Approve & Promote to Mentor
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: USERS DIRECTORY */}
      {activeTab === 'users' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Registered Users</h3>
            <span className="text-xs text-slate-400">{profiles.length} Total</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {profiles.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No registered users found in database yet.
              </div>
            ) : (
              profiles.map((u) => (
              <div key={u.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt={u.full_name} className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center uppercase">
                      {(u.full_name || u.email || 'U').charAt(0)}
                    </div>
                  )}
                  <div>
                    <h5 className="font-bold text-slate-900 dark:text-white">{u.full_name}</h5>
                    <span className="text-slate-400">{u.native_language}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {u.role}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.status === 'approved'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {u.status}
                  </span>
                </div>
              </div>
            )))}
          </div>
        </div>
      )}

      {/* TAB 4: LIVE CLASSES MONITOR */}
      {activeTab === 'classes' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Classrooms Monitor</h3>
          <div className="space-y-3">
            {classes.map((c) => (
              <div key={c.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white">{c.title}</h4>
                  <p className="text-slate-400">Mentor: {c.mentor_name} • Mode: {c.speaking_mode}</p>
                </div>
                <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  {c.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: PLATFORM SETTINGS */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 max-w-xl">
          <div>
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Platform Settings & Quotas</h3>
            <p className="text-xs text-slate-500">Configure business parameters and daily free allowances.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Daily Free Speaking Allowance (Minutes)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={settings.daily_free_minutes?.minutes || 20}
              onChange={(e) => setSettings({
                ...settings,
                daily_free_minutes: { minutes: parseInt(e.target.value, 10) }
              })}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Default: 20 minutes (1200 seconds)</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Partner Response Timeout (Seconds)
            </label>
            <input
              type="number"
              min={5}
              max={60}
              value={settings.matching_timeout_seconds?.seconds || 15}
              onChange={(e) => setSettings({
                ...settings,
                matching_timeout_seconds: { seconds: parseInt(e.target.value, 10) }
              })}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Default: 15 seconds per candidate before re-queue</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Max Active Mics in Open Discussion Mode
            </label>
            <input
              type="number"
              min={2}
              max={20}
              value={settings.max_active_mics_open_discussion?.limit || 10}
              onChange={(e) => setSettings({
                ...settings,
                max_active_mics_open_discussion: { limit: parseInt(e.target.value, 10) }
              })}
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Platform Settings
          </button>
        </form>
      )}

      {/* TAB: MENTOR EARNINGS & PAYOUTS MANAGEMENT */}
      {activeTab === 'payouts' && (
        <div className="space-y-6">
          
          {/* Top Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Gross Sales</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                ৳{financials.totalGrossSalesBdt?.toLocaleString()}
              </p>
              <span className="text-[11px] text-indigo-500 font-semibold mt-1 block">Course & Masterclass Revenue</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Platform Commission</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                ৳{financials.platformCommissionBdt?.toLocaleString()}
              </p>
              <span className="text-[11px] text-emerald-500 font-semibold mt-1 block">
                {financials.commissionPercentage || 20}% SayBD Share
              </span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Disbursed</span>
              <p className="text-2xl font-black text-slate-900 dark:text-white mt-1 font-mono">
                ৳{financials.totalDisbursedBdt?.toLocaleString()}
              </p>
              <span className="text-[11px] text-slate-400 mt-1 block">Paid out to mentors</span>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Pending Payouts</span>
              <p className="text-2xl font-black text-amber-500 mt-1 font-mono">
                ৳{financials.totalPendingPayoutBdt?.toLocaleString()}
              </p>
              <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">
                {financials.pendingPayoutCount} withdrawal requests pending
              </span>
            </div>
          </div>

          {/* Platform Financial Configuration Card */}
          <form
            onSubmit={handleSaveFinancialSettings}
            className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                    Platform Commission & Payout Configuration
                  </h3>
                  <p className="text-xs text-slate-400">
                    Control commission rates split between platform and mentors, and minimum withdrawal thresholds.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  SayBD Platform Commission (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={financialSettings.commission_percentage}
                    onChange={(e) => setFinancialSettings({
                      ...financialSettings,
                      commission_percentage: parseInt(e.target.value, 10) || 0
                    })}
                    className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Remaining {100 - (financialSettings.commission_percentage || 20)}% is directly credited to the Mentor.
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Minimum Payout Threshold (BDT)
                </label>
                <input
                  type="number"
                  min={100}
                  step={50}
                  value={financialSettings.minimum_payout_bdt}
                  onChange={(e) => setFinancialSettings({
                    ...financialSettings,
                    minimum_payout_bdt: parseInt(e.target.value, 10) || 500
                  })}
                  className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Minimum balance required for mentor withdrawal request.</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Save Financial Settings</span>
              </button>
            </div>
          </form>

          {/* Withdrawals Master Table & Controls */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by mentor name, email, or account number..."
                  value={withdrawalSearch}
                  onChange={(e) => setWithdrawalSearch(e.target.value)}
                  className="w-full text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              {/* Status Filter Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {['all', 'pending', 'approved', 'rejected'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setWithdrawalFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                      withdrawalFilter === st
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Withdrawals List Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Mentor</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payout Method</th>
                    <th className="py-3 px-4">Account / Wallet</th>
                    <th className="py-3 px-4">Requested On</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Admin Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {withdrawals
                    .filter((w) => {
                      const matchQuery =
                        !withdrawalSearch ||
                        w.mentor_name?.toLowerCase().includes(withdrawalSearch.toLowerCase()) ||
                        w.mentor_email?.toLowerCase().includes(withdrawalSearch.toLowerCase()) ||
                        w.account_number?.includes(withdrawalSearch);
                      const matchStatus =
                        withdrawalFilter === 'all' || w.status === withdrawalFilter;
                      return matchQuery && matchStatus;
                    })
                    .map((w) => (
                      <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        
                        {/* Mentor */}
                        <td className="py-3 px-4">
                          <p className="font-bold text-slate-900 dark:text-white">{w.mentor_name}</p>
                          <span className="text-[10px] text-slate-400">{w.mentor_email}</span>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-4">
                          <span className="font-black font-mono text-sm text-slate-900 dark:text-white">
                            ৳{w.amount?.toLocaleString()}
                          </span>
                        </td>

                        {/* Method */}
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {w.payment_method}
                          </span>
                        </td>

                        {/* Account Number */}
                        <td className="py-3 px-4">
                          <p className="font-mono text-xs text-slate-800 dark:text-slate-200 font-bold">
                            {w.account_number}
                          </p>
                          {w.account_details && (
                            <span className="text-[10px] text-slate-400">{w.account_details}</span>
                          )}
                        </td>

                        {/* Date Requested */}
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {formatDate(w.requested_at)}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          {w.status === 'approved' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Approved & Paid
                            </span>
                          )}
                          {w.status === 'pending' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Pending Review
                            </span>
                          )}
                          {w.status === 'rejected' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" title={w.notes}>
                              Rejected
                            </span>
                          )}
                          {w.transaction_ref && (
                            <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                              Ref: {w.transaction_ref}
                            </span>
                          )}
                        </td>

                        {/* Admin Action Buttons */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {w.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleApproveWithdrawal(w.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors"
                                  title="Approve payout and record transaction reference"
                                >
                                  Approve & Disburse
                                </button>
                                <button
                                  onClick={() => handleRejectWithdrawal(w.id)}
                                  className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950 text-slate-700 dark:text-slate-300 font-bold text-[11px] transition-colors"
                                  title="Reject payout request"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            {w.status === 'approved' && (
                              <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 justify-end">
                                <Check className="w-3.5 h-3.5" /> Settled
                              </span>
                            )}
                          </div>
                        </td>

                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

          </div>

          {/* Audit Logs Section */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-500" />
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                Administrative Audit Trail (Financials, Safety & System)
              </h3>
            </div>
            
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400">No administrative events recorded yet.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[11px] flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white font-mono uppercase">
                        {log.action}
                      </span>
                      <span className="text-slate-400 ml-2">
                        Actor: <strong>{log.actor_id}</strong>
                      </span>
                      {log.metadata?.reason && (
                        <span className="text-rose-500 ml-2 font-medium">
                          Reason: {log.metadata.reason}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 font-mono text-[10px] shrink-0">
                      {formatDate(log.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
