/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { Header } from './components/Header';
import { AttendanceKiosk } from './components/AttendanceKiosk';
import { DashboardRecap } from './components/DashboardRecap';
import { EmployeeManagement } from './components/EmployeeManagement';
import { SettingsView } from './components/SettingsView';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import {
  Employee,
  AttendanceRecord,
  OfficeSetting,
  NotificationSetting,
  PushNotificationLog,
} from './types';
import {
  seedInitialDataIfNeeded,
  subscribeEmployees,
  subscribeAttendances,
  subscribeOfficeSettings,
  DEFAULT_OFFICE_SETTING,
  DEFAULT_NOTIFICATION_SETTING,
} from './lib/firestoreService';
import { checkScheduledReminders } from './lib/notifications';

function MainApp() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'kiosk' | 'recap' | 'employees' | 'settings'>('kiosk');

  // Firestore Synced States (Real live data only)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [officeSetting, setOfficeSetting] = useState<OfficeSetting>(DEFAULT_OFFICE_SETTING);
  const [notificationSetting, setNotificationSetting] = useState<NotificationSetting>(() => {
    const saved = localStorage.getItem('presensi_notification_setting');
    return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATION_SETTING;
  });

  // Notifications
  const [notificationLogs, setNotificationLogs] = useState<PushNotificationLog[]>([]);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState<boolean>(false);

  // Cross-tab navigation trigger for face enrollment
  const [initialEnrollingId, setInitialEnrollingId] = useState<string | null>(null);

  // Track scheduled reminders fired state
  const lastFiredRef = useRef<{ checkInDate?: string; checkOutDate?: string }>({});

  // 1. Initial Firestore Seeding & Real-time Subscriptions
  useEffect(() => {
    seedInitialDataIfNeeded().catch(console.error);

    const unsubEmp = subscribeEmployees((list) => {
      setEmployees(list);
    });

    const unsubAtt = subscribeAttendances((list) => {
      setAttendances(list);
    });

    const unsubOffice = subscribeOfficeSettings((setting) => {
      setOfficeSetting(setting);
    });

    return () => {
      unsubEmp();
      unsubAtt();
      unsubOffice();
    };
  }, []);

  // 2. Listen for push notification events
  useEffect(() => {
    const handlePushEvent = (e: Event) => {
      const customEvent = e as CustomEvent<PushNotificationLog>;
      if (customEvent.detail) {
        setNotificationLogs((prev) => [customEvent.detail, ...prev]);
      }
    };

    window.addEventListener('app-push-notification', handlePushEvent);
    return () => {
      window.removeEventListener('app-push-notification', handlePushEvent);
    };
  }, []);

  // 3. Background timer for scheduled reminders (runs every 30s)
  useEffect(() => {
    const timer = setInterval(() => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const res = checkScheduledReminders(notificationSetting, lastFiredRef.current);
      if (res.firedCheckIn) {
        lastFiredRef.current.checkInDate = todayStr;
      }
      if (res.firedCheckOut) {
        lastFiredRef.current.checkOutDate = todayStr;
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [notificationSetting]);

  // Handle update notification setting
  const handleUpdateNotificationSetting = (newSetting: NotificationSetting) => {
    setNotificationSetting(newSetting);
    localStorage.setItem('presensi_notification_setting', JSON.stringify(newSetting));
  };

  // Switch to employee tab to enroll face
  const handleNavigateToRegisterFace = (employeeId: string) => {
    setInitialEnrollingId(employeeId);
    setActiveTab('employees');
  };

  // Show LoginPage if user is not authenticated
  if (!user) {
    return <LoginPage employees={employees} />;
  }

  return (
    <div className="min-h-screen bg-[#00112C] text-slate-100 flex flex-col font-sans selection:bg-[#B4E0E8] selection:text-[#011E4D]">
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        notificationLogs={notificationLogs}
        onOpenNotifications={() => setIsNotifModalOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'kiosk' && (
          <AttendanceKiosk
            employees={employees}
            attendances={attendances}
            officeSetting={officeSetting}
            onNavigateToRegisterFace={handleNavigateToRegisterFace}
          />
        )}

        {activeTab === 'recap' && (
          <DashboardRecap
            attendances={attendances}
            officeSetting={officeSetting}
          />
        )}

        {activeTab === 'employees' && (
          <EmployeeManagement
            employees={employees}
            initialEnrollingEmployeeId={initialEnrollingId}
            onClearInitialEnrollingId={() => setInitialEnrollingId(null)}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            officeSetting={officeSetting}
            notificationSetting={notificationSetting}
            onUpdateNotificationSetting={handleUpdateNotificationSetting}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#093478] bg-[#011E4D]/90 py-6 text-center text-xs text-slate-300">
        <p>
          Absensi Karyawan GPS & Face Recognition • Terintegrasi Firebase Firestore Enterprise
        </p>
      </footer>

      {/* Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
        logs={notificationLogs}
        onClearLogs={() => setNotificationLogs([])}
        onMarkAllAsRead={() =>
          setNotificationLogs((prev) => prev.map((l) => ({ ...l, isRead: true })))
        }
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
