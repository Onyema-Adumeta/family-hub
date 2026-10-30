import axios from 'axios';
import { useAuthStore } from '../store/auth';
export const api = axios.create({ baseURL: (import.meta.env.VITE_API_URL || '') + '/api' });
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // A wrong password on the sign-in form is also a 401 — show that error on the
    // form instead of treating it as an expired session.
    const isSignIn = /\/auth\/(login|join|register)$/.test(err.config?.url || '');
    if (err.response?.status === 401 && !isSignIn) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);
/** A link to an uploaded photo or video. Old uploads stored as "/uploads/…" live on the API server, not this website. */
export function mediaSrc(url?: string | null): string {
  if (!url) return '';
  // iPhone HEIC photos: most browsers can't show them, so ask Cloudinary for a JPEG copy.
  if (/^https:\/\/res\.cloudinary\.com\/.+\.hei[cf]$/i.test(url)) return url.replace(/\.hei[cf]$/i, '.jpg');
  return /^(https?:|data:|blob:)/.test(url) ? url : (import.meta.env.VITE_API_URL || '') + url;
}

export async function uploadFile(file: File): Promise<{ url: string; type: 'image' | 'video' }> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  return data;
}