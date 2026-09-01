import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { Alert } from "react-native";
import api from "../constants/api";
import { useAuth } from "./AuthContext";
import { useAvisoLogin } from "./AvisoLoginContext";

export interface Favorito {
  ID_FAVORITO: number;
  FECHA_AGREGADO: string;
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  MARCA?: string;
  IMAGEN: string;
}

export interface ToastFavorito {
  mensaje: string;
  agregado: boolean;
}

interface FavoritosContextType {
  favoritos: Favorito[];
  idsFavoritos: Set<number>;
  loadingFavoritos: boolean;
  fetchFavoritos: (opts?: { silencioso?: boolean }) => void;
  toggleFavorito: (idProducto: number) => Promise<void>;
  esFavorito: (idProducto: number) => boolean;
  toast: ToastFavorito | null;
}

const FavoritosContext = createContext<FavoritosContextType | undefined>(undefined);

export function FavoritosProvider({ children }: { children: ReactNode }) {
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [loadingFavoritos, setLoadingFavoritos] = useState(false);
  const [toast, setToast] = useState<ToastFavorito | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { estaLogueado } = useAuth();
  const { mostrarAvisoLogin } = useAvisoLogin();

  const idsFavoritos = useMemo(() => new Set(favoritos.map((f) => f.ID)), [favoritos]);

  const fetchFavoritos = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!estaLogueado) {
      setFavoritos([]);
      return;
    }
    if (!opts?.silencioso) setLoadingFavoritos(true);
    try {
      const res = await api.get("/api/favoritos");
      setFavoritos(res.data);
    } catch (err: any) {
      const status = err?.response?.status;
      const isNetwork = !err?.response && (err?.message === "Network Error" || err?.code === "ERR_NETWORK" || err?.code === "ECONNABORTED");
      if (status === 401) {
        // Sesión expirada — no borra favoritos, solo deja de reintentar hasta que vuelva a primer plano
        return;
      }
      if (isNetwork) {
        console.log("[Favoritos] sin red, mantengo cache");
        return;
      }
      console.error("Error al obtener favoritos:", err);
    } finally {
      if (!opts?.silencioso) setLoadingFavoritos(false);
    }
  }, [estaLogueado]);

  useEffect(() => {
    fetchFavoritos();
  }, [fetchFavoritos]);

  const toggleFavorito = useCallback(
    async (idProducto: number) => {
      if (!estaLogueado) {
        mostrarAvisoLogin("Para guardar favoritos necesitas iniciar sesión.");
        return;
      }

      const yaExiste = favoritos.find((f) => f.ID === idProducto);

      try {
        if (yaExiste) {
          await api.delete(`/api/favoritos/${yaExiste.ID_FAVORITO}`);
        } else {
          await api.post("/api/favoritos", { id_producto: idProducto });
        }
        fetchFavoritos();

        if (toastTimer.current) clearTimeout(toastTimer.current);
        setToast(
          yaExiste
            ? { mensaje: "Se quitó de favoritos", agregado: false }
            : { mensaje: "Se agregó a favoritos", agregado: true }
        );
        toastTimer.current = setTimeout(() => setToast(null), 2200);
      } catch (err: any) {
        console.error("Error al cambiar favorito:", err);
        Alert.alert("Error", err.response?.data?.msg || "No se pudo actualizar favorito");
      }
    },
    [estaLogueado, favoritos, fetchFavoritos, mostrarAvisoLogin]
  );

  const esFavorito = useCallback((idProducto: number) => idsFavoritos.has(idProducto), [idsFavoritos]);

  const value = useMemo(
    () => ({ favoritos, idsFavoritos, loadingFavoritos, fetchFavoritos, toggleFavorito, esFavorito, toast }),
    [favoritos, idsFavoritos, loadingFavoritos, fetchFavoritos, toggleFavorito, esFavorito, toast]
  );

  return <FavoritosContext.Provider value={value}>{children}</FavoritosContext.Provider>;
}

export const useFavoritos = () => {
  const context = useContext(FavoritosContext);
  if (!context) throw new Error("useFavoritos debe usarse dentro de FavoritosProvider");
  return context;
};
