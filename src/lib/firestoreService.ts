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

/**
 * Initialize office settings document if not already configured
 */
export async function seedInitialDataIfNeeded(): Promise<void> {
  try {
    // Only seed office geofence settings document if it doesn't exist
    const officeDoc = await getDoc(doc(db, 'settings', 'office'));
    if (!officeDoc.exists()) {
      await setDoc(doc(db, 'settings', 'office'), DEFAULT_OFFICE_SETTING);
    }
  } catch (err) {
    console.warn('Office setting check:', err);
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
