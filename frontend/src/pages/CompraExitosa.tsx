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

function numeroOrdenAlAzar(id: string): number {
  const key = `jadda_orden_${id}`;
  const guardado = Number(localStorage.getItem(key));
  if (guardado) return guardado;
  const nuevo = Math.floor(100000 + Math.random() * 900000);
  localStorage.setItem(key, String(nuevo));
  return nuevo;
}

function CompraExitosa() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { usuario, usuarioLogueado } = useAuth();
  const state = location.state as any;

  const [relacionados, setRelacionados] = useState<ProductoRelacionado[]>([]);

  const [ventaServidor, setVentaServidor] = useState<any>(null);

  const total = state?.total || ventaServidor?.TOTAL || 0;
  const referencia = state?.referencia || ventaServidor?.REFERENCIA_PAGO || "";
  const productos = state?.productos || ventaServidor?.productos || [];
  const planGenerado = state?.planGenerado || ventaServidor?.planGenerado || false;
  const emailUsuario = (usuario as any)?.EMAIL || (usuario as any)?.CORREO || "";

  const [numeroOrden] = useState(() => numeroOrdenAlAzar(id || "0"));

  // Si se refrescó la página (sin location.state), se recupera la venta desde el servidor
  useEffect(() => {
    if (state?.total) return;
    axios
      .get(`/api/compras/${id}`, { withCredentials: true })
      .then((res) => setVentaServidor(res.data))
      .catch(() => {});
  }, [id, state]);

  const [reviewComentario, setReviewComentario] = useState("");
  const [reviewCalificacion, setReviewCalificacion] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [enviandoReview, setEnviandoReview] = useState(false);
  const [reviewEnviado, setReviewEnviado] = useState(false);
  const [reviewProductoIndex, setReviewProductoIndex] = useState(0);

  useEffect(() => {
    const primerId = productos[0]?.ID || productos[0]?.ID_PRODUCTO;
    if (!primerId) return;
    axios.get(`/api/productos/relacionados/${primerId}`)
      .then((res) => setRelacionados(res.data || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productos.length, productos[0]?.ID]);

  const enviarReview = async () => {
    if (!reviewComentario.trim() || reviewCalificacion === 0) return;
    const prod = productos[reviewProductoIndex];
    if (!prod) return;
    const productId = prod.ID || prod.ID_PRODUCTO;
    const nombre = usuario?.NOMBRE_USUARIO?.trim();
    if (!nombre) return;
    setEnviandoReview(true);
    try {
      const res = await fetch(`/api/productos/${productId}/resenas`, {
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
        <div className="compra-exitosa-grid">
          <div className="compra-exitosa-card">
            <div>
              <div className="compra-exitosa-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 12l2 2 4-4" />
                </svg>
              </div>
              <h1 className="compra-exitosa-title">¡Gracias por tu compra!</h1>
              <p className="compra-exitosa-subtitle">Tu pedido ha sido registrado exitosamente</p>
            </div>

            <div>
              {planGenerado && (
                <div className="msg-item msg-plan">
                  <span className="msg-icon">🏋️</span>
                  <span>
                    Por tu compra se ha hecho un <strong>plan personalizado solo para ti</strong>.
                    {" "}
                    <a href="/mis-planes" className="msg-link">Ver mi plan →</a>
                  </span>
                </div>
              )}
              <div className="msg-item msg-info">
                <span className="msg-icon">📧</span>
                <span>
                  Factura enviada a tu correo{emailUsuario ? <> (<strong>{emailUsuario}</strong>)</> : ""}
                </span>
              </div>
              <div className="msg-item msg-info">
                <span className="msg-icon">🔔</span>
                <span>Te avisaremos con el estado de tu pedido</span>
              </div>

              <div className="compra-exitosa-detalles">
                <div className="detalle-item">
                  <span className="detalle-label">Número de orden</span>
                  <span className="detalle-value">#{numeroOrden}</span>
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

              <button className="btn-back-home" onClick={() => navigate("/")}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12l9-9 9 9" />
                  <path d="M5 10v9a1 1 0 001 1h3v-5h6v5h3a1 1 0 001-1v-9" />
                </svg>
                Volver al inicio
              </button>
            </div>
          </div>

          <div className="compra-exitosa-side">
            {usuarioLogueado && productos.length > 0 && (
              <div className="compra-exitosa-panel">
                {!reviewEnviado ? (
                  <div className="panel-review">
                    <h3 className="relacionados-title">📝 Deja tu opinión</h3>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <div className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: "24px", height: "24px", fontSize: "0.75rem", flexShrink: 0 }}>
                        {(usuario?.NOMBRE_USUARIO || "U")[0].toUpperCase()}
                      </div>
                      <span className="fw-bold small">{usuario?.NOMBRE_USUARIO}</span>
                    </div>
                    <div className="d-flex flex-wrap gap-1 mb-1">
                      {productos.map((p: any, i: number) => (
                        <button
                          key={i}
                          className={`btn btn-sm ${reviewProductoIndex === i ? "btn-danger" : "btn-outline-danger"}`}
                          onClick={() => { setReviewProductoIndex(i); setReviewEnviado(false); }}
                        >
                          {p.NOMBRE?.length > 18 ? p.NOMBRE.slice(0, 18) + "..." : p.NOMBRE}
                        </button>
                      ))}
                    </div>
                    <div className="d-flex align-items-center gap-3 mb-1">
                      <div className="d-flex gap-1" style={{ fontSize: "1rem" }}>
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
                      <span className="text-muted small">({productos[reviewProductoIndex]?.NOMBRE?.slice(0, 22)})</span>
                    </div>
                    <textarea
                      className="form-control mb-1"
                      rows={1}
                      placeholder="¿Qué te pareció el producto?"
                      value={reviewComentario}
                      onChange={(e) => setReviewComentario(e.target.value)}
                      style={{ resize: "none" }}
                    />
                    <button
                      className="btn btn-danger w-100 py-1"
                      onClick={enviarReview}
                      disabled={!reviewComentario.trim() || reviewCalificacion === 0 || enviandoReview}
                    >
                      {enviandoReview ? "Enviando..." : "Enviar opinión"}
                    </button>
                  </div>
                ) : (
                  <div className="review-sent-box">
                    <p className="fw-bold text-success mb-0">✅ ¡Opinión enviada! Gracias por tu feedback.</p>
                  </div>
                )}
              </div>
            )}

            {relacionados.length > 0 && (
              <div className="compra-exitosa-panel">
                <h3 className="relacionados-title">✨ También podría interesarte</h3>
                <div className="relacionados-row">
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
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default CompraExitosa;