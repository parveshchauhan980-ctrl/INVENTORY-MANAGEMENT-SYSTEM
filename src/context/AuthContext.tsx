import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../api/client';
import { auth, googleProvider, testFirestoreConnection } from '../firebase/config';
import { signInWithPopup, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  isFirebaseConnected: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('nexus_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('nexus_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState<boolean>(false);

  useEffect(() => {
    testFirestoreConnection().then((connected) => {
      setIsFirebaseConnected(connected);
    });

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const res = await api.post<{ token: string; user: User }>('/api/auth/firebase-login', {
            email: fbUser.email,
            name: fbUser.displayName,
            phone: fbUser.phoneNumber
          });
          localStorage.setItem('nexus_token', res.token);
          localStorage.setItem('nexus_user', JSON.stringify(res.user));
          setToken(res.token);
          setUser(res.user);
          setIsLoading(false);
        } catch (syncErr) {
          console.warn('Firebase login sync fallback:', syncErr);
        }
      }
    });

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
      localStorage.removeItem('nexus_token');
      localStorage.removeItem('nexus_user');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      unsubscribe();
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const refreshUser = async () => {
    if (!token) {
      setUser(null);
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.get<{ user: User }>('/api/auth/me');
      setUser(res.user);
      localStorage.setItem('nexus_user', JSON.stringify(res.user));
    } catch (err: any) {
      if (err?.status === 401) {
        localStorage.removeItem('nexus_token');
        localStorage.removeItem('nexus_user');
        setUser(null);
        setToken(null);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api.post<{ message: string; token: string; user: User }>('/api/auth/login', {
      email,
      password
    });
    localStorage.setItem('nexus_token', res.token);
    localStorage.setItem('nexus_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const fbUser = result.user;
    const res = await api.post<{ token: string; user: User }>('/api/auth/firebase-login', {
      email: fbUser.email,
      name: fbUser.displayName,
      phone: fbUser.phoneNumber
    });
    localStorage.setItem('nexus_token', res.token);
    localStorage.setItem('nexus_user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
  };

  const logout = () => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    setToken(null);
    setUser(null);
    auth.signOut().catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        firebaseUser,
        token,
        isLoading,
        isAdmin: user?.role === 'admin',
        isFirebaseConnected,
        login,
        loginWithGoogle,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
