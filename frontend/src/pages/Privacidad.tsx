import "../css/Privacidad.css";
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FaHistory, FaTrashAlt, FaCookieBite, FaFileAlt, FaShieldAlt } from "react-icons/fa";
import Breadcrumb from "../components/Breadcrumb";
import Swal from "sweetalert2";

export default function Privacidad() {
  const navigate = useNavigate();
  const [guardarHistorial, setGuardarHistorial] = useState<boolean | null>(null);
  const [articulos, setArticulos] = useState<number>(0);
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => {
    cargarAjustes();
    contarHistorial();
  }, []);

  async function cargarAjustes() {
    try {
      const res = await axios.get("/api/auth/perfil", { withCredentials: true });
      setGuardarHistorial(!!res.data.usuario.GUARDAR_HISTORIAL);
    } catch {
      setGuardarHistorial(false);
    }
  }

  async function contarHistorial() {
    try {
      const res = await axios.get("/api/historial", { withCredentials: true });
      setArticulos(Array.isArray(res.data) ? res.data.length : Array.isArray(res.data.historial) ? res.data.historial.length : 0);
    } catch {
      setArticulos(0);
    }
  }

  async function alternarHistorial(nuevo: boolean) {
    const previo = guardarHistorial;
    setGuardarHistorial(nuevo);
    setCambiando(true);
    try {
      await axios.put("/api/auth/privacidad", { guardarHistorial: nuevo }, { withCredentials: true });
      if (nuevo) {
        Swal.fire({
          icon: "success", title: "AJUSTE ACTUALIZADO",
          text: "Volveremos a registrar los productos que veas.",
          background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946",
        });
      } else {
        try {
          await axios.delete("/api/historial", { withCredentials: true });
        } catch { /* el historial guardado puede no existir */ }
        await contarHistorial();
        Swal.fire({
          icon: "success", title: "AJUSTE ACTUALIZADO",
          text: "Dejamos de guardar tu historial y se borró el histórico.",
          background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946",
        });
      }
    } catch {
      setGuardarHistorial(previo);
      Swal.fire({
        icon: "error", title: "NO SE PUDO GUARDAR",
        text: "Intenta de nuevo en unos segundos.",
        background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946",
      });
    } finally {
      setCambiando(false);
    }
  }

  async function borrarHistorial() {
    const r = await Swal.fire({
      icon: "warning",
      title: "¿Borrar tu historial?",
      text: "Se eliminarán los productos que visitaste. Se puede volver a llenar si el ajuste está activado.",
      showCancelButton: true,
      confirmButtonText: "Sí, borrar",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946",
    });
    if (!r.isConfirmed) return;
    try {
      const res = await axios.delete("/api/historial", { withCredentials: true });
      await contarHistorial();
      Swal.fire({
        icon: "success", title: "HISTORIAL BORRADO",
        text: res.data?.msg || "Se eliminó tu historial de navegación.",
        background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946",
      });
    } catch {
      Swal.fire({
        icon: "error", title: "NO SE PUDO BORRAR",
        text: "Intenta de nuevo en unos segundos.",
        background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946",
      });
    }
  }

  function reMostrarAvisoCookies() {
    localStorage.removeItem("jadda_aviso_cookies");
    Swal.fire({
      icon: "info", title: "AVISO DE COOKIES",
      text: "El aviso volverá a mostrarse la próxima vez que abras la tienda.",
      background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946",
    }).then(() => navigate("/"));
  }

  return (
    <div className="priv-page">
      <div className="priv-bloque">
        <div className="priv-header">
          <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Privacidad" }]} />
          <h1><FaShieldAlt className="priv-icon-title" /> Privacidad</h1>
          <p className="priv-subtitle">Controla qué información guardamos sobre ti y cómo se usa.</p>
        </div>

        {/* Historial de navegación */}
        <div className="priv-card">
          <div className="priv-card-cabecera">
            <div className="card-icon"><FaHistory /></div>
            <div>
              <h2>Historial de navegación</h2>
              <p>Los productos que ves alimentan la sección «Recientemente vistos».</p>
            </div>
          </div>

          <div className="priv-fila">
            <div>
              <strong>Guardar mi historial</strong>
              <small>Si lo desactivas, dejamos de registrar los productos que visites.</small>
            </div>
            <button
              type="button"
              className={`priv-switch ${guardarHistorial ? "activo" : ""}`}
              disabled={guardarHistorial === null || cambiando}
              onClick={() => alternarHistorial(!guardarHistorial)}
              aria-pressed={!!guardarHistorial}
            >
              <span className="priv-switch-knob" />
            </button>
          </div>

          <div className="priv-fila">
            <div>
              <strong>Borrar mi historial</strong>
              <small>{articulos > 0 ? `${articulos} productos guardados` : "No hay productos guardados"}</small>
            </div>
            <button className="priv-btn-peligro" onClick={borrarHistorial}>
              <FaTrashAlt /> Borrar
            </button>
          </div>
        </div>

        {/* Cookies */}
        <div className="priv-card">
          <div className="priv-card-cabecera">
            <div className="card-icon"><FaCookieBite /></div>
            <div>
              <h2>Cookies</h2>
              <p>Solo usamos cookies estrictamente necesarias para mantener tu sesión.</p>
            </div>
          </div>

          <div className="priv-fila">
            <div>
              <strong>Ver de nuevo el aviso de cookies</strong>
              <small>Volverá a aparecer cuando entres a la tienda.</small>
            </div>
            <button className="priv-btn-secundario" onClick={reMostrarAvisoCookies}>
              Mostrar de nuevo
            </button>
          </div>
        </div>

        {/* Legal */}
        <div className="priv-card">
          <div className="priv-card-cabecera">
            <div className="card-icon"><FaFileAlt /></div>
            <div>
              <h2>Más información</h2>
              <p>Consulta cómo tratamos tus datos y qué derechos tienes.</p>
            </div>
          </div>

          <div className="priv-links">
            <button className="priv-link" onClick={() => navigate("/politica-privacidad")}>
              Política de privacidad
            </button>
            <button className="priv-link" onClick={() => navigate("/terminos-y-condiciones")}>
              Términos y condiciones
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}