import { createContext, useContext, useState } from 'react';
import api from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export const homeFor = (role) => (role === 'customer' ? '/portal' : role === 'agent' ? '/agent' : '/admin');

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sm_user')); } catch { return null; }
  });
  const save = (d) => {
    localStorage.setItem('sm_token', d.token);
    localStorage.setItem('sm_user', JSON.stringify(d.user));
    setUser(d.user);
    return d.user;
  };
  const login = async (identifier, password) => save((await api.post('/auth/login', { identifier, password })).data);
  const register = async (body) => save((await api.post('/auth/register', body)).data);
  const logout = () => {
    localStorage.removeItem('sm_token');
    localStorage.removeItem('sm_user');
    setUser(null);
  };
  return <Ctx.Provider value={{ user, login, register, logout }}>{children}</Ctx.Provider>;
}
