import "../css/MisCompras.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaArrowLeft, FaBox, FaChevronDown, FaChevronUp, FaEdit, FaSave, FaTruck, FaMapMarkerAlt, FaCreditCard } from "react-icons/fa";

interface Producto {
  ID: number;
  NOMBRE: string;
  IMAGEN: string;
  CANTIDAD: number;
  PRECIO_UNITARIO: number;
  SUBTOTAL: number;
}

interface Compra {
  ID_VENTA: number;
  FECHA_VENTA: string;
  TOTAL: number;
  ESTADO: string;
  REFERENCIA_PAGO: string | null;
  METODO_PAGO: string | null;
  DATOS_PAGO: string | null;
  DIRECCION_ENVIO: string | null;
  CIUDAD: string | null;
  BARRIO: string | null;
  DEPARTAMENTO: string | null;
  CODIGO_POSTAL: string | null;
  TELEFONO_CONTACTO: string | null;
  OBSERVACIONES: string | null;
  ESTADO_ENVIO: string | null;
  productos: Producto[];
}

interface DireccionEdit {
  [ventaId: number]: {
    DIRECCION_ENVIO: string;
    CIUDAD: string;
    BARRIO: string;
    DEPARTAMENTO: string;
    CODIGO_POSTAL: string;
    TELEFONO_CONTACTO: string;
    OBSERVACIONES: string;
  };
}

const STORAGE_KEY = "jadda_direcciones_edit";

function loadDirecciones(): DireccionEdit {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

const estadoEnvioTexto: Record<string, string> = {
  PENDIENTE: "🛒 En camino",
  ENVIADO: "📦 En tránsito",
  ENTREGADO: "✅ Entregado",
  CANCELADO: "❌ Cancelado",
};

const estadoColor: Record<string, string> = {
  COMPLETADA: "#22c55e",
  PENDIENTE: "#f59e0b",
  CANCELADA: "#ef4444",
  ENVIADA: "#3b82f6",
  ENTREGADA: "#16a34a",
};

export default function MisCompras() {
  const navigate = useNavigate();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const [editando, setEditando] = useState<number | null>(null);
  const [dirEdit, setDirEdit] = useState<DireccionEdit>(loadDirecciones);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dirEdit));
  }, [dirEdit]);

  const toggleExpand = (id: number) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    const fetchCompras = async () => {
      try {
        const res = await axios.get("/api/compras", { withCredentials: true });
        setCompras(res.data);
      } catch { console.error("Error al cargar compras");
      } finally { setLoading(false); }
    };
    fetchCompras();
  }, []);

  const getDir = (c: Compra) => dirEdit[c.ID_VENTA] || {
    DIRECCION_ENVIO: c.DIRECCION_ENVIO || "",
    CIUDAD: c.CIUDAD || "",
    BARRIO: c.BARRIO || "",
    DEPARTAMENTO: c.DEPARTAMENTO || "",
    CODIGO_POSTAL: c.CODIGO_POSTAL || "",
    TELEFONO_CONTACTO: c.TELEFONO_CONTACTO || "",
    OBSERVACIONES: c.OBSERVACIONES || "",
  };

  const iniciarEdicion = (id: number) => {
    const c = compras.find(x => x.ID_VENTA === id);
    if (!c) return;
    setDirEdit(prev => ({
      ...prev,
      [id]: { ...getDir(c) }
    }));
    setEditando(id);
  };

  const guardarEdicion = () => {
    setEditando(null);
  };

  const cambiarEdit = (id: number, campo: string, valor: string) => {
    setDirEdit(prev => ({
      ...prev,
      [id]: { ...prev[id], [campo]: valor }
    }));
  };

  return (
    <div className="compras-page">
      <div className="compras-card">
        <div className="comp-header">
          <button className="btn-volver-comp" onClick={() => navigate("/perfil")}>
            <FaArrowLeft /> Volver
          </button>
          <h1><FaBox className="comp-icon-title" /> Mis Compras</h1>
          {!loading && <p className="comp-count">{compras.length} pedidos</p>}
        </div>

        {loading ? (
          <div className="comp-loading">Cargando...</div>
        ) : compras.length === 0 ? (
          <div className="comp-empty">
            <FaBox className="comp-empty-icon" />
            <h3>No tienes compras</h3>
            <p>Aún no has realizado ningún pedido</p>
            <button className="btn-ir-tienda-comp" onClick={() => navigate("/catalogo")}>
              Ir a la tienda
            </button>
          </div>
        ) : (
          <div className="comp-lista">
            {compras.map(compra => {
              const dir = getDir(compra);
              const editandoActual = editando === compra.ID_VENTA;
              let datosPago: any = null;
              try { datosPago = compra.DATOS_PAGO ? JSON.parse(compra.DATOS_PAGO) : null; } catch {}

              return (
                <div key={compra.ID_VENTA} className="comp-item">
                  <div className="comp-item-header" onClick={() => toggleExpand(compra.ID_VENTA)}>
                    <div className="comp-item-info">
                      <div className="comp-item-top">
                        <strong>Pedido #{compra.ID_VENTA}</strong>
                        <span className="comp-estado" style={{ background: estadoColor[compra.ESTADO] || "#94a3b8" }}>
                          {compra.ESTADO}
                        </span>
                      </div>
                      <div className="comp-item-meta">
                        <span>{new Date(compra.FECHA_VENTA).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}</span>
                        <span className="comp-meta-sep">|</span>
                        <span className="comp-total">${compra.TOTAL.toLocaleString("es-CO")}</span>
                      </div>
                    </div>
                    <div className="comp-expand-icon">
                      {expandidos.has(compra.ID_VENTA) ? <FaChevronUp /> : <FaChevronDown />}
                    </div>
                  </div>

                  {expandidos.has(compra.ID_VENTA) && (
                    <div className="comp-detalles">
                      {compra.ESTADO_ENVIO && (
                        <div className="comp-envio-badge">
                          <FaTruck /> {estadoEnvioTexto[compra.ESTADO_ENVIO] || compra.ESTADO_ENVIO}
                        </div>
                      )}

                      <div className="comp-seccion">
                        <h4><FaMapMarkerAlt /> Dirección de envío</h4>
                        {editandoActual ? (
                          <div className="comp-dir-edit">
                            {[
                              { campo: "DIRECCION_ENVIO", label: "Dirección" },
                              { campo: "CIUDAD", label: "Ciudad" },
                              { campo: "BARRIO", label: "Barrio" },
                              { campo: "DEPARTAMENTO", label: "Departamento" },
                              { campo: "CODIGO_POSTAL", label: "Código postal" },
                              { campo: "TELEFONO_CONTACTO", label: "Teléfono" },
                            ].map(({ campo, label }) => (
                              <div className="mb-2" key={campo}>
                                <small>{label}</small>
                                <input type="text" className="form-control form-control-sm" value={(dir as any)[campo] || ""} onChange={(e) => cambiarEdit(compra.ID_VENTA, campo, e.target.value)} />
                              </div>
                            ))}
                            <div className="mb-2">
                              <small>Observaciones</small>
                              <textarea className="form-control form-control-sm" rows={2} value={dir.OBSERVACIONES || ""} onChange={(e) => cambiarEdit(compra.ID_VENTA, "OBSERVACIONES", e.target.value)} />
                            </div>
                            <button className="btn btn-sm btn-success" onClick={guardarEdicion}>
                              <FaSave /> Guardar
                            </button>
                          </div>
                        ) : (
                          <div className="comp-dir-info">
                            <p><strong>Dirección:</strong> {dir.DIRECCION_ENVIO || "—"}</p>
                            <p><strong>Ciudad:</strong> {dir.CIUDAD || "—"}</p>
                            <p><strong>Barrio:</strong> {dir.BARRIO || "—"}</p>
                            <p><strong>Departamento:</strong> {dir.DEPARTAMENTO || "—"}</p>
                            <p><strong>Teléfono:</strong> {dir.TELEFONO_CONTACTO || "—"}</p>
                            {dir.OBSERVACIONES && <p><strong>Obs.:</strong> {dir.OBSERVACIONES}</p>}
                            <button className="btn btn-sm btn-outline-danger mt-1" onClick={() => iniciarEdicion(compra.ID_VENTA)}>
                              <FaEdit /> Editar dirección
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="comp-seccion">
                        <h4><FaCreditCard /> Pago</h4>
                        <p><strong>Método:</strong> {compra.METODO_PAGO || "—"}</p>
                        {compra.REFERENCIA_PAGO && <p><strong>Referencia:</strong> {compra.REFERENCIA_PAGO}</p>}
                        {datosPago && (
                          <p><strong>Datos de pago:</strong> {Object.entries(datosPago).map(([k, v]) => `${k}: ${v}`).join(" | ")}</p>
                        )}
                      </div>

                      <div className="comp-productos">
                        <h4>Productos</h4>
                        {compra.productos.map((prod, idx) => (
                          <div key={idx} className="comp-producto" onClick={() => navigate(`/producto/${prod.ID}`)}>
                            <img src={prod.IMAGEN || "https://via.placeholder.com/60"} alt={prod.NOMBRE} loading="lazy" onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }} />
                            <div className="comp-prod-info">
                              <h4>{prod.NOMBRE}</h4>
                              <span className="comp-prod-cant">x{prod.CANTIDAD}</span>
                            </div>
                            <span className="comp-prod-precio">${prod.SUBTOTAL.toLocaleString("es-CO")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
