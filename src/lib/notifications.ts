import { NotificationSetting, PushNotificationLog } from '../types';

class SoundPlayer {
  private audioCtx: AudioContext | null = null;

  playChime(type: 'checkin' | 'checkout' | 'success' | 'error') {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (type === 'checkin') {
        // Melodic ascending chime
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.12); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.24); // G5
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.55);
      } else if (type === 'checkout') {
        // Warm two-tone chime
        osc.frequency.setValueAtTime(659.25, now); // E5
        osc.frequency.setValueAtTime(523.25, now + 0.18); // C5
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.55);
      } else if (type === 'error') {
        // Warning chime
        osc.frequency.setValueAtTime(329.63, now); // E4
        osc.frequency.setValueAtTime(261.63, now + 0.15); // C4
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        // High success chime
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.0, now + 0.1); // A5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch {
      // Audio not permitted or supported
    }
  }
}

export const soundPlayer = new SoundPlayer();

/**
 * Request browser desktop push permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

/**
 * Send browser push notification and audio chime
 */
export function sendPushNotification(
  title: string,
  body: string,
  type: 'checkin' | 'checkout' | 'system',
  soundEnabled: boolean = true
): PushNotificationLog {
  if (soundEnabled) {
    soundPlayer.playChime(type === 'checkout' ? 'checkout' : 'checkin');
  }

  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: `attendance-${type}-${Date.now()}`,
      });
    } catch {
      // Notification constructor error in some iframe contexts
    }
  }

  const log: PushNotificationLog = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title,
    body,
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    type,
    isRead: false,
  };

  // Broadcast event for active UI components
  window.dispatchEvent(
    new CustomEvent('app-push-notification', {
      detail: log,
    })
  );

  return log;
}

/**
 * Check and fire scheduled push notification reminders
 */
export function checkScheduledReminders(
  settings: NotificationSetting,
  lastFired: { checkInDate?: string; checkOutDate?: string }
): { firedCheckIn: boolean; firedCheckOut: boolean } {
  if (!settings.enabled) {
    return { firedCheckIn: false, firedCheckOut: false };
  }

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentHours = String(now.getHours()).padStart(2, '0');
  const currentMinutes = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  let firedCheckIn = false;
  let firedCheckOut = false;

  // Check In Reminder
  if (
    currentTimeStr === settings.checkInReminderTime &&
    lastFired.checkInDate !== todayStr
  ) {
    sendPushNotification(
      '⏰ Pengingat Absensi Masuk Kerja',
      'Waktu kerja akan segera dimulai! Jangan lupa melakukan presensi GPS & verifikasi wajah sekarang.',
      'checkin',
      settings.soundEnabled
    );
    firedCheckIn = true;
  }

  // Check Out Reminder
  if (
    currentTimeStr === settings.checkOutReminderTime &&
    lastFired.checkOutDate !== todayStr
  ) {
    sendPushNotification(
      '🏢 Pengingat Absensi Pulang Kerja',
      'Jam kerja hari ini telah selesai. Pastikan Anda telah melakukan Absen Pulang sebelum pulang.',
      'checkout',
      settings.soundEnabled
    );
    firedCheckOut = true;
  }

  return { firedCheckIn, firedCheckOut };
}
