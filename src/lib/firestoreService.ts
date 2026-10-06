import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { AttendanceRecord, Employee, OfficeSetting, NotificationSetting } from '../types';

// Default Office Coordinates (Jakarta CBD / Monas Area)
export const DEFAULT_OFFICE_SETTING: OfficeSetting = {
  id: 'office_main',
  name: 'Headquarters PT Sinergi Nusantara',
  address: 'Jl. Jenderal Sudirman No. 45, Karet Sudirman, Jakarta Pusat',
  latitude: -6.21462,
  longitude: 106.82143,
  radiusMeters: 150, // 150 meters radius
  workStartTime: '08:00',
  workEndTime: '17:00',
  lateToleranceMinutes: 15,
  updatedAt: new Date().toISOString(),
};

export const DEFAULT_NOTIFICATION_SETTING: NotificationSetting = {
  id: 'notification_main',
  enabled: true,
  checkInReminderTime: '07:45',
  checkOutReminderTime: '17:00',
  soundEnabled: true,
  desktopPushEnabled: true,
  updatedAt: new Date().toISOString(),
};

export const INITIAL_EMPLOYEES: Omit<Employee, 'id'>[] = [
  {
    nik: 'EMP-2026-001',
    name: 'Budi Santoso',
    email: 'budi.santoso@perusahaan.co.id',
    department: 'Teknologi Informasi',
    role: 'Lead Fullstack Developer',
    systemRole: 'Karyawan',
    phone: '0812-3456-7890',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
    hasFaceRegistered: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    nik: 'EMP-2026-002',
    name: 'Siti Rahmawati',
    email: 'siti.rahma@perusahaan.co.id',
    department: 'Human Resources (HRD)',
    role: 'HR Manager',
    systemRole: 'Manager',
    phone: '0813-9876-5432',
    photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80',
    hasFaceRegistered: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    nik: 'EMP-2026-003',
    name: 'Ahmad Fauzi',
    email: 'ahmad.fauzi@perusahaan.co.id',
    department: 'Keuangan & Finansial',
    role: 'Senior Finance Analyst',
    systemRole: 'Karyawan',
    phone: '0857-1122-3344',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
    hasFaceRegistered: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    nik: 'EMP-2026-004',
    name: 'Dewi Lestari',
    email: 'dewi.lestari@perusahaan.co.id',
    department: 'Pemasaran & Digital',
    role: 'Growth Marketing Specialist',
    systemRole: 'Karyawan',
    phone: '0819-5566-7788',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&auto=format&fit=crop&q=80',
    hasFaceRegistered: true,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    nik: 'EMP-2026-005',
    name: 'Rian Pratama',
    email: 'rian.pratama@perusahaan.co.id',
    department: 'Operasional',
    role: 'Operations Supervisor',
    systemRole: 'Karyawan',
    phone: '0812-9988-7766',
    photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
    hasFaceRegistered: false,
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

/**
 * Initialize / Seed default data if collections are empty
 */
export async function seedInitialDataIfNeeded(): Promise<void> {
  try {
    const empSnap = await getDocs(collection(db, 'employees'));
    if (empSnap.empty) {
      for (let i = 0; i < INITIAL_EMPLOYEES.length; i++) {
        const emp = INITIAL_EMPLOYEES[i];
        const empId = `emp-${i + 1}`;
        await setDoc(doc(db, 'employees', empId), emp);
      }
    }

    // Seed office settings
    const officeDoc = await getDoc(doc(db, 'settings', 'office'));
    if (!officeDoc.exists()) {
      await setDoc(doc(db, 'settings', 'office'), DEFAULT_OFFICE_SETTING);
    }

    // Seed sample attendances for demonstration
    const attSnap = await getDocs(collection(db, 'attendances'));
    if (attSnap.empty) {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      const sampleRecords: Omit<AttendanceRecord, 'id'>[] = [
        {
          employeeId: 'emp-1',
          employeeNik: 'EMP-2026-001',
          employeeName: 'Budi Santoso',
          department: 'Teknologi Informasi',
          date: today,
          checkInTime: '07:54:12',
          type: 'wfo',
          status: 'tepat_waktu',
          locationLat: -6.21461,
          locationLng: 106.82141,
          distanceToOfficeMeters: 8,
          isWithinGeofence: true,
          verificationConfidence: 98,
          photoSnapshot: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
          notes: 'Absensi masuk di lobi lantai 1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          employeeId: 'emp-2',
          employeeNik: 'EMP-2026-002',
          employeeName: 'Siti Rahmawati',
          department: 'Human Resources (HRD)',
          date: today,
          checkInTime: '08:08:45',
          type: 'wfo',
          status: 'tepat_waktu',
          locationLat: -6.21465,
          locationLng: 106.82148,
          distanceToOfficeMeters: 14,
          isWithinGeofence: true,
          verificationConfidence: 97,
          photoSnapshot: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
          notes: 'Masuk kantor normal',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          employeeId: 'emp-3',
          employeeNik: 'EMP-2026-003',
          employeeName: 'Ahmad Fauzi',
          department: 'Keuangan & Finansial',
          date: yesterday,
          checkInTime: '08:24:10',
          checkOutTime: '17:30:15',
          type: 'wfo',
          status: 'terlambat',
          locationLat: -6.21470,
          locationLng: 106.82155,
          distanceToOfficeMeters: 25,
          isWithinGeofence: true,
          verificationConfidence: 96,
          photoSnapshot: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
          notes: 'Macet di tol dalam kota',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          employeeId: 'emp-4',
          employeeNik: 'EMP-2026-004',
          employeeName: 'Dewi Lestari',
          department: 'Pemasaran & Digital',
          date: today,
          checkInTime: '08:00:00',
          type: 'wfh',
          status: 'tepat_waktu',
          locationLat: -6.2201,
          locationLng: 106.8402,
          distanceToOfficeMeters: 2200,
          isWithinGeofence: false,
          verificationConfidence: 99,
          photoSnapshot: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
          notes: 'Work from home - jadwal rotasi tim',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];

      for (let j = 0; j < sampleRecords.length; j++) {
        await setDoc(doc(db, 'attendances', `att-sample-${j + 1}`), sampleRecords[j]);
      }
    }
  } catch (err) {
    console.warn('Initial seeding bypassed or encountered error:', err);
  }
}

/**
 * Subscribe to all employees
 */
export function subscribeEmployees(callback: (employees: Employee[]) => void): () => void {
  const q = collection(db, 'employees');
  return onSnapshot(
    q,
    (snapshot) => {
      const list: Employee[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Employee);
      });
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'employees');
    }
  );
}

/**
 * Add or update employee
 */
export async function saveEmployee(employee: Partial<Employee> & { nik: string; name: string }): Promise<string> {
  const id = employee.id || `emp-${Date.now()}`;
  const path = `employees/${id}`;
  try {
    const payload = {
      nik: employee.nik,
      name: employee.name,
      email: employee.email || '',
      department: employee.department || 'Umum',
      role: employee.role || 'Karyawan',
      systemRole: employee.systemRole || (employee.role?.toLowerCase().includes('manager') ? 'Manager' : 'Karyawan'),
      phone: employee.phone || '',
      photoUrl: employee.photoUrl || '',
      hasFaceRegistered: Boolean(employee.hasFaceRegistered),
      isActive: employee.isActive ?? true,
      createdAt: employee.createdAt || new Date().toISOString(),
    };
    await setDoc(doc(db, 'employees', id), payload, { merge: true });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Delete employee
 */
export async function deleteEmployee(id: string): Promise<void> {
  const path = `employees/${id}`;
  try {
    await deleteDoc(doc(db, 'employees', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Subscribe to all attendances
 */
export function subscribeAttendances(callback: (records: AttendanceRecord[]) => void): () => void {
  const q = query(collection(db, 'attendances'), orderBy('createdAt', 'desc'), limit(500));
  return onSnapshot(
    q,
    (snapshot) => {
      const list: AttendanceRecord[] = [];
      snapshot.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as AttendanceRecord);
      });
      callback(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendances');
    }
  );
}

/**
 * Record Check-In
 */
export async function recordCheckIn(
  record: Omit<AttendanceRecord, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const path = `attendances/${id}`;
  try {
    const payload = {
      ...record,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'attendances', id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Record Check-Out
 */
export async function recordCheckOut(
  attendanceId: string,
  checkOutTime: string,
  notes?: string
): Promise<void> {
  const path = `attendances/${attendanceId}`;
  try {
    const updateData: Record<string, any> = {
      checkOutTime,
      updatedAt: new Date().toISOString(),
    };
    if (notes) {
      updateData.notes = notes;
    }
    await updateDoc(doc(db, 'attendances', attendanceId), updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Get / Subscribe Office Settings
 */
export function subscribeOfficeSettings(callback: (setting: OfficeSetting) => void): () => void {
  return onSnapshot(
    doc(db, 'settings', 'office'),
    (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() } as OfficeSetting);
      } else {
        callback(DEFAULT_OFFICE_SETTING);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/office');
    }
  );
}

/**
 * Update Office Settings
 */
export async function updateOfficeSettings(setting: Partial<OfficeSetting>): Promise<void> {
  const path = 'settings/office';
  try {
    const payload = {
      ...DEFAULT_OFFICE_SETTING,
      ...setting,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'settings', 'office'), payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
