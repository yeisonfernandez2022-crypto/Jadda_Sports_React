import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  FaArrowLeft, FaTrophy, FaRunning, FaMedal, FaCheckCircle, FaChevronRight,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { verEvidenciasReto, reportarAvanceReto } from "../utils/retosAvances.tsx";
import MisRetoCard from "../components/MisRetoCard";
import "../css/Retos.css";

function MisRetos() {
  const { esAdmin } = useAuth();
  const navigate = useNavigate();
  const [retos, setRetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    try {
      const res = await axios.get("/api/retos/mis-retos");
      setRetos(res.data);
    } catch {
      /* sesión inválida → ProtectedRoute redirige */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  const enProgreso = retos.filter((r: any) => !r.COMPLETADO);
  const completados = retos.filter((r: any) => r.COMPLETADO);
  const dtoMaximo = Math.max(0, ...retos.map((r: any) => Number(r.RECOMPENSA_PORCENTAJE) || 0));
  const cuponesGanados = completados.filter((r: any) => r.CUPON_GENERADO).length;

  const renderCard = (r: any) => (
    <MisRetoCard
      key={r.ID_RETO_USUARIO}
      reto={r}
      esAdmin={esAdmin}
      onVerAvances={(x) => verEvidenciasReto(x, cargarDatos)}
      onReportar={(x, restante) => reportarAvanceReto(x.ID_RETO_USUARIO, restante, x.META_TIPO, cargarDatos)}
    />
  );

  return (
    <div className="retos-page">
      <div className="container retos-wrap">
        <button className="btn btn-outline-secondary btn-sm mb-3" onClick={() => navigate("/retos")}>
          <FaArrowLeft className="me-1" /> Volver a retos
        </button>

        {/* ---------- HERO ---------- */}
        <section className="retos-hero">
          <div className="retos-hero-contenido">
            <div className="retos-hero-icono"><FaRunning /></div>
            <div>
              <h1 className="retos-hero-titulo">MIS <span>RETOS</span></h1>
              <p className="retos-hero-sub">Todos los retos en los que estás inscrito, tu progreso y los que ya completaste</p>
            </div>
          </div>
          <div className="retos-hero-stats">
            <div className="retos-stat"><strong>{enProgreso.length}</strong><span>En progreso</span></div>
            <div className="retos-stat"><strong>{completados.length}</strong><span>Completados</span></div>
            <div className="retos-stat"><strong>{cuponesGanados}</strong><span>Cupones ganados</span></div>
            <div className="retos-stat"><strong>{dtoMaximo}%</strong><span>Dto. máximo</span></div>
          </div>
        </section>

        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-danger" role="status" />
          </div>
        ) : retos.length === 0 ? (
          <div className="mis-vacio">
            <FaTrophy />
            <p className="m-0">Aún no te has inscrito a ningún reto</p>
            <button className="reto-btn reto-btn-unirse mt-3 mx-auto" style={{ maxWidth: 260 }} onClick={() => navigate("/retos")}>
              Ver retos disponibles <FaChevronRight />
            </button>
          </div>
        ) : (
          <>
            {enProgreso.length > 0 && (
              <>
                <h4 className="retos-seccion"><FaRunning className="retos-seccion-icono" /> Retos en progreso</h4>
                <div className="mis-grid">
                  {enProgreso.map(renderCard)}
                </div>
              </>
            )}

            {completados.length > 0 && (
              <>
                <h4 className="retos-seccion" style={{ marginTop: 30 }}>
                  <FaMedal className="retos-seccion-icono" /> Retos completados
                </h4>
                <div className="mis-grid">
                  {completados.map(renderCard)}
                </div>
              </>
            )}

            {completados.length > 0 && (
              <div className="mis-cupon-band">
                <FaCheckCircle /> {completados.length} reto{completados.length !== 1 ? "s" : ""} completado{completados.length !== 1 ? "s" : ""}
                {cuponesGanados > 0 ? ` — ya tienes ${cuponesGanados} cupón${cuponesGanados !== 1 ? "es" : ""} de descuento. Úsalos en el checkout.` : ""}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default MisRetos;