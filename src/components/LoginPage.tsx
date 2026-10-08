import { useState } from 'react';
import {
  Camera,
  FileSpreadsheet,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Employee } from '../types';

interface LoginPageProps {
  employees?: Employee[];
}

export function LoginPage({}: LoginPageProps) {
  const { loginWithGoogle } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState<boolean>(false);

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
        setErrorMessage('Gagal masuk dengan Google. Pastikan koneksi internet stabil dan coba kembali.');
      }
    } finally {
      setIsLoggingInGoogle(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#00112C] flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#011E4D] rounded-full blur-3xl opacity-80 pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-[#B4E0E8]/15 rounded-full blur-3xl pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center px-4">
        {/* Brand Logo & Icon */}
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-[#011E4D] to-[#022864] flex items-center justify-center shadow-2xl shadow-[#011E4D]/50 mx-auto mb-4 border border-[#B4E0E8]/50 p-2.5">
          <img
            src="https://upload.wikimedia.org/wikipedia/commons/9/90/National_emblem_of_Indonesia_Garuda_Pancasila.svg"
            alt="Garuda Pancasila"
            className="w-full h-full object-contain drop-shadow"
          />
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
          Absensi Karyawan
        </h1>
        <p className="mt-1.5 text-xs text-slate-300 max-w-sm mx-auto font-medium">
          Koperasi Garuda Merah Putih
        </p>

        {/* Feature Badges */}
        <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
          <span className="bg-[#011E4D] border border-[#093478] text-slate-200 text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1">
            <Camera className="w-3 h-3 text-[#B4E0E8]" /> Face AI Biometrik
          </span>
          <span className="bg-[#011E4D] border border-[#093478] text-slate-200 text-[11px] px-2.5 py-1 rounded-full flex items-center gap-1">
            <FileSpreadsheet className="w-3 h-3 text-[#B4E0E8]" /> Rekap Excel
          </span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 relative z-10">
        <div className="bg-[#011E4D]/90 border border-[#093478] backdrop-blur-xl py-8 px-6 sm:px-8 rounded-3xl shadow-2xl space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-white flex items-center justify-center gap-2">
              <Lock className="w-4 h-4 text-[#B4E0E8]" />
              Masuk ke Aplikasi
            </h2>
            <p className="text-xs text-slate-300">
              Silakan login menggunakan Akun Google Anda untuk mengakses sistem presensi.
            </p>
          </div>

          {/* GOOGLE SIGN-IN BUTTON */}
          <div className="space-y-4 pt-2">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isLoggingInGoogle}
              className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-[#B4E0E8] text-[#011E4D] font-bold text-sm shadow-xl transition flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
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
              Otentikasi aman terenkripsi via Firebase Authentication. Hak akses role (Manager/Karyawan) akan otomatis diverifikasi.
            </p>
          </div>

          {/* Error Feedback */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 flex items-start gap-2">
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
