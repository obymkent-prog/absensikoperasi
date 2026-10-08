export type UserRole = 'Manager' | 'Karyawan';

export interface Employee {
  id: string;
  nik: string;
  name: string;
  email: string;
  department: string;
  role: string; // Job title, e.g. "Lead Developer" or "HR Manager"
  systemRole: UserRole; // Access level: 'Manager' (Full access, edit, delete) | 'Karyawan' (Absen & lihat hasil)
  phone: string;
  photoUrl: string;
  hasFaceRegistered: boolean;
  faceFeatures?: number[];
  isActive: boolean;
  createdAt: string;
}

export type WorkType = 'wfo' | 'wfh' | 'dinas';
export type AttendanceStatus = 'tepat_waktu' | 'terlambat' | 'pulang_cepat' | 'lembur';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeNik: string;
  employeeName: string;
  department: string;
  date: string; // YYYY-MM-DD
  checkInTime: string; // HH:mm:ss
  checkOutTime?: string; // HH:mm:ss
  type: WorkType;
  status: AttendanceStatus;
  locationLat: number;
  locationLng: number;
  distanceToOfficeMeters: number;
  isWithinGeofence: boolean;
  verificationConfidence: number; // 0 - 100%
  photoSnapshot: string; // selfie image capture
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface OfficeSetting {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  workStartTime: string; // e.g. "08:00"
  workEndTime: string; // e.g. "17:00"
  lateToleranceMinutes: number; // e.g. 15
  updatedAt: string;
}

export interface NotificationSetting {
  id: string;
  enabled: boolean;
  checkInReminderTime: string; // e.g. "07:45"
  checkOutReminderTime: string; // e.g. "17:00"
  soundEnabled: boolean;
  desktopPushEnabled: boolean;
  updatedAt: string;
}

export interface PushNotificationLog {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  type: 'checkin' | 'checkout' | 'system';
  isRead: boolean;
}

export type LeaveType =
  | 'cuti_tahunan'
  | 'izin_sakit'
  | 'izin_keperluan_pribadi'
  | 'cuti_melahirkan'
  | 'izin_dinas_luar'
  | 'izin_lainnya';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeNik: string;
  employeeName: string;
  department: string;
  type: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  reason: string;
  attachmentUrl?: string; // photo or document URL/data URL
  status: LeaveStatus;
  reviewedBy?: string; // Name or role of approving manager
  reviewNotes?: string; // Reason or response
  createdAt: string;
  updatedAt: string;
}
