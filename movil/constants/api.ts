import axios from 'axios';

// URL base de la API (backend Express). Sobrescribible con EXPO_PUBLIC_API_URL.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.2.178.124:5000';

// URL base del frontend web (Vite), donde se sirven las imágenes locales
// (/images/...). Sobrescribible con EXPO_PUBLIC_FRONT_URL.
const FRONT_URL = process.env.EXPO_PUBLIC_FRONT_URL || 'http://10.2.178.124:5173';

/**
 * Convierte rutas relativas (/images/...) en URLs absolutas para la app móvil.
 * Las URLs completas (http/https) se devuelven tal cual.
 */
export const resolverImagen = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('/')) return FRONT_URL + url;
  return url;
};

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

export default api;
