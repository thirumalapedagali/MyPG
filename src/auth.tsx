import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onSessionExpired, post, put, tokenStore } from './api';
import { unregisterFromPush } from './push';
import { LoginResponse, User } from './types';

const USER_KEY = 'mypg-user';

type Auth = {
  ready: boolean;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  /** Super admin / owner: work inside the chosen PG. */
  selectPg: (pgId: number) => Promise<void>;
  /** Super admin: leave the current PG and return to the admin console. */
  exitPg: () => Promise<void>;
  /** Owner: show the consolidated figures of all their properties. */
  viewAllProperties: () => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<Auth>(null as unknown as Auth);
export const useAuth = () => useContext(Ctx);

const toUser = (r: LoginResponse): User => ({
  role: r.role,
  userId: r.userId,
  username: r.username,
  pgId: r.pgId,
  pgName: r.pgName,
  totalFloors: r.totalFloors,
  residentId: r.residentId,
  mustChangePassword: r.mustChangePassword,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  const persist = useCallback(async (u: User | null) => {
    setUserState(u);
    if (u) await AsyncStorage.setItem(USER_KEY, JSON.stringify(u));
    else await AsyncStorage.removeItem(USER_KEY);
  }, []);

  useEffect(() => {
    onSessionExpired(() => setUserState(null));
    (async () => {
      try {
        const [token, raw] = await Promise.all([tokenStore.get(), AsyncStorage.getItem(USER_KEY)]);
        if (token && raw) setUserState(JSON.parse(raw) as User);
      } catch {
        // Corrupt stored session: start logged out.
      }
      setReady(true);
    })();
    return () => onSessionExpired(null);
  }, []);

  const value = useMemo<Auth>(
    () => ({
      ready,
      user,
      login: async (username, password) => {
        const res = await post<LoginResponse>('/api/auth/login', { username: username.trim(), password }, { auth: false });
        await tokenStore.set(res.token);
        await persist(toUser(res));
      },
      selectPg: async (pgId) => {
        const res = await post<LoginResponse>('/api/auth/select-pg', { pgId });
        await tokenStore.set(res.token);
        await persist(toUser(res));
      },
      exitPg: async () => {
        const res = await post<LoginResponse>('/api/auth/exit-pg');
        await tokenStore.set(res.token);
        await persist(toUser(res));
      },
      viewAllProperties: async () => {
        if (user) await persist({ ...user, allProperties: true });
      },
      changePassword: async (oldPassword, newPassword) => {
        await put('/api/auth/change-password', { oldPassword, newPassword });
        if (user) await persist({ ...user, mustChangePassword: false });
      },
      logout: async () => {
        // Tokens are stateless on the server; dropping ours is the logout. Stop pushes for this phone first, while we can still call the API.
        if (!user || user.pgId == null) {
          await unregisterFromPush();
        }
        await tokenStore.clear();
        await persist(null);
      },
    }),
    [ready, user, persist],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
