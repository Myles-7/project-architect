/**
 * @file config.ts
 * @description API Environment Configuration for Frontend Web App.
 *
 * Guaranteed Invariants:
 * 1. Strictly accesses the local backend server via HTTP REST.
 * 2. Never embeds host filesystem absolute paths into browser client code.
 * 3. Never attempts direct process execution (e.g. agy CLI).
 */

export function getApiBaseUrl(): string {
  // Read from Vite environment variable if explicitly configured
  const envUrl = import.meta.env.VITE_PA_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim() !== '') {
    return envUrl.replace(/\/+$/, '');
  }
  // In browser, use relative path to leverage Vite /api proxy seamlessly without CORS/host mismatch
  if (typeof window !== 'undefined') {
    return '';
  }
  return 'http://127.0.0.1:3001';
}
