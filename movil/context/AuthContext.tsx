import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const USER_KEY = "@jadda_usuario";

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
    AsyncStorage.getItem(USER_KEY)
      .then((data) => {
        if (data) {
          setUsuario(JSON.parse(data));
        }
      })
      .finally(() => setCargando(false));
  }, []);

  function login(user: Usuario) {
    setUsuario(user);
    AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function logout() {
    setUsuario(null);
    AsyncStorage.removeItem(USER_KEY);
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