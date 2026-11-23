import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import EncabezadoDetalle from "./EncabezadoDetalle";
import "../css/adminDashboard.css";
import {
  FaCalendarAlt, FaChevronDown, FaCreditCard, FaEnvelope,
  FaHome, FaMapMarkerAlt, FaPhone, FaReceipt, FaSearch,
  FaShoppingCart, FaStore, FaTrophy, FaUser,
} from "react-icons/fa";
import { numeroPedido } from "../utils/numeroPedido";

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eef2f7'/><text x='50%25' y='55%25' font-family='sans-serif' font-size='11' fill='%2394a3b8' text-anchor='middle'>JADDA</text></svg>";

const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const fmtMoney = (n: number | null | undefined) => moneda.format(Number(n || 0));

const fechaDia = (f: string | null | undefined) => {
  if (!f) return "-";
  const [y, m, d] = String(f).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "-";
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    day: "numeric", month: "long", year: "numeric",
  });
};

const fechaHora = (f: string | null | undefined) => {
  if (!f) return "Sin registros";
  const fecha = new Date(f);
  return Number.isNaN(fecha.getTime()) ? "Sin registros" : fecha.toLocaleString("es-CO");
};

const claseRol = (idRol: number) =>
  idRol === 1 ? "au-rol-admin" : idRol === 2 ? "au-rol-cliente" : idRol === 3 ? "au-rol-asesor" : idRol === 6 ? "au-rol-vendedor" : "au-rol-otro";

interface ItemCompra {
  ID_VENTA: number;
  CANTIDAD: number;
  PRECIO_UNITARIO: number;
  SUBTOTAL: number;
  NOMBRE: string;
  ID_VENDEDOR: number | null;
  VENDEDOR_NOMBRE?: string | null;
  IMAGEN?: string | null;
  COLOR?: string | null;
  NOMBRE_ATRIBUTO?: string | null;
  ATRIBUTO?: string | null;
}

export interface Compra {
  ID_VENTA: number;
  ESTADO: string;
  FECHA_VENTA: string | null;
  TOTAL_ARTICULOS: number;
  METODO_PAGO?: string | null;
  ESTADO_ENVIO?: string | null;
  PRODUCTOS_NOMBRES?: string | null;
  TOTAL: number;
  TOTAL_PEDIDO?: number | null;
  REFERENCIA_PAGO?: string | null;
  ENVIO_DIRECCION?: string | null;
  ENVIO_BARRIO?: string | null;
  ENVIO_CIUDAD?: string | null;
  ENVIO_DEPARTAMENTO?: string | null;
  ENVIO_CODIGO_POSTAL?: string | null;
  ENVIO_TELEFONO?: string | null;
  COSTO_ENVIO?: number | null;
  items?: ItemCompra[];
}

interface Reto {
  ID_RETO_USUARIO: number;
  TITULO: string;
  PROGRESO: number;
  META_VALOR: number;
  META_TIPO: string;
  COMPLETADO: number;
  RECOMPENSA_PORCENTAJE?: number | null;
  EVIDENCIAS_PENDIENTES?: number | null;
  CUPON_GENERADO?: string | null;
}

interface Direccion {
  ID_DIRECCION: number;
  ETIQUETA?: string | null;
  ES_PRINCIPAL?: number | null;
  DIRECCION: string;
  BARRIO?: string | null;
  CIUDAD: string;
  DEPARTAMENTO: string;
  CODIGO_POSTAL?: string | null;
  TELEFONO_CONTACTO?: string | null;
}

interface MetodoPago {
  ID: number;
  NOMBRE_METODO: string;
  ES_PRINCIPAL?: number | null;
  TITULAR?: string | null;
  BANCO?: string | null;
  TIPO?: string | null;
  TELEFONO?: string | null;
  FECHA_CREADO?: string | null;
}

export interface Vendedor {
  ID_VENDEDOR: number;
  ID_SOLICITUD: number;
  NOMBRE_EMPRESA: string;
  NIT?: string | null;
  EMAIL_VENDEDOR?: string | null;
  TELEFONO?: string | null;
  DEPARTAMENTO?: string | null;
  CIUDAD?: string | null;
  CATEGORIAS?: string | null;
  ESTADO?: string | null;
  FECHA_REGISTRO?: string | null;
}

interface Stats {
  totalCompras?: number;
  totalGastado?: number;
  totalFavoritos?: number;
  totalRetos?: number;
  productosPublicados?: number;
  unidadesVendidas?: number;
  totalVentas?: number;
  totalIngresos?: number;
}

interface DetalleUsuario {
  usuario: {
    ID_USUARIO: number;
    NOMBRE_USUARIO: string;
    APELLIDO_USUARIO?: string | null;
    EMAIL: string;
    USUARIO: string;
    TELEFONO?: string | null;
    TIPO_DOCUMENTO?: string | null;
    NUMERO_DOCUMENTO?: string | null;
    FECHA_REGISTRO?: string | null;
    ID_ROL: number;
    NOMBRE_ROL?: string | null;
    CONFIRMADO?: number | null;
    AUTH_PROVIDER?: string | null;
    DEBE_CAMBIAR_PASSWORD?: number | null;
    ULTIMA_CONEXION?: string | null;
    ULTIMA_UBICACION?: string | null;
  };
  stats?: Stats;
  compras?: Compra[];
  retos?: Reto[];
  direcciones?: Direccion[];
  metodos?: MetodoPago[];
  vendedor?: Vendedor | null;
}

const DetalleUsuarioAdmin = () => {
  const { id } = useParams();
  const [datos, setDatos] = useState<DetalleUsuario | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [abiertas, setAbiertas] = useState<number[]>([]);
  const [filtro, setFiltro] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

  useEffect(() => {
    let cancelado = false;
    const cargar = async () => {
      setCargando(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/usuarios/${id}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.msg || "No se pudo cargar el detalle del usuario.");
        if (!cancelado) {
          setDatos(data);
          setAbiertas([]);
        }
      } catch (err) {
        if (!cancelado) {
          setError(err instanceof Error ? err.message : "No se pudo cargar el detalle del usuario.");
        }
      } finally {
        if (!cancelado) setCargando(false);
      }
    };
    void cargar();
    return () => { cancelado = true; };
  }, [id, intento]);

  const usuario = datos?.usuario;
  const compras = datos?.compras || [];
  const retos = datos?.retos || [];
  const direcciones = datos?.direcciones || [];
  const metodos = datos?.metodos || [];
  const stats = datos?.stats || {};
  const vendedor = datos?.vendedor;

  const comprasFiltradas = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return compras.filter((c) => {
      if (filtroEstado !== "todos") {
        const estado = String(c.ESTADO || "").toLowerCase();
        if (filtroEstado === "enviada") {
          if (estado !== "enviada" && estado !== "confirmada") return false;
        } else if (filtroEstado === "pendiente") {
          if (estado !== "pendiente" && estado !== "pendiente_pago") return false;
        } else if (estado !== filtroEstado) {
          return false;
        }
      }
      if (!q) return true;
      const texto = [
        numeroPedido(c.ID_VENTA),
        c.PRODUCTOS_NOMBRES || "",
        c.METODO_PAGO || "",
        ...(c.items || []).map((item) => `${item.NOMBRE} ${item.VENDEDOR_NOMBRE || ""}`),
      ].join(" ").toLowerCase();
      return texto.includes(q);
    });
  }, [compras, filtro, filtroEstado]);

  const alternarCompra = (idVenta: number) => {
    setAbiertas((prev) => (prev.includes(idVenta) ? prev.filter((x) => x !== idVenta) : [...prev, idVenta]));
  };

  const nombre = usuario ? `${usuario.NOMBRE_USUARIO || ""} ${usuario.APELLIDO_USUARIO || ""}`.trim() : "Detalle de usuario";
  const inicial = (usuario?.NOMBRE_USUARIO?.[0] || "?").toUpperCase();

  const contenido = cargando ? (
    <div className="adp-empty">Cargando usuario...</div>
  ) : error || !datos || !usuario ? (
    <div className="adp-empty">
      <p>{error || "No se pudo cargar el detalle del usuario."}</p>
      <div className="adp-empty-acciones">
        <button className="au-btn-ver" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
        <Link className="au-btn-ver" to="/admin/usuarios">Volver a usuarios</Link>
      </div>
    </div>
  ) : (
    <>
      <EncabezadoDetalle
        icono={<span>{inicial}</span>}
        titulo={nombre}
        subtitulo={`@${usuario.USUARIO} · ${usuario.EMAIL}`}
        volver={{ to: "/admin/usuarios", label: "Volver a usuarios" }}
        breadcrumb={[
          { label: "Dashboard", to: "/admin" },
          { label: "Usuarios", to: "/admin/usuarios" },
          { label: "Detalle" },
        ]}
        badges={(
          <>
            <span className={`au-rol ${claseRol(usuario.ID_ROL)}`}>{usuario.NOMBRE_ROL || "Sin rol"}</span>
            {usuario.CONFIRMADO ? (
              <span className="au-badge au-badge-si">Verificado</span>
            ) : (
              <span className="au-badge au-badge-no">No verificado</span>
            )}
            {usuario.AUTH_PROVIDER && usuario.AUTH_PROVIDER !== "local" && (
              <span className="au-badge">{usuario.AUTH_PROVIDER}</span>
            )}
          </>
        )}
      />

      <div className="adp-grid adp-section">
        <div className="adp-kpi">
          <span className="adp-kpi-label">Compras</span>
          <span className="adp-kpi-valor">{stats.totalCompras ?? 0}</span>
        </div>
        <div className="adp-kpi">
          <span className="adp-kpi-label">Gastado</span>
          <span className="adp-kpi-valor">{fmtMoney(stats.totalGastado)}</span>
        </div>
        <div className="adp-kpi">
          <span className="adp-kpi-label">Favoritos</span>
          <span className="adp-kpi-valor">{stats.totalFavoritos ?? 0}</span>
        </div>
        <div className="adp-kpi">
          <span className="adp-kpi-label">Retos</span>
          <span className="adp-kpi-valor">{stats.totalRetos ?? 0}</span>
        </div>
      </div>

      {vendedor && (
        <section className="adp-card adp-section">
          <h2 className="adp-section-titulo"><FaStore /> Actividad como vendedor</h2>
          <p className="adp-meta">
            {vendedor.NOMBRE_EMPRESA} · {vendedor.ESTADO || "Sin estado"}
            {vendedor.CIUDAD ? ` · ${vendedor.CIUDAD}${vendedor.DEPARTAMENTO ? `, ${vendedor.DEPARTAMENTO}` : ""}` : ""}
          </p>
          <div className="adp-grid">
            <div className="adp-kpi">
              <span className="adp-kpi-label">Productos publicados</span>
              <span className="adp-kpi-valor">{stats.productosPublicados ?? 0}</span>
            </div>
            <div className="adp-kpi">
              <span className="adp-kpi-label">Unidades vendidas</span>
              <span className="adp-kpi-valor">{stats.unidadesVendidas ?? 0}</span>
            </div>
            <div className="adp-kpi">
              <span className="adp-kpi-label">Ventas</span>
              <span className="adp-kpi-valor">{stats.totalVentas ?? 0}</span>
            </div>
            <div className="adp-kpi">
              <span className="adp-kpi-label">Ingresos</span>
              <span className="adp-kpi-valor">{fmtMoney(stats.totalIngresos)}</span>
            </div>
          </div>
          <Link className="au-btn-ver" to={`/admin/vendedores/${vendedor.ID_SOLICITUD}`}>
            <FaStore /> Ver ficha del vendedor
          </Link>
        </section>
      )}

      <section className="adp-card adp-section">
        <h2 className="adp-section-titulo"><FaUser /> Información personal</h2>
        <div className="au-info-grid">
          <div className="au-dato"><span>Correo</span><strong className="au-dato-email"><FaEnvelope /> {usuario.EMAIL}</strong></div>
          <div className="au-dato"><span>Teléfono</span><strong>{usuario.TELEFONO || "-"}</strong></div>
          <div className="au-dato"><span>Documento</span><strong>{usuario.TIPO_DOCUMENTO ? `${usuario.TIPO_DOCUMENTO} ${usuario.NUMERO_DOCUMENTO || ""}` : "-"}</strong></div>
          <div className="au-dato"><span>Proveedor de acceso</span><strong>{usuario.AUTH_PROVIDER || "local"}</strong></div>
          <div className="au-dato"><span>Fecha de registro</span><strong>{fechaDia(usuario.FECHA_REGISTRO)}</strong></div>
          <div className="au-dato"><span>Última conexión</span><strong>{usuario.ULTIMA_CONEXION ? `${fechaHora(usuario.ULTIMA_CONEXION)}${usuario.ULTIMA_UBICACION ? ` · ${usuario.ULTIMA_UBICACION}` : ""}` : "Sin registros"}</strong></div>
          {usuario.DEBE_CAMBIAR_PASSWORD === 1 && (
            <div className="au-aviso-pass">Debe cambiar su contraseña</div>
          )}
        </div>
      </section>

      <section className="adp-card adp-section">
        <h2 className="adp-section-titulo"><FaShoppingCart /> Compras ({compras.length})</h2>
        {compras.length === 0 ? (
          <p className="adp-empty">Sin compras registradas</p>
        ) : (
          <>
            <div className="adp-filtros">
              <div className="ap-search">
                <FaSearch />
                <input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar por pedido, producto o método..."
                />
              </div>
              <select
                className="admin-select"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                aria-label="Filtrar compras por estado"
              >
                <option value="todos">Todos los estados</option>
                <option value="completada">Completada</option>
                <option value="pendiente">Pendiente / Sin pago</option>
                <option value="cancelada">Cancelada</option>
                <option value="enviada">Enviada / Confirmada</option>
              </select>
              <span className="ap-count">{comprasFiltradas.length} compra{comprasFiltradas.length !== 1 ? "s" : ""}</span>
            </div>

            {comprasFiltradas.length === 0 ? (
              <p className="adp-empty">Sin resultados con esos filtros</p>
            ) : (
              comprasFiltradas.map((c) => {
                const abierta = abiertas.includes(c.ID_VENTA);
                return (
                  <article className="adp-compra" key={c.ID_VENTA}>
                    <div className="adp-compra-head">
                      <div className="adp-compra-titulo">
                        <strong>Pedido #{numeroPedido(c.ID_VENTA)}</strong>
                        <span className={`au-badge-estado ${String(c.ESTADO).toLowerCase()}`}>{c.ESTADO}</span>
                      </div>
                      <div className="adp-compra-meta">
                        <span><FaCalendarAlt /> {fechaDia(c.FECHA_VENTA)}</span>
                        <span>{c.TOTAL_ARTICULOS} artículo(s)</span>
                        <span>{c.METODO_PAGO || "—"}</span>
                        <strong>{fmtMoney(c.TOTAL_PEDIDO ?? c.TOTAL)}</strong>
                      </div>
                      <button
                        type="button"
                        className="au-btn-ver"
                        aria-expanded={abierta}
                        aria-controls={`compra-detalle-${c.ID_VENTA}`}
                        onClick={() => alternarCompra(c.ID_VENTA)}
                      >
                        <FaChevronDown className={abierta ? "adp-chevron adp-chevron--abierto" : "adp-chevron"} />
                        Ver detalle de la compra {c.ID_VENTA}
                      </button>
                    </div>

                    {abierta && (
                      <div className="adp-compra-body" id={`compra-detalle-${c.ID_VENTA}`}>
                        <div className="adp-tabla-wrap">
                          <table className="adp-tabla">
                            <thead>
                              <tr>
                                <th>Producto</th>
                                <th>Variante</th>
                                <th>Cantidad</th>
                                <th>Precio unitario</th>
                                <th>Subtotal</th>
                                <th>Origen</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(c.items || []).length === 0 ? (
                                <tr><td colSpan={6}>Sin ítems registrados</td></tr>
                              ) : (
                                (c.items || []).map((item, i) => (
                                  <tr key={`${item.NOMBRE}-${i}`}>
                                    <td>
                                      <div className="adp-item-producto">
                                        <img
                                          src={item.IMAGEN || PLACEHOLDER_IMG}
                                          alt={item.NOMBRE}
                                          loading="lazy"
                                          onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                                        />
                                        <strong>{item.NOMBRE}</strong>
                                      </div>
                                    </td>
                                    <td>{[item.COLOR, item.ATRIBUTO].filter(Boolean).join(" · ") || "—"}</td>
                                    <td>{item.CANTIDAD}</td>
                                    <td>{fmtMoney(item.PRECIO_UNITARIO)}</td>
                                    <td>{fmtMoney(item.SUBTOTAL)}</td>
                                    <td>{item.ID_VENDEDOR == null ? "JADDA" : (item.VENDEDOR_NOMBRE || "Tienda")}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        <div className="adp-grid adp-detalle-compra">
                          <div className="adp-pago">
                            <h3><FaReceipt /> Pago</h3>
                            <p>Método: <strong>{c.METODO_PAGO || "—"}</strong></p>
                            <p>Referencia: <strong>{c.REFERENCIA_PAGO || "—"}</strong></p>
                            <p>Estado del pedido: <strong>{c.ESTADO}</strong></p>
                            <p>Total del pedido: <strong>{fmtMoney(c.TOTAL_PEDIDO ?? c.TOTAL)}</strong></p>
                          </div>

                          <div className="adp-envio">
                            <h3><FaMapMarkerAlt /> Envío</h3>
                            {!c.ENVIO_DIRECCION ? (
                              <p>Sin datos de envío</p>
                            ) : (
                              <>
                                <p><FaHome /> {c.ENVIO_DIRECCION}{c.ENVIO_BARRIO ? ` (${c.ENVIO_BARRIO})` : ""}</p>
                                <p><FaMapMarkerAlt /> {[c.ENVIO_CIUDAD, c.ENVIO_DEPARTAMENTO].filter(Boolean).join(", ")}{c.ENVIO_CODIGO_POSTAL ? ` · CP ${c.ENVIO_CODIGO_POSTAL}` : ""}</p>
                                {c.ENVIO_TELEFONO && <p><FaPhone /> {c.ENVIO_TELEFONO}</p>}
                                <p>Estado del envío: <strong>{c.ESTADO_ENVIO || "—"}</strong></p>
                                <p>Costo de envío: <strong>{fmtMoney(c.COSTO_ENVIO)}</strong></p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </>
        )}
      </section>

      <section className="adp-card adp-section">
        <h2 className="adp-section-titulo"><FaTrophy /> Retos ({retos.length})</h2>
        {retos.length === 0 ? (
          <p className="adp-empty">No está inscrito en retos</p>
        ) : (
          <div className="adp-items">
            {retos.map((reto) => {
              const pct = Math.min(100, Math.round((Number(reto.PROGRESO) / Math.max(1, Number(reto.META_VALOR))) * 100));
              return (
                <div className="au-tarjeta-compra" key={reto.ID_RETO_USUARIO}>
                  <div className="au-tarjeta-compra-titulo">
                    <strong>{reto.TITULO}</strong>
                    {Number(reto.COMPLETADO) === 1 ? (
                      <span className="au-badge au-badge-si">Completado</span>
                    ) : (
                      <span className="au-badge au-badge-progreso">En progreso</span>
                    )}
                  </div>
                  <p className="au-venta-meta">
                    <FaTrophy /> {reto.PROGRESO}/{reto.META_VALOR} {reto.META_TIPO}
                    {reto.RECOMPENSA_PORCENTAJE ? ` · Premio ${reto.RECOMPENSA_PORCENTAJE}%` : ""}
                    {Number(reto.EVIDENCIAS_PENDIENTES) > 0 ? ` · ${reto.EVIDENCIAS_PENDIENTES} avance(s) en revisión` : ""}
                    {reto.CUPON_GENERADO ? ` · Cupón: ${reto.CUPON_GENERADO}` : ""}
                  </p>
                  <div className="au-reto-barra">
                    <div style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="adp-card adp-section">
        <h2 className="adp-section-titulo"><FaMapMarkerAlt /> Direcciones ({direcciones.length})</h2>
        {direcciones.length === 0 ? (
          <p className="adp-empty">Sin direcciones guardadas</p>
        ) : (
          <div className="au-lista-dir">
            {direcciones.map((dir) => (
              <div key={dir.ID_DIRECCION} className="au-tarjeta-dir">
                <div className="au-tarjeta-dir-titulo">
                  <strong>{dir.ETIQUETA || "Dirección"}</strong>
                  {dir.ES_PRINCIPAL === 1 && <span className="au-badge au-badge-si">Principal</span>}
                </div>
                <p><FaHome /> {dir.DIRECCION}{dir.BARRIO ? ` (${dir.BARRIO})` : ""}</p>
                <p><FaMapMarkerAlt /> {dir.CIUDAD}, {dir.DEPARTAMENTO}{dir.CODIGO_POSTAL ? ` · CP ${dir.CODIGO_POSTAL}` : ""}</p>
                {dir.TELEFONO_CONTACTO && <p><FaPhone /> {dir.TELEFONO_CONTACTO}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="adp-card adp-section">
        <h2 className="adp-section-titulo"><FaCreditCard /> Métodos de pago ({metodos.length})</h2>
        {metodos.length === 0 ? (
          <p className="adp-empty">Sin métodos de pago guardados</p>
        ) : (
          <div className="au-lista-metodos">
            {metodos.map((metodo) => (
              <div key={metodo.ID} className="au-tarjeta-metodo">
                <div className="au-tarjeta-metodo-titulo">
                  <strong>{metodo.NOMBRE_METODO}</strong>
                  {metodo.ES_PRINCIPAL === 1 && <span className="au-badge au-badge-si">Principal</span>}
                </div>
                <p>{metodo.TITULAR ? `Titular: ${metodo.TITULAR}` : ""}{metodo.BANCO ? ` · ${metodo.BANCO}` : ""}</p>
                <p>{[metodo.TIPO, metodo.TELEFONO].filter(Boolean).join(" · ") || "—"}</p>
                {metodo.FECHA_CREADO && <small>{fechaDia(metodo.FECHA_CREADO)}</small>}
              </div>
            ))}
          </div>
        )}
      </section>
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

export default DetalleUsuarioAdmin;
