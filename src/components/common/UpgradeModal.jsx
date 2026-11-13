import React, { useState } from 'react';
import { Modal } from './Modal.jsx';
import { Check, Zap, Sparkles, Shield, Clock } from 'lucide-react';
import { PAYMENT_METHODS } from '../../config/constants.js';

export function UpgradeModal({ isOpen, onClose, remainingSeconds, onSelectPlan }) {
  const [selectedPlan, setSelectedPlan] = useState('pro_monthly');

  const plans = [
    {
      id: 'pro_monthly',
      name: 'Pro English Club',
      price: '৳499',
      period: '/ month',
      description: 'Ideal for job seekers and daily fluency builders.',
      badge: 'Most Popular',
      features: [
        '60 minutes daily 1-on-1 speaking (3x free tier)',
        'Priority matching with top-rated partners',
        'Unlimited live mentor classrooms access',
        'Raise-hand speaking priority in discussions',
        'Weekly curated vocabulary & idioms deck',
      ],
    },
    {
      id: 'unlimited_annual',
      name: 'Master Fluency Annual',
      price: '৳3,999',
      period: '/ year',
      description: 'Best value for comprehensive IELTS & career mastery.',
      badge: 'Save 35%',
      features: [
        '120 minutes daily speaking practice',
        'All Mentor Courses included free ($150+ value)',
        '1-on-1 monthly pronunciation feedback from mentors',
        'Verified SayBD Fluency Certificate',
        'VIP WhatsApp community access',
      ],
    },
  ];

  const handleCheckout = (methodId) => {
    onSelectPlan && onSelectPlan(selectedPlan, methodId);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
      <div className="space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Supercharge Your English Fluency
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            {remainingSeconds === 0
              ? 'You have used your 20 minutes of free speaking practice for today. Upgrade for extended time or return tomorrow at midnight (Asia/Dhaka)!'
              : 'Unlock extended daily practice time, mentor courses, and priority matching.'}
          </p>
        </div>

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30 shadow-md ring-1 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-600 text-white shadow-sm">
                    {plan.badge}
                  </span>
                )}
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {plan.price}
                  </span>
                  <span className="text-xs text-slate-500">{plan.period}</span>
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mt-1">
                  {plan.name}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                  {plan.description}
                </p>
                <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Payment Methods */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select Bangladesh or Card Payment
            </span>
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Shield className="w-3.5 h-3.5 text-emerald-500" /> 100% Secure Checkout
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {PAYMENT_METHODS.map((pm) => (
              <button
                key={pm.id}
                onClick={() => handleCheckout(pm.id)}
                className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-all group"
              >
                <span className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600">
                  {pm.name}
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">{pm.badge}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center pt-1">
          <button
            onClick={onClose}
            className="text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            I will continue with free daily practice
          </button>
        </div>
      </div>
    </Modal>
  );
}
