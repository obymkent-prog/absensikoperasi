import { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Search,
  CheckCircle,
  Clock,
  MapPin,
  Camera,
  Calendar,
  Building,
  ExternalLink,
  ChevronDown,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
  Loader2,
  Check,
} from 'lucide-react';
import { AttendanceRecord, OfficeSetting, Employee, AttendanceStatus, WorkType } from '../types';
import { exportAttendancesToExcel } from '../lib/excelExport';
import { updateAttendanceRecord, deleteAttendanceRecord } from '../lib/firestoreService';
import { useAuth } from '../context/AuthContext';

interface DashboardRecapProps {
  attendances: AttendanceRecord[];
  officeSetting: OfficeSetting;
  employees?: Employee[];
}

export function DashboardRecap({ attendances, officeSetting, employees = [] }: DashboardRecapProps) {
  const { user, isManager } = useAuth();
  const isKaryawan = user?.role === 'Karyawan';

  // Find corresponding employee record for current user
  const currentEmployee = useMemo(() => {
    if (!employees || employees.length === 0) return null;
    return (
      employees.find(
        (e) =>
          (user?.email && e.email && e.email.toLowerCase() === user.email.toLowerCase()) ||
          (user?.nik && e.nik === user.nik) ||
          e.id === user?.uid ||
          (user?.displayName && e.name.toLowerCase() === user.displayName.toLowerCase())
      ) || employees[0]
    );
  }, [employees, user]);

  // Check if a record belongs to the current user
  const isMyRecord = (record: AttendanceRecord) => {
    if (currentEmployee) {
      if (record.employeeId && currentEmployee.id && record.employeeId === currentEmployee.id) return true;
      if (record.employeeNik && currentEmployee.nik && record.employeeNik === currentEmployee.nik) return true;
      if (record.employeeName && currentEmployee.name && record.employeeName.toLowerCase() === currentEmployee.name.toLowerCase()) return true;
    }
    if (user?.uid && record.employeeId === user.uid) return true;
    if (user?.nik && record.employeeNik === user.nik) return true;
    if (user?.displayName && record.employeeName.toLowerCase() === user.displayName.toLowerCase()) return true;
    return false;
  };

  // Filter States
  const [periodFilter, setPeriodFilter] = useState<'all' | 'today' | '7days' | 'month'>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [onlyMyAttendance, setOnlyMyAttendance] = useState<boolean>(!isManager);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Photo Zoom Modal
  const [selectedPhoto, setSelectedPhoto] = useState<{
    url: string;
    name: string;
    time: string;
  } | null>(null);

  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Manager Edit State
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editCheckInTime, setEditCheckInTime] = useState<string>('');
  const [editCheckOutTime, setEditCheckOutTime] = useState<string>('');
  const [editType, setEditType] = useState<WorkType>('wfo');
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('tepat_waktu');
  const [editIsWithinGeofence, setEditIsWithinGeofence] = useState<boolean>(true);
  const [editDistance, setEditDistance] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Manager Delete State
  const [deletingRecord, setDeletingRecord] = useState<AttendanceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Toast / notification feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleOpenEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    setEditDate(record.date || '');
    setEditCheckInTime(record.checkInTime || '');
    setEditCheckOutTime(record.checkOutTime || '');
    setEditType(record.type || 'wfo');
    setEditStatus(record.status || 'tepat_waktu');
    setEditIsWithinGeofence(record.isWithinGeofence ?? true);
    setEditDistance(record.distanceToOfficeMeters ?? 0);
    setEditNotes(record.notes || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    if (!editDate || !editCheckInTime) {
      setEditError('Tanggal dan Jam Masuk wajib diisi.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const updatePayload: Partial<AttendanceRecord> = {
        date: editDate,
        checkInTime: editCheckInTime.trim(),
        type: editType,
        status: editStatus,
        isWithinGeofence: editIsWithinGeofence,
        distanceToOfficeMeters: Number(editDistance) || 0,
        notes: editNotes.trim(),
      };

      if (editCheckOutTime.trim()) {
        updatePayload.checkOutTime = editCheckOutTime.trim();
      }

      await updateAttendanceRecord(editingRecord.id, updatePayload);
      setToastMessage({
        text: `Data presensi ${editingRecord.employeeName} (${editDate}) berhasil diperbarui!`,
        type: 'success',
      });
      setEditingRecord(null);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setEditError(err?.message || 'Gagal menyimpan perubahan presensi.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleOpenDelete = (record: AttendanceRecord) => {
    setDeletingRecord(record);
    setDeleteError(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteAttendanceRecord(deletingRecord.id);
      setToastMessage({
        text: `Data presensi ${deletingRecord.employeeName} (${deletingRecord.date}) berhasil dihapus!`,
        type: 'success',
      });
      setDeletingRecord(null);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      setDeleteError(err?.message || 'Gagal menghapus data presensi.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Departments list for filter
  const departments = useMemo(() => {
    const set = new Set<string>();
    attendances.forEach((a) => {
      if (a.department) set.add(a.department);
    });
    return Array.from(set);
  }, [attendances]);

  // Filtered Records (Strictly personal for Karyawan role)
  const filteredAttendances = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    return attendances.filter((record) => {
      // 1. Role Karyawan: STRICTLY only display their own attendance
      if (isKaryawan) {
        if (!isMyRecord(record)) return false;
      } else if (onlyMyAttendance) {
        // Manager optionally filtered to own attendance
        if (!isMyRecord(record)) return false;
      }

      // Period filter
      if (periodFilter === 'today' && record.date !== todayStr) return false;
      if (periodFilter === '7days' && record.date < sevenDaysAgo) return false;
      if (periodFilter === 'month' && record.date < thirtyDaysAgo) return false;

      // Department filter (only for Manager viewing all employees)
      if (!isKaryawan && departmentFilter !== 'all' && record.department !== departmentFilter) return false;

      // Status filter
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;

      // Type filter
      if (typeFilter !== 'all' && record.type !== typeFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = record.employeeName.toLowerCase().includes(query);
        const matchesNik = record.employeeNik.toLowerCase().includes(query);
        const matchesNotes = record.notes?.toLowerCase().includes(query);
        if (!matchesName && !matchesNik && !matchesNotes) return false;
      }

      return true;
    });
  }, [
    attendances,
    isKaryawan,
    currentEmployee,
    user,
    onlyMyAttendance,
    periodFilter,
    departmentFilter,
    statusFilter,
    typeFilter,
    searchQuery,
  ]);

  // KPI Calculations
  const stats = useMemo(() => {
    const total = filteredAttendances.length;
    const tepatWaktu = filteredAttendances.filter((a) => a.status === 'tepat_waktu').length;
    const terlambat = filteredAttendances.filter((a) => a.status === 'terlambat').length;
    const wfoCount = filteredAttendances.filter((a) => a.type === 'wfo').length;
    const wfhCount = filteredAttendances.filter((a) => a.type === 'wfh').length;
    const avgConfidence =
      total > 0
        ? Math.round(
            filteredAttendances.reduce((acc, curr) => acc + (curr.verificationConfidence || 95), 0) /
              total
          )
        : 0;

    return {
      total,
      tepatWaktu,
      terlambat,
      wfoCount,
      wfhCount,
      avgConfidence,
    };
  }, [filteredAttendances]);

  // Export to Excel Handler
  const handleExport = () => {
    setIsExporting(true);
    try {
      const periodLabel =
        periodFilter === 'today'
          ? 'Hari Ini'
          : periodFilter === '7days'
          ? '7 Hari Terakhir'
          : periodFilter === 'month'
          ? '30 Hari Terakhir'
          : 'Semua Periode';

      const subjectName = isKaryawan
        ? `${currentEmployee?.name || user?.displayName || 'Karyawan'} (Pribadi)`
        : officeSetting.name;

      exportAttendancesToExcel(filteredAttendances, periodLabel, subjectName);
    } finally {
      setTimeout(() => setIsExporting(false), 600);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Action */}
      <div className="bg-[#011E4D]/90 border border-[#093478] rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#00112C] text-[#B4E0E8] border border-[#093478]">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white tracking-tight">
                  {isKaryawan ? 'Rekapitulasi Kehadiran Pribadi' : 'Rekapitulasi Kehadiran & Laporan Absensi'}
                </h2>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    isKaryawan
                      ? 'bg-[#B4E0E8]/20 text-[#B4E0E8] border-[#B4E0E8]/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {isKaryawan ? 'Role Karyawan • Data Mandiri' : 'Role Manager • Semua Karyawan'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {isKaryawan ? (
                  <>
                    Menampilkan rekapitulasi data absensi diri sendiri untuk{' '}
                    <span className="text-[#B4E0E8] font-bold">
                      {currentEmployee?.name || user?.displayName}
                    </span>{' '}
                    {currentEmployee?.nik ? `(NIK: ${currentEmployee.nik})` : ''}
                  </>
                ) : (
                  'Sinkronisasi data kehadiran harian seluruh karyawan real-time via Firebase Firestore'
                )}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting || filteredAttendances.length === 0}
          className="px-5 py-3 rounded-2xl bg-[#B4E0E8] hover:bg-white text-[#011E4D] font-bold text-sm shadow-lg shadow-[#B4E0E8]/20 transition flex items-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          <span>
            {isExporting
              ? 'Membuat File Excel...'
              : isKaryawan
              ? 'Ekspor Absensi Saya (.xlsx)'
              : 'Ekspor ke Excel (.xlsx)'}
          </span>
        </button>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-[#011E4D]/90 border border-[#093478] rounded-2xl p-4 shadow-md">
          <span className="text-xs font-semibold text-slate-400 block mb-1">Total Absensi</span>
          <div className="text-2xl font-black text-white font-mono">{stats.total}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Catatan terpilih</span>
        </div>

        <div className="bg-[#011E4D]/90 border border-[#093478] rounded-2xl p-4 shadow-md">
          <span className="text-xs font-semibold text-[#B4E0E8] block mb-1">Tepat Waktu</span>
          <div className="text-2xl font-black text-[#B4E0E8] font-mono">{stats.tepatWaktu}</div>
          <span className="text-[11px] text-[#B4E0E8]/70 mt-1 block">
            {stats.total > 0 ? `${Math.round((stats.tepatWaktu / stats.total) * 100)}%` : '0%'} rasio
          </span>
        </div>

        <div className="bg-[#011E4D]/90 border border-[#093478] rounded-2xl p-4 shadow-md">
          <span className="text-xs font-semibold text-rose-400 block mb-1">Terlambat</span>
          <div className="text-2xl font-black text-rose-400 font-mono">{stats.terlambat}</div>
          <span className="text-[11px] text-rose-400/70 mt-1 block">
            {stats.total > 0 ? `${Math.round((stats.terlambat / stats.total) * 100)}%` : '0%'} rasio
          </span>
        </div>

        <div className="bg-[#011E4D]/90 border border-[#093478] rounded-2xl p-4 shadow-md">
          <span className="text-xs font-semibold text-[#B4E0E8] block mb-1">WFO (Kantor)</span>
          <div className="text-2xl font-black text-[#B4E0E8] font-mono">{stats.wfoCount}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Lokasi Geofence</span>
        </div>

        <div className="bg-[#011E4D]/90 border border-[#093478] rounded-2xl p-4 shadow-md">
          <span className="text-xs font-semibold text-sky-400 block mb-1">WFH (Remote)</span>
          <div className="text-2xl font-black text-sky-300 font-mono">{stats.wfhCount}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Kerja dari Rumah</span>
        </div>

        <div className="bg-[#011E4D]/90 border border-[#093478] rounded-2xl p-4 shadow-md">
          <span className="text-xs font-semibold text-amber-400 block mb-1">Akurasi Wajah</span>
          <div className="text-2xl font-black text-amber-300 font-mono">
            {stats.avgConfidence > 0 ? `${stats.avgConfidence}%` : '-'}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Rata-rata biometrik</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#011E4D]/90 border border-[#093478] rounded-2xl p-4 shadow-lg space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Cari nama, NIK, atau catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#00112C] border border-[#093478] rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#B4E0E8]"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Periode */}
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as 'all' | 'today' | '7days' | 'month')}
              className="bg-[#00112C] border border-[#093478] rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-[#B4E0E8] cursor-pointer"
            >
              <option value="all">Semua Periode</option>
              <option value="today">Hari Ini</option>
              <option value="7days">7 Hari Terakhir</option>
              <option value="month">30 Hari Terakhir</option>
            </select>

            {/* Departemen (Hanya untuk Manager) */}
            {!isKaryawan && (
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="bg-[#00112C] border border-[#093478] rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-[#B4E0E8] cursor-pointer"
              >
                <option value="all">Semua Departemen</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            )}

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#00112C] border border-[#093478] rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-[#B4E0E8] cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="tepat_waktu">Tepat Waktu</option>
              <option value="terlambat">Terlambat</option>
            </select>

            {/* Tipe Kerja */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#00112C] border border-[#093478] rounded-xl px-3 py-2 text-xs text-slate-200 font-medium focus:outline-none focus:border-[#B4E0E8] cursor-pointer"
            >
              <option value="all">Semua Tipe Kerja</option>
              <option value="wfo">WFO (Kantor)</option>
              <option value="wfh">WFH (Rumah)</option>
              <option value="dinas">Dinas Luar</option>
            </select>

            {/* Role indicator / Filter personal */}
            {isKaryawan ? (
              <div className="px-3 py-2 rounded-xl text-xs font-bold bg-[#B4E0E8] text-[#011E4D] shadow-sm flex items-center gap-1.5 whitespace-nowrap">
                <span>👤 Absensi Diri Sendiri</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOnlyMyAttendance(!onlyMyAttendance)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  onlyMyAttendance
                    ? 'bg-[#B4E0E8] text-[#011E4D] shadow-sm'
                    : 'bg-[#00112C] text-slate-300 hover:bg-[#B4E0E8] hover:text-[#011E4D] border border-[#093478] hover:border-[#B4E0E8]'
                }`}
              >
                <span>{onlyMyAttendance ? '👤 Presensi Saya Saja' : '👥 Semua Karyawan'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-[#011E4D]/90 border border-[#093478] rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#00112C]/90 text-slate-300 font-semibold border-b border-[#093478] uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Foto Verifikasi</th>
                <th className="py-3.5 px-4">Karyawan</th>
                <th className="py-3.5 px-4">Tanggal</th>
                <th className="py-3.5 px-4">Masuk / Keluar</th>
                <th className="py-3.5 px-4">Tipe & Status</th>
                <th className="py-3.5 px-4">Jarak & Geofence GPS</th>
                <th className="py-3.5 px-4">Verifikasi Wajah</th>
                <th className="py-3.5 px-4">Catatan</th>
                {isManager && <th className="py-3.5 px-4 text-center">Aksi (Manager)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#093478] text-slate-300">
              {filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan={isManager ? 9 : 8} className="py-12 text-center text-slate-400">
                    {isKaryawan
                      ? 'Belum ada catatan presensi untuk akun Anda pada periode ini. Silakan catat presensi di tab Kios Presensi (Absen).'
                      : 'Tidak ada catatan presensi yang sesuai dengan filter.'}
                  </td>
                </tr>
              ) : (
                filteredAttendances.map((rec) => (
                  <tr key={rec.id} className="hover:bg-[#022864]/50 transition">
                    {/* Selfie Snapshot */}
                    <td className="py-3 px-4">
                      {rec.photoSnapshot ? (
                        <button
                          onClick={() =>
                            setSelectedPhoto({
                              url: rec.photoSnapshot,
                              name: rec.employeeName,
                              time: `${rec.date} ${rec.checkInTime}`,
                            })
                          }
                          className="relative group cursor-pointer"
                        >
                          <img
                            src={rec.photoSnapshot}
                            alt={rec.employeeName}
                            className="w-10 h-10 rounded-xl object-cover border border-[#093478] group-hover:border-[#B4E0E8] transition"
                          />
                          <span className="absolute inset-0 bg-[#00112C]/60 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white">
                            Lihat
                          </span>
                        </button>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-[#00112C] border border-[#093478] flex items-center justify-center text-slate-500">
                          <Camera className="w-4 h-4" />
                        </div>
                      )}
                    </td>

                    {/* Employee Info */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{rec.employeeName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{rec.employeeNik}</div>
                      <div className="text-[11px] text-[#B4E0E8]">{rec.department}</div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 font-mono text-slate-300 whitespace-nowrap">
                      {rec.date}
                    </td>

                    {/* In / Out times */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono">
                      <div className="text-[#B4E0E8] font-semibold">
                        Masuk: {rec.checkInTime}
                      </div>
                      <div className="text-slate-400 text-[11px]">
                        Pulang: {rec.checkOutTime || '-'}
                      </div>
                    </td>

                    {/* Work Type & Attendance Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            rec.type === 'wfo'
                              ? 'bg-[#022864] text-[#B4E0E8] border border-[#B4E0E8]/30'
                              : rec.type === 'wfh'
                              ? 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
                              : 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                          }`}
                        >
                          {rec.type.toUpperCase()}
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            rec.status === 'tepat_waktu'
                              ? 'bg-[#022864] text-[#B4E0E8] border border-[#B4E0E8]/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {rec.status === 'tepat_waktu' ? 'Tepat Waktu' : 'Terlambat'}
                        </span>
                      </div>
                    </td>

                    {/* GPS Distance & Geofence Status */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-mono text-slate-200">
                        {rec.distanceToOfficeMeters !== undefined
                          ? `${rec.distanceToOfficeMeters} meter`
                          : '-'}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            rec.isWithinGeofence ? 'bg-[#B4E0E8]' : 'bg-rose-400'
                          }`}
                        ></span>
                        <span className="text-[11px] text-slate-400">
                          {rec.isWithinGeofence ? 'Valid (Dalam Geofence)' : 'Luar Radius'}
                        </span>
                        {rec.locationLat && (
                          <a
                            href={`https://www.google.com/maps?q=${rec.locationLat},${rec.locationLng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#B4E0E8] hover:text-white"
                            title="Buka di Google Maps"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Face Verification Score */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-mono text-[#B4E0E8] font-bold bg-[#022864] px-2 py-1 rounded-lg border border-[#B4E0E8]/30">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {rec.verificationConfidence || 95}% Cocok
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                      {rec.notes || '-'}
                    </td>

                    {/* Manager Action Buttons (Edit & Hapus) */}
                    {isManager && (
                      <td className="py-3 px-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(rec)}
                            className="px-2.5 py-1.5 rounded-xl bg-[#00112C] hover:bg-[#B4E0E8] text-[#B4E0E8] hover:text-[#011E4D] border border-[#093478] hover:border-[#B4E0E8] transition text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-sm"
                            title="Edit presensi karyawan ini"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(rec)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/30 transition text-xs font-semibold inline-flex items-center gap-1 cursor-pointer shadow-sm"
                            title="Hapus presensi karyawan ini"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Photo Zoom Modal */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 bg-[#00112C]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#011E4D] border border-[#093478] rounded-3xl p-5 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-1.5 rounded-xl bg-[#00112C] hover:bg-[#B4E0E8] text-slate-300 hover:text-[#011E4D] cursor-pointer transition border border-[#093478] hover:border-[#B4E0E8]"
            >
              <X className="w-5 h-5" />
            </button>

            <h4 className="text-base font-bold text-white mb-1">{selectedPhoto.name}</h4>
            <p className="text-xs text-slate-300 mb-4">{selectedPhoto.time}</p>

            <div className="rounded-2xl overflow-hidden border border-[#093478] aspect-4/3 bg-black flex items-center justify-center">
              <img
                src={selectedPhoto.url}
                alt={selectedPhoto.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="mt-4 pt-3 border-t border-[#093478] flex justify-end">
              <button
                onClick={() => setSelectedPhoto(null)}
                className="px-4 py-2 bg-[#00112C] hover:bg-[#B4E0E8] text-slate-200 hover:text-[#011E4D] text-xs font-semibold rounded-xl cursor-pointer border border-[#093478] hover:border-[#B4E0E8] transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Attendance Record Modal (Manager Only) */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 bg-[#00112C]/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[#011E4D] border border-[#093478] rounded-3xl p-6 max-w-xl w-full shadow-2xl relative my-8">
            <button
              onClick={() => {
                if (!isSavingEdit) setEditingRecord(null);
              }}
              className="absolute top-5 right-5 p-2 rounded-xl bg-[#00112C] hover:bg-[#B4E0E8] text-slate-300 hover:text-[#011E4D] cursor-pointer transition border border-[#093478] hover:border-[#B4E0E8]"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-[#00112C] text-[#B4E0E8] border border-[#093478]">
                <Pencil className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Edit Rekapitulasi Kehadiran</h3>
                <p className="text-xs text-slate-300">
                  Perbarui catatan presensi karyawan sebagai Manager
                </p>
              </div>
            </div>

            {/* Employee Card info */}
            <div className="p-3.5 rounded-2xl bg-[#00112C]/90 border border-[#093478] flex items-center gap-3.5 mb-5">
              {editingRecord.photoSnapshot ? (
                <img
                  src={editingRecord.photoSnapshot}
                  alt={editingRecord.employeeName}
                  className="w-12 h-12 rounded-xl object-cover border border-[#093478] shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#011E4D] border border-[#093478] flex items-center justify-center text-[#B4E0E8] font-bold text-sm shrink-0">
                  {editingRecord.employeeName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-white truncate">{editingRecord.employeeName}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-0.5">
                  <span className="font-mono text-slate-300">NIK: {editingRecord.employeeNik}</span>
                  <span>•</span>
                  <span className="text-[#B4E0E8]">{editingRecord.department}</span>
                </div>
              </div>
            </div>

            {/* Error Banner */}
            {editError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{editError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Tanggal */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Tanggal Presensi <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#B4E0E8]"
                  />
                </div>

                {/* Tipe Kehadiran */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Tipe Kehadiran
                  </label>
                  <select
                    value={editType}
                    onChange={(e) => setEditType(e.target.value as WorkType)}
                    className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#B4E0E8] cursor-pointer"
                  >
                    <option value="wfo">WFO (Work From Office)</option>
                    <option value="wfh">WFH (Work From Home)</option>
                    <option value="dinas">Dinas Luar Kantor</option>
                  </select>
                </div>

                {/* Jam Masuk */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Jam Masuk (Check-In) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 08:00:00"
                    value={editCheckInTime}
                    onChange={(e) => setEditCheckInTime(e.target.value)}
                    className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#B4E0E8]"
                  />
                </div>

                {/* Jam Pulang */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Jam Pulang (Check-Out)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: 17:00:00 (opsional)"
                    value={editCheckOutTime}
                    onChange={(e) => setEditCheckOutTime(e.target.value)}
                    className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#B4E0E8]"
                  />
                </div>

                {/* Status Kehadiran */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Status Kehadiran
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
                    className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#B4E0E8] cursor-pointer"
                  >
                    <option value="tepat_waktu">Tepat Waktu</option>
                    <option value="terlambat">Terlambat</option>
                    <option value="pulang_cepat">Pulang Cepat</option>
                    <option value="lembur">Lembur</option>
                  </select>
                </div>

                {/* Status Geofence GPS */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Status Geofence Lokasi
                  </label>
                  <select
                    value={editIsWithinGeofence ? 'true' : 'false'}
                    onChange={(e) => setEditIsWithinGeofence(e.target.value === 'true')}
                    className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#B4E0E8] cursor-pointer"
                  >
                    <option value="true">Valid (Dalam Radius Kantor)</option>
                    <option value="false">Luar Radius Kantor</option>
                  </select>
                </div>

                {/* Jarak ke Kantor */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Jarak ke Kantor (meter)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editDistance}
                    onChange={(e) => setEditDistance(Number(e.target.value))}
                    className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#B4E0E8]"
                  />
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Catatan / Keterangan
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan perubahan atau catatan khusus..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#B4E0E8] resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[#093478] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSavingEdit}
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#00112C] hover:bg-slate-800 text-slate-300 text-xs font-semibold transition border border-[#093478] cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2.5 rounded-xl bg-[#B4E0E8] hover:bg-white text-[#011E4D] text-xs font-bold transition shadow-md shadow-[#B4E0E8]/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal (Manager Only) */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 bg-[#00112C]/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#011E4D] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => {
                if (!isDeleting) setDeletingRecord(null);
              }}
              className="absolute top-5 right-5 p-2 rounded-xl bg-[#00112C] hover:bg-rose-500 text-slate-300 hover:text-white cursor-pointer transition border border-[#093478] hover:border-rose-500"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Hapus Rekapitulasi Kehadiran</h3>
                <p className="text-xs text-rose-300/80">Konfirmasi tindakan penghapusan data</p>
              </div>
            </div>

            {/* Detail Box */}
            <div className="p-4 rounded-2xl bg-[#00112C]/90 border border-[#093478] mb-4 space-y-2">
              <div className="text-xs text-slate-400">Data yang akan dihapus:</div>
              <div className="text-sm font-bold text-white">{deletingRecord.employeeName}</div>
              <div className="text-xs text-slate-300 flex flex-wrap gap-x-3 gap-y-1 font-mono">
                <span>NIK: {deletingRecord.employeeNik}</span>
                <span>•</span>
                <span>Tanggal: {deletingRecord.date}</span>
              </div>
              <div className="text-xs text-[#B4E0E8]">
                Masuk: {deletingRecord.checkInTime} {deletingRecord.checkOutTime ? `• Pulang: ${deletingRecord.checkOutTime}` : ''}
              </div>
            </div>

            {/* Warning Text */}
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 mb-5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Catatan kehadiran ini akan dihapus permanen dari Firestore database dan tidak dapat dipulihkan kembali.
              </span>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-xs text-rose-200">
                {deleteError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingRecord(null)}
                className="px-4 py-2.5 rounded-xl bg-[#00112C] hover:bg-slate-800 text-slate-300 text-xs font-semibold transition border border-[#093478] cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-lg shadow-rose-600/30 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Ya, Hapus Presensi</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 text-xs font-bold border animate-fade-in ${
              toastMessage.type === 'success'
                ? 'bg-[#011E4D] border-[#B4E0E8] text-[#B4E0E8]'
                : 'bg-rose-950 border-rose-500 text-rose-200'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-[#B4E0E8]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}
