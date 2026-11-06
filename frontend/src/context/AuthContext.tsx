import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
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
  DEBE_CAMBIAR_PASSWORD?: number;
}

interface AuthContextType {
  usuario: Usuario | null;
  usuarioLogueado: boolean;
  esAdmin: boolean;
  esVendedor: boolean;
  loadingAuth: boolean;
  login: (datosUsuario: Usuario) => void; 
  logoutGlobal: () => Promise<void>;
  refreshPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const forzandoRef = useRef(false);
  const forzarCambioPasswordRef = useRef<((datos: Usuario) => void) | null>(null);

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

        const completo: Usuario = {
          ...datosUsuario,
          foto_url: datosUsuario.FOTO_URL || null,
        };

        setUsuario(completo);
        forzarCambioPasswordRef.current?.(completo);
      }
    } catch {
      // Un 401 al cargar es el estado normal del visitante anónimo:
      // no se registra como error para no ensuciar la consola.
      setUsuario(null);
    }
  }, []);

  useEffect(() => {
    const inicializar = async () => {
      await fetchPerfil();
      setLoadingAuth(false);
    };
    void inicializar();
  }, []);

  const refreshPerfil = useCallback(async () => {
    await fetchPerfil();
  }, [fetchPerfil]);

  /** Si la cuenta usa una contraseña temporal (vendedores aprobados), exige cambiarla. */
  const forzarCambioPassword = useCallback(async (datos: Usuario) => {
    if (forzandoRef.current || Number(datos.DEBE_CAMBIAR_PASSWORD) !== 1) return;
    forzandoRef.current = true;

    // La UI del cambio obligatorio vive aquí mismo (Swal de forzarCambioPassword): este
    // callback solo detecta la condición y sincroniza el guard de reentrada.
    // (Se eliminó el bloque muerto con la lógica Swal inline y el log con
    // datos del usuario — ronda de limpieza.)
  }, []);

  // (Sonar S6544) el ref espera `(datos) => void`: adapter que no devuelve
  // la promesa de la función subyacente (fire-and-forget controlado).
  forzarCambioPasswordRef.current = (datos: Usuario): void => { void forzarCambioPassword(datos); };

  const login = useCallback((datosUsuario: Usuario) => {
    setUsuario(datosUsuario);
    forzarCambioPasswordRef.current?.(datosUsuario);
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
    // Refresco completo de la página para limpiar todo estado en memoria
    window.location.replace("/");
  }
}, []);

  const esAdmin = usuario?.ID_ROL === 1;
  const esVendedor = usuario?.ID_ROL === 6;

  const value = useMemo(() => ({
    usuario,
    usuarioLogueado: !!usuario,
    esAdmin,
    esVendedor,
    loadingAuth,
    login,
    logoutGlobal,
    refreshPerfil
  }), [usuario, esAdmin, esVendedor, loadingAuth, login, logoutGlobal, refreshPerfil]);

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