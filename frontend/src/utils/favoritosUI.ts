import Swal from "sweetalert2";
import type { Dispatch, SetStateAction } from "react";
import type { NavigateFunction } from "react-router-dom";

/** Filas mínimas del listado de favoritos (GET /api/favoritos). */
export interface FavoritoItem {
  ID: number;
  ID_FAVORITO: number;
}

/**
 * Toggle de favorito contra el servidor con toast y acceso directo a
 * /favoritos. Fuente única compartida por Principal y Catalogo (cada página
 * tenía su copia — duplicación CPD). Cuerpo canónico = el de Catalogo,
 * que además muestra un toast cuando el POST falla.
 */
export const toggleFavoritoUI = async ({
  id,
  logueado,
  favoritos,
  setFavoritos,
  navigate,
}: {
  id: number;
  logueado: boolean;
  favoritos: FavoritoItem[];
  setFavoritos: Dispatch<SetStateAction<FavoritoItem[]>>;
  navigate: NavigateFunction;
}) => {
  if (!logueado) {
    void Swal.fire({
      title: "INICIA SESIÓN",
      text: "Debes iniciar sesión para guardar favoritos.",
      icon: "warning",
      background: '#121212',
      color: '#ffffff',
      confirmButtonColor: '#e73737'
    });
    return;
  }
  const Toast = Swal.mixin({ toast: true, position: "bottom", showConfirmButton: false, timer: 2000, timerProgressBar: true });
  const existente = favoritos.find(f => f.ID === id);
  try {
    if (existente) {
      await fetch(`/api/favoritos/${existente.ID_FAVORITO}`, {
        method: "DELETE",
        credentials: "include"
      });
      setFavoritos(prev => prev.filter(f => f.ID !== id));
      void Toast.fire({
        icon: "success",
        timer: 4500,
        html: `Quitado de favoritos <a href="#" id="jadda-ver-favoritos" style="color:#e73737;font-weight:700;text-decoration:underline;margin-left:6px">Ver mis favoritos</a>`,
      });
      setTimeout(() => {
        const el = document.getElementById("jadda-ver-favoritos");
        if (el) {
          el.addEventListener("click", (e) => {
            e.preventDefault();
            Swal.close();
            navigate("/favoritos");
          });
        }
      }, 100);
    } else {
      const res = await fetch("/api/favoritos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id_producto: id })
      });
      if (!res.ok) {
        const data = await res.json();
        void Toast.fire({ icon: "warning", title: data.msg || "Error al agregar" });
        return;
      }
      const favRes = await fetch("/api/favoritos", { credentials: "include" });
      const data = await favRes.json();
      setFavoritos(data.map((f: { ID: number; ID_FAVORITO: number }) => ({ ID: f.ID, ID_FAVORITO: f.ID_FAVORITO })));
      void Toast.fire({
        icon: "success",
        timer: 4500,
        html: `Agregado a favoritos <a href="#" id="jadda-ver-favoritos" style="color:#e73737;font-weight:700;text-decoration:underline;margin-left:6px">Ver mis favoritos</a>`,
      });
      setTimeout(() => {
        const el = document.getElementById("jadda-ver-favoritos");
        if (el) {
          el.addEventListener("click", (e) => {
            e.preventDefault();
            Swal.close();
            navigate("/favoritos");
          });
        }
      }, 100);
    }
  } catch (err) {
    console.error("Error al toggle favorito:", err);
  }
};
