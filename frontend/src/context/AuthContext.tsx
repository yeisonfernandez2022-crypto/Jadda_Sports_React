import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import axios from "axios";

// 🚀 CONFIGURACIÓN GLOBAL DE AXIOS: Esto le dice a Axios que inyecte la cookie de sesión en CADA petición a la API
axios.defaults.withCredentials = true;

interface Usuario {
  ID_USUARIO?: number; 
  NOMBRE_USUARIO: string;
  APELLIDO_USUARIO?: string;
  EMAIL?: string;
  USUARIO?: string;
  foto_url: string | null;
  ID_ROL?: number;
}

interface AuthContextType {
  usuario: Usuario | null;
  usuarioLogueado: boolean;
  loadingAuth: boolean;
  login: (datosUsuario: Usuario) => void; 
  logoutGlobal: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const verificarSesion = async () => {
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
          setLoadingAuth(false);
          return; 
        }

        // Con el default arriba establecido, ya no hace falta forzar inline el withCredentials, pero se deja por seguridad
        const res = await axios.get("http://localhost:5000/api/auth/perfil");
        if (res.data.ok || res.data.ID_USUARIO || res.data.NOMBRE_USUARIO) {
          // Guardamos la info del usuario ya sea que responda con un wrapper objeto u objeto directo
          const datosUsuario = res.data.usuario || res.data;

setUsuario({
  ...datosUsuario,
  foto_url: datosUsuario.FOTO_URL || null
});
        }
      } catch (err) {
        console.error("No hay sesión activa en el servidor.");
        setUsuario(null);
      } finally {
        setLoadingAuth(false);
      }
    };

    verificarSesion();
  }, []);

  const login = (datosUsuario: Usuario) => {
    setUsuario(datosUsuario);
  };

  const logoutGlobal = async () => {
  try {
    // 1. Llamada al servidor para destruir la sesión (cookie)
    await axios.post("http://localhost:5000/api/auth/logout", {}, {
      withCredentials: true 
    });
  } catch (err) {
    console.error("Error al cerrar sesión:", err);
  } finally {
    // 2. Limpieza del estado en memoria
    setUsuario(null);
    
    // 3. SOLO REFRESCA, NO REDIRIGES
    // Esto mantendrá al usuario en la misma URL (catalogo, principal, etc.)
    window.location.reload(); 
  }
};

  return (
    <AuthContext.Provider 
      value={{ 
        usuario, 
        usuarioLogueado: !!usuario, 
        loadingAuth, 
        login, 
        logoutGlobal 
      }}
    >
      {!loadingAuth && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de un AuthProvider");
  return context;
};