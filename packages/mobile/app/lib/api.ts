import axios from 'axios';
import { useAuthStore } from '../store/auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    // A wrong password on the sign-in screen is also a 401; only log out for real sessions.
    // Only a request that carried a sign-in can mean the sign-in has ended.
    const isSignIn = /\/auth\/(login|join|register)$/.test(err.config?.url || '');
    const hadToken = !!err.config?.headers?.Authorization;
    if (err.response?.status === 401 && !isSignIn && hadToken) useAuthStore.getState().logout();
    return Promise.reject(err);
  }
);

/** A link to an uploaded photo or video: API-hosted "/uploads/…" links, and HEIC photos as JPEG. */
export function mediaSrc(url?: string | null): string {
  if (!url) return '';
  if (/^https:\/\/res\.cloudinary\.com\/.+\.hei[cf]$/i.test(url)) return url.replace(/\.hei[cf]$/i, '.jpg');
  return /^(https?:|data:|file:)/.test(url) ? url : API_URL.replace(/\/api\/?$/, '') + url;
}
