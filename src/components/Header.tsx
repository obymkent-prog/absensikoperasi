import { useState, useEffect } from 'react';
import {
  Clock,
  MapPin,
  Camera,
  CalendarDays,
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
  activeTab: 'kiosk' | 'leave' | 'recap' | 'employees' | 'settings';
  setActiveTab: (tab: 'kiosk' | 'leave' | 'recap' | 'employees' | 'settings') => void;
  notificationLogs: PushNotificationLog[];
  onOpenNotifications: () => void;
  pendingLeaveCount?: number;
}

export function Header({
  activeTab,
  setActiveTab,
  notificationLogs,
  onOpenNotifications,
  pendingLeaveCount,
}: HeaderProps) {
  const { user, logout, setRole } = useAuth();
  const isManager = user?.role === 'Manager';
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
    <header className="sticky top-0 z-40 bg-[#011E4D]/95 backdrop-blur-md border-b border-[#093478] text-white shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Brand & Status */}
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-[#011E4D] to-[#022864] border border-[#B4E0E8]/40 flex items-center justify-center shadow-lg shadow-[#011E4D]/30 p-1.5">
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/9/90/National_emblem_of_Indonesia_Garuda_Pancasila.svg"
                alt="Garuda Pancasila"
                className="w-full h-full object-contain drop-shadow"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">
                  Absensi Karyawan
                </span>
                <span className="bg-[#022864] text-[#B4E0E8] text-xs px-2 py-0.5 rounded-full font-semibold border border-[#B4E0E8]/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B4E0E8] animate-ping"></span>
                  GPS & Face AI
                </span>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#B4E0E8]" />
                Firebase Real-time Connected
              </p>
            </div>
          </div>

          {/* Real-time Clock Widget */}
          <div className="hidden lg:flex items-center bg-[#00112C]/80 border border-[#093478] rounded-xl px-4 py-2 space-x-3 shadow-inner">
            <Clock className="w-5 h-5 text-[#B4E0E8] animate-pulse" />
            <div>
              <div className="text-sm font-semibold tracking-wider text-slate-100 font-mono">
                {formattedTime} <span className="text-xs text-[#B4E0E8] font-normal">WIB</span>
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
              <div className="flex items-center space-x-2.5 bg-[#00112C]/80 border border-[#093478] rounded-2xl py-1.5 px-3">
                <img
                  src={
                    user.photoURL ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100'
                  }
                  alt={user.displayName}
                  className="w-8 h-8 rounded-xl object-cover border border-[#B4E0E8]/40"
                />
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-white truncate max-w-[130px]">
                    {user.displayName}
                  </div>
                  <button
                    type="button"
                    onClick={() => setRole(user.role === 'Manager' ? 'Karyawan' : 'Manager')}
                    className="mt-0.5 text-[10px] font-semibold flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[#00112C] border border-[#093478] hover:border-[#B4E0E8] transition cursor-pointer"
                    title="Klik untuk beralih mode Role (Manager / Karyawan)"
                  >
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full ${
                        user.role === 'Manager' ? 'bg-amber-400 animate-pulse' : 'bg-[#B4E0E8]'
                      }`}
                    ></span>
                    <span
                      className={
                        user.role === 'Manager' ? 'text-amber-300 font-bold' : 'text-[#B4E0E8] font-bold'
                      }
                    >
                      {user.role === 'Manager' ? 'Role: Manager' : 'Role: Karyawan'}
                    </span>
                    <span className="text-[9px] text-slate-400">⇄ Ganti</span>
                  </button>
                </div>
              </div>
            )}

            {/* Push Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2.5 rounded-xl bg-[#00112C]/80 hover:bg-[#B4E0E8] text-slate-300 hover:text-[#011E4D] border border-[#093478] hover:border-[#B4E0E8] transition-all cursor-pointer"
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
                className="p-2.5 rounded-xl bg-[#00112C]/80 hover:bg-[#B4E0E8] text-slate-300 hover:text-[#011E4D] border border-[#093478] hover:border-[#B4E0E8] transition cursor-pointer"
                title="Keluar / Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation Navigation Bar */}
        <div className="flex space-x-2 border-t border-[#093478] py-2.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('kiosk')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'kiosk'
                ? 'bg-[#B4E0E8] text-[#011E4D] font-bold shadow-lg shadow-[#B4E0E8]/20'
                : 'text-slate-200 hover:text-[#011E4D] hover:bg-[#B4E0E8]'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>Kios Presensi (Absen)</span>
          </button>

          <button
            onClick={() => setActiveTab('leave')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'leave'
                ? 'bg-[#B4E0E8] text-[#011E4D] font-bold shadow-lg shadow-[#B4E0E8]/20'
                : 'text-slate-200 hover:text-[#011E4D] hover:bg-[#B4E0E8]'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Izin & Cuti</span>
            {pendingLeaveCount !== undefined && pendingLeaveCount > 0 && (
              <span className="ml-1 text-[10px] bg-amber-400 text-[#011E4D] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                {pendingLeaveCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('recap')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'recap'
                ? 'bg-[#B4E0E8] text-[#011E4D] font-bold shadow-lg shadow-[#B4E0E8]/20'
                : 'text-slate-200 hover:text-[#011E4D] hover:bg-[#B4E0E8]'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Dashboard Rekapitulasi & Excel</span>
          </button>

          {/* Tab Kelola Karyawan (Hanya untuk Role Manager) */}
          {isManager && (
            <button
              onClick={() => setActiveTab('employees')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'employees'
                  ? 'bg-[#B4E0E8] text-[#011E4D] font-bold shadow-lg shadow-[#B4E0E8]/20'
                  : 'text-slate-200 hover:text-[#011E4D] hover:bg-[#B4E0E8]'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Kelola Karyawan</span>
            </button>
          )}

          {/* Tab Pengaturan GPS & Notifikasi (Hanya untuk Role Manager) */}
          {isManager && (
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'settings'
                  ? 'bg-[#B4E0E8] text-[#011E4D] font-bold shadow-lg shadow-[#B4E0E8]/20'
                  : 'text-slate-200 hover:text-[#011E4D] hover:bg-[#B4E0E8]'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Pengaturan GPS & Notifikasi</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
