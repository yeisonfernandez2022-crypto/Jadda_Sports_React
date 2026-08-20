import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
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
      // Solo si el SERVIDOR dice que no hay sesión se limpia el usuario guardado;
      // un error de red NO debe borrar la sesión local (el teléfono puede estar offline).
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        setUsuario(null);
        safeRemoveItem(USER_KEY);
      }
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await safeGetItem(USER_KEY);
        if (data) {
          try {
            setUsuario(JSON.parse(data));
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

  return (
    <AuthContext.Provider
      value={{
        usuario,
        login,
        logout,
        estaLogueado: !!usuario,
        cargando,
        esAdmin,
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
