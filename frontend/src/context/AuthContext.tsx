import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import axios from "axios";

// 🚀 CONFIGURACIÓN GLOBAL DE AXIOS: Esto le dice a Axios que inyecte la cookie de sesión en CADA petición a la API
axios.defaults.withCredentials = true;

interface Usuario {
  ID_USUARIO?: number; 
  NOMBRE_USUARIO: string;
  APELLIDO_USUARIO?: string;
  EMAIL?: string;
  USUARIO?: string;
  TELEFONO?: string;
  TIPO_DOCUMENTO?: string;
  NUMERO_DOCUMENTO?: string;
  foto_url: string | null;
  ID_ROL?: number;
}

interface AuthContextType {
  usuario: Usuario | null;
  usuarioLogueado: boolean;
  esAdmin: boolean;
  loadingAuth: boolean;
  login: (datosUsuario: Usuario) => void; 
  logoutGlobal: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const fetchPerfil = useCallback(async () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const nombreURL = params.get("user");
      const fotoURL = params.get("photo");

      if (nombreURL) {
        const usuarioSocial: Usuario = {
          NOMBRE_USUARIO: decodeURIComponent(nombreURL),
          foto_url: fotoURL ? decodeURIComponent(fotoURL) : null,
        };
        
        setUsuario(usuarioSocial);
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      const res = await axios.get("/api/auth/perfil");
      if (res.data.ok || res.data.ID_USUARIO || res.data.NOMBRE_USUARIO) {
        const datosUsuario = res.data.usuario || res.data;

        setUsuario({
          ...datosUsuario,
          foto_url: datosUsuario.FOTO_URL || null
        });
      }
    } catch (err) {
      console.error("No hay sesión activa en el servidor.");
      setUsuario(null);
    }
  }, []);

  useEffect(() => {
    const inicializar = async () => {
      await fetchPerfil();
      setLoadingAuth(false);
    };
    inicializar();
  }, []);

  const refreshPerfil = useCallback(async () => {
    await fetchPerfil();
  }, [fetchPerfil]);

  const login = useCallback((datosUsuario: Usuario) => {
    setUsuario(datosUsuario);
  }, []);

  const logoutGlobal = useCallback(async () => {
  try {
    // 1. Llamada al servidor para destruir la sesión (cookie)
    await axios.post("/api/auth/logout", {}, {
      withCredentials: true 
    });
  } catch (err) {
    console.error("Error al cerrar sesión:", err);
  } finally {
    setUsuario(null);
  }
}, []);

  const esAdmin = usuario?.ID_ROL === 1;

  const value = useMemo(() => ({
    usuario,
    usuarioLogueado: !!usuario,
    esAdmin,
    loadingAuth,
    login,
    logoutGlobal,
    refreshPerfil
  }), [usuario, esAdmin, loadingAuth, login, logoutGlobal, refreshPerfil]);

  return (
    <AuthContext.Provider value={value}>
      {!loadingAuth && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de un AuthProvider");
  return context;
};