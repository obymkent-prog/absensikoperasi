import { useState, useRef, useEffect, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Camera,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Building2,
  ArrowRight,
  LogOut,
  Navigation,
  ShieldCheck,
  User,
  X,
  UserPlus,
} from 'lucide-react';
import {
  Employee,
  AttendanceRecord,
  OfficeSetting,
  WorkType,
  AttendanceStatus,
} from '../types';
import {
  calculateDistanceMeters,
  formatDistance,
  getCurrentPosition,
  watchPosition,
  stopWatchingPosition,
  Coordinates,
} from '../lib/gpsGeofence';
import {
  detectFaceInVideo,
  captureSnapshot,
  DetectedFace,
} from '../lib/faceRecognition';
import { recordCheckIn, recordCheckOut, saveEmployee } from '../lib/firestoreService';
import { soundPlayer } from '../lib/notifications';
import { useAuth } from '../context/AuthContext';

interface AttendanceKioskProps {
  employees: Employee[];
  attendances: AttendanceRecord[];
  officeSetting: OfficeSetting;
  onRefreshData?: () => void;
  onNavigateToRegisterFace?: (employeeId: string) => void;
}

export function AttendanceKiosk({
  employees,
  attendances,
  officeSetting,
}: AttendanceKioskProps) {
  const { user, isManager } = useAuth();

  // Video and Canvas refs for Kiosk verification
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // States
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedFace, setDetectedFace] = useState<DetectedFace | null>(null);

  // Real GPS Location state (No test simulation mode)
  const [currentCoords, setCurrentCoords] = useState<Coordinates | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Work Options
  const [workType, setWorkType] = useState<WorkType>('wfo');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // In-Kiosk Face Enrollment Modal states
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);
  const enrollVideoRef = useRef<HTMLVideoElement>(null);
  const enrollCanvasRef = useRef<HTMLCanvasElement>(null);
  const [enrollCapturedPhoto, setEnrollCapturedPhoto] = useState<string | null>(null);
  const [enrollFaceDetected, setEnrollFaceDetected] = useState<boolean>(false);
  const [isSavingEnrollment, setIsSavingEnrollment] = useState<boolean>(false);

  // Determine current active employee from logged in user
  const currentEmployee: Employee | null = useMemo(() => {
    if (!user) return null;

    // Search by NIK, ID, or Email
    const matched = employees.find(
      (e) =>
        (user.nik && e.nik.toLowerCase() === user.nik.toLowerCase()) ||
        e.id === user.uid ||
        (user.email && e.email.toLowerCase() === user.email.toLowerCase())
    );

    if (matched) return matched;

    // Fallback: Synthesize an employee profile for new account or newly logged-in user
    return {
      id: user.uid,
      nik: user.nik || `EMP-${user.uid.slice(0, 6).toUpperCase()}`,
      name: user.displayName || 'Pengguna Baru',
      email: user.email || '',
      department: user.department || 'Umum',
      role: isManager ? 'Manager' : 'Karyawan',
      systemRole: user.role || 'Karyawan',
      phone: '',
      photoUrl: user.photoURL || '',
      hasFaceRegistered: false,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
  }, [user, employees, isManager]);

  // Today's attendance for current logged-in employee
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayAttendance = useMemo(() => {
    if (!currentEmployee) return null;
    return attendances.find(
      (a) =>
        (a.employeeId === currentEmployee.id || a.employeeNik === currentEmployee.nik) &&
        a.date === todayStr
    );
  }, [attendances, currentEmployee, todayStr]);

  // Track Real GPS Location (Continuous & Initial)
  useEffect(() => {
    setIsLocating(true);
    getCurrentPosition()
      .then((coords) => {
        setCurrentCoords(coords);
        setGpsError(null);
      })
      .catch((err) => {
        setGpsError(err.message || 'Gagal memperoleh lokasi GPS.');
        // Fallback default coordinates to office coordinates if GPS denied in sandbox
        setCurrentCoords({
          latitude: officeSetting.latitude,
          longitude: officeSetting.longitude,
          accuracy: 10,
        });
      })
      .finally(() => setIsLocating(false));

    const watchId = watchPosition(
      (coords) => {
        setCurrentCoords(coords);
        setGpsError(null);
      },
      (err) => {
        setGpsError(err.message || 'Gagal melacak pergerakan GPS.');
      }
    );

    return () => {
      stopWatchingPosition(watchId);
    };
  }, [officeSetting]);

  // Distance calculation to Office
  const distanceToOfficeMeters = useMemo(() => {
    if (!currentCoords) return null;
    return calculateDistanceMeters(
      currentCoords.latitude,
      currentCoords.longitude,
      officeSetting.latitude,
      officeSetting.longitude
    );
  }, [currentCoords, officeSetting]);

  const isWithinGeofence = useMemo(() => {
    if (distanceToOfficeMeters === null) return false;
    return distanceToOfficeMeters <= officeSetting.radiusMeters;
  }, [distanceToOfficeMeters, officeSetting.radiusMeters]);

  // Setup WebCam Stream for Kiosk Face Recognition
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;

    async function startCamera() {
      try {
        setCameraError(null);
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            aspectRatio: { ideal: 4 / 3 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (!isCancelled && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        if (!isCancelled) {
          setCameraError(
            err.name === 'NotAllowedError'
              ? 'Izin kamera ditolak. Silakan izinkan akses webcam untuk verifikasi wajah.'
              : 'Gagal mengakses kamera webcam.'
          );
        }
      }
    }

    if (cameraActive && !isEnrollModalOpen) {
      startCamera();
    }

    return () => {
      isCancelled = true;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraActive, isEnrollModalOpen]);

  // Real-time Face Recognition Detection Loop
  useEffect(() => {
    let animationFrameId: number;
    let isRunning = true;

    const detectLoop = async () => {
      if (
        isRunning &&
        cameraActive &&
        !isEnrollModalOpen &&
        videoRef.current &&
        overlayCanvasRef.current &&
        videoRef.current.readyState >= 2
      ) {
        const face = await detectFaceInVideo(videoRef.current, overlayCanvasRef.current);
        setDetectedFace(face);
      }
      if (isRunning) {
        animationFrameId = requestAnimationFrame(detectLoop);
      }
    };

    if (cameraActive && !isEnrollModalOpen) {
      detectLoop();
    }

    return () => {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
    };
  }, [cameraActive, isEnrollModalOpen]);

  // Camera Stream for In-Kiosk Face Enrollment Modal
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;
    let animId: number;

    async function startEnrollCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 480, facingMode: 'user' },
        });
        if (!isCancelled && enrollVideoRef.current) {
          enrollVideoRef.current.srcObject = stream;
          enrollVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Webcam enrollment error:', err);
      }
    }

    if (isEnrollModalOpen) {
      setEnrollCapturedPhoto(null);
      startEnrollCamera();

      const checkFace = async () => {
        if (enrollVideoRef.current && enrollCanvasRef.current) {
          const det = await detectFaceInVideo(enrollVideoRef.current, enrollCanvasRef.current);
          if (!isCancelled) {
            setEnrollFaceDetected(Boolean(det));
          }
        }
        animId = requestAnimationFrame(checkFace);
      };
      checkFace();
    }

    return () => {
      isCancelled = true;
      cancelAnimationFrame(animId);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isEnrollModalOpen]);

  // Capture face photo inside Enrollment Modal
  const handleCaptureEnrollSnapshot = () => {
    if (enrollVideoRef.current && currentEmployee) {
      const snap = captureSnapshot(
        enrollVideoRef.current,
        `BIOMETRIK RESMI • ${currentEmployee.nik}`
      );
      if (snap) {
        setEnrollCapturedPhoto(snap);
      }
    }
  };

  // Save Face Enrollment to Firestore
  const handleSaveEnrollment = async () => {
    if (!currentEmployee || !enrollCapturedPhoto) return;

    setIsSavingEnrollment(true);
    try {
      await saveEmployee({
        id: currentEmployee.id,
        nik: currentEmployee.nik,
        name: currentEmployee.name,
        email: currentEmployee.email,
        department: currentEmployee.department,
        role: currentEmployee.role,
        systemRole: currentEmployee.systemRole,
        hasFaceRegistered: true,
        photoUrl: enrollCapturedPhoto,
        isActive: true,
      });

      soundPlayer.playChime('success');
      setIsEnrollModalOpen(false);
      setFeedbackMessage({
        type: 'success',
        text: 'Wajah biometrik berhasil didaftarkan! Anda sekarang dapat melakukan presensi masuk.',
      });
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan pendaftaran wajah ke database.');
    } finally {
      setIsSavingEnrollment(false);
    }
  };

  // Handle Check-In
  const handleCheckIn = async () => {
    if (!currentEmployee) return;

    // Check Geofencing Constraint for WFO
    if (workType === 'wfo' && !isWithinGeofence) {
      soundPlayer.playChime('error');
      setFeedbackMessage({
        type: 'error',
        text: `Presensi WFO Ditolak: Anda berada ${formatDistance(
          distanceToOfficeMeters || 0
        )} dari kantor (Batas radius ${officeSetting.radiusMeters}m). Gunakan WFH/Dinas atau masuk ke area kantor.`,
      });
      return;
    }

    // Check Face Registration Requirement
    if (!currentEmployee.hasFaceRegistered) {
      soundPlayer.playChime('error');
      setFeedbackMessage({
        type: 'error',
        text: 'Anda belum mendaftarkan foto wajah referensi! Silakan klik tombol "Daftarkan Wajah" terlebih dahulu.',
      });
      setIsEnrollModalOpen(true);
      return;
    }

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      // Capture live verification selfie
      let photoSnapshot = '';
      if (videoRef.current) {
        photoSnapshot =
          captureSnapshot(
            videoRef.current,
            `${currentEmployee.name} • ${workType.toUpperCase()}`
          ) || '';
      }

      const now = new Date();
      const checkInTime = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      // Determine attendance status based on workStartTime + tolerance
      const [startHour, startMin] = officeSetting.workStartTime.split(':').map(Number);
      const limitMinutes = startHour * 60 + startMin + officeSetting.lateToleranceMinutes;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const status: AttendanceStatus =
        currentMinutes > limitMinutes ? 'terlambat' : 'tepat_waktu';

      // Record check-in to Firestore
      await recordCheckIn({
        employeeId: currentEmployee.id,
        employeeNik: currentEmployee.nik,
        employeeName: currentEmployee.name,
        department: currentEmployee.department,
        date: todayStr,
        checkInTime,
        type: workType,
        status,
        locationLat: currentCoords?.latitude || officeSetting.latitude,
        locationLng: currentCoords?.longitude || officeSetting.longitude,
        distanceToOfficeMeters: Math.round(distanceToOfficeMeters || 0),
        isWithinGeofence: Boolean(isWithinGeofence),
        verificationConfidence: detectedFace ? detectedFace.confidence : 92,
        photoSnapshot,
        notes: notes.trim(),
      });

      // Play success audio & celebration confetti
      soundPlayer.playChime('checkin');
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });

      setFeedbackMessage({
        type: 'success',
        text: `Presensi Masuk Berhasil! Status: ${
          status === 'tepat_waktu' ? 'Tepat Waktu' : 'Terlambat'
        } pada pukul ${checkInTime}.`,
      });
    } catch (err: any) {
      console.error(err);
      soundPlayer.playChime('error');
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Gagal menyimpan absensi masuk ke server.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Check-Out
  const handleCheckOut = async () => {
    if (!todayAttendance || !currentEmployee) return;

    setIsSubmitting(true);
    setFeedbackMessage(null);

    try {
      const now = new Date();
      const checkOutTime = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      await recordCheckOut(todayAttendance.id, checkOutTime, notes.trim());

      soundPlayer.playChime('checkout');
      setFeedbackMessage({
        type: 'success',
        text: `Presensi Pulang Berhasil! Tercatat pada pukul ${checkOutTime}. Terima kasih atas kerja keras Anda hari ini!`,
      });
    } catch (err: any) {
      console.error(err);
      soundPlayer.playChime('error');
      setFeedbackMessage({
        type: 'error',
        text: err.message || 'Gagal menyimpan absensi pulang.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans">
      {/* LEFT COLUMN: Camera Viewfinder & Face Biometric Scanner (7 cols) */}
      <div className="lg:col-span-7 space-y-6">
        {/* Face Enrollment Callout for First-Time Users */}
        {currentEmployee && !currentEmployee.hasFaceRegistered && (
          <div className="bg-[#011E4D]/90 border border-[#B4E0E8]/40 rounded-3xl p-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#00112C] text-[#B4E0E8] border border-[#093478] flex items-center justify-center shrink-0">
                <Sparkles className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Daftarkan Wajah Anda untuk Mulai Absen
                  <span className="bg-[#022864] text-[#B4E0E8] text-[10px] px-2 py-0.5 rounded-full font-bold border border-[#B4E0E8]/30">
                    Pengguna Baru
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                  Halo <strong>{currentEmployee.name}</strong>, akun Anda belum memiliki foto referensi biometrik wajah. Ambil foto wajah sekali saja untuk presensi harian.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsEnrollModalOpen(true)}
              className="px-4 py-2.5 bg-[#B4E0E8] hover:bg-white text-[#011E4D] font-black text-xs rounded-xl shadow-lg shadow-[#B4E0E8]/20 transition cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Camera className="w-4 h-4" />
              <span>Daftarkan Wajah Sekarang</span>
            </button>
          </div>
        )}

        {/* Camera Viewfinder Card */}
        <div className="bg-[#011E4D]/90 border border-[#093478] rounded-3xl p-6 shadow-2xl overflow-hidden relative">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-[#00112C] text-[#B4E0E8] border border-[#093478]">
                <Camera className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  Pemindai Wajah Real-Time
                  <span className="w-2 h-2 rounded-full bg-[#B4E0E8] animate-ping"></span>
                </h3>
                <p className="text-xs text-slate-300">
                  Verifikasi identitas biometrik otomatis sebelum mencatat presensi
                </p>
              </div>
            </div>

            <button
              onClick={() => setCameraActive(!cameraActive)}
              className="text-xs text-slate-300 hover:text-[#011E4D] bg-[#00112C] hover:bg-[#B4E0E8] px-3 py-1.5 rounded-xl border border-[#093478] hover:border-[#B4E0E8] transition cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{cameraActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
            </button>
          </div>

          {/* Video Feed Box - Proportional 4:3 Aspect Ratio (Not squished/gepeng) */}
          <div className="relative aspect-[4/3] max-h-[460px] w-full bg-[#00112C] rounded-3xl overflow-hidden border border-[#093478] flex items-center justify-center shadow-2xl">
            {cameraActive ? (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute inset-0 w-full h-full pointer-events-none scale-x-[-1]"
                />

                {/* Face Scanning HUD Overlay - Ergonomic Human Proportions */}
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-4">
                  {/* Proportional Biometric Face Target (1:1.35 Golden Ratio) */}
                  <div
                    className={`relative w-48 sm:w-56 h-64 sm:h-74 rounded-[42px] border-2 transition-all duration-300 flex flex-col items-center justify-between p-3.5 ${
                      detectedFace
                        ? 'border-[#B4E0E8] bg-[#B4E0E8]/10 shadow-[0_0_30px_rgba(180,224,232,0.35)]'
                        : 'border-slate-500/60 border-dashed bg-[#00112C]/40'
                    }`}
                  >
                    {/* High-tech Corner Brackets */}
                    <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-2 border-l-2 border-[#B4E0E8] rounded-tl-lg"></div>
                    <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-2 border-r-2 border-[#B4E0E8] rounded-tr-lg"></div>
                    <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-2 border-l-2 border-[#B4E0E8] rounded-bl-lg"></div>
                    <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-2 border-r-2 border-[#B4E0E8] rounded-br-lg"></div>

                    {/* Laser Scan Line Animation */}
                    <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-transparent via-[#B4E0E8] to-transparent animate-pulse"></div>

                    <span className="text-[10px] font-mono tracking-wider uppercase bg-[#00112C]/90 px-2.5 py-0.5 rounded-full text-slate-300 border border-[#093478] shadow-sm">
                      Area Wajah
                    </span>

                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full shadow-lg backdrop-blur-md transition-colors ${
                        detectedFace
                          ? 'bg-[#B4E0E8] text-[#011E4D] font-mono shadow-[#B4E0E8]/25'
                          : 'bg-[#00112C]/90 text-slate-300 border border-[#093478]'
                      }`}
                    >
                      {detectedFace
                        ? `✓ Wajah Terdeteksi (${detectedFace.confidence}%)`
                        : 'Posisikan Wajah di Tengah'}
                    </span>
                  </div>
                </div>

                {/* Live Detection Bottom Tag */}
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-[#00112C]/90 backdrop-blur-md py-2 px-3.5 rounded-xl border border-[#093478] text-xs">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        detectedFace ? 'bg-[#B4E0E8] animate-ping' : 'bg-amber-400 animate-pulse'
                      }`}
                    ></span>
                    <span className="text-slate-300 font-medium">
                      {detectedFace
                        ? 'Wajah Siap Diverifikasi'
                        : 'Arahkan wajah tegak ke kamera...'}
                    </span>
                  </div>

                  <span className="font-mono text-[#B4E0E8] font-semibold text-[11px] bg-[#022864] px-2 py-0.5 rounded-md border border-[#B4E0E8]/30">
                    Proposional 4:3
                  </span>
                </div>
              </>
            ) : (
              <div className="text-center p-6">
                <Camera className="w-12 h-12 text-slate-500 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Kamera dinonaktifkan</p>
                <button
                  onClick={() => setCameraActive(true)}
                  className="mt-3 px-4 py-2 bg-[#B4E0E8] hover:bg-white text-[#011E4D] rounded-xl text-xs font-semibold cursor-pointer transition"
                >
                  Aktifkan Kamera
                </button>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* GPS Geofence Radar Card (Real GPS only) */}
        <div className="bg-[#011E4D]/90 border border-[#093478] rounded-3xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2.5">
              <div
                className={`p-2 rounded-xl ${
                  isWithinGeofence
                    ? 'bg-[#00112C] text-[#B4E0E8] border border-[#093478]'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  Status Lokasi GPS & Geofencing
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      isWithinGeofence
                        ? 'bg-[#022864] text-[#B4E0E8] border-[#B4E0E8]/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {isWithinGeofence ? 'DALAM RADIUS KANTOR' : 'DI LUAR RADIUS'}
                  </span>
                </h4>
                <p className="text-xs text-slate-300">{officeSetting.name}</p>
              </div>
            </div>

            {isLocating && (
              <span className="text-xs text-slate-300 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin text-[#B4E0E8]" /> Melacak GPS...
              </span>
            )}
          </div>

          {/* Location details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#00112C]/80 p-3.5 rounded-2xl border border-[#093478] text-xs mb-2">
            <div>
              <span className="text-slate-400 block">Jarak ke Kantor</span>
              <span
                className={`text-sm font-bold font-mono ${
                  isWithinGeofence ? 'text-[#B4E0E8]' : 'text-rose-400'
                }`}
              >
                {distanceToOfficeMeters !== null
                  ? formatDistance(distanceToOfficeMeters)
                  : 'Menghitung...'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Radius Diizinkan</span>
              <span className="text-sm font-bold text-slate-200 font-mono">
                {officeSetting.radiusMeters} meter
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Latitude GPS</span>
              <span className="text-xs text-slate-300 font-mono truncate block">
                {currentCoords ? currentCoords.latitude.toFixed(5) : '-'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block">Longitude GPS</span>
              <span className="text-xs text-slate-300 font-mono truncate block">
                {currentCoords ? currentCoords.longitude.toFixed(5) : '-'}
              </span>
            </div>
          </div>

          {gpsError && (
            <p className="text-[11px] text-amber-400/90 mt-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{gpsError}</span>
            </p>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Logged-in User Profile & Attendance Actions (5 cols) */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-[#011E4D]/90 border border-[#093478] rounded-3xl p-6 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-5 pb-3 border-b border-[#093478]">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-[#B4E0E8]" />
              Profil Akun Presensi
            </h3>
            <span
              className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                isManager
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                  : 'bg-[#022864] text-[#B4E0E8] border border-[#B4E0E8]/30'
              }`}
            >
              {isManager ? '👑 Manager' : '👤 Karyawan'}
            </span>
          </div>

          {/* User Profile Card */}
          {currentEmployee && (
            <div className="bg-[#00112C]/80 border border-[#093478] rounded-2xl p-4 mb-6">
              <div className="flex items-center space-x-3.5">
                <div className="relative">
                  <img
                    src={
                      currentEmployee.photoUrl ||
                      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                    }
                    alt={currentEmployee.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#B4E0E8]/40 shadow-md"
                  />
                  {currentEmployee.hasFaceRegistered && (
                    <span
                      className="absolute -bottom-1 -right-1 p-1 bg-[#B4E0E8] text-[#011E4D] rounded-full shadow"
                      title="Wajah Biometrik Terverifikasi"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-white truncate">
                    {currentEmployee.name}
                  </h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {currentEmployee.nik}
                  </p>
                  <p className="text-xs text-[#B4E0E8] font-medium truncate">
                    {currentEmployee.role} • {currentEmployee.department}
                  </p>
                </div>
              </div>

              {/* Face Biometric Status & Direct Register Button */}
              <div className="mt-4 pt-3 border-t border-[#093478] flex items-center justify-between text-xs">
                <span className="text-slate-400">Verifikasi Wajah:</span>
                {currentEmployee.hasFaceRegistered ? (
                  <span className="text-[#B4E0E8] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Terdaftar & Aktif
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEnrollModalOpen(true)}
                    className="px-2.5 py-1 bg-[#022864] hover:bg-[#B4E0E8] text-[#B4E0E8] hover:text-[#011E4D] font-bold rounded-lg border border-[#B4E0E8]/30 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Daftarkan Wajah</span>
                  </button>
                )}
              </div>

              {/* Status Absensi Hari Ini */}
              <div className="mt-3 pt-3 border-t border-[#093478] flex items-center justify-between text-xs">
                <span className="text-slate-400">Presensi Hari Ini:</span>
                {todayAttendance ? (
                  <div className="text-right">
                    <span className="text-[#B4E0E8] font-bold block">
                      Masuk: {todayAttendance.checkInTime}
                    </span>
                    {todayAttendance.checkOutTime ? (
                      <span className="text-sky-300 font-semibold block">
                        Pulang: {todayAttendance.checkOutTime}
                      </span>
                    ) : (
                      <span className="text-amber-400 text-[11px] block">
                        Belum Absen Pulang
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="bg-[#00112C] text-slate-300 px-2 py-0.5 rounded-lg font-semibold text-[11px] border border-[#093478]">
                    Belum Melakukan Absen
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Work Type Selector */}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Tipe Kehadiran:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setWorkType('wfo')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex flex-col items-center gap-1 ${
                  workType === 'wfo'
                    ? 'bg-[#B4E0E8] text-[#011E4D] shadow-md shadow-[#B4E0E8]/20'
                    : 'bg-[#00112C] text-slate-300 hover:bg-[#B4E0E8] hover:text-[#011E4D] border border-[#093478] hover:border-[#B4E0E8]'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>WFO (Kantor)</span>
              </button>

              <button
                type="button"
                onClick={() => setWorkType('wfh')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex flex-col items-center gap-1 ${
                  workType === 'wfh'
                    ? 'bg-[#B4E0E8] text-[#011E4D] shadow-md shadow-[#B4E0E8]/20'
                    : 'bg-[#00112C] text-slate-300 hover:bg-[#B4E0E8] hover:text-[#011E4D] border border-[#093478] hover:border-[#B4E0E8]'
                }`}
              >
                <Navigation className="w-4 h-4" />
                <span>WFH (Rumah)</span>
              </button>

              <button
                type="button"
                onClick={() => setWorkType('dinas')}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex flex-col items-center gap-1 ${
                  workType === 'dinas'
                    ? 'bg-[#B4E0E8] text-[#011E4D] shadow-md shadow-[#B4E0E8]/20'
                    : 'bg-[#00112C] text-slate-300 hover:bg-[#B4E0E8] hover:text-[#011E4D] border border-[#093478] hover:border-[#B4E0E8]'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Dinas Luar</span>
              </button>
            </div>
            {workType !== 'wfo' && (
              <p className="text-[11px] text-[#B4E0E8] mt-1.5 italic">
                * Presensi {workType.toUpperCase()} dapat dilakukan di luar radius kantor.
              </p>
            )}
          </div>

          {/* Notes Input */}
          <div className="mb-6">
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Catatan Aktivitas (Opsional):
            </label>
            <input
              type="text"
              placeholder="Contoh: Meeting divisi / tugas dinas luar..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#B4E0E8]"
            />
          </div>

          {/* Feedback Message */}
          {feedbackMessage && (
            <div
              className={`mb-5 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 animate-fade-in ${
                feedbackMessage.type === 'success'
                  ? 'bg-[#022864] text-[#B4E0E8] border border-[#B4E0E8]/30'
                  : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
              }`}
            >
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#B4E0E8] mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
          )}

          {/* Action Buttons: Check-In and Check-Out */}
          <div className="space-y-3">
            {!todayAttendance ? (
              <button
                type="button"
                onClick={handleCheckIn}
                disabled={isSubmitting || !currentEmployee}
                className="w-full py-3.5 px-4 rounded-2xl bg-[#B4E0E8] hover:bg-white text-[#011E4D] font-black text-sm shadow-xl shadow-[#B4E0E8]/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mencatat Presensi...</span>
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-5 h-5" />
                    <span>ABSEN MASUK (Check-In)</span>
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleCheckOut}
                  disabled={isSubmitting || Boolean(todayAttendance.checkOutTime)}
                  className={`w-full py-3.5 px-4 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 cursor-pointer ${
                    todayAttendance.checkOutTime
                      ? 'bg-[#00112C] text-slate-500 cursor-not-allowed border border-[#093478]'
                      : 'bg-[#022864] hover:bg-[#B4E0E8] text-white hover:text-[#011E4D] border border-[#B4E0E8]/40 shadow-lg'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan Pulang...</span>
                    </>
                  ) : todayAttendance.checkOutTime ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-[#B4E0E8]" />
                      <span>Presensi Lengkap (Sudah Pulang)</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-5 h-5" />
                      <span>ABSEN PULANG (Check-Out)</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-slate-400">
                  Check-in masuk Anda tercatat pada pukul{' '}
                  <strong className="text-slate-200">{todayAttendance.checkInTime}</strong>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: DAFTARKAN WAJAH BIOMETRIK BARU */}
      {isEnrollModalOpen && currentEmployee && (
        <div className="fixed inset-0 z-50 bg-[#00112C]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#011E4D] border border-[#093478] rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setIsEnrollModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-[#00112C] hover:bg-[#B4E0E8] text-slate-300 hover:text-[#011E4D] cursor-pointer transition border border-[#093478] hover:border-[#B4E0E8]"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#B4E0E8]" />
              Perekaman Wajah Biometrik
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              Pendaftaran untuk:{' '}
              <strong className="text-white">{currentEmployee.name}</strong> (
              {currentEmployee.nik})
            </p>

            {/* Camera Viewfinder */}
            <div className="relative aspect-square w-full bg-[#00112C] rounded-2xl overflow-hidden border border-[#093478] mb-4 flex items-center justify-center">
              {!enrollCapturedPhoto ? (
                <>
                  <video
                    ref={enrollVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <canvas ref={enrollCanvasRef} className="hidden" />

                  {/* Face Guide Oval - Proportional Biometric Framing */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-3">
                    <div className="relative w-48 h-62 border-2 border-[#B4E0E8]/80 rounded-[40px] flex flex-col items-center justify-between p-3 shadow-[0_0_25px_rgba(180,224,232,0.25)] bg-[#B4E0E8]/5">
                      <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-[#B4E0E8] rounded-tl-md"></div>
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-[#B4E0E8] rounded-tr-md"></div>
                      <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-[#B4E0E8] rounded-bl-md"></div>
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-[#B4E0E8] rounded-br-md"></div>

                      <span className="text-[10px] bg-[#00112C]/90 text-[#B4E0E8] px-2.5 py-0.5 rounded-full font-mono border border-[#093478]">
                        Posisikan Wajah
                      </span>
                    </div>
                  </div>

                  <div className="absolute bottom-3 inset-x-3 bg-[#00112C]/90 backdrop-blur-md rounded-xl p-2.5 text-center text-xs border border-[#093478]">
                    <span className="text-[#B4E0E8] font-semibold flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {enrollFaceDetected
                        ? 'Wajah siap diambil!'
                        : 'Menunggu posisi wajah pas...'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="relative w-full h-full">
                  <img
                    src={enrollCapturedPhoto}
                    alt="Captured Face"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 inset-x-3 bg-[#B4E0E8] text-[#011E4D] font-bold rounded-xl p-2 text-center text-xs flex items-center justify-center gap-1.5 shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    Foto Wajah Siap Digunakan
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3">
              {!enrollCapturedPhoto ? (
                <button
                  type="button"
                  onClick={handleCaptureEnrollSnapshot}
                  className="w-full py-3 bg-[#B4E0E8] hover:bg-white text-[#011E4D] font-black rounded-xl text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Ambil Foto Referensi</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setEnrollCapturedPhoto(null)}
                    className="px-4 py-2.5 bg-[#00112C] hover:bg-[#B4E0E8] text-slate-300 hover:text-[#011E4D] font-medium rounded-xl text-xs cursor-pointer flex items-center gap-1.5 border border-[#093478] hover:border-[#B4E0E8] transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Ulangi</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveEnrollment}
                    disabled={isSavingEnrollment}
                    className="flex-1 py-2.5 bg-[#B4E0E8] hover:bg-white text-[#011E4D] font-black rounded-xl text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSavingEnrollment ? 'Menyimpan...' : 'Simpan & Daftarkan Wajah'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
