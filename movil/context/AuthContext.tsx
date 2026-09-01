import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../constants/api";

const USER_KEY = "@jadda_usuario";

// Cache en memoria como respaldo si AsyncStorage no está disponible (expo web, etc.)
let memoryCache: string | null = null;

async function safeGetItem(key: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return memoryCache;
  }
}

async function safeSetItem(key: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    memoryCache = value;
  }
}

async function safeRemoveItem(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    memoryCache = null;
  }
}

export interface Usuario {
  ID_USUARIO?: number;
  NOMBRE_USUARIO: string;
  APELLIDO_USUARIO?: string;
  EMAIL?: string;
  USUARIO?: string;
  TELEFONO?: string;
  TIPO_DOCUMENTO?: string;
  NUMERO_DOCUMENTO?: string;
  FOTO_URL?: string | null;
  foto_url?: string | null;
  ID_ROL?: number;
  DEBE_CAMBIAR_PASSWORD?: number;
  FECHA_REGISTRO?: string;
  ULTIMA_CONEXION?: string | null;
}

interface AuthContextType {
  usuario: Usuario | null;
  login: (user: Usuario) => void;
  logout: () => void;
  estaLogueado: boolean;
  cargando: boolean;
  esAdmin: boolean;
  esVendedor: boolean;
  refreshPerfil: () => Promise<Usuario | null>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  const refreshPerfil = useCallback(async (): Promise<Usuario | null> => {
    try {
      const res = await api.get("/api/auth/perfil");
      if (res.data.ok || res.data.ID_USUARIO || res.data.NOMBRE_USUARIO) {
        const datos = res.data.usuario || res.data;
        // Bloqueo admin en móvil: si el perfil es admin, no se permite
        if (Number(datos.ID_ROL) === 1) {
          Alert.alert(
            "Acceso denegado",
            "Señor admin, recuerde que no puede loguearse en la app móvil, intente en la web 😉"
          );
          setUsuario(null);
          safeRemoveItem(USER_KEY);
          try { await api.post("/api/auth/logout"); } catch {}
          return null;
        }
        const completo: Usuario = {
          ...datos,
          foto_url: datos.FOTO_URL || null,
        };
        setUsuario(completo);
        safeSetItem(USER_KEY, JSON.stringify(completo));
        return completo;
      }
      return null;
    } catch (err: any) {
      // Solo si el SERVIDOR dice 401/403 Y no es error de red se limpia la sesión.
      // Un Network Error / timeout NO debe borrar la sesión local: el teléfono puede
      // estar sin Wi-Fi o en segundo plano y axios "se pierde" un momento.
      const status = err?.response?.status;
      const isNetwork = !err?.response && (err?.message === 'Network Error' || err?.code === 'ERR_NETWORK' || err?.code === 'ECONNABORTED');
      if (isNetwork) {
        console.log('[Auth] refreshPerfil sin red, mantengo sesión local');
        return null;
      }
      if (status === 401 || status === 403) {
        // Si ya había usuario logueado, es que la sesión expiró: no lo sacamos de golpe,
        // dejamos que el siguiente 401 de una acción lo lleve a login con aviso.
        // Solo limpiamos si no había sesión previa o si es 403 de admin
        if (!usuario) {
          setUsuario(null);
          safeRemoveItem(USER_KEY);
        }
      }
      return null;
    }
  }, [usuario]);

  useEffect(() => {
    (async () => {
      try {
        const data = await safeGetItem(USER_KEY);
        if (data) {
          try {
            const parsed = JSON.parse(data);
            // Si el usuario guardado es admin, no lo restaures (bloqueo móvil)
            if (Number(parsed.ID_ROL) === 1) {
              safeRemoveItem(USER_KEY);
            } else {
              setUsuario(parsed);
            }
          } catch {}
        }
      } catch {}
      setCargando(false);
      // El web hace fetchPerfil() en cada arranque; el móvil debe hacer lo mismo:
      // el usuario guardado en AsyncStorage puede traer una foto_url VIEJA (p. ej.
      // la foto se cambió desde otro dispositivo o quedó una URL de un archivo que
      // ya no existe en disco) → se re-sincroniza con la verdad del servidor.
      await refreshPerfil();
    })();
  }, [refreshPerfil]);

  function login(user: Usuario) {
    if (Number(user.ID_ROL) === 1) {
      Alert.alert(
        "Acceso denegado",
        "Señor admin, recuerde que no puede loguearse en la app móvil, intente en la web 😉"
      );
      safeRemoveItem(USER_KEY);
      try { api.post("/api/auth/logout"); } catch {}
      return;
    }
    setUsuario(user);
    safeSetItem(USER_KEY, JSON.stringify(user));
    // Re-sincroniza con el servidor: la respuesta del login podría no traer la
    // foto actual y lo guardado en AsyncStorage puede estar desactualizado.
    refreshPerfil().catch(() => {});
  }

  function logout() {
    api.post("/api/auth/logout").catch(() => {});
    setUsuario(null);
    safeRemoveItem(USER_KEY);
  }

  const esAdmin = usuario?.ID_ROL === 1;
  const esVendedor = usuario?.ID_ROL === 6;

  return (
    <AuthContext.Provider
      value={{
        usuario,
        login,
        logout,
        estaLogueado: !!usuario,
        cargando,
        esAdmin,
        esVendedor,
        refreshPerfil,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
