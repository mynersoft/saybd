import React, { useState, useEffect } from 'react';
import { dbService } from '../../services/supabase/dbService.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import { formatDate } from '../../utils/formatters.js';
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Building,
  Smartphone,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  Send,
  Loader2,
  Sparkles
} from 'lucide-react';

export function MentorEarningsDashboard() {
  const { currentUser } = useAuth();
  const { addToast } = useNotification();

  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Withdrawal form inputs
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('bkash');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountDetails, setAccountDetails] = useState('');

  const loadEarnings = async () => {
    if (!currentUser?.id) return;
    try {
      const data = await dbService.getMentorEarnings(currentUser.id);
      setEarnings(data);
    } catch (err) {
      console.error('Error fetching mentor earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEarnings();
    const unsub = dbService.subscribe((msg) => {
      if (msg.type === 'withdrawal_status_updated' || msg.type === 'table_update') {
        loadEarnings();
      }
    });
    return unsub;
  }, [currentUser?.id]);

  const handleRequestWithdrawal = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);

    if (!numAmount || numAmount <= 0) {
      addToast('Please enter a valid payout amount.', 'error');
      return;
    }

    if (numAmount > (earnings?.availableBalanceBdt || 0)) {
      addToast(`Requested amount exceeds available balance (৳${earnings?.availableBalanceBdt.toLocaleString()}).`, 'error');
      return;
    }

    if (numAmount < (earnings?.minimumPayoutThreshold || 500)) {
      addToast(`Minimum withdrawal amount is ৳${earnings?.minimumPayoutThreshold || 500}.`, 'error');
      return;
    }

    if (!accountNumber.trim()) {
      addToast('Please enter your receiving account or wallet number.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await dbService.requestWithdrawal(currentUser.id, {
        amount: numAmount,
        method,
        accountNumber,
        accountDetails,
      });

      addToast('Withdrawal request submitted! Payout will be processed within 24 hours.', 'success');
      setAmount('');
      setAccountNumber('');
      setAccountDetails('');
      loadEarnings();
    } catch (err) {
      addToast(err.message || 'Failed to submit withdrawal request.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
      </div>
    );
  }

  const availableBal = earnings?.availableBalanceBdt || 0;
  const netEarnings = earnings?.netEarningsBdt || 0;
  const grossSales = earnings?.grossSalesBdt || 0;
  const commission = earnings?.platformCommissionBdt || 0;
  const paidOut = earnings?.paidWithdrawalsBdt || 0;
  const pendingOut = earnings?.pendingWithdrawalsBdt || 0;

  return (
    <div className="space-y-6">
      
      {/* Financial Metric KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Available Balance (Withdrawal Eligible) */}
        <div className="p-5 rounded-3xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/20">
          <span className="text-xs font-bold uppercase tracking-wider opacity-85">Available Balance</span>
          <p className="text-2xl sm:text-3xl font-black mt-1 font-mono">
            ৳{availableBal.toLocaleString()}
          </p>
          <span className="text-[11px] opacity-90 mt-1 block font-medium">Ready for withdrawal</span>
        </div>

        {/* Net Mentor Earnings (80%) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Net Earned</span>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1 font-mono">
            ৳{netEarnings.toLocaleString()}
          </p>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
            {100 - (earnings?.commissionPercentage || 20)}% Net Share
          </span>
        </div>

        {/* Total Gross Sales */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Gross Sales</span>
          <p className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1 font-mono">
            ৳{grossSales.toLocaleString()}
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {earnings?.totalStudentsEnrolled || 0} students enrolled
          </span>
        </div>

        {/* Total Withdrawn */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Paid Out</span>
          <p className="text-2xl sm:text-3xl font-black text-slate-700 dark:text-slate-300 mt-1 font-mono">
            ৳{paidOut.toLocaleString()}
          </p>
          {pendingOut > 0 ? (
            <span className="text-[11px] text-amber-500 font-bold mt-1 block">
              ৳{pendingOut.toLocaleString()} pending review
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 mt-1 block">All settled</span>
          )}
        </div>

      </div>

      {/* Payout Request Section & Recent Sales Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Payout Request Form */}
        <form
          onSubmit={handleRequestWithdrawal}
          className="lg:col-span-1 p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4"
        >
          <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span>Request Payout</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Withdraw earnings to your personal bKash, Nagad, or Bank account.
            </p>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Withdrawal Amount (BDT) *
            </label>
            <div className="relative">
              <span className="text-sm font-bold text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2">৳</span>
              <input
                type="number"
                required
                min={earnings?.minimumPayoutThreshold || 500}
                max={availableBal}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min ৳${earnings?.minimumPayoutThreshold || 500}`}
                className="w-full text-xs font-mono font-bold pl-8 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
              <span>Min: ৳{earnings?.minimumPayoutThreshold || 500}</span>
              <button
                type="button"
                onClick={() => setAmount(String(availableBal))}
                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
              >
                Max (৳{availableBal.toLocaleString()})
              </button>
            </div>
          </div>

          {/* Method selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Payout Method *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'bkash', name: 'bKash' },
                { id: 'nagad', name: 'Nagad' },
                { id: 'bank', name: 'Bank' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMethod(m.id)}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                    method === m.id
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Account/Wallet Number */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              {method === 'bank' ? 'Account Number *' : `${method.toUpperCase()} Wallet Number *`}
            </label>
            <input
              type="text"
              required
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder={method === 'bank' ? '12-16 digit account number' : '01XXXXXXXXX'}
              className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          {/* Bank details if Bank selected */}
          {method === 'bank' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Bank & Branch Name *
              </label>
              <input
                type="text"
                required
                value={accountDetails}
                onChange={(e) => setAccountDetails(e.target.value)}
                placeholder="e.g. City Bank, Gulshan Branch, Routing: 225..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || availableBal < (earnings?.minimumPayoutThreshold || 500)}
            className="w-full mt-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all hover:scale-101 active:scale-98"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Submitting Request...' : 'Submit Withdrawal Request'}</span>
          </button>
        </form>

        {/* Withdrawal History & Recent Sales */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Withdrawal History Table */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span>Payout History</span>
            </h3>

            {(!earnings?.withdrawals || earnings.withdrawals.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center">No withdrawal requests submitted yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Method & Account</th>
                      <th className="py-3 px-4">Requested On</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {earnings.withdrawals.map(w => (
                      <tr key={w.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          ৳{w.amount?.toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold uppercase text-[11px] block">{w.payment_method}</span>
                          <span className="font-mono text-[10px] text-slate-400">{w.account_number}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">
                          {formatDate(w.requested_at)}
                        </td>
                        <td className="py-3 px-4">
                          {w.status === 'approved' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              Paid
                            </span>
                          )}
                          {w.status === 'pending' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              Pending
                            </span>
                          )}
                          {w.status === 'rejected' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300" title={w.notes}>
                              Rejected
                            </span>
                          )}
                          {w.transaction_ref && (
                            <span className="block text-[10px] font-mono text-slate-400 mt-0.5">
                              {w.transaction_ref}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Course Sales */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h3 className="font-extrabold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <span>Recent Student Enrollments</span>
            </h3>

            {(!earnings?.recentSales || earnings.recentSales.length === 0) ? (
              <p className="text-xs text-slate-400 py-4 text-center">No student sales recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {earnings.recentSales.map(s => (
                  <div key={s.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{s.courseTitle}</p>
                      <span className="text-[10px] text-slate-400">{formatDate(s.enrolledAt)}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-black font-mono text-emerald-600 dark:text-emerald-400 block">
                        +৳{s.mentorShare?.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        (৳{s.amount?.toLocaleString()} price)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
