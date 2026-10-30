import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { volverAtras } from "../utils/volverAtras";
import { useAuth } from "../context/AuthContext";
import {
  FaTrophy, FaRunning, FaFire, FaCheckCircle, FaPlus, FaArrowLeft,
  FaEye, FaUserPlus, FaCamera, FaGift, FaMedal, FaChevronRight, FaTimes,
  FaFileContract, FaShieldAlt,
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
  const { usuario, usuarioLogueado, esAdmin } = useAuth();
  const navigate = useNavigate();
  const [retosDisponibles, setRetosDisponibles] = useState<any[]>([]);
  const [misRetos, setMisRetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  // Guía de la página: se abre al llegar a /retos salvo que el usuario marque
  // "No mostrar de nuevo" (se guarda por cuenta en localStorage).
  const [guiaAbierta, setGuiaAbierta] = useState(false);
  const [guiaNoMostrar, setGuiaNoMostrar] = useState(false);
  const [terminosAbiertos, setTerminosAbiertos] = useState(false);

  useEffect(() => {
    if (!usuarioLogueado) return;
    const clave = `jadda_reto_guia_${usuario?.ID_USUARIO ?? "0"}`;
    if (!localStorage.getItem(clave)) setGuiaAbierta(true);
  }, [usuarioLogueado, usuario?.ID_USUARIO]);

  const cerrarGuia = () => {
    if (guiaNoMostrar) {
      localStorage.setItem(`jadda_reto_guia_${usuario?.ID_USUARIO ?? "0"}`, "1");
    }
    setGuiaAbierta(false);
  };

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
  const retosActivos = misRetos.filter((r: any) => !r.COMPLETADO).length;
  const cuposRestantes = Math.max(0, 3 - retosActivos);
  const dtoMaximo = Math.max(0, ...retosDisponibles.map((r: any) => Number(r.RECOMPENSA_PORCENTAJE) || 0));
  const totalMeta = misRetos.reduce((acc: number, r: any) => acc + Number(r.META_VALOR) || 0, 0);
  const totalProgreso = misRetos.reduce((acc: number, r: any) => acc + Number(r.PROGRESO) || 0, 0);
  const progresoGlobal = totalMeta > 0 ? Math.round((totalProgreso / totalMeta) * 100) : 0;

  return (
    <div className="retos-page">
      <div className="container retos-wrap">
        <div className="retos-topbar">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => volverAtras(navigate, "/")}>
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
              <p className="retos-hero-sub">Supera retos, envía capturas de tu app de fitness como evidencia y gana descuentos exclusivos</p>
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
              <div><strong>Reporta avances</strong><span>Sube capturas de tu app de fitness; se revisan en 24h</span></div>
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
            <h4 className="retos-seccion">
              <FaMedal className="retos-seccion-icono" /> Retos disponibles
              {!esAdmin && (
                <span className={`retos-cupos ${cuposRestantes === 0 ? "sin-cupos" : ""}`}>
                  {cuposRestantes === 0 ? "Límite: 3 retos a la vez" : `Cupos: ${cuposRestantes} de 3`}
                </span>
              )}
            </h4>
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

      {/* ---------- MODAL DE INSTRUCCIONES AL LLEGAR ---------- */}
      {guiaAbierta && (
        <div className="retos-guia-overlay" onClick={cerrarGuia}>
          <div className="retos-guia-modal" role="dialog" aria-modal="true" aria-label="Instrucciones de los retos" onClick={(e) => e.stopPropagation()}>
            <div className="retos-guia-hero">
              <div className="retos-guia-hero-icono"><FaTrophy /></div>
              <div className="retos-guia-hero-txt">
                <h5 className="retos-guia-titulo">INSTRUCCIONES DE LOS RETOS</h5>
                <p className="retos-guia-sub">Todo lo que necesitas saber para ganar tus descuentos</p>
              </div>
              <button className="retos-guia-x" onClick={cerrarGuia} aria-label="Cerrar">
                <FaTimes />
              </button>
            </div>
            <div className="retos-guia-cuerpo">
              <div className="retos-guia-paso">
                <span className="retos-guia-num">1</span>
                <div>
                  <strong>Inscríbete gratis</strong>
                  <p>Elige cualquier reto activo de la lista y pulsa «Unirse al reto». Puedes participar en todos los que quieras, uno de cada reto.</p>
                </div>
              </div>
              <div className="retos-guia-paso">
                <span className="retos-guia-num">2</span>
                <div>
                  <strong>Reporta tus avances</strong>
                  <p>En «Mis retos» sube capturas o videos de tu app de fitness o pulsera (hasta 25 MB). Con material, el avance queda «En revisión» y nuestros asesores lo revisan en máximo 24 horas; sin material suma directo.</p>
                </div>
              </div>
              <div className="retos-guia-paso">
                <span className="retos-guia-num">3</span>
                <div>
                  <strong>Completa la meta y gana</strong>
                  <p>Al llegar a la meta recibes un cupón RETO- de un solo uso, válido 30 días y con compra mínima según el porcentaje. Lo encuentras listo para usar en «Mis retos».</p>
                </div>
              </div>
              <ul className="retos-guia-reglas">
                <li>Si un avance es rechazado verás el motivo y puedes volver a enviarlo en cualquier momento.</li>
                  <li>Los cupones se aplican en el checkout con un mínimo de compra (3–10% de descuento).</li>
              </ul>
              <label className="retos-guia-check">
                <input type="checkbox" checked={guiaNoMostrar} onChange={(e) => setGuiaNoMostrar(e.target.checked)} />
                <span>No mostrar de nuevo</span>
              </label>
            </div>
            <div className="retos-guia-pie">
              <button
                type="button"
                className="retos-guia-terminos"
                onClick={() => setTerminosAbiertos(true)}
              >
                <FaFileContract /> Leer términos y condiciones de los retos
              </button>
              <button className="retos-guia-btn" onClick={cerrarGuia}>Entendido</button>
            </div>
          </div>

          {/* ---------- SUBMODAL: TÉRMINOS DE LOS RETOS ---------- */}
          {terminosAbiertos && (
            <div
              className="retos-terminos-overlay"
              onClick={(e) => { e.stopPropagation(); setTerminosAbiertos(false); }}
            >
              <div
                className="retos-termino-modal"
                role="dialog"
                aria-modal="true"
                aria-label="Términos y condiciones de los retos"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="retos-termino-hero">
                  <div className="retos-termino-hero-icono"><FaFileContract /></div>
                  <div className="retos-termino-hero-txt">
                    <h5 className="retos-termino-titulo">TÉRMINOS DE LOS RETOS</h5>
                    <p className="retos-termino-sub">Léelos antes de unirte a un reto</p>
                  </div>
                  <button className="retos-guia-x" onClick={() => setTerminosAbiertos(false)} aria-label="Cerrar">
                    <FaTimes />
                  </button>
                </div>
                <div className="retos-termino-cuerpo">
                  <div className="retos-termino-aviso">
                    <FaShieldAlt />
                    <span>Al aceptar un reto, aceptas automáticamente <strong>la totalidad de estos términos</strong>.</span>
                  </div>
                  <ul className="retos-termino-lista">
                    <li>
                      <strong>Inscripción</strong>
                      <p>Es gratis y solo 1 vez por reto activo; puedes estar en todos los que quieras. La meta se mide por tipo de reto (kilómetros, calorías, minutos, series...).</p>
                    </li>
                    <li>
                      <strong>Evidencias de avance</strong>
                      <p>Sube capturas o videos de tu app de fitness o pulsera (hasta 25 MB por archivo, máx. 5 por avance). Con material queda «En revisión» y el equipo JADDA califica en máximo 24 horas; sin material suma directo. Si se rechaza verás el motivo y tu material se conserva: puedes reenviarlo o eliminarlo.</p>
                    </li>
                    <li>
                      <strong>Recompensa</strong>
                      <p>Cupón RETO-XXXX-XXXX de un solo uso, vigente 30 días, con 3–10% de descuento y compra mínima según porcentaje (10% → $200.000 · 7–9% → $150.000 · 5–6% → $100.000 · 3–4% → $50.000). Se consume al aplicarlo en el checkout.</p>
                    </li>
                    <li>
                      <strong>Fraude</strong>
                      <p>Evidencias imaginarias, editadas o que no correspondan al progreso permiten cancelar el avance o la recompensa; repetirlo puede suspender tu participación en retos.</p>
                    </li>
                  </ul>
                </div>
                <div className="retos-termino-pie">
                  <button className="retos-guia-btn" onClick={() => setTerminosAbiertos(false)}>Entendido</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Retos;