import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import axios from "axios";
import Swal from "sweetalert2";

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

  /** Si la cuenta usa una contraseña temporal (vendedores aprobados), exige cambiarla. */
  const forzarCambioPassword = useCallback(async (datos: Usuario) => {
    if (forzandoRef.current || Number(datos.DEBE_CAMBIAR_PASSWORD) !== 1) return;
    forzandoRef.current = true;

    const resultado = await Swal.fire({
      icon: "warning",
      title: "Debes cambiar tu contraseña",
      html:
        '<p style="text-align:left;font-size:14px;margin:0 0 10px">Tu cuenta usa una <strong>contraseña temporal</strong> (enviada por correo). Crea una nueva contraseña personal:</p>' +
        '<input id="swal-pass-actual" type="password" class="swal2-input" placeholder="Contraseña temporal actual" autocomplete="current-password">' +
        '<input id="swal-pass-nueva" type="password" class="swal2-input" placeholder="Nueva contraseña (mínimo 8 caracteres)" autocomplete="new-password">' +
        '<input id="swal-pass-confirmar" type="password" class="swal2-input" placeholder="Repite la nueva contraseña" autocomplete="new-password">',
      confirmButtonText: "Cambiar contraseña",
      confirmButtonColor: "#e63946",
      showCancelButton: true,
      cancelButtonText: "Cerrar sesión",
      focusConfirm: false,
      allowOutsideClick: false,
      preConfirm: async () => {
        const actual = (document.getElementById("swal-pass-actual") as HTMLInputElement)?.value || "";
        const nueva = (document.getElementById("swal-pass-nueva") as HTMLInputElement)?.value || "";
        const confirmarPass = (document.getElementById("swal-pass-confirmar") as HTMLInputElement)?.value || "";
        if (!actual || !nueva || !confirmarPass) {
          Swal.showValidationMessage("Completa los tres campos");
          return false;
        }
        if (nueva.length < 8) {
          Swal.showValidationMessage("La nueva contraseña debe tener mínimo 8 caracteres");
          return false;
        }
        if (nueva !== confirmarPass) {
          Swal.showValidationMessage("Las contraseñas no coinciden");
          return false;
        }
        try {
          await axios.post("/api/auth/cambiar-password", { password_actual: actual, password_nueva: nueva });
          return true;
        } catch (err: any) {
          Swal.showValidationMessage(err?.response?.data?.msg || "La contraseña actual es incorrecta");
          return false;
        }
      },
    });

    forzandoRef.current = false;

    if (resultado.dismiss) {
      // El usuario prefirió cerrar sesión en lugar de cambiar la contraseña
      await axios.post("/api/auth/logout").catch(() => {});
      setUsuario(null);
      return;
    }
    if (resultado.isConfirmed) {
      await Swal.fire({
        icon: "success",
        title: "Contraseña actualizada",
        text: "Ya puedes usar tu cuenta con tu nueva contraseña.",
        confirmButtonColor: "#e63946",
      });
    }
    await refreshPerfil();
  }, [refreshPerfil]);

  forzarCambioPasswordRef.current = forzarCambioPassword;

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