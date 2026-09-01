import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FaTrophy, FaRunning, FaFire, FaCheckCircle, FaPlus, FaArrowLeft,
  FaEye, FaUserPlus, FaCamera, FaGift, FaMedal, FaChevronRight,
} from "react-icons/fa";
import Swal from "sweetalert2";
import axios from "axios";
import { tipoDe } from "../utils/retosAvances.tsx";
import "../css/Retos.css";

const diasRestantes = (reto: any): string | null => {
  if (!reto?.FECHA_FIN) return null;
  const fin = new Date(reto.FECHA_FIN).getTime();
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.ceil((fin - hoy.getTime()) / 86400000);
  if (dias <= 0) return "¡Último día!";
  return dias === 1 ? "Falta 1 día" : `Faltan ${dias} días`;
};

function Retos() {
  const { usuarioLogueado, esAdmin } = useAuth();
  const navigate = useNavigate();
  const [retosDisponibles, setRetosDisponibles] = useState<any[]>([]);
  const [misRetos, setMisRetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    try {
      const [disponibles, mis] = await Promise.all([
        axios.get("/api/retos"),
        axios.get("/api/retos/mis-retos"),
      ]);
      setRetosDisponibles(disponibles.data);
      setMisRetos(mis.data);
    } catch (err) {
      console.error("Error al cargar retos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usuarioLogueado) cargarDatos();
  }, [usuarioLogueado]);

  const unirse = async (idReto: number) => {
    try {
      const res = await axios.post(`/api/retos/unirse/${idReto}`);
      Swal.fire({ icon: "success", title: "Inscrito", text: res.data.msg, timer: 1500, showConfirmButton: false });
      cargarDatos();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.msg || "Error al inscribirse" });
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
        <div className="spinner-border text-danger" role="status" />
      </div>
    );
  }

  const retosInscritos = new Set(misRetos.map((r: any) => r.ID_RETO));
  const dtoMaximo = Math.max(0, ...retosDisponibles.map((r: any) => Number(r.RECOMPENSA_PORCENTAJE) || 0));
  const totalMeta = misRetos.reduce((acc: number, r: any) => acc + Number(r.META_VALOR) || 0, 0);
  const totalProgreso = misRetos.reduce((acc: number, r: any) => acc + Number(r.PROGRESO) || 0, 0);
  const progresoGlobal = totalMeta > 0 ? Math.round((totalProgreso / totalMeta) * 100) : 0;

  return (
    <div className="retos-page">
      <div className="container retos-wrap">
        <div className="retos-topbar">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => navigate(-1)}>
            <FaArrowLeft className="me-1" /> Volver
          </button>
          <button className="retos-btn-misretos-top" onClick={() => navigate("/mis-retos")}>
            <FaRunning /> Mis retos
            {misRetos.length > 0 && <span className="retos-btn-count">{misRetos.length}</span>}
            <FaChevronRight className="retos-btn-flecha" />
          </button>
        </div>

        {/* ---------- HERO ---------- */}
        <section className="retos-hero">
          <div className="retos-hero-contenido">
            <div className="retos-hero-icono"><FaTrophy /></div>
            <div>
              <h1 className="retos-hero-titulo">RETOS <span>DEPORTIVOS</span></h1>
              <p className="retos-hero-sub">Supera retos, reporta tus avances con foto o video y gana descuentos exclusivos</p>
            </div>
          </div>
          <div className="retos-hero-stats">
            <div className="retos-stat"><strong>{retosDisponibles.length}</strong><span>Retos activos</span></div>
            <div className="retos-stat"><strong>{misRetos.length}</strong><span>Mis retos</span></div>
            <div className="retos-stat"><strong>{dtoMaximo}%</strong><span>Dto. máximo</span></div>
            <div className="retos-stat"><strong>{progresoGlobal}%</strong><span>Progreso global</span></div>
          </div>
        </section>

        {/* ---------- CÓMO FUNCIONA ---------- */}
        <section className="retos-como">
          <div className="retos-como-titulo">¿CÓMO FUNCIONA?</div>
          <div className="retos-como-pasos">
            <div className="retos-paso">
              <span className="retos-paso-num">1</span>
              <span className="retos-paso-icono"><FaUserPlus /></span>
              <div><strong>Inscríbete</strong><span>Elige un reto y únete gratis</span></div>
            </div>
            <div className="retos-paso">
              <span className="retos-paso-num">2</span>
              <span className="retos-paso-icono"><FaCamera /></span>
              <div><strong>Reporta avances</strong><span>Con foto o video, se revisan en 24h</span></div>
            </div>
            <div className="retos-paso">
              <span className="retos-paso-num">3</span>
              <span className="retos-paso-icono"><FaGift /></span>
              <div><strong>Gana tu descuento</strong><span>Completa la meta y recibe tu cupón</span></div>
            </div>
          </div>
        </section>

        {/* ---------- RETOS DISPONIBLES ---------- */}
        {retosDisponibles.length > 0 && (
          <>
            <h4 className="retos-seccion"><FaMedal className="retos-seccion-icono" /> Retos disponibles</h4>
            <div className="retos-grid">
              {retosDisponibles.map((reto) => {
                const tipo = tipoDe(reto.META_TIPO);
                const dias = diasRestantes(reto);
                return (
                  <div className="reto-card" key={reto.ID_RETO}>
                    <div className={`reto-card-top ${tipo.clase}`}>
                      <span className="reto-card-icono">{tipo.icono}</span>
                      <span className="reto-card-tipo">{tipo.etiqueta}</span>
                      {dias && <span className="reto-card-dias">{dias}</span>}
                    </div>
                    <div className="reto-card-body">
                      <h6 className="reto-card-titulo">{reto.TITULO}</h6>
                      <p className="reto-card-desc">{reto.DESCRIPCION}</p>
                      <div className="reto-card-meta">
                        <FaFire /> Meta: {reto.META_VALOR} {reto.META_TIPO}
                        <span className="reto-card-dto">-{reto.RECOMPENSA_PORCENTAJE}% dto.</span>
                      </div>
                      {retosInscritos.has(reto.ID_RETO) ? (
                        <div className="reto-inscrito-wrap">
                          <button className="reto-btn reto-btn-inscrito" disabled>
                            <FaCheckCircle /> Inscrito
                          </button>
                          <button className="reto-btn reto-btn-misretos" onClick={() => navigate("/mis-retos")}>
                            <FaRunning /> Ver mis retos <FaChevronRight />
                          </button>
                        </div>
                      ) : esAdmin ? (
                        <button className="reto-btn reto-btn-visual" disabled>
                          <FaEye /> Solo visualización
                        </button>
                      ) : (
                        <button className="reto-btn reto-btn-unirse" onClick={() => unirse(reto.ID_RETO)}>
                          <FaPlus /> Unirse al reto
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default Retos;