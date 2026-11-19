import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search, Users, GraduationCap, Shield, ShieldCheck, UserCheck, UserX, X, Loader2,
  RefreshCw, MapPin, Languages, Calendar, Mail,
} from 'lucide-react';
import { dbService } from '../../services/supabase/dbService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { formatDate } from '../../utils/formatters.js';

/**
 * Admin user manager: lists students / mentors / admins and lets the admin
 * approve, suspend, reactivate and change roles.
 * mode: 'all' | 'student' | 'mentor' | 'admin' | 'status'
 */
const MODE_META = {
  all: { title: 'All Users', role: 'all' },
  student: { title: 'Students', role: 'student' },
  mentor: { title: 'Mentors', role: 'mentor' },
  admin: { title: 'Admins', role: 'admin' },
  status: { title: 'Account Status', role: 'all' },
};

const ROLE_STYLE = {
  student: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  mentor: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300',
  admin: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
};
const STATUS_STYLE = {
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  suspended: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  banned: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
};

function Avatar({ u, size = 'w-10 h-10' }) {
  if (u.avatar_url) return <img src={u.avatar_url} alt="" className={`${size} rounded-xl object-cover shrink-0`} />;
  return (
    <div className={`${size} rounded-xl bg-indigo-600/10 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 font-bold flex items-center justify-center uppercase shrink-0`}>
      {(u.full_name || u.email || 'U').charAt(0)}
    </div>
  );
}

export function AdminUserManager({ mode = 'all' }) {
  const { currentUser } = useAuth();
  const { addToast } = useNotification();
  const meta = MODE_META[mode] || MODE_META.all;

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState(meta.role);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfiles((await dbService.getAllProfiles()) || []);
    } catch (e) {
      addToast('Could not load users.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setRoleFilter(meta.role); }, [meta.role]);

  const counts = useMemo(() => ({
    total: profiles.length,
    student: profiles.filter((p) => p.role === 'student').length,
    mentor: profiles.filter((p) => p.role === 'mentor').length,
    admin: profiles.filter((p) => p.role === 'admin').length,
    suspended: profiles.filter((p) => p.status === 'suspended' || p.status === 'banned').length,
  }), [profiles]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return profiles.filter((p) => {
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (statusFilter === 'suspended' ? !(p.status === 'suspended' || p.status === 'banned') : statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.full_name, p.email, p.country, p.native_language].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [profiles, query, roleFilter, statusFilter]);

  // Writes a change and re-reads from the database, so a policy/RLS rejection is not silently ignored.
  const applyChange = async (user, updates, successMsg, auditAction) => {
    if (user.id === currentUser?.id) {
      addToast("You can't change your own role or status.", 'error');
      return;
    }
    setBusyId(user.id);
    try {
      await dbService.updateProfile(user.id, updates, currentUser);
      const fresh = (await dbService.getAllProfiles()) || [];
      setProfiles(fresh);
      const after = fresh.find((p) => p.id === user.id);
      const ok = Object.entries(updates).every(([k, v]) => k === 'approval_notes' || after?.[k] === v || (k === 'status' && v === 'approved' && after?.status === 'approved'));
      if (!ok) {
        addToast('The change did not save. Check that the admin RLS policy migration (20250108) is applied.', 'error');
      } else {
        addToast(successMsg, 'success');
        dbService.logAudit?.(auditAction, 'profile', user.id, updates, currentUser?.id);
        if (selected?.id === user.id) setSelected(after);
      }
    } catch (e) {
      addToast(e.message || 'Update failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const suspend = (u) => {
    if (!window.confirm(`Suspend ${u.full_name || 'this user'}? They will lose access until reactivated.`)) return;
    applyChange(u, { status: 'suspended', approval_notes: 'Suspended by administrator' }, 'User suspended.', 'user_suspended');
  };
  const activate = (u) =>
    applyChange(u, { status: 'approved', approval_notes: 'Approved by administrator' }, u.status === 'suspended' ? 'User reactivated.' : 'User approved.', 'user_approved');
  const changeRole = (u, role) => {
    if (role === u.role) return;
    const warn = role === 'admin' ? ' This gives FULL admin access.' : '';
    if (!window.confirm(`Change ${u.full_name || 'this user'} from ${u.role} to ${role}?${warn}`)) return;
    applyChange(u, { role }, `Role changed to ${role}.`, 'user_role_changed');
  };

  const StatCard = ({ icon: Icon, label, value, onClick, active }) => (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-2xl border transition ${active ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
    >
      <Icon className="w-4 h-4 text-indigo-500" />
      <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{value}</p>
      <p className="text-[11px] font-semibold text-slate-400">{label}</p>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">{meta.title}</h3>
        <button onClick={load} className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatCard icon={Users} label="All users" value={counts.total} onClick={() => { setRoleFilter('all'); setStatusFilter('all'); }} active={roleFilter === 'all' && statusFilter === 'all'} />
        <StatCard icon={GraduationCap} label="Students" value={counts.student} onClick={() => setRoleFilter('student')} active={roleFilter === 'student'} />
        <StatCard icon={ShieldCheck} label="Mentors" value={counts.mentor} onClick={() => setRoleFilter('mentor')} active={roleFilter === 'mentor'} />
        <StatCard icon={Shield} label="Admins" value={counts.admin} onClick={() => setRoleFilter('admin')} active={roleFilter === 'admin'} />
        <StatCard icon={UserX} label="Suspended" value={counts.suspended} onClick={() => setStatusFilter('suspended')} active={statusFilter === 'suspended'} />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email, country…"
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
          <option value="all">All roles</option>
          <option value="student">Students</option>
          <option value="mentor">Mentors</option>
          <option value="admin">Admins</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {loading ? (
          <div className="py-12 flex justify-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">No users match this filter.</div>
        ) : (
          rows.map((u) => {
            const isMe = u.id === currentUser?.id;
            const suspended = u.status === 'suspended' || u.status === 'banned';
            return (
              <div key={u.id} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <button type="button" onClick={() => setSelected(u)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <Avatar u={u} />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                      {u.full_name || 'Unnamed'} {isMe && <span className="text-[10px] text-indigo-500">(you)</span>}
                    </p>
                    <p className="text-xs text-slate-400 truncate">{u.email || u.native_language || '—'}</p>
                  </div>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${ROLE_STYLE[u.role] || ROLE_STYLE.student}`}>{u.role}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_STYLE[u.status] || STATUS_STYLE.pending}`}>{u.status}</span>

                  {!isMe && (
                    <>
                      <select
                        value={u.role}
                        disabled={busyId === u.id}
                        onChange={(e) => changeRole(u, e.target.value)}
                        aria-label="Change role"
                        className="text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-2 py-1.5"
                      >
                        <option value="student">Student</option>
                        <option value="mentor">Mentor</option>
                        <option value="admin">Admin</option>
                      </select>
                      {suspended || u.status === 'pending' ? (
                        <button disabled={busyId === u.id} onClick={() => activate(u)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50">
                          <UserCheck className="w-3.5 h-3.5" /> {suspended ? 'Reactivate' : 'Approve'}
                        </button>
                      ) : (
                        <button disabled={busyId === u.id} onClick={() => suspend(u)} className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50">
                          <UserX className="w-3.5 h-3.5" /> Suspend
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      <p className="text-[11px] text-slate-400">{rows.length} of {profiles.length} users shown</p>

      {selected && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={() => setSelected(null)}>
          <div className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar u={selected} size="w-14 h-14" />
                <div className="min-w-0">
                  <h4 className="font-extrabold text-base text-slate-900 dark:text-white truncate">{selected.full_name || 'Unnamed'}</h4>
                  <div className="flex gap-1.5 mt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${ROLE_STYLE[selected.role] || ''}`}>{selected.role}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_STYLE[selected.status] || ''}`}>{selected.status}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"><X className="w-5 h-5" /></button>
            </div>
            <dl className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {selected.email && <div className="flex gap-2"><Mail className="w-4 h-4 mt-0.5 text-slate-400" /><dd className="break-all">{selected.email}</dd></div>}
              {selected.country && <div className="flex gap-2"><MapPin className="w-4 h-4 mt-0.5 text-slate-400" /><dd>{selected.country}</dd></div>}
              {selected.native_language && <div className="flex gap-2"><Languages className="w-4 h-4 mt-0.5 text-slate-400" /><dd>{selected.native_language}</dd></div>}
              {selected.created_at && <div className="flex gap-2"><Calendar className="w-4 h-4 mt-0.5 text-slate-400" /><dd>Joined {formatDate(selected.created_at)}</dd></div>}
              {selected.bio && <p className="text-xs leading-relaxed bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3">{selected.bio}</p>}
              {selected.approval_notes && <p className="text-xs text-slate-400">Note: {selected.approval_notes}</p>}
              <p className="text-[10px] text-slate-400 font-mono break-all">ID: {selected.id}</p>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}