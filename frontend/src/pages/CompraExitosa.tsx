import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import "../css/CompraExitosa.css";

interface ProductoRelacionado {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  URL_IMAGEN: string;
}

function CompraExitosa() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { usuario, usuarioLogueado } = useAuth();
  const state = location.state as any;

  const [relacionados, setRelacionados] = useState<ProductoRelacionado[]>([]);

  const total = state?.total || 0;
  const referencia = state?.referencia || "";
  const productos = state?.productos || [];
  const planGenerado = state?.planGenerado || false;

  const [reviewComentario, setReviewComentario] = useState("");
  const [reviewCalificacion, setReviewCalificacion] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [enviandoReview, setEnviandoReview] = useState(false);
  const [reviewEnviado, setReviewEnviado] = useState(false);
  const [reviewProductoIndex, setReviewProductoIndex] = useState(0);

  useEffect(() => {
    if (productos.length > 0) {
      const primerId = productos[0].ID || productos[0].ID_PRODUCTO;
      axios.get(`http://localhost:5000/api/productos/relacionados/${primerId}`)
        .then((res) => setRelacionados(res.data || []))
        .catch(() => {});
    }
  }, [productos]);

  const enviarReview = async () => {
    if (!reviewComentario.trim() || reviewCalificacion === 0) return;
    const prod = productos[reviewProductoIndex];
    if (!prod) return;
    const productId = prod.ID || prod.ID_PRODUCTO;
    const nombre = usuario?.NOMBRE_USUARIO?.trim();
    if (!nombre) return;
    setEnviandoReview(true);
    try {
      const res = await fetch(`http://localhost:5000/api/productos/${productId}/resenas`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comentario: reviewComentario.trim(),
          calificacion: reviewCalificacion,
        }),
      });
      if (res.ok) {
        setReviewEnviado(true);
        setReviewComentario("");
        setReviewCalificacion(0);
      }
    } catch (err) {
      console.error("Error al enviar review:", err);
    } finally {
      setEnviandoReview(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="compra-exitosa-container">
        <div className="compra-exitosa-card">
          <div className="compra-exitosa-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 12l2 2 4-4" />
            </svg>
          </div>
          <h1 className="compra-exitosa-title">¡Gracias por tu compra!</h1>
          <p className="compra-exitosa-subtitle">Tu pedido ha sido registrado exitosamente</p>

          <div className="compra-exitosa-detalles">
            <div className="detalle-item">
              <span className="detalle-label">Número de orden</span>
              <span className="detalle-value">#{id}</span>
            </div>
            {referencia && (
              <div className="detalle-item">
                <span className="detalle-label">Referencia de pago</span>
                <span className="detalle-value">{referencia}</span>
              </div>
            )}
            <div className="detalle-item">
              <span className="detalle-label">Total pagado</span>
              <span className="detalle-value total-value">${Number(total).toLocaleString("es-CO")}</span>
            </div>
          </div>

          {planGenerado && (
            <a
              href="/mis-planes"
              className="d-flex align-items-center gap-3 p-3 rounded text-white text-decoration-none mb-3"
              style={{ background: "linear-gradient(135deg, #e73737, #c52d2d)" }}
            >
              <span style={{ fontSize: "2rem" }}>🏋️</span>
              <div>
                <div className="fw-bold">¡Plan de entrenamiento disponible!</div>
                <small>Hemos generado un plan personalizado según tu compra. Ver plan →</small>
              </div>
            </a>
          )}

          {usuarioLogueado && productos.length > 0 && !reviewEnviado && (
            <>
              <hr className="my-4" />
              <h3 className="relacionados-title">Deja tu opinión</h3>
              <div className="d-flex align-items-center gap-2 mb-3 justify-content-center">
                <div className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: "32px", height: "32px", fontSize: "0.85rem" }}>
                  {(usuario?.NOMBRE_USUARIO || "U")[0].toUpperCase()}
                </div>
                <span className="fw-bold">{usuario?.NOMBRE_USUARIO}</span>
              </div>

              <div className="d-flex flex-wrap gap-2 justify-content-center mb-3">
                {productos.map((p: any, i: number) => (
                  <button
                    key={i}
                    className={`btn btn-sm ${reviewProductoIndex === i ? "btn-danger" : "btn-outline-danger"}`}
                    onClick={() => { setReviewProductoIndex(i); setReviewEnviado(false); }}
                  >
                    {p.NOMBRE?.length > 20 ? p.NOMBRE.slice(0, 20) + "..." : p.NOMBRE}
                  </button>
                ))}
              </div>

              <p className="text-muted small mb-2">
                Opinando sobre: <strong>{productos[reviewProductoIndex]?.NOMBRE}</strong>
              </p>

              <div className="d-flex gap-1 fs-4 justify-content-center mb-3">
                {[1, 2, 3, 4, 5].map(star => (
                  <span
                    key={star}
                    style={{ cursor: "pointer", color: star <= (reviewHover || reviewCalificacion) ? "#e63946" : "#ccc", transition: "color 0.15s" }}
                    onClick={() => setReviewCalificacion(star)}
                    onMouseEnter={() => setReviewHover(star)}
                    onMouseLeave={() => setReviewHover(0)}
                  >
                    ★
                  </span>
                ))}
              </div>

              <textarea
                className="form-control mb-3"
                rows={3}
                placeholder="¿Qué te pareció este producto?"
                value={reviewComentario}
                onChange={(e) => setReviewComentario(e.target.value)}
              />

              <button
                className="btn btn-danger w-100"
                onClick={enviarReview}
                disabled={!reviewComentario.trim() || reviewCalificacion === 0 || enviandoReview}
              >
                {enviandoReview ? "Enviando..." : "Enviar opinión"}
              </button>
            </>
          )}

          {reviewEnviado && (
            <div className="mt-4 p-3 bg-light border rounded text-center">
              <p className="fw-bold text-success mb-0">¡Opinión enviada! Gracias por tu feedback.</p>
            </div>
          )}

          <button className="btn-back-home" onClick={() => navigate("/")}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12l9-9 9 9" />
              <path d="M5 10v9a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1v-9" />
            </svg>
            Volver al inicio
          </button>

          {relacionados.length > 0 && (
            <>
              <hr className="my-3" />
              <h3 className="relacionados-title">También podría interesarte</h3>
              <div className="relacionados-grid">
                {relacionados.map((p) => (
                  <div key={p.ID} className="relacionado-card" onClick={() => navigate(`/producto/${p.ID}`)}>
                    <div className="relacionado-img-wrapper">
                      <img src={p.URL_IMAGEN} alt={p.NOMBRE} loading="lazy" onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }} />
                    </div>
                    <h4>{p.NOMBRE}</h4>
                    <span className="relacionado-precio">${Number(p.PRECIO).toLocaleString("es-CO")}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default CompraExitosa;
