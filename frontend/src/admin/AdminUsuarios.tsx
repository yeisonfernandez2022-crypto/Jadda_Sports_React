import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import {
  FaArrowLeft, FaBoxes, FaBoxOpen, FaBuilding, FaCreditCard,
  FaEnvelope, FaEye, FaHeart, FaHome, FaMapMarkerAlt, FaPhone, FaSearch,
  FaShoppingCart, FaStore, FaTrophy, FaUser, FaCalendarAlt, FaReceipt,
} from "react-icons/fa";
import { numeroPedido } from "../utils/numeroPedido";

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eef2f7'/><text x='50%25' y='55%25' font-family='sans-serif' font-size='11' fill='%2394a3b8' text-anchor='middle'>JADDA</text></svg>";

const AdminUsuarios = () => {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [detalle, setDetalle] = useState<any>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState<number | null>(null);
  const [grupoAbierto, setGrupoAbierto] = useState<{ compras: boolean; retos: boolean }>({ compras: true, retos: true });
  const [verMas, setVerMas] = useState<{ compras: boolean; retos: boolean }>({ compras: false, retos: false });
  const [filtroCompra, setFiltroCompra] = useState("");
  const [filtroEstadoCompra, setFiltroEstadoCompra] = useState("todos");
  const [filtroReto, setFiltroReto] = useState("");
  const [filtroEstadoReto, setFiltroEstadoReto] = useState("todos");

  const fetchUsuarios = async () => {
    try {
      const res = await fetch("/api/admin/usuarios", { credentials: "include" });
      const data = await res.json();
      setUsuarios(Array.isArray(data) ? data : []);
    } catch {
      console.error("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuarios(); }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return usuarios;
    return usuarios.filter((u) =>
      `${u.NOMBRE_USUARIO || ""} ${u.APELLIDO_USUARIO || ""} ${u.EMAIL || ""} ${u.USUARIO || ""}`.toLowerCase().includes(q)
    );
  }, [usuarios, busqueda]);

  const verUsuario = async (id: number) => {
    setCargandoDetalle(id);
    try {
      const res = await fetch(`/api/admin/usuarios/${id}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Error");
      setDetalle(data);
      setVerMas({ compras: false, retos: false });
      setFiltroCompra("");
      setFiltroEstadoCompra("todos");
      setFiltroReto("");
      setFiltroEstadoReto("todos");
      setGrupoAbierto({ compras: true, retos: true });
    } catch {
      setDetalle({ error: "No se pudo cargar el detalle del usuario." });
    } finally {
      setCargandoDetalle(null);
    }
  };

  const claseRol = (idRol: number) =>
    idRol === 1 ? "au-rol-admin" : idRol === 2 ? "au-rol-cliente" : idRol === 3 ? "au-rol-asesor" : idRol === 6 ? "au-rol-vendedor" : "au-rol-otro";

  const d = detalle?.usuario;
  const fmtMoney = (n: number) => `$${Number(n || 0).toLocaleString("es-CO")}`;
  const esVendedor = d?.ID_ROL === 6;

  const comprasLista = useMemo(() => {
    const lista: any[] = detalle?.compras || [];
    const q = filtroCompra.trim().toLowerCase();
    return lista.filter((c) => {
      if (filtroEstadoCompra !== "todos") {
        const v = String(c.ESTADO || "").toLowerCase();
        if (filtroEstadoCompra === "enviada") {
          if (v !== "completada" && v !== "enviada" && v !== "confirmada") return false;
        } else if (v !== filtroEstadoCompra) return false;
      }
      if (!q) return true;
      return (
        String(numeroPedido(c.ID_VENTA)).includes(q) ||
        String(c.PRODUCTOS_NOMBRES || "").toLowerCase().includes(q) ||
        String(c.METODO_PAGO || "").toLowerCase().includes(q)
      );
    });
  }, [detalle, filtroCompra, filtroEstadoCompra]);

  const retosLista = useMemo(() => {
    const lista: any[] = detalle?.retos || [];
    const q = filtroReto.trim().toLowerCase();
    return lista.filter((r) => {
      if (filtroEstadoReto !== "todos") {
        const completado = Number(r.COMPLETADO) === 1;
        if (filtroEstadoReto === "completado" && !completado) return false;
        if (filtroEstadoReto === "progreso" && completado) return false;
      }
      if (!q) return true;
      return String(r.TITULO || "").toLowerCase().includes(q);
    });
  }, [detalle, filtroReto, filtroEstadoReto]);

  const visibles = (lista: any[], ver: boolean) => (ver ? lista : lista.slice(0, 5));

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="au-wrap">
          <div className="au-header-col">
            <button className="admin-volver" onClick={() => navigate("/admin")}>
              <FaArrowLeft /> Volver al Dashboard
            </button>
            <Breadcrumb items={[{ label: "Dashboard", to: "/admin" }, { label: "Usuarios" }]} />
            <div className="au-titulos">
              <h1>Usuarios</h1>
              <p>Gestiona los usuarios registrados</p>
            </div>
          </div>

          <div className="au-toolbar">
            <div className="ap-search au-search">
              <FaSearch />
              <input
                type="text"
                placeholder="Buscar por nombre, email o usuario..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <span className="ap-count">{filtrados.length} usuario{filtrados.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="au-vacio">Cargando usuarios...</div>
          ) : filtrados.length === 0 ? (
            <div className="au-vacio">
              <FaUser style={{ fontSize: "2rem", color: "#94a3b8" }} />
              <p>{usuarios.length === 0 ? "No hay usuarios registrados" : "No se encontraron resultados"}</p>
            </div>
          ) : (
            <div className="au-tabla-wrap">
              <table className="au-tabla">
                <thead>
                  <tr>
                    <th className="au-col-usuario">Usuario</th>
                    <th className="au-col-nombre">Nombre</th>
                    <th className="au-col-email">Correo</th>
                    <th className="au-col-rol">Rol</th>
                    <th className="au-col-fecha">Fecha registro</th>
                    <th className="au-col-ver">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => (
                    <tr key={u.ID_USUARIO}>
                      <td className="au-col-usuario">
                        <div className="au-usuario">
                          <div className="au-avatar">
                            {u.NOMBRE_USUARIO?.[0] || <FaUser size={13} />}
                          </div>
                          <span className="au-usuario-nombre" title={u.USUARIO}>{u.USUARIO}</span>
                        </div>
                      </td>
                      <td className="au-col-nombre" title={`${u.NOMBRE_USUARIO || ""} ${u.APELLIDO_USUARIO || ""}`}>
                        {u.NOMBRE_USUARIO} {u.APELLIDO_USUARIO}
                      </td>
                      <td className="au-col-email" title={u.EMAIL}>{u.EMAIL}</td>
                      <td className="au-col-rol">
                        <span className={`au-rol ${claseRol(u.ID_ROL)}`}>{u.NOMBRE_ROL || "Sin rol"}</span>
                      </td>
                      <td className="au-col-fecha">
                        {u.FECHA_REGISTRO ? new Date(u.FECHA_REGISTRO).toLocaleDateString("es-CO") : "-"}
                      </td>
                      <td className="au-col-ver">
                        <button className="au-btn-ver" onClick={() => verUsuario(u.ID_USUARIO)} disabled={cargandoDetalle === u.ID_USUARIO}>
                          <FaEye /> {cargandoDetalle === u.ID_USUARIO ? "Cargando..." : "Ver usuario"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {detalle && (
        <div className="au-backdrop" onClick={() => setDetalle(null)}>
          <div className="au-modal" onClick={(e) => e.stopPropagation()}>
            {detalle.error ? (
              <div className="au-modal-error">
                <p>{detalle.error}</p>
                <button className="au-btn-cerrar" onClick={() => setDetalle(null)}>Cerrar</button>
              </div>
            ) : d ? (
              <>
                <button className="au-modal-x" onClick={() => setDetalle(null)}>✕</button>

                <div className="au-modal-hero">
                  <div className="au-modal-avatar">
                    {d.NOMBRE_USUARIO?.[0] || <FaUser size={22} />}
                  </div>
                  <div className="au-modal-hero-info">
                    <h2>{d.NOMBRE_USUARIO} {d.APELLIDO_USUARIO}</h2>
                    <p className="au-modal-usuario">@{d.USUARIO}</p>
                    <div className="au-modal-badges">
                      <span className={`au-rol ${claseRol(d.ID_ROL)}`}>{d.NOMBRE_ROL || "Sin rol"}</span>
                      {d.CONFIRMADO ? (
                        <span className="au-badge au-badge-si">Verificado</span>
                      ) : (
                        <span className="au-badge au-badge-no">No verificado</span>
                      )}
                    </div>
                  </div>
                  <div className="au-modal-stats">
                    {esVendedor ? (
                      <>
                        <div className="au-stat"><FaBoxOpen /> <strong>{detalle.stats?.productosPublicados ?? 0}</strong><span>Artículos</span></div>
                        <div className="au-stat"><FaBoxes /> <strong>{detalle.stats?.unidadesVendidas ?? 0}</strong><span>Unidades vendidas</span></div>
                        <div className="au-stat"><FaShoppingCart /> <strong>{detalle.stats?.totalVentas ?? 0}</strong><span>Ventas</span></div>
                        <div className="au-stat au-stat-money"><strong>{fmtMoney(detalle.stats?.totalIngresos)}</strong><span>Ingresos</span></div>
                      </>
                    ) : (
                      <>
                        <div className="au-stat"><FaBoxOpen /> <strong>{detalle.stats?.totalCompras ?? 0}</strong><span>Compras</span></div>
                        <div className="au-stat"><FaHeart /> <strong>{detalle.stats?.totalFavoritos ?? 0}</strong><span>Favoritos</span></div>
                        <div className="au-stat"><FaTrophy /> <strong>{detalle.stats?.totalRetos ?? 0}</strong><span>Retos</span></div>
                        <div className="au-stat au-stat-money"><strong>{fmtMoney(detalle.stats?.totalGastado)}</strong><span>Gastado</span></div>
                      </>
                    )}
                  </div>
                </div>

                <div className="au-modal-body">
                  <div className="au-seccion">
                    <h3><FaUser /> Información personal</h3>
                    <div className="au-info-grid">
                      <div className="au-dato"><span>Correo</span><strong className="au-dato-email"><FaEnvelope /> {d.EMAIL}</strong></div>
                      <div className="au-dato"><span>Teléfono</span><strong>{d.TELEFONO || "-"}</strong></div>
                      <div className="au-dato"><span>Documento</span><strong>{d.TIPO_DOCUMENTO ? `${d.TIPO_DOCUMENTO} ${d.NUMERO_DOCUMENTO || ""}` : "-"}</strong></div>
                      <div className="au-dato"><span>Proveedor de acceso</span><strong>{d.AUTH_PROVIDER || "local"}</strong></div>
                      <div className="au-dato"><span>Fecha de registro</span><strong>{d.FECHA_REGISTRO ? new Date(d.FECHA_REGISTRO).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : "-"}</strong></div>
                      <div className="au-dato"><span>Última conexión</span><strong>{d.ULTIMA_CONEXION ? `${new Date(d.ULTIMA_CONEXION).toLocaleString("es-CO")}${d.ULTIMA_UBICACION ? ` · ${d.ULTIMA_UBICACION}` : ""}` : "Sin registros"}</strong></div>
                      {d.DEBE_CAMBIAR_PASSWORD === 1 && (
                        <div className="au-aviso-pass">Debe cambiar su contraseña</div>
                      )}
                    </div>
                  </div>

                  {!esVendedor && (
                    <>
                      <div className="au-seccion">
                        <h3 className="au-grupo-titulo" onClick={() => setGrupoAbierto((g) => ({ ...g, compras: !g.compras }))}>
                          <span><FaShoppingCart /> Compras ({detalle.compras?.length ?? 0})</span>
                          <span className={`au-grupo-chevron ${grupoAbierto.compras ? "abierto" : ""}`}>▾</span>
                        </h3>
                        {grupoAbierto.compras && (
                          <>
                            <div className="au-grupo-toolbar">
                              <input
                                value={filtroCompra}
                                onChange={(e) => setFiltroCompra(e.target.value)}
                                placeholder="Buscar por pedido, producto o método..."
                              />
                              <select value={filtroEstadoCompra} onChange={(e) => setFiltroEstadoCompra(e.target.value)}>
                                <option value="todos">Todos los estados</option>
                                <option value="completada">Completada</option>
                                <option value="pendiente">Pendiente</option>
                                <option value="cancelada">Cancelada</option>
                                <option value="enviada">Enviada / Confirmada</option>
                              </select>
                            </div>
                            {comprasLista.length === 0 ? (
                              <p className="au-vacio-mini">
                                {detalle.compras?.length ? "Sin resultados con esos filtros" : "Sin compras registradas"}
                              </p>
                            ) : (
                              <div className="au-lista-compras">
                                {visibles(comprasLista, verMas.compras).map((c: any) => (
                                  <div key={c.ID_VENTA} className="au-tarjeta-compra">
                                    <div className="au-tarjeta-compra-titulo">
                                      <strong>Pedido #{numeroPedido(c.ID_VENTA)}</strong>
                                      <span className={`au-badge-estado ${String(c.ESTADO).toLowerCase()}`}>{c.ESTADO}</span>
                                    </div>
                                    <p className="au-venta-meta">
                                      <FaCalendarAlt /> {new Date(c.FECHA_VENTA).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                                      {" "}· {c.TOTAL_ARTICULOS} artículo(s) · {c.METODO_PAGO || "—"}
                                      {c.ESTADO_ENVIO ? ` · Envío: ${c.ESTADO_ENVIO}` : ""}
                                    </p>
                                    <p className="au-compra-productos" title={c.PRODUCTOS_NOMBRES || ""}>
                                      {c.PRODUCTOS_NOMBRES || "Sin productos"}
                                    </p>
                                    <div className="au-venta-total">
                                      <span>Total</span>
                                      <strong>{fmtMoney(c.TOTAL)}</strong>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {comprasLista.length > 5 && (
                              <button className="au-btn-vermas" onClick={() => setVerMas((v) => ({ ...v, compras: !v.compras }))}>
                                {verMas.compras ? "Ver menos" : `Ver más (${comprasLista.length - 5})`}
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      <div className="au-seccion">
                        <h3 className="au-grupo-titulo" onClick={() => setGrupoAbierto((g) => ({ ...g, retos: !g.retos }))}>
                          <span><FaTrophy /> Retos ({detalle.retos?.length ?? 0})</span>
                          <span className={`au-grupo-chevron ${grupoAbierto.retos ? "abierto" : ""}`}>▾</span>
                        </h3>
                        {grupoAbierto.retos && (
                          <>
                            <div className="au-grupo-toolbar">
                              <input
                                value={filtroReto}
                                onChange={(e) => setFiltroReto(e.target.value)}
                                placeholder="Buscar reto..."
                              />
                              <select value={filtroEstadoReto} onChange={(e) => setFiltroEstadoReto(e.target.value)}>
                                <option value="todos">Todos los estados</option>
                                <option value="progreso">En progreso</option>
                                <option value="completado">Completados</option>
                              </select>
                            </div>
                            {retosLista.length === 0 ? (
                              <p className="au-vacio-mini">
                                {detalle.retos?.length ? "Sin resultados con esos filtros" : "No está inscrito en retos"}
                              </p>
                            ) : (
                              <div className="au-lista-compras">
                                {visibles(retosLista, verMas.retos).map((r: any) => {
                                  const pct = Math.min(100, Math.round((Number(r.PROGRESO) / Math.max(1, Number(r.META_VALOR))) * 100));
                                  return (
                                    <div key={r.ID_RETO_USUARIO} className="au-tarjeta-compra">
                                      <div className="au-tarjeta-compra-titulo">
                                        <strong>{r.TITULO}</strong>
                                        {Number(r.COMPLETADO) === 1 ? (
                                          <span className="au-badge au-badge-si">Completado</span>
                                        ) : (
                                          <span className="au-badge au-badge-progreso">En progreso</span>
                                        )}
                                      </div>
                                      <p className="au-venta-meta">
                                        <FaTrophy /> {r.PROGRESO}/{r.META_VALOR} {r.META_TIPO} · Premio {r.RECOMPENSA_PORCENTAJE}%
                                        {Number(r.EVIDENCIAS_PENDIENTES) > 0 ? ` · ${r.EVIDENCIAS_PENDIENTES} avance(s) en revisión` : ""}
                                        {r.CUPON_GENERADO ? ` · Cupón: ${r.CUPON_GENERADO}` : ""}
                                      </p>
                                      <div className="au-reto-barra">
                                        <div style={{ width: `${pct}%` }} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            {retosLista.length > 5 && (
                              <button className="au-btn-vermas" onClick={() => setVerMas((v) => ({ ...v, retos: !v.retos }))}>
                                {verMas.retos ? "Ver menos" : `Ver más (${retosLista.length - 5})`}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {detalle.vendedor && (
                    <div className="au-seccion">
                      <h3><FaStore /> Información de la empresa</h3>
                      <div className="au-info-grid">
                        <div className="au-dato"><span>Empresa</span><strong className="au-dato-email"><FaBuilding /> {detalle.vendedor.NOMBRE_EMPRESA}</strong></div>
                        <div className="au-dato"><span>NIT</span><strong>{detalle.vendedor.NIT || "-"}</strong></div>
                        <div className="au-dato"><span>Correo de empresa</span><strong className="au-dato-email"><FaEnvelope /> {detalle.vendedor.EMAIL_VENDEDOR || "-"}</strong></div>
                        <div className="au-dato"><span>Categorías</span><strong>{detalle.vendedor.CATEGORIAS || "-"}</strong></div>
                        <div className="au-dato"><span>Ubicación</span><strong>{detalle.vendedor.CIUDAD || "-"}{detalle.vendedor.DEPARTAMENTO ? `, ${detalle.vendedor.DEPARTAMENTO}` : ""}</strong></div>
                        <div className="au-dato"><span>Teléfono</span><strong>{detalle.vendedor.TELEFONO || "-"}</strong></div>
                        {detalle.vendedor.DIRECCION && <div className="au-dato"><span>Dirección</span><strong>{detalle.vendedor.DIRECCION}</strong></div>}
                        <div className="au-dato"><span>Aprobado desde</span><strong>{detalle.vendedor.FECHA_REGISTRO ? new Date(detalle.vendedor.FECHA_REGISTRO).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }) : "-"}</strong></div>
                      </div>
                    </div>
                  )}

                  {detalle.vendedor && (
                    <div className="au-seccion">
                      <h3><FaReceipt /> Registro de ventas ({detalle.ventas?.length ?? 0})</h3>
                      {!detalle.ventas || detalle.ventas.length === 0 ? (
                        <p className="au-vacio-mini">Sin ventas registradas</p>
                      ) : (
                        <div className="au-lista-ventas">
                          {detalle.ventas.map((ven: any) => (
                            <div key={ven.ID_VENTA} className="au-tarjeta-venta">
                              <div className="au-tarjeta-venta-titulo">
                                <strong>Pedido #{numeroPedido(ven.ID_VENTA)}</strong>
                                <span className={`au-badge-estado ${String(ven.ESTADO).toLowerCase()}`}>{ven.ESTADO}</span>
                              </div>
                              <p className="au-venta-meta">
                                <FaCalendarAlt /> {new Date(ven.FECHA_VENTA).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                                {ven.CLIENTE ? ` · Cliente: ${ven.CLIENTE}` : ""}
                              </p>
                              {ven.items.map((it: any, i: number) => (
                                <div key={i} className="au-venta-item">
                                  <img src={it.IMAGEN || PLACEHOLDER_IMG} alt={it.NOMBRE} loading="lazy" onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }} />
                                  <div>
                                    <strong>{it.NOMBRE}</strong>
                                    <span>{[it.COLOR, it.ATRIBUTO].filter(Boolean).join(" · ")}{it.CANTIDAD ? ` · ×${it.CANTIDAD}` : ""}</span>
                                  </div>
                                  <span className="au-venta-item-total">{fmtMoney(it.SUBTOTAL)}</span>
                                </div>
                              ))}
                              <div className="au-venta-total">
                                <span>Total del pedido</span>
                                <strong>{fmtMoney(ven.TOTAL)}</strong>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="au-seccion">
                    <h3><FaMapMarkerAlt /> Direcciones ({detalle.direcciones.length})</h3>
                    {detalle.direcciones.length === 0 ? (
                      <p className="au-vacio-mini">Sin direcciones guardadas</p>
                    ) : (
                      <div className="au-lista-dir">
                        {detalle.direcciones.map((dir: any) => (
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
                  </div>

                  <div className="au-seccion">
                    <h3><FaCreditCard /> Métodos de pago ({detalle.metodos.length})</h3>
                    {detalle.metodos.length === 0 ? (
                      <p className="au-vacio-mini">Sin métodos de pago guardados</p>
                    ) : (
                      <div className="au-lista-metodos">
                        {detalle.metodos.map((m: any) => (
                          <div key={m.ID} className="au-tarjeta-metodo">
                            <div className="au-tarjeta-metodo-titulo">
                              <strong>{m.NOMBRE_METODO}</strong>
                              {m.ES_PRINCIPAL === 1 && <span className="au-badge au-badge-si">Principal</span>}
                            </div>
                            <p>{m.TITULAR ? `Titular: ${m.TITULAR}` : ""}{m.BANCO ? ` · ${m.BANCO}` : ""}</p>
                            <p>{[m.TIPO, m.TELEFONO].filter(Boolean).join(" · ") || "—"}</p>
                            {m.FECHA_CREADO && <small>{new Date(m.FECHA_CREADO).toLocaleDateString("es-CO")}</small>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      <AdminFooter />
    </div>
  );
};

export default AdminUsuarios;