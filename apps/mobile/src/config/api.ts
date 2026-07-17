const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

/**
 * Set EXPO_PUBLIC_API_URL to the LAN-accessible API origin when testing on
 * a physical device (for example http://192.168.1.20:4000).
 */
export const API_URL = (configuredUrl || 'http://localhost:4000').replace(/\/$/, '');

export function apiUrl(path: string): string {
  return `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
