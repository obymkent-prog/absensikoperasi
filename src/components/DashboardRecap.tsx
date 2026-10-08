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
} from 'lucide-react';
import { AttendanceRecord, OfficeSetting, Employee } from '../types';
import { exportAttendancesToExcel } from '../lib/excelExport';
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
              </tr>
            </thead>
            <tbody className="divide-y divide-[#093478] text-slate-300">
              {filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
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
    </div>
  );
}
