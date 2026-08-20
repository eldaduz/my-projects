import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';
import { AuthContext } from './context';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    apiClient
      .get('/auth/me', { signal: controller.signal })
      .then(({ user }) => {
        if (!active) return;
        setUser(user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus('unauthenticated');
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const login = useCallback(async (email, password) => {
    const { user } = await apiClient.post('/auth/login', { email, password });
    setUser(user);
    setStatus('authenticated');
    return user;
  }, []);

  // Registration doesn't start a session on its own (POST /auth/register
  // just creates the account), so this signs the new user straight in.
  const register = useCallback(
    async (email, password) => {
      await apiClient.post('/auth/register', { email, password });
      return login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // A network/server failure shouldn't block clearing the local session state.
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
