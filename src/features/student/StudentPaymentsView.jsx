import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  Calendar,
  Download,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Receipt,
  Clock
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { dbService } from '../../services/supabase/dbService.js';
import { CheckoutModal } from '../payments/CheckoutModal.jsx';

export function StudentPaymentsView() {
  const { currentUser } = useAuth();
  const [tab, setTab] = useState('history'); // 'history' | 'subscription'
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  const loadPayments = async () => {
    if (!currentUser?.id) return;
    try {
      setLoading(true);
      const orders = await dbService.getUserPaymentOrders(currentUser.id);
      setPayments(orders || []);
    } catch (err) {
      console.error('Failed to load payment orders:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
    const unsub = dbService.subscribe((msg) => {
      if (msg.type === 'table_update' && msg.table === 'payment_orders') {
        loadPayments();
      }
    });
    return unsub;
  }, [currentUser?.id]);

  const proItem = {
    id: 'sub_saybd_pro',
    title: 'SayBD Pro (Monthly Subscription)',
    price_bdt: 499,
    currency: 'BDT',
    type: 'subscription'
  };

  return (
    <div className="space-y-6">
      {/* View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Payments & Subscription
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage your billing history, SSLCOMMERZ receipts, and practice tier memberships.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
          <button
            onClick={() => setTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'history'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Payment History
          </button>
          <button
            onClick={() => setTab('subscription')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'subscription'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Subscription Details
          </button>
        </div>
      </div>

      {tab === 'history' ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Invoice ID</th>
                  <th className="px-4 py-3.5">Description</th>
                  <th className="px-4 py-3.5">Amount (BDT)</th>
                  <th className="px-4 py-3.5">Gateway / Method</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Date</th>
                  <th className="px-4 py-3.5 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Receipt className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">No payment transactions found</p>
                        <p className="text-[11px] text-slate-400 max-w-sm">When you purchase courses, enroll in mentor live classes, or upgrade to Pro, verified SSLCOMMERZ payment records will appear here.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => {
                    const amountVal = p.amount_bdt || p.amount || (p.amount_cents ? p.amount_cents / 100 : 0) || 0;
                    const dateVal = p.created_at ? new Date(p.created_at).toLocaleDateString() : (p.date || 'Recent');
                    const orderId = p.order_id || p.id || p.order_number;
                    const methodVal = p.payment_method || p.method || 'bKash / SSLCommerz';
                    const itemTitle = p.item || p.course_title || (p.item_type === 'subscription' ? 'SayBD Pro Subscription' : 'SayBD Course');

                    return (
                      <tr key={p.id || orderId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="px-5 py-4 font-mono font-medium text-slate-900 dark:text-white">
                          {orderId}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{itemTitle}</p>
                          <p className="text-[10px] text-slate-400">{p.item_type || 'Verified Order'}</p>
                        </td>
                        <td className="px-4 py-4 font-bold text-slate-900 dark:text-white">
                          ৳{amountVal.toLocaleString()}
                        </td>
                        <td className="px-4 py-4 text-slate-600 dark:text-slate-400 uppercase text-[11px]">
                          {methodVal}
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            {p.status || 'completed'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-500">
                          {dateVal}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => {
                              window.print();
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Receipt
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Free Tier */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Plan</span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">Free Practice</h3>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
                ৳0 <span className="text-xs font-normal text-slate-400">/ forever</span>
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  15 minutes daily 1-on-1 speaking allowance
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Daily reset at 00:00 Asia/Dhaka
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Access to regional leaderboard
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <span className="block text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ Currently Active
              </span>
            </div>
          </div>

          {/* Pro Tier */}
          <div className="p-6 rounded-2xl bg-gradient-to-b from-indigo-900/10 to-transparent bg-white dark:bg-slate-900 border-2 border-indigo-600 shadow-lg flex flex-col justify-between relative">
            <span className="absolute -top-3 right-6 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
              Recommended
            </span>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Upgrade</span>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">SayBD Pro</h3>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">
                ৳499 <span className="text-xs font-normal text-slate-400">/ month</span>
              </p>
              <ul className="mt-4 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  Unlimited 1-on-1 daily speaking practice
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  Smart matching with top-rated partners
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  AI pronunciation & grammar report card
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  15% discount on all mentor live classes
                </li>
              </ul>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsCheckoutOpen(true)}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors shadow-md shadow-indigo-600/20"
              >
                Upgrade to Pro
              </button>
            </div>
          </div>

          {/* Guarantee / Security Box */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mb-3">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                SSLCOMMERZ Verified Protection
              </h4>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                All transactions are securely routed through SSLCOMMERZ Bangladesh gateway supporting bKash, Nagad, Rocket, and Visa/Mastercard. Instant automatic course and class activation.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400">
              Need billing assistance? Contact support@saybd.com
            </div>
          </div>
        </div>
      )}

      {/* Real Checkout Modal */}
      {isCheckoutOpen && (
        <CheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          item={proItem}
          currentUser={currentUser}
          onPaymentSuccess={() => {
            setIsCheckoutOpen(false);
            loadPayments();
          }}
        />
      )}
    </div>
  );
}
