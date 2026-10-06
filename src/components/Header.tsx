import { useState, useEffect } from 'react';
import {
  Clock,
  MapPin,
  Camera,
  FileSpreadsheet,
  Users,
  Settings,
  Bell,
  ShieldCheck,
  CheckCircle2,
  LogOut,
  User,
} from 'lucide-react';
import { PushNotificationLog } from '../types';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  activeTab: 'kiosk' | 'recap' | 'employees' | 'settings';
  setActiveTab: (tab: 'kiosk' | 'recap' | 'employees' | 'settings') => void;
  notificationLogs: PushNotificationLog[];
  onOpenNotifications: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  notificationLogs,
  onOpenNotifications,
}: HeaderProps) {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const unreadCount = notificationLogs.filter((n) => !n.isRead).length;

  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand & Status */}
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950 font-bold text-xl">
              <ShieldCheck className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">
                  Presensi Pintar
                </span>
                <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2 py-0.5 rounded-full font-semibold border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  GPS & Face AI
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Firebase Real-time Connected
              </p>
            </div>
          </div>

          {/* Real-time Clock Widget */}
          <div className="hidden lg:flex items-center bg-slate-800/80 border border-slate-700/70 rounded-xl px-4 py-2 space-x-3 shadow-inner">
            <Clock className="w-5 h-5 text-emerald-400 animate-pulse" />
            <div>
              <div className="text-sm font-semibold tracking-wider text-slate-100 font-mono">
                {formattedTime} <span className="text-xs text-slate-400 font-normal">WIB</span>
              </div>
              <div className="text-xs text-slate-400 capitalize">
                {formattedDate}
              </div>
            </div>
          </div>

          {/* User Profile & Actions */}
          <div className="flex items-center space-x-3">
            {/* User Profile Card */}
            {user && (
              <div className="flex items-center space-x-2.5 bg-slate-800/80 border border-slate-700/80 rounded-2xl py-1.5 px-3">
                <img
                  src={
                    user.photoURL ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                  }
                  alt={user.displayName}
                  className="w-8 h-8 rounded-xl object-cover border border-emerald-400/40"
                />
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-white truncate max-w-[130px]">
                    {user.displayName}
                  </div>
                  <div className="text-[10px] font-semibold flex items-center gap-1">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        user.role === 'Manager' ? 'bg-amber-400 animate-pulse' : 'bg-teal-400'
                      }`}
                    ></span>
                    <span
                      className={
                        user.role === 'Manager' ? 'text-amber-300 font-bold' : 'text-teal-300'
                      }
                    >
                      {user.role === 'Manager' ? 'Manager (Akses Penuh)' : 'Karyawan'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Push Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all cursor-pointer"
              title="Notifikasi Pengingat"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Logout Button */}
            {user && (
              <button
                onClick={logout}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/30 transition cursor-pointer"
                title="Keluar / Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="flex space-x-2 border-t border-slate-800/80 py-2.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('kiosk')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'kiosk'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Kios Presensi (Absen)</span>
          </button>

          <button
            onClick={() => setActiveTab('recap')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'recap'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Dashboard Rekapitulasi & Excel</span>
          </button>

          <button
            onClick={() => setActiveTab('employees')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'employees'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kelola Karyawan</span>
            {user?.role !== 'Manager' && (
              <span className="ml-1 text-[10px] bg-slate-800 text-amber-400 px-1.5 py-0.5 rounded-md border border-amber-500/30">
                Manager
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-emerald-500 text-slate-950 font-semibold shadow-lg shadow-emerald-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Pengaturan GPS & Notifikasi</span>
          </button>
        </div>
      </div>
    </header>
  );
}
