import { X, Bell, Trash2, CheckCircle2 } from 'lucide-react';
import { PushNotificationLog } from '../types';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: PushNotificationLog[];
  onClearLogs: () => void;
  onMarkAllAsRead: () => void;
}

export function NotificationCenterModal({
  isOpen,
  onClose,
  logs,
  onClearLogs,
  onMarkAllAsRead,
}: NotificationCenterModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Bell className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Pusat Notifikasi Push</h3>
          </div>
          {logs.length > 0 && (
            <button
              onClick={onClearLogs}
              className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua</span>
            </button>
          )}
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              <Bell className="w-8 h-8 mx-auto mb-2 text-slate-600" />
              Belum ada riwayat notifikasi push.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-200">{log.title}</span>
                  <span className="text-[10px] text-slate-500 font-mono">{log.timestamp}</span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">{log.body}</p>
              </div>
            ))
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
          <button
            onClick={onMarkAllAsRead}
            className="text-emerald-400 hover:underline cursor-pointer"
          >
            Tandai semua dibaca
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
