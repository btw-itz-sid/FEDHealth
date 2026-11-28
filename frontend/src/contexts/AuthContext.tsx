import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';

interface User {
  id: string; email: string; firstName: string; lastName: string;
  role: 'patient' | 'researcher' | 'admin'; isActive: boolean;
}
interface Registration { email: string; password: string; firstName: string; lastName: string }
interface AuthContextType {
  user: User | null; isLoading: boolean; isAuthenticated: boolean;
  connectionError: string; retrySession: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Registration) => Promise<string>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let current = true;
    // Remove tokens left by older versions; sessions now use HttpOnly cookies.
    localStorage.removeItem('fedhealth_token');
    setIsLoading(true); setError('');
    api.getProfile().then(data => { if (current) setUser(data); })
      .catch((failure: Error & { statusCode?: number }) => {
        if (!current) return;
        if (failure.statusCode === 401) setUser(null);
        else setError(failure.message || 'The service is temporarily unavailable.');
      }).finally(() => { if (current) setIsLoading(false); });
    return () => { current = false; };
  }, [retry]);
  const login = async (email: string, password: string) => { const result = await api.login({ email, password }); setError(''); setUser(result.user); };
  const register = async (data: Registration) => { const result = await api.register(data); setError(''); setUser(result.user); return result.recoveryCode; };
  const logout = async () => {
    try { await api.logout(); setUser(null); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not sign out. Please try again.'); }
  };
  return <AuthContext.Provider value={{ user, isLoading, isAuthenticated: !!user, connectionError: error, retrySession: () => setRetry(value => value + 1), login, register, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
