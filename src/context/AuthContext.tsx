import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { Employee, UserRole } from '../types';

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: UserRole; // 'Manager' | 'Karyawan'
  nik?: string;
  department?: string;
}

interface AuthContextType {
  user: AppUser | null;
  isManager: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmployee: (employee: Employee) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('presensi_auth_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        const isManager =
          fbUser.email?.includes('admin') ||
          fbUser.email?.includes('manager') ||
          fbUser.email === 'obymkent@gmail.com' ||
          fbUser.email?.endsWith('@perusahaan.co.id');

        const appUser: AppUser = {
          uid: fbUser.uid,
          displayName: fbUser.displayName || fbUser.email?.split('@')[0] || 'Pengguna',
          email: fbUser.email || '',
          photoURL:
            fbUser.photoURL ||
            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
          role: isManager ? 'Manager' : 'Karyawan',
        };
        setUser(appUser);
        localStorage.setItem('presensi_auth_user', JSON.stringify(appUser));
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      const isManager =
        fbUser.email?.includes('admin') ||
        fbUser.email?.includes('manager') ||
        fbUser.email === 'obymkent@gmail.com' ||
        fbUser.email?.endsWith('@perusahaan.co.id');

      const appUser: AppUser = {
        uid: fbUser.uid,
        displayName: fbUser.displayName || 'Pengguna',
        email: fbUser.email || '',
        photoURL: fbUser.photoURL || undefined,
        role: isManager ? 'Manager' : 'Karyawan',
      };
      setUser(appUser);
      localStorage.setItem('presensi_auth_user', JSON.stringify(appUser));
    } catch (err: any) {
      console.warn('Google sign-in popup error/closed:', err);
      throw err;
    }
  };

  const loginWithEmployee = (employee: Employee) => {
    const role: UserRole =
      employee.systemRole ||
      (employee.role?.toLowerCase().includes('manager') || employee.department?.includes('HR')
        ? 'Manager'
        : 'Karyawan');

    const appUser: AppUser = {
      uid: employee.id,
      displayName: employee.name,
      email: employee.email,
      photoURL: employee.photoUrl,
      role,
      nik: employee.nik,
      department: employee.department,
    };
    setUser(appUser);
    localStorage.setItem('presensi_auth_user', JSON.stringify(appUser));
  };

  const logout = async () => {
    try {
      await fbSignOut(auth);
    } catch {
      // ignore
    }
    setUser(null);
    localStorage.removeItem('presensi_auth_user');
  };

  const isManager = user?.role === 'Manager';

  return (
    <AuthContext.Provider
      value={{
        user,
        isManager,
        loading,
        loginWithGoogle,
        loginWithEmployee,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
