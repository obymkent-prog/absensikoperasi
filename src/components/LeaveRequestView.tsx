import { useState, useMemo } from 'react';
import {
  CalendarDays,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  FileText,
  Paperclip,
  Trash2,
  Check,
  X,
  AlertCircle,
  Eye,
  User,
  Calendar,
} from 'lucide-react';
import { LeaveRequest, LeaveType, LeaveStatus, Employee } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  createLeaveRequest,
  updateLeaveRequestStatus,
  deleteLeaveRequest,
} from '../lib/firestoreService';

interface LeaveRequestViewProps {
  leaveRequests: LeaveRequest[];
  employees: Employee[];
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, { label: string; color: string; desc: string }> = {
  cuti_tahunan: {
    label: 'Cuti Tahunan',
    color: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    desc: 'Cuti reguler hak tahunan karyawan',
  },
  izin_sakit: {
    label: 'Izin Sakit',
    color: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    desc: 'Izin tidak masuk karena kondisi medis/kesehatan',
  },
  izin_keperluan_pribadi: {
    label: 'Keperluan Pribadi',
    color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    desc: 'Izin urusan keluarga atau keperluan mendesak',
  },
  cuti_melahirkan: {
    label: 'Cuti Melahirkan',
    color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    desc: 'Cuti melahirkan atau mendampingi persalinan',
  },
  izin_dinas_luar: {
    label: 'Izin Dinas Luar',
    color: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    desc: 'Tugas kerja atau dinas di luar lokasi kantor',
  },
  izin_lainnya: {
    label: 'Izin Lainnya',
    color: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    desc: 'Kategori izin atau dispensasi khusus lainnya',
  },
};

export function LeaveRequestView({ leaveRequests, employees }: LeaveRequestViewProps) {
  const { user } = useAuth();
  const isManager = user?.role === 'Manager';

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

  // Check if a request belongs to the current user
  const isMyRequest = (req: LeaveRequest) => {
    if (currentEmployee) {
      if (req.employeeId && currentEmployee.id && req.employeeId === currentEmployee.id) return true;
      if (req.employeeNik && currentEmployee.nik && req.employeeNik === currentEmployee.nik) return true;
      if (req.employeeName && currentEmployee.name && req.employeeName.toLowerCase() === currentEmployee.name.toLowerCase()) return true;
    }
    if (user?.uid && req.employeeId === user.uid) return true;
    if (user?.nik && req.employeeNik === user.nik) return true;
    if (user?.displayName && req.employeeName.toLowerCase() === user.displayName.toLowerCase()) return true;
    return false;
  };

  // Scoped requests: Manager sees all; Karyawan only sees own
  const scopedRequests = useMemo(() => {
    return isManager ? leaveRequests : leaveRequests.filter(isMyRequest);
  }, [isManager, leaveRequests, currentEmployee, user]);

  // Filters & State
  const [statusFilter, setStatusFilter] = useState<'all' | LeaveStatus>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [previewAttachmentUrl, setPreviewAttachmentUrl] = useState<string | null>(null);

  // Review Modal State
  const [reviewModalData, setReviewModalData] = useState<{
    request: LeaveRequest;
    action: 'approved' | 'rejected';
    notes: string;
  } | null>(null);
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // Form State
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(() => {
    const matching = employees.find(
      (e) => e.email?.toLowerCase() === user?.email?.toLowerCase() || (user?.nik && e.nik === user.nik)
    );
    return matching?.id || employees[0]?.id || '';
  });
  const [selectedType, setSelectedType] = useState<LeaveType>('cuti_tahunan');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [reason, setReason] = useState<string>('');
  const [attachmentBase64, setAttachmentBase64] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Calculate duration
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    if (diffTime < 0) return 0;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  }, [startDate, endDate]);

  // Statistics
  const stats = useMemo(() => {
    const total = scopedRequests.length;
    const pending = scopedRequests.filter((r) => r.status === 'pending').length;
    const approved = scopedRequests.filter((r) => r.status === 'approved').length;
    const rejected = scopedRequests.filter((r) => r.status === 'rejected').length;
    return { total, pending, approved, rejected };
  }, [scopedRequests]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return scopedRequests.filter((req) => {
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      if (typeFilter !== 'all' && req.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = req.employeeName.toLowerCase().includes(query);
        const matchNik = req.employeeNik?.toLowerCase().includes(query);
        const matchReason = req.reason.toLowerCase().includes(query);
        const matchDept = req.department.toLowerCase().includes(query);
        if (!matchName && !matchNik && !matchReason && !matchDept) return false;
      }
      return true;
    });
  }, [scopedRequests, statusFilter, typeFilter, searchQuery]);

  // Handle File Upload for Attachment
  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFormError('Ukuran file maksimal 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachmentBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Leave Request
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const emp = isManager
      ? employees.find((e) => e.id === selectedEmpId) || currentEmployee
      : currentEmployee;
    if (!emp) {
      setFormError('Data profil karyawan tidak ditemukan. Pastikan akun terdaftar di sistem.');
      return;
    }

    if (!startDate || !endDate) {
      setFormError('Tanggal mulai dan selesai harus diisi.');
      return;
    }

    if (calculatedDays <= 0) {
      setFormError('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
      return;
    }

    if (!reason.trim()) {
      setFormError('Harap cantumkan alasan atau keterangan permohonan.');
      return;
    }

    setIsSaving(true);
    try {
      await createLeaveRequest({
        employeeId: emp.id,
        employeeNik: emp.nik,
        employeeName: emp.name,
        department: emp.department,
        type: selectedType,
        startDate,
        endDate,
        totalDays: calculatedDays,
        reason: reason.trim(),
        attachmentUrl: attachmentBase64 || undefined,
        status: 'pending',
      });

      // Reset form
      setReason('');
      setAttachmentBase64('');
      setIsSubmitModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan pengajuan.');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm Review Action (Manager only)
  const handleConfirmReview = async () => {
    if (!reviewModalData) return;
    setIsSubmittingReview(true);
    try {
      await updateLeaveRequestStatus(
        reviewModalData.request.id,
        reviewModalData.action,
        user?.displayName || 'Manager',
        reviewModalData.notes.trim() || undefined
      );
      setReviewModalData(null);
    } catch (err) {
      console.error('Gagal memproses persetujuan:', err);
    } finally {
      setIsSubmittingReview(false);
    }
  };

  // Delete / Cancel Request
  const handleDeleteRequest = async (id: string) => {
    try {
      await deleteLeaveRequest(id);
    } catch (err) {
      console.error('Gagal menghapus permohonan:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-[#011E4D]/90 border border-[#093478] rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 rounded-2xl bg-[#00112C] text-[#B4E0E8] border border-[#093478] shadow-inner">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
              Pengajuan Izin & Cuti Karyawan
            </h1>
            <p className="text-xs text-slate-300">
              Formulir izin tidak masuk, cuti tahunan, sakit, dinas luar, serta persetujuan resmi manajemen
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setFormError(null);
            setIsSubmitModalOpen(true);
          }}
          className="flex items-center space-x-2 px-5 py-3 rounded-xl bg-[#B4E0E8] hover:bg-white text-[#011E4D] font-bold text-sm shadow-lg shadow-[#B4E0E8]/20 transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Ajukan Izin / Cuti Baru</span>
        </button>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-[#011E4D]/80 border border-[#093478] rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-slate-300 text-xs font-semibold mb-2">
            <span>Total Pengajuan</span>
            <FileText className="w-4 h-4 text-[#B4E0E8]" />
          </div>
          <div className="text-2xl font-black text-white">{stats.total}</div>
          <p className="text-[11px] text-slate-400 mt-1">Seluruh riwayat izin terdata</p>
        </div>

        {/* Pending */}
        <div className="bg-[#011E4D]/80 border border-amber-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-amber-300 text-xs font-semibold mb-2">
            <span>Menunggu Review</span>
            <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="text-2xl font-black text-amber-300">{stats.pending}</div>
          <p className="text-[11px] text-amber-200/70 mt-1">Perlu tindakan Manager</p>
        </div>

        {/* Approved */}
        <div className="bg-[#011E4D]/80 border border-emerald-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold mb-2">
            <span>Disetujui</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{stats.approved}</div>
          <p className="text-[11px] text-emerald-200/70 mt-1">Izin resmi disahkan</p>
        </div>

        {/* Rejected */}
        <div className="bg-[#011E4D]/80 border border-rose-500/30 rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between text-rose-300 text-xs font-semibold mb-2">
            <span>Ditolak</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-400">{stats.rejected}</div>
          <p className="text-[11px] text-rose-200/70 mt-1">Pengajuan tidak disetujui</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#011E4D]/90 border border-[#093478] rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Status Filter Badges */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto scrollbar-none pb-1 md:pb-0">
          {(
            [
              { key: 'all', label: 'Semua Status' },
              { key: 'pending', label: 'Menunggu' },
              { key: 'approved', label: 'Disetujui' },
              { key: 'rejected', label: 'Ditolak' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              onClick={() => setStatusFilter(item.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                statusFilter === item.key
                  ? 'bg-[#B4E0E8] text-[#011E4D] shadow-sm'
                  : 'bg-[#00112C] text-slate-300 hover:bg-[#B4E0E8]/20 hover:text-white border border-[#093478]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Search & Type Filters */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {/* Type Dropdown */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-[#00112C] border border-[#093478] rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-[#B4E0E8] cursor-pointer"
            >
              <option value="all">Semua Jenis Izin</option>
              {Object.entries(LEAVE_TYPE_LABELS).map(([key, val]) => (
                <option key={key} value={key}>
                  {val.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama karyawan / alasan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#00112C] border border-[#093478] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#B4E0E8]"
            />
          </div>
        </div>
      </div>

      {/* Requests List Card */}
      <div className="bg-[#011E4D]/90 border border-[#093478] rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#B4E0E8]" />
            Daftar Pengajuan ({filteredRequests.length})
          </h2>
          {isManager && (
            <span className="text-xs bg-[#00112C] text-amber-300 px-2.5 py-1 rounded-lg border border-amber-500/30">
              Mode Manager: Anda dapat menyetujui / menolak pengajuan
            </span>
          )}
        </div>

        {filteredRequests.length === 0 ? (
          <div className="text-center py-16 text-slate-400 space-y-3">
            <CalendarDays className="w-12 h-12 mx-auto text-slate-600" />
            <p className="text-sm font-medium">Belum ada pengajuan izin atau cuti yang sesuai.</p>
            <button
              onClick={() => setIsSubmitModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#00112C] hover:bg-[#B4E0E8] hover:text-[#011E4D] text-slate-200 text-xs font-bold rounded-xl border border-[#093478] transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Buat Pengajuan Pertama
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRequests.map((req) => {
              const typeConfig = LEAVE_TYPE_LABELS[req.type] || LEAVE_TYPE_LABELS.izin_lainnya;
              const isOwner =
                req.employeeId === selectedEmpId ||
                req.employeeName.toLowerCase() === user?.displayName?.toLowerCase();

              return (
                <div
                  key={req.id}
                  className="bg-[#00112C]/90 border border-[#093478] hover:border-[#B4E0E8]/50 rounded-2xl p-5 transition-all shadow-md flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                >
                  {/* Left Info: Employee & Type */}
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-bold text-sm text-white">{req.employeeName}</span>
                      <span className="text-xs text-slate-400 font-mono">({req.employeeNik})</span>
                      <span className="text-[11px] bg-[#011E4D] text-slate-300 px-2 py-0.5 rounded-md border border-[#093478]">
                        {req.department}
                      </span>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${typeConfig.color}`}
                      >
                        {typeConfig.label}
                      </span>
                    </div>

                    {/* Date Duration */}
                    <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-[#B4E0E8]" />
                      <span>
                        {new Date(req.startDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        -{' '}
                        {new Date(req.endDate).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      <span className="bg-[#011E4D] text-[#B4E0E8] font-bold px-2 py-0.5 rounded text-[11px] border border-[#093478]">
                        {req.totalDays} Hari
                      </span>
                    </div>

                    {/* Reason */}
                    <p className="text-xs text-slate-200 bg-[#011E4D]/60 p-2.5 rounded-xl border border-[#093478]/60 leading-relaxed">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider mb-0.5">
                        Alasan / Keterangan:
                      </span>
                      {req.reason}
                    </p>

                    {/* Review Notes from Manager if available */}
                    {req.reviewNotes && (
                      <div className="text-xs p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 flex items-start gap-1.5">
                        <span className="text-[#B4E0E8] font-bold">Catatan {req.reviewedBy || 'Manager'}:</span>
                        <span>{req.reviewNotes}</span>
                      </div>
                    )}
                  </div>

                  {/* Right: Status & Actions */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end justify-between gap-3 w-full lg:w-auto shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-[#093478]/50">
                    {/* Status Badge */}
                    <div>
                      {req.status === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <Clock className="w-3.5 h-3.5 animate-pulse" />
                          Menunggu Persetujuan
                        </span>
                      )}
                      {req.status === 'approved' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Disetujui
                        </span>
                      )}
                      {req.status === 'rejected' && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          <XCircle className="w-3.5 h-3.5" />
                          Ditolak
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Attachment Preview button */}
                      {req.attachmentUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewAttachmentUrl(req.attachmentUrl!)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#011E4D] hover:bg-[#B4E0E8] text-slate-300 hover:text-[#011E4D] text-xs font-semibold border border-[#093478] flex items-center gap-1 transition cursor-pointer"
                          title="Lihat Bukti Surat/Foto"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span>Lampiran</span>
                        </button>
                      )}

                      {/* Manager Review Actions (If status is pending) */}
                      {isManager && req.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setReviewModalData({
                                request: req,
                                action: 'approved',
                                notes: 'Disetujui',
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition shadow cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Setujui</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setReviewModalData({
                                request: req,
                                action: 'rejected',
                                notes: '',
                              })
                            }
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 transition shadow cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        </>
                      )}

                      {/* Cancel / Delete (Manager or Owner if pending) */}
                      {(isManager || (isOwner && req.status === 'pending')) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(req.id)}
                          className="p-1.5 rounded-lg bg-[#011E4D] hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-[#093478] transition cursor-pointer"
                          title="Hapus / Batalkan Pengajuan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: AJUKAN IZIN / CUTI BARU */}
      {isSubmitModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#00112C]/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#011E4D] border border-[#093478] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-[#093478]">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-[#00112C] text-[#B4E0E8] border border-[#093478]">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Form Pengajuan Izin / Cuti</h3>
                  <p className="text-xs text-slate-300">Isi data permohonan dengan akurat</p>
                </div>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="p-2 rounded-xl bg-[#00112C] hover:bg-[#B4E0E8] text-slate-400 hover:text-[#011E4D] border border-[#093478] transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="mt-6 space-y-4">
              {/* Employee Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Karyawan Pemohon:
                </label>
                {isManager ? (
                  <select
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#B4E0E8] cursor-pointer"
                  >
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.nik}) - {emp.department}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full bg-[#00112C]/80 border border-[#093478] rounded-xl px-3 py-2.5 text-xs text-slate-200 flex items-center justify-between">
                    <span className="font-semibold text-white">
                      {currentEmployee?.name || user?.displayName}
                    </span>
                    <span className="text-[11px] text-[#B4E0E8] font-mono">
                      NIK: {currentEmployee?.nik || user?.nik || '-'} • {currentEmployee?.department || user?.department || 'Karyawan'}
                    </span>
                  </div>
                )}
              </div>

              {/* Leave Type */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Jenis Izin / Cuti:
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as LeaveType)}
                  className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#B4E0E8] cursor-pointer"
                >
                  {Object.entries(LEAVE_TYPE_LABELS).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.label} - ({val.desc})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Pickers (Start & End) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Tanggal Mulai:
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#B4E0E8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                    Tanggal Selesai:
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#00112C] border border-[#093478] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#B4E0E8]"
                  />
                </div>
              </div>

              {/* Total Days Indicator */}
              <div className="p-3 bg-[#00112C] border border-[#093478] rounded-xl flex items-center justify-between text-xs">
                <span className="text-slate-300">Estimasi Durasi Izin:</span>
                <span className="font-bold text-[#B4E0E8] font-mono text-sm">
                  {calculatedDays > 0 ? `${calculatedDays} Hari Kerja` : 'Tanggal tidak valid'}
                </span>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Alasan / Keterangan Lengkap: <span className="text-rose-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Jelaskan alasan izin cuti atau tidak masuk kantor..."
                  className="w-full bg-[#00112C] border border-[#093478] rounded-xl p-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#B4E0E8] resize-none"
                ></textarea>
              </div>

              {/* Attachment File (Surat Dokter / Undangan / Bukti) */}
              <div>
                <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                  Lampiran / Bukti Surat (Opsional):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleAttachmentChange}
                    className="text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#00112C] file:text-[#B4E0E8] file:border file:border-[#093478] hover:file:bg-[#B4E0E8] hover:file:text-[#011E4D] cursor-pointer"
                  />
                  {attachmentBase64 && (
                    <button
                      type="button"
                      onClick={() => setAttachmentBase64('')}
                      className="text-xs text-rose-400 hover:text-rose-300 underline"
                    >
                      Hapus
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Mendukung foto surat dokter, surat tugas, atau dokumen pendukung (Maks. 2MB).
                </p>
              </div>

              {/* Error Message */}
              {formError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#093478]">
                <button
                  type="button"
                  onClick={() => setIsSubmitModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-[#00112C] hover:bg-[#B4E0E8] text-slate-300 hover:text-[#011E4D] text-xs font-bold border border-[#093478] transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-[#B4E0E8] hover:bg-white text-[#011E4D] text-xs font-bold shadow-lg transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Menyimpan...' : 'Kirim Pengajuan Izin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REVIEW MANAGER (SETUJUI / TOLAK) */}
      {reviewModalData && (
        <div className="fixed inset-0 z-50 bg-[#00112C]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#011E4D] border border-[#093478] rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#093478]">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {reviewModalData.action === 'approved' ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    <span>Setujui Permohonan Izin</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-5 h-5 text-rose-400" />
                    <span>Tolak Permohonan Izin</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setReviewModalData(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-2 bg-[#00112C] p-3 rounded-xl border border-[#093478]">
              <p>
                <strong>Karyawan:</strong> {reviewModalData.request.employeeName} (
                {reviewModalData.request.employeeNik})
              </p>
              <p>
                <strong>Jenis:</strong> {LEAVE_TYPE_LABELS[reviewModalData.request.type]?.label} (
                {reviewModalData.request.totalDays} Hari)
              </p>
              <p>
                <strong>Alasan:</strong> {reviewModalData.request.reason}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-200 mb-1.5">
                Catatan / Keterangan Persetujuan (Opsional):
              </label>
              <textarea
                rows={3}
                value={reviewModalData.notes}
                onChange={(e) =>
                  setReviewModalData({ ...reviewModalData, notes: e.target.value })
                }
                placeholder={
                  reviewModalData.action === 'approved'
                    ? 'Misal: Disetujui, selamat beristirahat.'
                    : 'Misal: Mohon maaf, jadwal pekerjaan sedang padat.'
                }
                className="w-full bg-[#00112C] border border-[#093478] rounded-xl p-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#B4E0E8] resize-none"
              ></textarea>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReviewModalData(null)}
                className="px-4 py-2 rounded-xl bg-[#00112C] hover:bg-[#B4E0E8] text-slate-300 hover:text-[#011E4D] text-xs font-bold border border-[#093478] transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmittingReview}
                onClick={handleConfirmReview}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-lg transition cursor-pointer disabled:opacity-50 ${
                  reviewModalData.action === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {isSubmittingReview
                  ? 'Memproses...'
                  : reviewModalData.action === 'approved'
                  ? 'Konfirmasi Setujui'
                  : 'Konfirmasi Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PREVIEW LAMPIRAN */}
      {previewAttachmentUrl && (
        <div className="fixed inset-0 z-50 bg-[#00112C]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#011E4D] border border-[#093478] rounded-3xl p-5 max-w-2xl w-full shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#093478]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-[#B4E0E8]" />
                Bukti Lampiran Izin / Surat
              </h3>
              <button
                onClick={() => setPreviewAttachmentUrl(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-auto flex items-center justify-center rounded-xl bg-[#00112C] p-2 border border-[#093478]">
              {previewAttachmentUrl.startsWith('data:image') ||
              previewAttachmentUrl.includes('unsplash') ||
              previewAttachmentUrl.includes('http') ? (
                <img
                  src={previewAttachmentUrl}
                  alt="Lampiran Surat Izin"
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                />
              ) : (
                <iframe
                  src={previewAttachmentUrl}
                  title="Dokumen Lampiran"
                  className="w-full h-96 rounded-lg"
                />
              )}
            </div>

            <div className="text-right">
              <button
                onClick={() => setPreviewAttachmentUrl(null)}
                className="px-4 py-2 rounded-xl bg-[#B4E0E8] text-[#011E4D] font-bold text-xs hover:bg-white transition cursor-pointer"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
