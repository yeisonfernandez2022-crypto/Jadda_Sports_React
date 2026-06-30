import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

interface Usuario {
  ID_USUARIO: number;
  NOMBRE_USUARIO: string;
  foto_url?: string | null;
}

interface AuthContextType {
  usuario: Usuario | null;
  login: (user: Usuario) => void;
  logout: () => void;
  estaLogueado: boolean;
  cargando: boolean;
}

const AuthContext =
  createContext<AuthContextType>(
    {} as AuthContextType
  );

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [usuario, setUsuario] =
    useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    safeGetItem(USER_KEY)
      .then((data) => {
        if (data) {
          try { setUsuario(JSON.parse(data)); } catch {}
        }
      })
      .finally(() => setCargando(false));
  }, []);

  function login(user: Usuario) {
    setUsuario(user);
    safeSetItem(USER_KEY, JSON.stringify(user));
  }

  function logout() {
    setUsuario(null);
    safeRemoveItem(USER_KEY);
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        login,
        logout,
        estaLogueado: !!usuario,
        cargando,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}