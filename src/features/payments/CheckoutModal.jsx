import React, { useState } from 'react';
import { Modal } from '../../components/common/Modal.jsx';
import { formatCurrency } from '../../utils/formatters.js';
import { PAYMENT_METHODS } from '../../config/constants.js';
import { dbService } from '../../services/supabase/dbService.js';
import { useNotification } from '../../contexts/NotificationContext.jsx';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Loader2,
  CreditCard,
  Building,
  Smartphone,
  ExternalLink,
  Receipt,
  RotateCcw,
  Sparkles
} from 'lucide-react';

export function CheckoutModal({ isOpen, onClose, item, currentUser, onPaymentSuccess }) {
  const { addToast } = useNotification();
  const [selectedMethod, setSelectedMethod] = useState('bkash');
  const [walletNumber, setWalletNumber] = useState('01712345678');
  const [pinOrOtp, setPinOrOtp] = useState('');
  const [step, setStep] = useState('select'); // 'select' | 'confirm' | 'verifying' | 'success'
  const [transactionId, setTransactionId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  if (!item) return null;

  const itemPrice = item.price_bdt ?? item.price ?? (item.price_cents ? item.price_cents / 100 : 0) ?? 0;
  const itemCurrency = item.currency || 'BDT';

  const handleProceed = () => {
    setStep('confirm');
  };

  const handleSimulatePayment = async (e) => {
    e.preventDefault();
    setStep('verifying');
    setIsProcessing(true);

    try {
      const orderId = `SM-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const trxId = `${selectedMethod.toUpperCase()}_TRX_${Date.now().toString(36).toUpperCase()}`;
      
      // Simulate SSLCommerz verification handshake
      await new Promise(res => setTimeout(res, 1200));

      // Record verified payment order in dbService
      const order = await dbService.recordOrderPayment({
        orderId,
        courseId: item.id,
        studentId: currentUser.id,
        amountBdt: itemPrice,
        paymentMethod: selectedMethod,
        transactionRef: trxId
      });

      // If item is a scheduled live class, also confirm class enrollment
      if (item.scheduled_at || item.speaking_mode) {
        await dbService.enrollStudentInClass(item.id, currentUser.id, orderId, itemPrice);
      }

      setTransactionId(trxId);
      setReceiptData({
        orderId,
        trxId,
        amount: itemPrice,
        currency: itemCurrency,
        method: selectedMethod,
        date: new Date().toISOString(),
        studentName: currentUser.full_name,
        courseTitle: item.title,
      });

      setStep('success');
      addToast(`Payment verified! You are now enrolled in ${item.title}.`, 'success');
      if (onPaymentSuccess) {
        onPaymentSuccess(item.id, trxId);
      }
    } catch (err) {
      addToast(err.message || 'Payment verification failed.', 'error');
      setStep('confirm');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCloseAll = () => {
    setStep('select');
    setPinOrOtp('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCloseAll} title="SSLCommerz Secure Checkout" maxWidth="max-w-lg">
      <div className="space-y-5">
        
        {/* Order Summary Card */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Purchasing Course Enrollment
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> SSLCommerz Verified
            </span>
          </div>

          <h4 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white mt-1">
            {item.title}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Lifetime course access • Live mentor QA sessions • Interactive vocabulary exercises
          </p>

          <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Total Payable:</span>
            <span className="text-xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
              ৳{itemPrice.toLocaleString()} {itemCurrency}
            </span>
          </div>
        </div>

        {/* Step 1: Select Payment Gateway */}
        {step === 'select' && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Select Payment Channel
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  { id: 'bkash', name: 'bKash', badge: 'Mobile Wallet', icon: Smartphone, color: 'text-pink-600' },
                  { id: 'nagad', name: 'Nagad', badge: 'Mobile Wallet', icon: Smartphone, color: 'text-orange-600' },
                  { id: 'card', name: 'Visa / Mastercard', badge: 'Debit / Credit Card', icon: CreditCard, color: 'text-blue-600' },
                  { id: 'bank', name: 'Internet Banking', badge: 'City / Brac / EBL', icon: Building, color: 'text-emerald-600' },
                ].map((pm) => (
                  <button
                    key={pm.id}
                    type="button"
                    onClick={() => setSelectedMethod(pm.id)}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      selectedMethod === pm.id
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-1 ring-indigo-500/20 shadow-xs'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <pm.icon className={`w-4 h-4 ${pm.color}`} />
                      <span className="text-[10px] font-semibold text-slate-400">{pm.badge}</span>
                    </div>
                    <span className="text-xs font-extrabold text-slate-900 dark:text-white block">
                      {pm.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>
                Processed securely via SSLCommerz payment gateway. Supports instant OTP and PIN confirmation.
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseAll}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProceed}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 flex items-center gap-2 transition-all hover:scale-101 active:scale-98"
              >
                <span>Continue with {selectedMethod.toUpperCase()}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Confirmation / PIN & Sandbox Verification */}
        {step === 'confirm' && (
          <form onSubmit={handleSimulatePayment} className="space-y-4">
            <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs">
              <span className="font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wide">
                {selectedMethod} Gateway Checkout
              </span>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Enter your test wallet number or account credentials to authorize ৳{itemPrice.toLocaleString()} {itemCurrency}.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Wallet / Phone Number
              </label>
              <input
                type="text"
                required
                value={walletNumber}
                onChange={(e) => setWalletNumber(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                PIN or One-Time Passcode (OTP)
              </label>
              <input
                type="password"
                required
                value={pinOrOtp}
                onChange={(e) => setPinOrOtp(e.target.value)}
                placeholder="••••"
                className="w-full text-xs font-mono p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                SSLCommerz Sandbox Mode: Enter any 4-digit PIN (e.g. 1234) for instant test approval.
              </span>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep('select')}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 flex items-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Confirm & Pay ৳{itemPrice.toLocaleString()}</span>
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Verifying */}
        {step === 'verifying' && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
            <div>
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                Verifying Transaction with SSLCommerz...
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Authorizing {selectedMethod.toUpperCase()} transaction and generating unique enrollment ledger.
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Success & Official Receipt */}
        {step === 'success' && receiptData && (
          <div className="py-4 space-y-4">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-black text-xl text-slate-900 dark:text-white">
                Payment Successful!
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                You are officially enrolled in <strong>{receiptData.courseTitle}</strong>.
              </p>
            </div>

            {/* Official Digital Receipt */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Transaction Receipt</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {new Date(receiptData.date).toLocaleDateString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Student</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{receiptData.studentName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Payment Method</span>
                  <span className="font-bold uppercase text-slate-800 dark:text-slate-200">{receiptData.method} (SSLCommerz)</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Order ID</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{receiptData.orderId}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Transaction Ref</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold">{receiptData.trxId}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">Amount Paid:</span>
                <span className="font-black font-mono text-sm text-indigo-600 dark:text-indigo-400">
                  ৳{receiptData.amount.toLocaleString()} {receiptData.currency}
                </span>
              </div>
            </div>

            <button
              onClick={handleCloseAll}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all hover:scale-101 active:scale-98"
            >
              Start Course Now
            </button>
          </div>
        )}

      </div>
    </Modal>
  );
}
