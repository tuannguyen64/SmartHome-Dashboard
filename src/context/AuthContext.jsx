import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      setReady(true);
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const finish = useCallback((res, remember) => {
    setToken(res.accessToken, remember);
    setUser(res.user);
    return res.user;
  }, []);

  const login = useCallback(async (username, password, remember) => finish(await api.login(username, password), remember), [finish]);
  const register = useCallback(async (body) => finish(await api.register(body), true), [finish]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* phiên đã hết hạn sẵn */
    }
    setToken(null);
    setUser(null);
  }, []);

  // Phiên hết hạn → về trang đăng nhập
  const expire = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, ready, login, register, logout, expire }), [user, ready, login, register, logout, expire]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
