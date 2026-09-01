import axios from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// URL base de la API (backend Express). Sobrescribible con EXPO_PUBLIC_API_URL.
// Para Android físico usa la IP LAN del PC (192.168.1.5), para emulador usa 10.0.2.2
const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
const envFrontUrl = process.env.EXPO_PUBLIC_FRONT_URL;

// Intenta deducir la IP del host desde el hostUri de Expo (ej: 192.168.1.5:8081)
function hostFromExpo(): string | null {
  try {
    const hostUri =
      (Constants.expoConfig as any)?.hostUri ||
      (Constants.manifest as any)?.hostUri ||
      (Constants.manifest2 as any)?.extra?.expoGo?.developer?.tool;
    if (typeof hostUri === 'string') {
      const m = hostUri.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (m) return m[1];
    }
    // Fallback: intenta desde Constants.expoConfig.extra
    const extra = (Constants.expoConfig as any)?.extra;
    if (extra?.host) return String(extra.host);
  } catch {}
  return null;
}

const expoHost = hostFromExpo();

export const API_URL = (() => {
  if (envApiUrl) return envApiUrl;
  if (expoHost) return `http://${expoHost}:5000`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:5000';
  return 'http://10.2.178.124:5000';
})();

// URL base del frontend web (Vite), donde se sirven las imágenes locales
// (/images/...). Sobrescribible con EXPO_PUBLIC_FRONT_URL.
const FRONT_URL = (() => {
  if (envFrontUrl) return envFrontUrl;
  if (expoHost) return `http://${expoHost}:5173`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:5173';
  return 'http://10.2.178.124:5173';
})();

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
  timeout: 10000,
});

// Interceptor: si la sesión expiró (401) no es "Network Error", solo avisa una vez y no rompe la cola
let sesionAvisada = false;
api.interceptors.response.use(
  (r) => {
    // Si vuelve a funcionar, resetea el flag para próximos 401
    sesionAvisada = false;
    return r;
  },
  (error) => {
    const status = error?.response?.status;
    const isNetwork = !error.response && (error.message === 'Network Error' || error.code === 'ERR_NETWORK');
    // 401 = sesión expirada o no logueado → no es error de red, solo la app pedirá login cuando haga falta
    if (status === 401) {
      if (!sesionAvisada) {
        console.log('[API] Sesión expirada (401) — se pedirá login si hace falta');
        sesionAvisada = true;
        setTimeout(() => (sesionAvisada = false), 3000);
      }
      return Promise.reject(error);
    }
    if (isNetwork) {
      console.warn('[API] Sin conexión (se reintentará al volver a primer plano)');
    }
    return Promise.reject(error);
  }
);

// Si la IP del bundle quedó vieja (cambiaste de Wi-Fi), expoHost ya es la nueva.
// Actualiza el baseURL en caliente cuando la app vuelve a primer plano
let lastExpoHost = expoHost;
export function refrescarBaseUrlSiCambio() {
  const nuevo = hostFromExpo();
  if (nuevo && nuevo !== lastExpoHost) {
    lastExpoHost = nuevo;
    const nuevaUrl = `http://${nuevo}:5000`;
    const nuevaFront = `http://${nuevo}:5173`;
    api.defaults.baseURL = nuevaUrl;
    console.log(`[API] Host cambió a ${nuevo} → baseURL=${nuevaUrl} front=${nuevaFront}`);
  }
}

console.log(`[API] Config: API_URL=${API_URL} FRONT_URL=${FRONT_URL} expoHost=${expoHost || 'null'} platform=${Platform.OS}`);

export default api;
