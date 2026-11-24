import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import EncabezadoDetalle from "./EncabezadoDetalle";
import "../css/adminDashboard.css";
import {
  FaBoxOpen, FaCalendarAlt, FaCheck, FaEnvelope, FaMapMarkerAlt, FaPhone,
  FaShoppingCart, FaStore, FaTimes, FaUser, FaUserTie,
} from "react-icons/fa";

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eef2f7'/><text x='50%25' y='55%25' font-family='sans-serif' font-size='11' fill='%2394a3b8' text-anchor='middle'>JADDA</text></svg>";

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const fmtMoney = (n: number | null | undefined) => moneda.format(Number(n || 0));

const fechaDia = (f: string | null | undefined) => {
  if (!f) return "—";
  const [y, m, d] = String(f).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    day: "numeric", month: "long", year: "numeric",
  });
};

interface SolicitudVendedor {
  ID_SOLICITUD: number;
  ID_USUARIO: number;
  NOMBRE_EMPRESA: string | null;
  NIT: string | null;
  NOMBRE_REPRESENTANTE: string | null;
  EMAIL_EMPRESA: string;
  TELEFONO: string | null;
  DEPARTAMENTO: string;
  CIUDAD: string;
  DIRECCION: string | null;
  CATEGORIAS: string | null;
  DESCRIPCION: string | null;
  ESTADO: string;
  OBSERVACION_ADMIN: string | null;
  FECHA_CREACION: string;
  FECHA_PROCESADA: string | null;
  SOLICITANTE_NOMBRE: string | null;
  SOLICITANTE_EMAIL: string | null;
  SOLICITANTE_USUARIO: string | null;
  SOLICITANTE_TELEFONO: string | null;
}

interface Vendedor {
  ID_VENDEDOR: number;
  ID_USUARIO: number;
  NOMBRE_EMPRESA: string;
  NIT: string | null;
  EMAIL_VENDEDOR: string | null;
  TELEFONO: string | null;
  DEPARTAMENTO: string | null;
  CIUDAD: string | null;
  DIRECCION: string | null;
  CATEGORIAS: string | null;
  ESTADO: string;
  FECHA_REGISTRO: string | null;
  VENDEDOR_NOMBRE: string | null;
  VENDEDOR_APELLIDO: string | null;
  VENDEDOR_EMAIL: string | null;
}

interface Resumen {
  productosPublicados: number;
  unidadesVendidas: number;
  totalVentas: number;
  totalIngresos: number;
  ticketPromedio: number;
}

interface Producto {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  ESTADO_PUBLICACION: string | null;
  STOCK: number;
  IMAGEN: string | null;
  UNIDADES: number;
  INGRESOS: number;
  PEDIDOS: number;
}

interface VentaReciente {
  ID_VENTA: number;
  FECHA_VENTA: string | null;
  ESTADO: string;
  CLIENTE: string | null;
  CLIENTE_APELLIDO: string | null;
  IMPORTE: number;
}

interface DetalleSolicitud {
  solicitud: SolicitudVendedor;
  vendedor: Vendedor | null;
  resumen: Resumen | null;
  productos: Producto[];
  ventasRecientes: VentaReciente[];
}

const claseEstado = (estado: string) => {
  if (estado === "APROBADA") return "au-badge au-badge-si";
  if (estado === "RECHAZADA") return "au-badge au-badge-no";
  return "au-badge au-badge-progreso";
};

const etiquetaEstado = (estado: string) => (estado === "PENDIENTE" ? "En revisión" : estado);

const clasePublicacion = (estado: string | null) => {
  if (estado === "APROBADO") return "au-badge au-badge-si";
  if (estado === "PENDIENTE") return "au-badge au-badge-progreso";
  return "au-badge au-badge-no";
};

const DetalleVendedorAdmin = () => {
  const { id } = useParams();
  const [datos, setDatos] = useState<DetalleSolicitud | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const res = await fetch(`/api/vendedor/admin/${id}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok || data?.ok === false) throw new Error(data?.msg || "No se pudo cargar la solicitud.");
        if (!cancelado) setDatos(data as DetalleSolicitud);
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : "No se pudo cargar la solicitud.");
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    void cargar();
    return () => { cancelado = true; };
  }, [id, intento]);

  const procesar = async (estado: "APROBADA" | "RECHAZADA") => {
    if (!datos || procesando) return;
    const solicitud = datos.solicitud;
    const esAprobar = estado === "APROBADA";

    const observacion = !esAprobar
      ? await Swal.fire({
          icon: "warning",
          title: "Rechazar solicitud",
          input: "textarea",
          inputPlaceholder: "Explica por qué no se aprueba — el vendedor verá este motivo y podrá intentarlo de nuevo",
          showCancelButton: true,
          confirmButtonText: "Continuar",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#dc3545",
          cancelButtonColor: "#6c757d",
          inputValidator: (v) => {
            const t = (v || "").trim();
            if (!t) return "Debes indicar el motivo del rechazo";
            if (t.length > 500) return "Máximo 500 caracteres";
            return undefined;
          },
        })
      : null;

    if (!esAprobar && !observacion?.isConfirmed) return;

    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: esAprobar ? "¿Aprobar solicitud?" : "¿Confirmar rechazo?",
      html: esAprobar
        ? `Se creará una cuenta de vendedor con el correo <strong>${solicitud.EMAIL_EMPRESA}</strong> y una <strong>contraseña temporal</strong>. Las credenciales se enviarán por correo.`
        : `La solicitud quedará rechazada y el vendedor recibirá por correo el motivo: "<em>${(observacion?.value || "").trim()}</em>". Podrá corregir y volver a enviar.`,
      showCancelButton: true,
      confirmButtonText: esAprobar ? "Sí, aprobar" : "Sí, rechazar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: esAprobar ? "#198754" : "#dc3545",
      cancelButtonColor: "#6c757d",
    });
    if (!isConfirmed) return;

    setProcesando(true);
    try {
      const res = await fetch(`/api/vendedor/admin/${solicitud.ID_SOLICITUD}/procesar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ estado, observacion: observacion?.value || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        await Swal.fire({ icon: "success", title: data.msg, timer: 2000, showConfirmButton: false });
        setIntento((n) => n + 1);
      } else {
        await Swal.fire({ icon: "warning", title: data.msg || "No se pudo procesar la solicitud" });
      }
    } catch {
      await Swal.fire({ icon: "error", title: "Error al procesar la solicitud" });
    } finally {
      setProcesando(false);
    }
  };

  const solicitud = datos?.solicitud;
  const vendedor = datos?.vendedor || null;
  const resumen = datos?.resumen || null;
  const productos = datos?.productos || [];
  const ventasRecientes = datos?.ventasRecientes || [];
  const esPendiente = solicitud?.ESTADO === "PENDIENTE";
  const inicial = (solicitud?.NOMBRE_EMPRESA?.[0] || solicitud?.SOLICITANTE_NOMBRE?.[0] || "V").toUpperCase();

  const contenido = cargando ? (
    <div className="adp-empty">Cargando solicitud...</div>
  ) : error || !datos || !solicitud ? (
    <div className="adp-empty">
      <p>{error || "No se pudo cargar la solicitud."}</p>
      <div className="adp-empty-acciones">
        <button className="au-btn-ver" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        <Link className="au-btn-ver" to="/admin/vendedores">Volver a vendedores</Link>
      </div>
    </div>
  ) : (
    <>
      <EncabezadoDetalle
        icono={<span>{inicial}</span>}
        titulo={solicitud.NOMBRE_EMPRESA || "Vendedor informal"}
        subtitulo={solicitud.SOLICITANTE_USUARIO
          ? `@${solicitud.SOLICITANTE_USUARIO} · ${solicitud.SOLICITANTE_EMAIL}`
          : solicitud.SOLICITANTE_EMAIL || undefined}
        volver={{ to: "/admin/vendedores", label: "Volver a vendedores" }}
        breadcrumb={[
          { label: "Dashboard", to: "/admin" },
          { label: "Vendedores", to: "/admin/vendedores" },
          { label: "Detalle" },
        ]}
        badges={(
          <>
            <span className={claseEstado(solicitud.ESTADO)}>{etiquetaEstado(solicitud.ESTADO)}</span>
            <span className="au-badge">Solicitud de vendedor</span>
          </>
        )}
        acciones={(
          <>
            {solicitud.ID_USUARIO && (
              <Link className="au-btn-ver" to={`/admin/usuarios/${solicitud.ID_USUARIO}`}>
                <FaUser /> Ver usuario
              </Link>
            )}
            {esPendiente && (
              <>
                <button
                  type="button"
                  className="btn btn-success px-3"
                  disabled={procesando}
                  onClick={() => void procesar("APROBADA")}
                >
                  <FaCheck /> Aprobar y enviar credenciales
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger px-3"
                  disabled={procesando}
                  onClick={() => void procesar("RECHAZADA")}
                >
                  <FaTimes /> Rechazar
                </button>
              </>
            )}
          </>
        )}
      />

      {!vendedor && (
        <div className="adp-readonly" role="status">
          Solicitud pendiente: todavía no tiene tienda aprobada
        </div>
      )}

      {solicitud.OBSERVACION_ADMIN && (
        <div className="ad-obs-admin">
          <strong>Observación del administrador:</strong> {solicitud.OBSERVACION_ADMIN}
        </div>
      )}

      <section className="adp-card adp-section">
        <h2 className="adp-section-titulo"><FaUserTie /> Solicitud</h2>
        <div className="au-info-grid">
          <div className="au-dato"><span>Representante legal</span><strong>{solicitud.NOMBRE_REPRESENTANTE || "—"}</strong></div>
          <div className="au-dato"><span>NIT</span><strong>{solicitud.NIT || "— (vendedor informal)"}</strong></div>
          <div className="au-dato"><span>Correo de la empresa</span><strong className="au-dato-email"><FaEnvelope /> {solicitud.EMAIL_EMPRESA}</strong></div>
          <div className="au-dato"><span>Teléfono</span><strong><FaPhone /> {solicitud.TELEFONO || solicitud.SOLICITANTE_TELEFONO || "—"}</strong></div>
          <div className="au-dato">
            <span>Ubicación</span>
            <strong><FaMapMarkerAlt /> {solicitud.CIUDAD}, {solicitud.DEPARTAMENTO}{solicitud.DIRECCION ? ` · ${solicitud.DIRECCION}` : ""}</strong>
          </div>
          <div className="au-dato">
            <span>Solicitud enviada</span>
            <strong><FaCalendarAlt /> {fechaDia(solicitud.FECHA_CREACION)}{solicitud.FECHA_PROCESADA ? ` · procesada ${fechaDia(solicitud.FECHA_PROCESADA)}` : ""}</strong>
          </div>
          {solicitud.CATEGORIAS && (
            <div className="au-dato"><span>Categorías</span><strong>{solicitud.CATEGORIAS}</strong></div>
          )}
        </div>
        {solicitud.DESCRIPCION && (
          <>
            <p className="adp-meta">Descripción del negocio</p>
            <p className="adp-parrafo">{solicitud.DESCRIPCION}</p>
          </>
        )}
      </section>

      {vendedor && (
        <>
          <section className="adp-card adp-section">
            <h2 className="adp-section-titulo"><FaStore /> Cuenta de vendedor</h2>
            <div className="au-info-grid">
              <div className="au-dato"><span>Tienda</span><strong>{vendedor.NOMBRE_EMPRESA}</strong></div>
              <div className="au-dato"><span>Estado</span><strong>{vendedor.ESTADO}</strong></div>
              <div className="au-dato"><span>Correo</span><strong className="au-dato-email"><FaEnvelope /> {vendedor.EMAIL_VENDEDOR || vendedor.VENDEDOR_EMAIL || "—"}</strong></div>
              <div className="au-dato"><span>Teléfono</span><strong>{vendedor.TELEFONO || "—"}</strong></div>
              <div className="au-dato"><span>Ubicación</span><strong>{[vendedor.CIUDAD, vendedor.DEPARTAMENTO].filter(Boolean).join(", ") || "—"}</strong></div>
              <div className="au-dato"><span>Registrada el</span><strong>{fechaDia(vendedor.FECHA_REGISTRO)}</strong></div>
              {vendedor.CATEGORIAS && (
                <div className="au-dato"><span>Categorías</span><strong>{vendedor.CATEGORIAS}</strong></div>
              )}
            </div>
          </section>

          <div className="adp-grid adp-section">
            <div className="adp-kpi">
              <span className="adp-kpi-label">Productos publicados</span>
              <span className="adp-kpi-valor">{resumen?.productosPublicados ?? 0}</span>
            </div>
            <div className="adp-kpi">
              <span className="adp-kpi-label">Unidades vendidas</span>
              <span className="adp-kpi-valor">{resumen?.unidadesVendidas ?? 0}</span>
            </div>
            <div className="adp-kpi">
              <span className="adp-kpi-label">Ventas</span>
              <span className="adp-kpi-valor">{resumen?.totalVentas ?? 0}</span>
            </div>
            <div className="adp-kpi">
              <span className="adp-kpi-label">Ingresos</span>
              <span className="adp-kpi-valor">{fmtMoney(resumen?.totalIngresos)}</span>
            </div>
            <div className="adp-kpi">
              <span className="adp-kpi-label">Ticket promedio</span>
              <span className="adp-kpi-valor">{fmtMoney(resumen?.ticketPromedio)}</span>
            </div>
          </div>

          <section className="adp-card adp-section">
            <h2 className="adp-section-titulo"><FaBoxOpen /> Productos ({productos.length})</h2>
            {productos.length === 0 ? (
              <p className="adp-empty">Esta tienda aún no tiene productos publicados.</p>
            ) : (
              <div className="adp-tabla-wrap">
                <table className="adp-tabla">
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Precio</th>
                      <th>Stock</th>
                      <th>Estado</th>
                      <th>Unidades</th>
                      <th>Pedidos</th>
                      <th>Ingresos generados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((p) => (
                      <tr key={p.ID}>
                        <td>
                          <div className="adp-item-producto">
                            <img
                              src={p.IMAGEN || PLACEHOLDER_IMG}
                              alt={p.NOMBRE}
                              loading="lazy"
                              onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                            />
                            <strong>{p.NOMBRE}</strong>
                          </div>
                        </td>
                        <td>{fmtMoney(p.PRECIO)}</td>
                        <td>{p.STOCK}</td>
                        <td><span className={clasePublicacion(p.ESTADO_PUBLICACION)}>{p.ESTADO_PUBLICACION || "Sin estado"}</span></td>
                        <td>{p.UNIDADES}</td>
                        <td>{p.PEDIDOS}</td>
                        <td>{fmtMoney(p.INGRESOS)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="adp-card adp-section">
            <h2 className="adp-section-titulo"><FaShoppingCart /> Ventas recientes</h2>
            {ventasRecientes.length === 0 ? (
              <p className="adp-empty">Sin ventas registradas para esta tienda.</p>
            ) : (
              <div className="adp-tabla-wrap">
                <table className="adp-tabla">
                  <thead>
                    <tr>
                      <th>Pedido</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th>Cliente</th>
                      <th>Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventasRecientes.map((v) => (
                      <tr key={v.ID_VENTA}>
                        <td>#{v.ID_VENTA}</td>
                        <td>{fechaDia(v.FECHA_VENTA)}</td>
                        <td>{v.ESTADO}</td>
                        <td>{[v.CLIENTE, v.CLIENTE_APELLIDO].filter(Boolean).join(" ") || "Cliente"}</td>
                        <td>{fmtMoney(v.IMPORTE)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </>
  );

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="adp-page">
          {contenido}
        </div>
      </div>
      <AdminFooter />
    </div>
  );
};

export default DetalleVendedorAdmin;
