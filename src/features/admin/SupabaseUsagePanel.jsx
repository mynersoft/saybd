import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  HardDrive,
  Users,
  Wifi,
  Activity,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Plug,
} from 'lucide-react';
import { dbService } from '../../services/supabase/dbService.js';

const MB = 1024 ** 2;
const GB = 1024 ** 3;

// Official plan limits (Supabase pricing page, 2026)
const PLANS = {
  free: { label: 'Free ($0)', db: 500 * MB, storage: 1 * GB, egressGb: 5, mau: 50000 },
  pro: { label: 'Pro ($25/mo)', db: 8 * GB, storage: 100 * GB, egressGb: 250, mau: 100000 },
};

const TONES = {
  emerald: { bar: 'bg-emerald-500', text: 'text-emerald-500', chip: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  amber: { bar: 'bg-amber-500', text: 'text-amber-500', chip: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  rose: { bar: 'bg-rose-500', text: 'text-rose-500', chip: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v >= GB) return `${(v / GB).toFixed(2)} GB`;
  if (v >= MB) return `${(v / MB).toFixed(1)} MB`;
  if (v >= 1024) return `${(v / 1024).toFixed(0)} KB`;
  return `${v} B`;
}

const pctOf = (used, limit) => (limit > 0 ? Math.min(100, (used / limit) * 100) : 0);
const toneOf = (p) => (p >= 85 ? 'rose' : p >= 60 ? 'amber' : 'emerald');

function readLS(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function UsageCard({ icon: Icon, title, usedLabel, limitLabel, percent, note, children }) {
  const tone = TONES[toneOf(percent)];
  return (
    <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
            <Icon className="w-4 h-4" />
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white">{title}</h4>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${tone.chip}`}>
          {percent.toFixed(1)}%
        </span>
      </div>
      <div>
        <div className="flex items-end justify-between mb-1.5">
          <span className="text-xl font-extrabold text-slate-900 dark:text-white">{usedLabel}</span>
          <span className="text-xs text-slate-500">of {limitLabel}</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${tone.bar}`}
            style={{ width: `${Math.max(percent, percent > 0 ? 2 : 0)}%` }}
          />
        </div>
      </div>
      {note && <p className="text-[11px] text-slate-500 leading-relaxed">{note}</p>}
      {children}
    </div>
  );
}

export function SupabaseUsagePanel() {
  const [plan, setPlan] = useState(() => readLS('saybd_supabase_plan', 'free'));
  const [egressGb, setEgressGb] = useState(() => readLS('saybd_supabase_egress_gb', ''));
  const [data, setData] = useState(null);
  const [api, setApi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const limits = PLANS[plan] || PLANS.free;
  const projectUrl = import.meta.env?.VITE_SUPABASE_URL || '';
  const projectRef = (projectUrl.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];
  const dashboardUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}`
    : 'https://supabase.com/dashboard';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await dbService.getSupabaseUsage();
      setData(d);
      const a = await dbService.getSupabaseApiRequests();
      setApi(a);
    } catch (e) {
      setError(e.message || 'Could not load usage');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changePlan = (p) => {
    setPlan(p);
    writeLS('saybd_supabase_plan', p);
  };
  const changeEgress = (v) => {
    setEgressGb(v);
    writeLS('saybd_supabase_egress_gb', v);
  };

  if (loading && !data) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">Loading Supabase usage...</div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-sm space-y-2">
        <p className="font-bold text-rose-500">Could not load usage</p>
        <p className="text-slate-600 dark:text-slate-300">{error}</p>
        <p className="text-xs text-slate-500">
          Run the SQL function <code>admin_supabase_usage</code> in the Supabase SQL Editor, and make
          sure you are logged in as admin.
        </p>
        <button
          onClick={load}
          className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold"
        >
          Try again
        </button>
      </div>
    );
  }

  const dbBytes = Number(data?.db_size_bytes) || 0;
  const storageBytes = Number(data?.storage_bytes) || 0;
  const mau = Number(data?.users_active_30d) || 0;
  const conns = Number(data?.connections) || 0;
  const maxConns = Number(data?.max_connections) || 0;
  const egressUsed = parseFloat(egressGb) || 0;

  const dbPct = pctOf(dbBytes, limits.db);
  const stPct = pctOf(storageBytes, limits.storage);
  const mauPct = pctOf(mau, limits.mau);
  const egPct = pctOf(egressUsed, limits.egressGb);
  const connPct = pctOf(conns, maxConns);

  const worst = [
    { name: 'Database size', p: dbPct },
    { name: 'File storage', p: stPct },
    { name: 'Monthly active users', p: mauPct },
    ...(egressUsed > 0 ? [{ name: 'Bandwidth (egress)', p: egPct }] : []),
  ].sort((a, b) => b.p - a.p)[0];

  const tables = data?.tables || [];
  const maxTable = Math.max(1, ...tables.map((t) => Number(t.bytes) || 0));
  const buckets = data?.buckets || [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-slate-900 dark:text-white">Supabase Usage</h3>
          <p className="text-xs text-slate-500">
            Updated {data?.generated_at ? new Date(data.generated_at).toLocaleString() : '-'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold">
            {Object.entries(PLANS).map(([id, p]) => (
              <button
                key={id}
                onClick={() => changePlan(id)}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  plan === id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
          >
            Open Supabase <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Health banner */}
      {worst && (
        <div
          className={`p-4 rounded-2xl border flex items-start gap-3 text-sm ${
            worst.p >= 85
              ? 'bg-rose-500/10 border-rose-500/30'
              : worst.p >= 60
                ? 'bg-amber-500/10 border-amber-500/30'
                : 'bg-emerald-500/10 border-emerald-500/30'
          }`}
        >
          {worst.p >= 60 ? (
            <AlertTriangle className={`w-5 h-5 shrink-0 ${TONES[toneOf(worst.p)].text}`} />
          ) : (
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
          )}
          <p className="text-slate-700 dark:text-slate-200">
            {worst.p >= 85
              ? `${worst.name} is at ${worst.p.toFixed(0)}% of the ${limits.label} limit. Upgrade or clean up soon.`
              : worst.p >= 60
                ? `${worst.name} is at ${worst.p.toFixed(0)}% of the ${limits.label} limit. Keep an eye on it.`
                : `Everything is healthy. Highest usage is ${worst.name} at ${worst.p.toFixed(1)}% of the ${limits.label} limit.`}
          </p>
        </div>
      )}

      {/* Main usage cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UsageCard
          icon={Database}
          title="Database size"
          usedLabel={formatBytes(dbBytes)}
          limitLabel={formatBytes(limits.db)}
          percent={dbPct}
          note="Total size of your Postgres database. Extra size on Pro costs $0.125 per GB."
        />
        <UsageCard
          icon={HardDrive}
          title="File storage"
          usedLabel={formatBytes(storageBytes)}
          limitLabel={formatBytes(limits.storage)}
          percent={stPct}
          note={`${data?.storage_objects ?? 0} files in Storage (avatars, uploads).`}
        >
          {buckets.length > 0 && (
            <div className="pt-2 space-y-1 border-t border-slate-100 dark:border-slate-800">
              {buckets.map((b) => (
                <div key={b.name} className="flex justify-between text-[11px] text-slate-500">
                  <span>{b.name} ({b.files} files)</span>
                  <span className="font-semibold">{formatBytes(b.bytes)}</span>
                </div>
              ))}
            </div>
          )}
        </UsageCard>
        <UsageCard
          icon={Users}
          title="Monthly active users"
          usedLabel={mau.toLocaleString()}
          limitLabel={limits.mau.toLocaleString()}
          percent={mauPct}
          note={`${Number(data?.users_total || 0).toLocaleString()} total accounts, ${Number(data?.users_new_7d || 0)} new in the last 7 days. Active = signed in during the last 30 days.`}
        />
        <UsageCard
          icon={Wifi}
          title="Bandwidth (egress)"
          usedLabel={`${egressUsed} GB`}
          limitLabel={`${limits.egressGb} GB`}
          percent={egPct}
          note="Supabase does not give egress numbers to the app. Open Supabase, go to Organization, Usage, Egress, and type the number below."
        >
          <div className="flex items-center gap-2 pt-1">
            <input
              type="number"
              min="0"
              step="0.1"
              value={egressGb}
              onChange={(e) => changeEgress(e.target.value)}
              placeholder="Egress GB this month"
              className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-500">GB</span>
          </div>
        </UsageCard>
      </div>

      {/* Connections + API requests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <UsageCard
          icon={Plug}
          title="Database connections now"
          usedLabel={String(conns)}
          limitLabel={String(maxConns)}
          percent={connPct}
          note="Live connections to Postgres. If this stays near the limit, upgrade compute."
        />
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500">
              <Activity className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-sm text-slate-900 dark:text-white">API requests</h4>
          </div>
          {api ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                ['Database (REST)', api.rest],
                ['Auth', api.auth],
                ['Realtime', api.realtime],
                ['Storage', api.storage],
              ].map(([label, val]) => (
                <div key={label} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60">
                  <p className="text-slate-500">{label}</p>
                  <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {Number(val || 0).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Not connected. Deploy the optional <code>supabase-usage</code> Edge Function to see
              request counts here. Everything else on this page works without it.
            </p>
          )}
        </div>
      </div>

      {/* Biggest tables */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <h4 className="font-bold text-sm text-slate-900 dark:text-white">Biggest tables</h4>
        {tables.length === 0 ? (
          <p className="text-xs text-slate-500">No tables found.</p>
        ) : (
          <div className="space-y-2.5">
            {tables.map((t) => (
              <div key={t.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{t.name}</span>
                  <span className="text-slate-500">
                    ~{Number(t.rows || 0).toLocaleString()} rows - {formatBytes(t.bytes)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${Math.max(2, ((Number(t.bytes) || 0) / maxTable) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
