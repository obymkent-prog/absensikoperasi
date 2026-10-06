import { useState } from 'react';
import {
  ShieldCheck,
  MapPin,
  Camera,
  FileSpreadsheet,
  Bell,
  ArrowRight,
  User,
  Users,
  AlertCircle,
  Sparkles,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Employee } from '../types';

interface LoginPageProps {
  employees: Employee[];
}

export function LoginPage({ employees }: LoginPageProps) {
  const { loginWithGoogle, loginWithEmployee } = useAuth();
  const [selectedNik, setSelectedNik] = useState<string>('');
  const [searchNik, setSearchNik] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'google' | 'nik'>('google');

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsLoggingInGoogle(true);
    setErrorMessage(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Jendela login ditutup sebelum selesai.');
      } else if (err.code === 'auth/popup-blocked') {
        setErrorMessage('Pop-up browser diblokir. Harap izinkan pop-up untuk domain ini.');
      } else {
        setErrorMessage('Gagal masuk dengan Google. Anda dapat menggunakan opsi Masuk dengan NIK / Akun Karyawan.');
      }
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  // Handle NIK Sign-In
  const handleNikSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    const targetNik = selectedNik || searchNik.trim();
    if (!targetNik) {
      setErrorMessage('Silakan pilih atau masukkan NIK karyawan.');
      return;
    }

    const found = employees.find(
      (emp) => emp.nik.toLowerCase() === targetNik.toLowerCase() || emp.id === targetNik
    );

    if (found) {
      loginWithEmployee(found);
    } else {
      setErrorMessage(`Karyawan dengan NIK "${targetNik}" tidak ditemukan.`);
    }
  };

  // Filtered employees for selector
  const filteredEmployees = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(searchNik.toLowerCase()) ||
      e.nik.toLowerCase().includes(searchNik.toLowerCase()) ||
      e.department.toLowerCase().includes(searchNik.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center px-4">
        {/* Brand Logo & Icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center shadow-xl shadow-emerald-500/25 mx-auto mb-4 border border-emerald-400/30">
          <ShieldCheck className="w-9 h-9 text-slate-950" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Presensi Pintar
        </h1>
        <p className="mt-1.5 text-xs text-slate-400 max-w-sm mx-auto">
          Sistem Absensi Karyawan Berbasis GPS Geofencing & Verifikasi Wajah Real-Time
        </p>

        {/* Feature Badges */}
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          <span className="bg-slate-900 border border-slate-800 text-slate-300 text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1">
            <MapPin className="w-3 h-3 text-emerald-400" /> GPS Geofence
          </span>
          <span className="bg-slate-900 border border-slate-800 text-slate-300 text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1">
            <Camera className="w-3 h-3 text-emerald-400" /> Face AI Biometrik
          </span>
          <span className="bg-slate-900 border border-slate-800 text-slate-300 text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3 text-emerald-400" /> Rekap Excel
          </span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        <div className="bg-slate-900/90 border border-slate-800 backdrop-blur-xl py-8 px-6 sm:px-8 rounded-3xl shadow-2xl">
          {/* Login Mode Toggle Tabs */}
          <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800/80 mb-6 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveTab('google');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'google'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Akun Google</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('nik');
                setErrorMessage(null);
              }}
              className={`flex-1 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'nik'
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>NIK / Karyawan</span>
            </button>
          </div>

          {/* TAB 1: GOOGLE SIGN-IN */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoggingInGoogle}
                className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm shadow-lg transition flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
              >
                {/* Official Google SVG Icon */}
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.98 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>
                  {isLoggingInGoogle ? 'Menghubungkan...' : 'Masuk dengan Akun Google'}
                </span>
              </button>

              <p className="text-[11px] text-center text-slate-500 leading-relaxed">
                Gunakan akun Google Anda yang terdaftar pada sistem perusahaan untuk otentikasi aman Firebase.
              </p>
            </div>
          )}

          {/* TAB 2: NIK / EMPLOYEE ID SIGN-IN */}
          {activeTab === 'nik' && (
            <form onSubmit={handleNikSignIn} className="space-y-4">
              {employees.length > 0 ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Pilih Profil Karyawan Terdaftar:
                    </label>
                    <select
                      value={selectedNik}
                      onChange={(e) => setSelectedNik(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="">-- Pilih dari Daftar Karyawan --</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.nik}>
                          [{emp.systemRole || (emp.role?.toLowerCase().includes('manager') ? 'Manager' : 'Karyawan')}] {emp.name} ({emp.nik}) - {emp.department}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Atau Cari Nama / NIK:
                    </label>
                    <input
                      type="text"
                      placeholder="Masukkan NIK atau Nama..."
                      value={searchNik}
                      onChange={(e) => setSearchNik(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Masuk ke Kios Presensi</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-300 font-medium">
                    Belum ada data karyawan terdaftar di database.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Silakan masuk menggunakan <strong>Akun Google</strong> di tab sebelah untuk mulai menambahkan data karyawan resmi di tab Kelola Karyawan.
                  </p>
                </div>
              )}
            </form>
          )}

          {/* Error Feedback */}
          {errorMessage && (
            <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] text-slate-500">
          Dilindungi oleh Firebase Security Rules & Enkripsi End-to-End
        </p>
      </div>
    </div>
  );
}
