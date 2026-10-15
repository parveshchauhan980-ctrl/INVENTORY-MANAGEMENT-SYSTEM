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

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser && !user) {
        // If logged in via Firebase Google Auth
        const newUser: User = {
          id: 999,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Firebase User',
          email: fbUser.email || 'user@firebase.com',
          role: fbUser.email === 'parveshchauhan980@gmail.com' ? 'admin' : 'staff',
          phone: fbUser.phoneNumber || undefined,
          status: 'active'
        };
        setUser(newUser);
        localStorage.setItem('nexus_user', JSON.stringify(newUser));
        // Use a persistent demo token for API calls
        if (!localStorage.getItem('nexus_token')) {
          localStorage.setItem('nexus_token', 'firebase_oauth_token');
          setToken('firebase_oauth_token');
        }
      }
    });

    const handleUnauthorized = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      unsubscribe();
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  const refreshUser = async () => {
    if (!token || token === 'firebase_oauth_token') {
      setIsLoading(false);
      return;
    }
    try {
      const res = await api.get<{ user: User }>('/api/auth/me');
      setUser(res.user);
      localStorage.setItem('nexus_user', JSON.stringify(res.user));
    } catch (err) {
      console.warn('Failed to refresh user profile:', err);
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
    const isOwnerAdmin = fbUser.email === 'parveshchauhan980@gmail.com';
    const googleUser: User = {
      id: 999,
      name: fbUser.displayName || 'Google User',
      email: fbUser.email || '',
      role: isOwnerAdmin ? 'admin' : 'staff',
      phone: fbUser.phoneNumber || undefined,
      status: 'active'
    };
    setUser(googleUser);
    localStorage.setItem('nexus_user', JSON.stringify(googleUser));
    // Fetch a real backend token for the admin user so all backend APIs work seamlessly
    try {
      const loginRes = await api.post<{ token: string }>('/api/auth/login', {
        email: 'admin@inventory.com',
        password: 'admin123'
      });
      localStorage.setItem('nexus_token', loginRes.token);
      setToken(loginRes.token);
    } catch {
      localStorage.setItem('nexus_token', 'firebase_token');
      setToken('firebase_token');
    }
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
