import { useState, useRef, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Camera,
  CheckCircle2,
  Trash2,
  Edit2,
  X,
  Search,
  Sparkles,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  User,
  Lock,
} from 'lucide-react';
import { Employee, UserRole } from '../types';
import { saveEmployee, deleteEmployee } from '../lib/firestoreService';
import { captureSnapshot, detectFaceInVideo } from '../lib/faceRecognition';
import { soundPlayer } from '../lib/notifications';
import { useAuth } from '../context/AuthContext';

interface EmployeeManagementProps {
  employees: Employee[];
  initialEnrollingEmployeeId?: string | null;
  onClearInitialEnrollingId?: () => void;
}

export function EmployeeManagement({
  employees,
  initialEnrollingEmployeeId,
  onClearInitialEnrollingId,
}: EmployeeManagementProps) {
  const { user, isManager } = useAuth();

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [enrollingEmployee, setEnrollingEmployee] = useState<Employee | null>(null);

  // Add/Edit Form states
  const [nik, setNik] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [department, setDepartment] = useState<string>('Teknologi Informasi');
  const [role, setRole] = useState<string>('');
  const [systemRole, setSystemRole] = useState<UserRole>('Karyawan');
  const [phone, setPhone] = useState<string>('');
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Face Enrollment Camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCapturingFace, setIsCapturingFace] = useState<boolean>(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [faceDetectedInCamera, setFaceDetectedInCamera] = useState<boolean>(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterRole, setFilterRole] = useState<'all' | 'Manager' | 'Karyawan'>('all');

  // Handle initial enrolling request from outside tab
  useEffect(() => {
    if (initialEnrollingEmployeeId) {
      const emp = employees.find((e) => e.id === initialEnrollingEmployeeId);
      if (emp) {
        setEnrollingEmployee(emp);
        if (onClearInitialEnrollingId) onClearInitialEnrollingId();
      }
    }
  }, [initialEnrollingEmployeeId, employees, onClearInitialEnrollingId]);

  // Open Edit Modal
  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setNik(emp.nik);
    setName(emp.name);
    setEmail(emp.email || '');
    setDepartment(emp.department || 'Teknologi Informasi');
    setRole(emp.role || '');
    setSystemRole(emp.systemRole || (emp.role?.toLowerCase().includes('manager') ? 'Manager' : 'Karyawan'));
    setPhone(emp.phone || '');
    setIsActive(emp.isActive ?? true);
  };

  // Reset Form
  const resetForm = () => {
    setNik('');
    setName('');
    setEmail('');
    setDepartment('Teknologi Informasi');
    setRole('');
    setSystemRole('Karyawan');
    setPhone('');
    setIsActive(true);
    setEditingEmployee(null);
  };

  // Camera stream for enrollment modal
  useEffect(() => {
    let stream: MediaStream | null = null;
    let isCancelled = false;
    let animId: number;

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 480, height: 480, facingMode: 'user' },
        });
        if (!isCancelled && videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn('Webcam enrollment error:', err);
      }
    }

    if (enrollingEmployee) {
      setCapturedPhoto(null);
      startCamera();

      // Detection tick
      const checkFace = async () => {
        if (videoRef.current && canvasRef.current) {
          const det = await detectFaceInVideo(videoRef.current, canvasRef.current);
          if (!isCancelled) {
            setFaceDetectedInCamera(Boolean(det));
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
  }, [enrollingEmployee]);

  // Handle add new employee form
  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nik.trim() || !name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingEmployee) {
        // Edit existing
        await saveEmployee({
          id: editingEmployee.id,
          nik: nik.trim(),
          name: name.trim(),
          email: email.trim(),
          department,
          role: role.trim() || 'Karyawan',
          systemRole,
          phone: phone.trim(),
          isActive,
          hasFaceRegistered: editingEmployee.hasFaceRegistered,
          photoUrl: editingEmployee.photoUrl,
        });
        setEditingEmployee(null);
      } else {
        // Create new
        await saveEmployee({
          nik: nik.trim(),
          name: name.trim(),
          email: email.trim(),
          department,
          role: role.trim() || 'Karyawan',
          systemRole,
          phone: phone.trim(),
          isActive: true,
          hasFaceRegistered: false,
        });
        setIsAddModalOpen(false);
      }

      soundPlayer.playChime('success');
      resetForm();
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menyimpan data karyawan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle take snapshot for enrollment
  const handleCaptureSnapshot = () => {
    if (videoRef.current) {
      const snap = captureSnapshot(videoRef.current, `FACE ENROLLMENT • ${enrollingEmployee?.nik}`);
      if (snap) {
        setCapturedPhoto(snap);
      }
    }
  };

  // Save Face Registration to Firestore
  const handleSaveFaceEnrollment = async () => {
    if (!enrollingEmployee || !capturedPhoto) return;

    setIsCapturingFace(true);
    try {
      await saveEmployee({
        id: enrollingEmployee.id,
        nik: enrollingEmployee.nik,
        name: enrollingEmployee.name,
        department: enrollingEmployee.department,
        systemRole: enrollingEmployee.systemRole,
        hasFaceRegistered: true,
        photoUrl: capturedPhoto,
      });

      soundPlayer.playChime('success');
      setEnrollingEmployee(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsCapturingFace(false);
    }
  };

  // Delete employee (Manager only)
  const handleDelete = async (id: string, empName: string) => {
    if (!isManager) {
      alert('Hanya role Manager yang memiliki izin menghapus data karyawan.');
      return;
    }
    if (confirm(`Yakin ingin menghapus data karyawan ${empName}? Tindakan ini tidak dapat dibatalkan.`)) {
      try {
        await deleteEmployee(id);
        soundPlayer.playChime('checkout');
      } catch (err) {
        console.error(err);
        alert('Gagal menghapus data karyawan.');
      }
    }
  };

  // Filtered employees
  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.nik.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.role.toLowerCase().includes(searchQuery.toLowerCase());

    const empRole: UserRole =
      e.systemRole || (e.role?.toLowerCase().includes('manager') ? 'Manager' : 'Karyawan');

    const matchesRole = filterRole === 'all' || empRole === filterRole;

    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              Kelola Karyawan & Hak Akses Role
              {isManager ? (
                <span className="text-[11px] bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Akses Manager (Edit & Hapus Aktif)
                </span>
              ) : (
                <span className="text-[11px] bg-teal-500/20 text-teal-300 font-medium px-2 py-0.5 rounded-full border border-teal-500/30 flex items-center gap-1">
                  <User className="w-3.5 h-3.5" /> Akses Karyawan (Read-Only)
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Role Manager dapat mengelola, mengedit, dan menghapus data karyawan. Role Karyawan hanya dapat input absensi & melihat hasil.
            </p>
          </div>
        </div>

        {isManager && (
          <button
            onClick={() => {
              resetForm();
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Tambah Karyawan Baru</span>
          </button>
        )}
      </div>

      {/* Role Restriction Banner for Non-Managers */}
      {!isManager && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-amber-300 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Akses Khusus Manager:</p>
            <p className="text-slate-300">
              Anda saat ini masuk sebagai <strong className="text-white">{user?.displayName} (Role: Karyawan)</strong>.
              Sesuai aturan hak akses, role Karyawan hanya dapat melakukan <em>input absensi</em> di Kios Presensi dan melihat hasil rekapitulasi. Fitur penambahan, edit, dan hapus karyawan hanya dapat dilakukan oleh role <strong>Manager</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari karyawan berdasarkan nama, NIK, jabatan, atau divisi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Role Filter */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as 'all' | 'Manager' | 'Karyawan')}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="all">Semua Role</option>
            <option value="Manager">👑 Role Manager</option>
            <option value="Karyawan">👤 Role Karyawan</option>
          </select>

          <div className="text-xs text-slate-400 font-mono whitespace-nowrap">
            Total: <strong className="text-white">{filteredEmployees.length}</strong> Karyawan
          </div>
        </div>
      </div>

      {/* Employee Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredEmployees.map((emp) => {
          const empRole: UserRole =
            emp.systemRole || (emp.role?.toLowerCase().includes('manager') ? 'Manager' : 'Karyawan');

          return (
            <div
              key={emp.id}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between hover:border-slate-700 transition relative"
            >
              <div>
                {/* Header with Avatar & Actions */}
                <div className="flex items-start space-x-3.5 mb-3.5">
                  <div className="relative">
                    <img
                      src={
                        emp.photoUrl ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
                      }
                      alt={emp.name}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-slate-700 shadow-md"
                    />
                    {emp.hasFaceRegistered && (
                      <span
                        className="absolute -bottom-1 -right-1 p-1 bg-emerald-500 text-slate-950 rounded-full shadow"
                        title="Wajah Terdaftar"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-sm font-bold text-white truncate">{emp.name}</h3>
                      {/* Action buttons (Manager Only) */}
                      {isManager ? (
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="text-slate-400 hover:text-emerald-400 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                            title="Edit Data Karyawan"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id, emp.name)}
                            className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                            title="Hapus Karyawan"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span title="Akses edit/hapus hanya untuk role Manager">
                          <Lock className="w-3.5 h-3.5 text-slate-600" />
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 font-mono">{emp.nik}</p>
                    <p className="text-xs text-slate-300 font-medium mt-0.5 truncate">
                      {emp.role}
                    </p>
                  </div>
                </div>

                {/* Role Badge Tag */}
                <div className="mb-3">
                  {empRole === 'Manager' ? (
                    <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-300 text-[11px] font-bold px-2.5 py-0.5 rounded-md border border-amber-500/30">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      Role: Manager (Akses Penuh)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-teal-500/10 text-teal-300 text-[11px] font-medium px-2.5 py-0.5 rounded-md border border-teal-500/30">
                      <User className="w-3.5 h-3.5 text-teal-400" />
                      Role: Karyawan (Input & Lihat Hasil)
                    </span>
                  )}
                </div>

                {/* Details Card */}
                <div className="space-y-1.5 text-xs text-slate-400 bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 mb-4">
                  <div className="flex items-center justify-between">
                    <span>Divisi:</span>
                    <span className="text-slate-200 font-medium">{emp.department}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Email:</span>
                    <span className="text-slate-300 truncate max-w-[150px]">{emp.email || '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Status Wajah:</span>
                    {emp.hasFaceRegistered ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Terdaftar
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> Belum Didaftarkan
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Button: Face Registration */}
              {isManager ? (
                <button
                  onClick={() => setEnrollingEmployee(emp)}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    emp.hasFaceRegistered
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  <span>{emp.hasFaceRegistered ? 'Perbarui Wajah Biometrik' : 'Daftarkan Foto Wajah'}</span>
                </button>
              ) : (
                <div className="w-full py-2 px-3 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-[11px] text-slate-500">
                  {emp.hasFaceRegistered ? 'Wajah Biometrik Terverifikasi' : 'Foto Wajah Belum Didaftarkan'}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Tambah Karyawan Baru / Edit Data Karyawan */}
      {(isAddModalOpen || editingEmployee) && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingEmployee(null);
              }}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              {editingEmployee ? (
                <>
                  <Edit2 className="w-5 h-5 text-emerald-400" />
                  Edit Data Karyawan & Hak Akses
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 text-emerald-400" />
                  Tambah Karyawan Baru
                </>
              )}
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Atur informasi identitas dan tentukan role sistem (Manager atau Karyawan).
            </p>

            <form onSubmit={handleSaveSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Nomor Induk Karyawan (NIK) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: EMP-2026-006"
                    value={nik}
                    onChange={(e) => setNik(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Role Sistem (Hak Akses) *
                  </label>
                  <select
                    value={systemRole}
                    onChange={(e) => setSystemRole(e.target.value as UserRole)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 font-bold cursor-pointer text-amber-300"
                  >
                    <option value="Manager">👑 Manager (Akses Penuh, Edit, Hapus)</option>
                    <option value="Karyawan">👤 Karyawan (Input Absen & Lihat Hasil Saja)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Nama Lengkap Karyawan *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nama lengkap"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Departemen</label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="Teknologi Informasi">Teknologi Informasi</option>
                    <option value="Human Resources (HRD)">Human Resources (HRD)</option>
                    <option value="Keuangan & Finansial">Keuangan & Finansial</option>
                    <option value="Pemasaran & Digital">Pemasaran & Digital</option>
                    <option value="Operasional">Operasional</option>
                    <option value="Pengadaan & Logistik">Pengadaan & Logistik</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Jabatan Pekerjaan</label>
                  <input
                    type="text"
                    placeholder="Contoh: Staff Developer / HR Staff"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Alamat Email</label>
                <input
                  type="email"
                  placeholder="email@perusahaan.co.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">No. Handphone</label>
                <input
                  type="text"
                  placeholder="0812-xxxx-xxxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {editingEmployee && (
                <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                  <span className="text-slate-300 font-semibold">Status Karyawan Aktif</span>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 cursor-pointer"
                  />
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingEmployee(null);
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl shadow cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Menyimpan...'
                    : editingEmployee
                    ? 'Perbarui Data Karyawan'
                    : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Face Registration Camera Modal */}
      {enrollingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setEnrollingEmployee(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              Perekaman Biometrik Wajah
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Karyawan:{' '}
              <strong className="text-slate-200">{enrollingEmployee.name}</strong> (
              {enrollingEmployee.nik})
            </p>

            {/* Camera Viewfinder */}
            <div className="relative aspect-square w-full bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 mb-4 flex items-center justify-center">
              {!capturedPhoto ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Face Guide Oval */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-60 border-2 border-emerald-400/50 rounded-full border-dashed flex flex-col items-center justify-center">
                      <span className="text-[11px] bg-slate-950/70 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                        Posisikan Wajah
                      </span>
                    </div>
                  </div>

                  <div className="absolute bottom-3 inset-x-3 bg-slate-950/80 backdrop-blur-md rounded-xl p-2.5 text-center text-xs">
                    <span className="text-emerald-400 font-semibold flex items-center justify-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {faceDetectedInCamera
                        ? 'Wajah siap ditangkap!'
                        : 'Menunggu posisi wajah...'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="relative w-full h-full">
                  <img
                    src={capturedPhoto}
                    alt="Captured Face"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-3 inset-x-3 bg-emerald-500 text-slate-950 font-bold rounded-xl p-2 text-center text-xs flex items-center justify-center gap-1.5 shadow-lg">
                    <CheckCircle2 className="w-4 h-4" />
                    Foto Wajah Berhasil Diambil
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between gap-3">
              {!capturedPhoto ? (
                <button
                  type="button"
                  onClick={handleCaptureSnapshot}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  <span>Ambil Foto Referensi</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setCapturedPhoto(null)}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Foto Ulang</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveFaceEnrollment}
                    disabled={isCapturingFace}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCapturingFace ? 'Menyimpan...' : 'Simpan ke Profil Karyawan'}
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
