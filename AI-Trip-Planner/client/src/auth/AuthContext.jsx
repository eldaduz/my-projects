// ╔══════════════════════════════════════════════════════════════════╗
// ║ AUTH CONTEXT — Global authentication state for the React app     ║
// ║                                                                  ║
// ║ PATTERN: React Context + Provider                                ║
// ║   - AuthContext (created in context.js) holds the auth state     ║
// ║   - AuthProvider (this file) wraps the entire app in main.jsx   ║
// ║   - useAuth() hook (in useAuth.js) lets any component access it ║
// ║                                                                  ║
// ║ WHY CONTEXT? Without it, you'd need to pass user/login/logout   ║
// ║ as props through EVERY component in the tree. Context eliminates ║
// ║ this "prop drilling" problem.                                    ║
// ║                                                                  ║
// ║ REUSE: useAuth() is consumed in LoginPage, RegisterPage,        ║
// ║ ProtectedLayout, RequireAuth — any component needing auth state. ║
// ╚══════════════════════════════════════════════════════════════════╝
import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../api/apiClient';
import { AuthContext } from './context';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');

  // STUDY NOTE: AUTO-LOGIN CHECK on app startup.
  // When the app loads, we call GET /auth/me to check if the user has a valid
  // session cookie from a previous visit. Three possible states:
  //   'loading' → still checking (show spinner)
  //   'authenticated' → cookie valid, user is logged in
  //   'unauthenticated' → no cookie or expired (show login page)
  //
  // PATTERN: useEffect cleanup with `active` flag + AbortController.
  // TEACHER Q: "Why let active = true?" → If the component unmounts before
  // the API call finishes, setting state would cause a React warning.
  // The cleanup function sets active=false, and we skip setState.
  // TEACHER Q: "Why AbortController?" → Actually cancels the in-flight
  // HTTP request, not just ignoring the result.
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

  // STUDY NOTE: useCallback memoizes these functions so they don't change
  // on every render. Without useCallback, any component that receives login/
  // register/logout as a dependency (e.g. in its own useEffect) would
  // re-run its effect on every parent render.
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
