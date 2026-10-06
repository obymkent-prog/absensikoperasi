import { useState } from 'react';
import {
  Settings,
  MapPin,
  Bell,
  Clock,
  Volume2,
  CheckCircle2,
  AlertCircle,
  LocateFixed,
  Save,
  Send,
} from 'lucide-react';
import { OfficeSetting, NotificationSetting } from '../types';
import { updateOfficeSettings } from '../lib/firestoreService';
import {
  requestNotificationPermission,
  getNotificationPermission,
  sendPushNotification,
  soundPlayer,
} from '../lib/notifications';
import { getCurrentPosition } from '../lib/gpsGeofence';
import { useAuth } from '../context/AuthContext';

interface SettingsViewProps {
  officeSetting: OfficeSetting;
  notificationSetting: NotificationSetting;
  onUpdateNotificationSetting: (newSetting: NotificationSetting) => void;
}

export function SettingsView({
  officeSetting,
  notificationSetting,
  onUpdateNotificationSetting,
}: SettingsViewProps) {
  const { isManager, user } = useAuth();
  // Office settings state
  const [officeName, setOfficeName] = useState(officeSetting.name);
  const [address, setAddress] = useState(officeSetting.address);
  const [latitude, setLatitude] = useState(officeSetting.latitude);
  const [longitude, setLongitude] = useState(officeSetting.longitude);
  const [radiusMeters, setRadiusMeters] = useState(officeSetting.radiusMeters);
  const [workStartTime, setWorkStartTime] = useState(officeSetting.workStartTime);
  const [workEndTime, setWorkEndTime] = useState(officeSetting.workEndTime);
  const [lateToleranceMinutes, setLateToleranceMinutes] = useState(
    officeSetting.lateToleranceMinutes
  );

  // Notification settings state
  const [notifEnabled, setNotifEnabled] = useState(notificationSetting.enabled);
  const [checkInReminderTime, setCheckInReminderTime] = useState(
    notificationSetting.checkInReminderTime
  );
  const [checkOutReminderTime, setCheckOutReminderTime] = useState(
    notificationSetting.checkOutReminderTime
  );
  const [soundEnabled, setSoundEnabled] = useState(notificationSetting.soundEnabled);

  // Notification permission
  const [permission, setPermission] = useState<NotificationPermission>(
    getNotificationPermission()
  );

  const [isSavingOffice, setIsSavingOffice] = useState(false);
  const [officeSavedMessage, setOfficeSavedMessage] = useState<string | null>(null);

  // Auto-detect current GPS coordinates as office location
  const handleUseCurrentLocation = async () => {
    try {
      const coords = await getCurrentPosition();
      setLatitude(coords.latitude);
      setLongitude(coords.longitude);
      setOfficeSavedMessage(
        `Koordinat berhasil diambil dari GPS perangkat: Lat ${coords.latitude.toFixed(
          5
        )}, Lng ${coords.longitude.toFixed(5)}`
      );
      setTimeout(() => setOfficeSavedMessage(null), 4000);
    } catch (err) {
      alert('Gagal mengambil koordinat GPS perangkat. Pastikan izin lokasi aktif.');
    }
  };

  // Save Office Settings to Firestore
  const handleSaveOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingOffice(true);
    setOfficeSavedMessage(null);

    try {
      await updateOfficeSettings({
        name: officeName.trim(),
        address: address.trim(),
        latitude: Number(latitude),
        longitude: Number(longitude),
        radiusMeters: Number(radiusMeters),
        workStartTime,
        workEndTime,
        lateToleranceMinutes: Number(lateToleranceMinutes),
      });

      soundPlayer.playChime('success');
      setOfficeSavedMessage('Pengaturan kantor dan geofence GPS berhasil disimpan ke Firebase!');
      setTimeout(() => setOfficeSavedMessage(null), 4000);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan pengaturan ke Firebase.');
    } finally {
      setIsSavingOffice(false);
    }
  };

  // Request browser push permission
  const handleRequestPermission = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === 'granted') {
      sendPushNotification(
        '🎉 Izin Push Notifikasi Aktif!',
        'Anda akan menerima pengingat otomatis jam masuk dan jam keluar kantor.',
        'system',
        soundEnabled
      );
    }
  };

  // Save notification preferences
  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: NotificationSetting = {
      ...notificationSetting,
      enabled: notifEnabled,
      checkInReminderTime,
      checkOutReminderTime,
      soundEnabled,
      updatedAt: new Date().toISOString(),
    };
    onUpdateNotificationSetting(updated);
    soundPlayer.playChime('success');
    alert('Pengaturan notifikasi berhasil diperbarui!');
  };

  // Test Push Notifications
  const handleTestCheckInPush = () => {
    sendPushNotification(
      '⏰ Pengingat Absensi Masuk Kerja',
      `Selamat pagi! Jam kerja dimulai pukul ${workStartTime}. Segera lakukan presensi GPS & verifikasi wajah.`,
      'checkin',
      soundEnabled
    );
  };

  const handleTestCheckOutPush = () => {
    sendPushNotification(
      '🏢 Pengingat Absensi Pulang Kerja',
      `Waktu kerja telah berakhir (Pukul ${workEndTime}). Jangan lupa lakukan Absen Pulang sebelum meninggalkan area kantor!`,
      'checkout',
      soundEnabled
    );
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex items-center space-x-3">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Settings className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Konfigurasi Geofencing GPS & Sistem Notifikasi Push
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Atur parameter radius kantor, jadwal jam kerja, dan notifikasi pengingat otomatis
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* OFFICE & GPS GEOFENCE CONFIGURATION */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
          <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-slate-800">
            <MapPin className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              Titik Kantor & Geofence GPS
            </h3>
          </div>

          <form onSubmit={handleSaveOffice} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Nama Kantor / Gedung Perusahaan
              </label>
              <input
                type="text"
                required
                value={officeName}
                onChange={(e) => setOfficeName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Alamat Lengkap Kantor
              </label>
              <textarea
                rows={2}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Coordinates with Auto-Locate Button */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 font-semibold">
                  Koordinat Titik Pusat Geofence
                </span>
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition border border-emerald-500/20"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  <span>Gunakan Lokasi GPS Saya</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={latitude}
                    onChange={(e) => setLatitude(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.000001"
                    required
                    value={longitude}
                    onChange={(e) => setLongitude(parseFloat(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Geofence Radius Slider */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-semibold">
                  Radius Geofence Presensi:
                </label>
                <span className="text-emerald-400 font-bold font-mono text-sm">
                  {radiusMeters} Meter
                </span>
              </div>
              <input
                type="range"
                min="20"
                max="500"
                step="10"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(parseInt(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>20 m (Sangat Ketat)</span>
                <span>150 m (Standar)</span>
                <span>500 m (Area Luas)</span>
              </div>
            </div>

            {/* Working Hours Schedule */}
            <div className="pt-2 border-t border-slate-800">
              <h4 className="text-slate-300 font-semibold mb-3 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-400" />
                Jadwal Jam Kerja & Keterlambatan
              </h4>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Jam Masuk</label>
                  <input
                    type="time"
                    required
                    value={workStartTime}
                    onChange={(e) => setWorkStartTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Toleransi (Mnt)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={lateToleranceMinutes}
                    onChange={(e) => setLateToleranceMinutes(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-[11px] mb-1">Jam Pulang</label>
                  <input
                    type="time"
                    required
                    value={workEndTime}
                    onChange={(e) => setWorkEndTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {officeSavedMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{officeSavedMessage}</span>
              </div>
            )}

            <div className="pt-3">
              {isManager ? (
                <button
                  type="submit"
                  disabled={isSavingOffice}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingOffice ? 'Menyimpan...' : 'Simpan Konfigurasi Kantor'}</span>
                </button>
              ) : (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span>Hanya role Manager yang dapat mengubah koordinat GPS kantor & jadwal kerja.</span>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* PUSH NOTIFICATION SYSTEM */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2.5 mb-5 pb-3 border-b border-slate-800">
              <Bell className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">
                Sistem Notifikasi Push Pengingat
              </h3>
            </div>

            {/* Browser Permission Status Card */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-5 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block">Izin Notifikasi Browser:</span>
                <span
                  className={`font-bold mt-0.5 inline-block ${
                    permission === 'granted'
                      ? 'text-emerald-400'
                      : permission === 'denied'
                      ? 'text-rose-400'
                      : 'text-amber-400'
                  }`}
                >
                  {permission === 'granted'
                    ? 'Diizinkan (Aktif)'
                    : permission === 'denied'
                    ? 'Ditolak oleh Browser'
                    : 'Belum Diizinkan'}
                </span>
              </div>

              {permission !== 'granted' && (
                <button
                  type="button"
                  onClick={handleRequestPermission}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow"
                >
                  Aktifkan Izin
                </button>
              )}
            </div>

            <form onSubmit={handleSaveNotifications} className="space-y-4 text-xs">
              {/* Enable / Disable Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div>
                  <span className="font-semibold text-slate-200 block">
                    Pengingat Otomatis Harian
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    Kirimkan push notifikasi setiap hari kerja
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={notifEnabled}
                  onChange={(e) => setNotifEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Sound Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-semibold text-slate-200 block">
                      Efek Suara (Audio Chime)
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      Bunyikan nada lonceng saat notifikasi & absensi sukses
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                />
              </div>

              {/* Scheduled Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Pengingat Jam Masuk
                  </label>
                  <input
                    type="time"
                    value={checkInReminderTime}
                    onChange={(e) => setCheckInReminderTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    15 menit sebelum masuk
                  </span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Pengingat Jam Pulang
                  </label>
                  <input
                    type="time"
                    value={checkOutReminderTime}
                    onChange={(e) => setCheckOutReminderTime(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Saat jam kerja berakhir
                  </span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl border border-slate-700 transition cursor-pointer mt-2"
              >
                Simpan Jadwal Pengingat
              </button>
            </form>
          </div>

          {/* Test Push Notifications Section */}
          <div className="mt-6 pt-5 border-t border-slate-800">
            <span className="text-xs font-semibold text-slate-300 block mb-2.5 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              Uji Coba Push Notifikasi & Suara:
            </span>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleTestCheckInPush}
                className="py-2.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Tes Notif Masuk</span>
              </button>

              <button
                type="button"
                onClick={handleTestCheckOutPush}
                className="py-2.5 px-3 bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Tes Notif Pulang</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
