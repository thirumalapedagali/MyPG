import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PORT = 8083;
const TIMEOUT_MS = 15000;
/** The consolidated "all properties" views fan out over every property, so allow them longer. */
const ALL_PROPERTIES_TIMEOUT_MS = 45000;
const TOKEN_KEY = 'mypg-token';

/**
 * Backend URL. Override with EXPO_PUBLIC_API_URL (needed for tunnels / production).
 * Otherwise use the machine running the Expo dev server, so a phone on the same Wi-Fi reaches the backend
 * without hardcoding an IP.
 */
function resolveBaseUrl(): string {
  const env = process.env.EXPO_PUBLIC_API_URL;
  if (env) return env.replace(/\/+$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:${PORT}`;
  return Platform.OS === 'android' ? `http://10.0.2.2:${PORT}` : `http://localhost:${PORT}`;
}
export const BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  status: number;
  code?: string;
  /** Only on LICENSE_EXPIRED (402): the signed-in role and the date the subscription ended (YYYY-MM-DD). */
  role?: string;
  licenseExpiry?: string;
  constructor(status: number, message: string, code?: string, extra?: { role?: string; licenseExpiry?: string }) {
    super(message);
    this.status = status;
    this.code = code;
    this.role = extra?.role;
    this.licenseExpiry = extra?.licenseExpiry;
  }
}

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ── Token storage ────────────────────────────────────────────────────────────

let tokenCache: string | null | undefined;
export const tokenStore = {
  async get(): Promise<string | null> {
    if (tokenCache === undefined) tokenCache = await AsyncStorage.getItem(TOKEN_KEY);
    return tokenCache;
  },
  async set(token: string) {
    tokenCache = token;
    await AsyncStorage.setItem(TOKEN_KEY, token);
  },
  async clear() {
    tokenCache = null;
    await AsyncStorage.removeItem(TOKEN_KEY);
  },
};

let licenseListener: ((info: { role?: string; expiresOn?: string }) => void) | null = null;
/** The subscription ended while the app was in use: show the renewal popup instead of signing the user out. */
export function onLicenseExpired(cb: ((info: { role?: string; expiresOn?: string }) => void) | null) {
  licenseListener = cb;
}

let expiredListener: (() => void) | null = null;
/** AuthProvider subscribes so a failed refresh sends the user back to the login screen. */
export function onSessionExpired(cb: (() => void) | null) {
  expiredListener = cb;
}
async function expireSession() {
  await tokenStore.clear();
  await AsyncStorage.removeItem('mypg-user');
  expiredListener?.();
}

// ── Transport ────────────────────────────────────────────────────────────────

/** A file chosen with the image picker, ready to be sent as a multipart part. */
export type PickedFile = { uri: string; name: string; type: string };

const UPLOAD_TIMEOUT_MS = 60000;

/**
 * Multipart upload over XMLHttpRequest. Expo's own `fetch` (SDK 58) cannot send React Native `{uri, name, type}` file
 * parts ("Unsupported FormDataPart implementation"), and the XHR from React Native can.
 */
function sendForm(path: string, method: string, form: FormData, token: string | null): Promise<Response> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, BASE_URL + path);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.setRequestHeader('Accept', 'application/json');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      const text = xhr.responseText ?? '';
      resolve({ status: xhr.status, ok: xhr.status >= 200 && xhr.status < 300, text: async () => text } as unknown as Response);
    };
    xhr.onerror = () => reject(new ApiError(0, `Cannot reach the server (${BASE_URL}). Check your connection.`));
    xhr.ontimeout = () => reject(new ApiError(0, 'The upload took too long. Check your connection and try again.'));
    xhr.send(form);
  });
}

/** Sends one file as the multipart part `file`. */
export const upload = <T = unknown,>(path: string, file: PickedFile) => {
  const form = new FormData();
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  return api<T>(path, { method: 'POST', body: form });
};

async function send(path: string, method: string, body: unknown, token: string | null): Promise<Response> {
  if (typeof FormData !== 'undefined' && body instanceof FormData) return sendForm(path, method, body, token);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), path.includes('scope=all') ? ALL_PROPERTIES_TIMEOUT_MS : TIMEOUT_MS);
  try {
    return await fetch(BASE_URL + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(
      0,
      ctrl.signal.aborted ? 'The server took too long to respond.' : `Cannot reach the server (${BASE_URL}). Check your connection.`,
    );
  } finally {
    clearTimeout(timer);
  }
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!res.ok) {
    const err = (json ?? {}) as { message?: string; code?: string; role?: string; licenseExpiry?: string };
    if (res.status === 402 && err.code === 'LICENSE_EXPIRED') {
      licenseListener?.({ role: err.role, expiresOn: err.licenseExpiry });
    }
    throw new ApiError(res.status, err.message ?? `Request failed (${res.status})`, err.code, err);
  }
  return json;
}

// One in-flight refresh shared by all callers.
let refreshing: Promise<string> | null = null;
function refreshToken(current: string): Promise<string> {
  if (!refreshing) {
    refreshing = (async () => {
      const data = (await parse(await send('/api/auth/refresh', 'POST', {}, current))) as { token?: string };
      if (!data?.token) throw new ApiError(401, 'No token in refresh response');
      await tokenStore.set(data.token);
      return data.token;
    })().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

type Options = { method?: string; body?: unknown; /** false for login: no token, no refresh-retry */ auth?: boolean };

export async function api<T>(path: string, { method = 'GET', body, auth = true }: Options = {}): Promise<T> {
  const token = auth ? await tokenStore.get() : null;
  let res = await send(path, method, body, token);

  if (res.status === 401 && auth && token) {
    let fresh: string;
    try {
      fresh = await refreshToken(token);
    } catch (e) {
      // An expired subscription keeps the session (the popup was shown by parse): the user renews instead of logging in again.
      if (e instanceof ApiError && e.status === 402) throw e;
      // Only an explicit rejection ends the session; a network error must not log the user out.
      if (e instanceof ApiError && [401, 403].includes(e.status)) {
        await expireSession();
        throw new ApiError(401, 'Your session has expired. Please log in again.');
      }
      throw e;
    }
    res = await send(path, method, body, fresh);
    if (res.status === 401) {
      await expireSession();
      throw new ApiError(401, 'Your session has expired. Please log in again.');
    }
  }
  return (await parse(res)) as T;
}

export const get = <T,>(path: string) => api<T>(path);
export const post = <T,>(path: string, body?: unknown, opts?: Pick<Options, 'auth'>) =>
  api<T>(path, { method: 'POST', body: body ?? {}, ...opts });
export const put = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'PUT', body: body ?? {} });
export const del = <T,>(path: string) => api<T>(path, { method: 'DELETE' });

export function qs(params: Record<string, string | number | undefined | null>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return parts.length ? '?' + parts.join('&') : '';
}
