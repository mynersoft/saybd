import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Mic, Users, BookOpen, User, Shield, Trophy, Radio } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';

export function MobileBottomBar() {
  const { isAdmin, isMentor } = useAuth();

  const links = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/practice', label: 'Practice', icon: Mic },
    { to: '/leaderboard', label: 'Ranks', icon: Trophy },
    { to: '/classes', label: 'Classes', icon: Users },
    isMentor
      ? { to: '/mentor', label: 'Studio', icon: Radio }
      : { to: isAdmin ? '/admin' : '/profile', label: isAdmin ? 'Admin' : 'Profile', icon: isAdmin ? Shield : User },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
              isActive
                ? 'text-indigo-600 dark:text-indigo-400 font-bold scale-105'
                : 'text-slate-400 dark:text-slate-500 font-medium hover:text-slate-700'
            }`
          }
        >
          <link.icon className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">{link.label}</span>
        </NavLink>
      ))}
    </div>
  );
}
