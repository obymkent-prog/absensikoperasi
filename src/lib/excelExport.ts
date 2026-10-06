import * as XLSX from 'xlsx';
import { AttendanceRecord } from '../types';

export function exportAttendancesToExcel(
  records: AttendanceRecord[],
  periodLabel: string = 'Semua Periode',
  officeName: string = 'Kantor Pusat'
) {
  // 1. Prepare Overview Stats
  const total = records.length;
  const tepatWaktu = records.filter((r) => r.status === 'tepat_waktu').length;
  const terlambat = records.filter((r) => r.status === 'terlambat').length;
  const wfoCount = records.filter((r) => r.type === 'wfo').length;
  const wfhCount = records.filter((r) => r.type === 'wfh').length;
  const dinasCount = records.filter((r) => r.type === 'dinas').length;

  // 2. Build rows for Sheet
  const rows: (string | number | undefined)[][] = [];

  // Header Title
  rows.push(['REKAPITULASI PRESENSI KARYAWAN BERBASIS GPS & FACE RECOGNITION']);
  rows.push([`Lokasi Kantor: ${officeName}`]);
  rows.push([`Periode: ${periodLabel}`]);
  rows.push([`Tanggal Unduh: ${new Date().toLocaleString('id-ID')}`]);
  rows.push([]);

  // KPI Summary Block
  rows.push(['RINGKASAN KEHADIRAN']);
  rows.push(['Total Absensi', 'Tepat Waktu', 'Terlambat', 'WFO', 'WFH', 'Dinas Luar']);
  rows.push([total, tepatWaktu, terlambat, wfoCount, wfhCount, dinasCount]);
  rows.push([]);

  // Table Columns
  rows.push([
    'No',
    'Tanggal',
    'NIK',
    'Nama Karyawan',
    'Departemen',
    'Jam Masuk',
    'Jam Keluar',
    'Tipe Kehadiran',
    'Status Presensi',
    'Jarak GPS (Meter)',
    'Radius Geofence',
    'Verifikasi Wajah (%)',
    'Catatan / Aktivitas',
  ]);

  // Data Rows
  records.forEach((record, index) => {
    const tipeLabel =
      record.type === 'wfo'
        ? 'WFO (Kantor)'
        : record.type === 'wfh'
        ? 'WFH (Rumah)'
        : 'Dinas Luar';

    const statusLabel =
      record.status === 'tepat_waktu'
        ? 'Tepat Waktu'
        : record.status === 'terlambat'
        ? 'Terlambat'
        : record.status === 'lembur'
        ? 'Lembur'
        : 'Pulang Cepat';

    rows.push([
      index + 1,
      record.date,
      record.employeeNik,
      record.employeeName,
      record.department,
      record.checkInTime || '-',
      record.checkOutTime || '-',
      tipeLabel,
      statusLabel,
      record.distanceToOfficeMeters !== undefined ? `${record.distanceToOfficeMeters} m` : '-',
      record.isWithinGeofence ? 'VALID (Dalam Radius)' : 'DILUAR RADIUS',
      `${record.verificationConfidence || 95}%`,
      record.notes || '-',
    ]);
  });

  // Create Worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Column Widths
  ws['!cols'] = [
    { wch: 6 },  // No
    { wch: 14 }, // Tanggal
    { wch: 14 }, // NIK
    { wch: 24 }, // Nama
    { wch: 18 }, // Departemen
    { wch: 12 }, // Jam Masuk
    { wch: 12 }, // Jam Keluar
    { wch: 16 }, // Tipe
    { wch: 16 }, // Status
    { wch: 18 }, // Jarak GPS
    { wch: 22 }, // Radius Geofence
    { wch: 20 }, // Verifikasi Wajah
    { wch: 30 }, // Catatan
  ];

  // Create Workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap Presensi');

  // Trigger download
  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Rekap_Presensi_Karyawan_${dateStr}.xlsx`);
}
