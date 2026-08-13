import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { FaEye, FaExternalLinkAlt, FaPalette, FaTag } from "react-icons/fa";
import AdminNavbar from "./AdminNavbar";
import SubirImagenes from "./SubirImagenes";
import { navegarConGuardia, setGuardiaNavegacion } from "../utils/navigationGuard";
import "../css/adminDashboard.css";
import "../css/editarProducto.css";

interface Caracteristica {
  propiedad: string;
  valor: string;
}

interface Variante {
  ID_VARIANTE?: number;
  COLOR: string;
  NOMBRE_ATRIBUTO: string;
  ATRIBUTO: string;
  STOCK: number;
}

const tiposAtributo = ["Talla", "Peso", "Capacidad", "Longitud", "Diámetro", "Voltaje", "Potencia", "Resistencia"];

const GaleriaAdmin = ({
  urls, activa, onCambiar, principal = true,
}: {
  urls: string[];
  activa: number;
  onCambiar?: (i: number) => void;
  principal?: boolean;
}) => (
  <div>
    {principal && (
      urls[activa] ? (
        <img src={urls[activa]} alt="Imagen principal" className="pp-galeria-principal" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <div className="pp-galeria-vacia">Sin imagen</div>
      )
    )}
    {urls.length > (principal ? 1 : 0) && (
      <div className="pp-galeria-thumbs">
        {urls.map((u, i) => (
          <div key={`${u}-${i}`} className={`pp-thumb ${i === activa ? "activa" : ""}`} onClick={() => onCambiar?.(i)} title={`Imagen ${i + 1}${i === 0 ? " — portada" : ""}`}>
            <img src={u} alt={`Imagen ${i + 1}`} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <span className={`pp-thumb-num ${i === 0 ? "portada" : ""}`}>{i === 0 ? "Portada" : i + 1}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const EditarProductoAdmin = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [categorias, setCategorias] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [descuentos, setDescuentos] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [precio, setPrecio] = useState("");
  const [idCategoria, setIdCategoria] = useState<number | string>("");
  const [idProveedor, setIdProveedor] = useState<number | string>("");
  const [idDescuento, setIdDescuento] = useState<number | string>("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenesUrls, setImagenesUrls] = useState<string[]>([]);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [caracteristicas, setCaracteristicas] = useState<Caracteristica[]>([]);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [dirty, setDirty] = useState(false);
  const snapshotRef = useRef("");
  const permitirSalidaRef = useRef(false);

  useEffect(() => {
    setPreviewIdx(0);
  }, [imagenesUrls]);

  const cargarProducto = async () => {
    if (!id) return;
    Promise.all([
      fetch(`/api/productos/${id}`).then(r => r.json()),
      fetch(`/api/productos/${id}/caracteristicas`).then(r => r.json()),
    ]).then(([prodData, carData]) => {
      setNombre(prodData.NOMBRE || "");
      setMarca(prodData.MARCA || "");
      setPrecio(prodData.PRECIO?.toString() || "");
      setIdCategoria(prodData.ID_CATEGORIA || "");
      setIdProveedor(prodData.ID_PROVEEDOR || "");
      setIdDescuento(prodData.ID_DESCUENTO || "");
      setDescripcion(prodData.DESCRIPCION || "");
      setImagenesUrls((prodData.IMAGENES || []).map((img: any) => img.url).filter(Boolean));

      const vars: Variante[] = (prodData.VARIANTES || []).map((v: any) => ({
        ID_VARIANTE: v.ID_VARIANTE,
        COLOR: v.COLOR || "",
        NOMBRE_ATRIBUTO: tiposAtributo.includes(v.NOMBRE_ATRIBUTO) ? v.NOMBRE_ATRIBUTO : v.NOMBRE_ATRIBUTO || "",
        ATRIBUTO: v.ATRIBUTO || "",
        STOCK: Number(v.STOCK) || 0,
      }));
      setVariantes(vars.length > 0 ? vars : [{ COLOR: "", NOMBRE_ATRIBUTO: "", ATRIBUTO: "", STOCK: 0 }]);

      const chars = Array.isArray(carData) ? carData : [];
      const newChars = chars
        .filter((c: any) => c.NOMBRE_ATRIBUTO !== "Color")
        .map((c: any) => ({ propiedad: c.NOMBRE_ATRIBUTO || "", valor: c.VALOR_ATRIBUTO || "" }));

      snapshotRef.current = JSON.stringify({
        nombre: prodData.NOMBRE || "",
        marca: prodData.MARCA || "",
        precio: prodData.PRECIO?.toString() || "",
        idCategoria: prodData.ID_CATEGORIA || "",
        idProveedor: prodData.ID_PROVEEDOR || "",
        idDescuento: prodData.ID_DESCUENTO || "",
        descripcion: prodData.DESCRIPCION || "",
        imagenesUrls: (prodData.IMAGENES || []).map((img: any) => img.url).filter(Boolean),
        variantes: vars,
        caracteristicas: newChars,
      });

      setCaracteristicas(newChars);

      setLoaded(true);
    }).catch(() => {
      Swal.fire("Error", "No se pudo cargar el producto", "error");
    });
  };

  useEffect(() => {
    if (!id) return;
    Promise.all([
      fetch("/api/productos/categorias").then(r => r.json()),
      fetch("/api/productos/descuentos").then(r => r.json()),
      fetch("/api/proveedores").then(r => r.json()),
    ]).then(([cats, descs, provs]) => {
      setCategorias(cats);
      setDescuentos(descs);
      setProveedores(provs);
    }).catch(() => {});
    cargarProducto();
  }, [id]);

  useEffect(() => {
    if (!loaded) return;
    const actual = JSON.stringify({
      nombre, marca, precio, idCategoria, idProveedor, idDescuento, descripcion,
      imagenesUrls, variantes, caracteristicas,
    });
    setDirty(actual !== snapshotRef.current);
  }, [loaded, nombre, marca, precio, idCategoria, idProveedor, idDescuento, descripcion, imagenesUrls, variantes, caracteristicas]);

  const confirmarSalida = async (): Promise<boolean> => {
    const result = await Swal.fire({
      title: "Cambios sin guardar",
      text: "Si sales de esta página perderás los cambios de la sesión de edición actual.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Salir sin guardar",
      cancelButtonText: "Seguir editando",
      confirmButtonColor: "#d33",
      reverseButtons: true,
    });
    return result.isConfirmed;
  };

  useEffect(() => {
    if (dirty) {
      setGuardiaNavegacion(confirmarSalida);
    } else {
      setGuardiaNavegacion(null);
    }
    return () => setGuardiaNavegacion(null);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onPop = () => {
      if (permitirSalidaRef.current) return;
      history.pushState(null, "", window.location.href);
      confirmarSalida().then((ok) => {
        if (ok) {
          permitirSalidaRef.current = true;
          window.history.back();
        }
      });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) permitirSalidaRef.current = false;
  }, [dirty]);

  const iniciarEdicion = () => {
    setEditing(true);
  };

  const cancelarEdicion = async () => {
    if (dirty) {
      if (!(await confirmarSalida())) return;
      permitirSalidaRef.current = false;
    }
    setEditing(false);
    cargarProducto();
  };

  const eliminarProducto = () => {
    Swal.fire({
      title: "¿Eliminar este producto?",
      text: "Esta acción no se puede deshacer. Se borrarán imágenes, variantes y características asociadas.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await fetch(`/api/productos/${id}`, { method: "DELETE" });
          if (res.ok) {
            Swal.fire("¡Eliminado!", "El producto ha sido borrado.", "success");
            navegarConGuardia("/admin", navigate);
          } else {
            throw new Error();
          }
        } catch {
          Swal.fire("Error", "No se pudo eliminar el producto.", "error");
        }
      }
    });
  };

  const guardarCambios = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const charsToSend = caracteristicas
      .filter(c => c.propiedad.trim() && c.valor.trim())
      .map(c => ({ NOMBRE_ATRIBUTO: c.propiedad.trim(), VALOR_ATRIBUTO: c.valor.trim() }));

    const hasColor = variantes.some(v => v.COLOR.trim());
    if (hasColor && !charsToSend.some(c => c.NOMBRE_ATRIBUTO === "Color")) {
      charsToSend.push({ NOMBRE_ATRIBUTO: "Color", VALOR_ATRIBUTO: variantes.map(v => v.COLOR).filter(Boolean).join(", ") });
    }

    const body = {
      NOMBRE: nombre,
      MARCA: marca || "Genérico",
      PRECIO: Number(precio),
      DESCRIPCION: descripcion,
      ID_CATEGORIA: Number(idCategoria),
      ID_PROVEEDOR: Number(idProveedor),
      ID_DESCUENTO: idDescuento ? Number(idDescuento) : null,
      IMAGENES: imagenesUrls.length > 0 ? imagenesUrls : undefined,
      URL_IMAGEN: imagenesUrls.length > 0 ? undefined : null,
      VARIANTES: variantes.filter(v => v.COLOR || v.ATRIBUTO),
      CARACTERISTICAS: charsToSend,
    };

    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        await Swal.fire({ icon: "success", title: "¡Actualizado!", text: "El producto se guardó correctamente", timer: 2000, showConfirmButton: true });
        setEditing(false);
        cargarProducto();
      } else {
        throw new Error();
      }
    } catch {
      Swal.fire("Error", "No se pudo actualizar el producto", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="admin-page">
        <AdminNavbar />
        <div className="admin-content d-flex align-items-center justify-content-center" style={{ minHeight: "60vh" }}>
          <div className="spinner-border text-danger" role="status" />
        </div>
      </div>
    );
  }

  const categoriaNombre = categorias.find(c => c.ID_CATEGORIA === Number(idCategoria))?.NOMBRE_CATEGORIA || "—";
  const descuentoLabel = descuentos.find(d => d.ID_DESCUENTO === Number(idDescuento));
  const stockTotal = variantes.reduce((sum, v) => sum + (Number(v.STOCK) || 0), 0);

  const proveedorEncontrado = proveedores.find(p => (p.ID_PROVEEDOR ?? p.id_proveedor) === Number(idProveedor));
  const proveedorNombre = proveedorEncontrado?.NOMBRE_PROVEEDOR ?? proveedorEncontrado?.nombre_proveedor ?? "—";

  return (
    <div className="admin-page">
      <AdminNavbar />

      <div className="admin-content">
        <div className="container" style={{ maxWidth: "1200px" }}>
          <div className="edit-breadcrumb">
            <a onClick={() => navegarConGuardia("/admin", navigate)}>Dashboard</a>
            <span>›</span>
            <a onClick={() => navegarConGuardia("/admin/productos", navigate)}>Productos</a>
            <span>›</span>
            <span style={{ color: "#666" }}>{nombre || `Producto #${id}`}</span>
          </div>

          <form onSubmit={guardarCambios}>
            <div className="edit-product-grid">
              {/* LEFT COLUMN */}
              <div className="edit-product-main">
                <div className="edit-card">
                  <div className="edit-card-title">Información General</div>
                  <div className="row">
                    <div className="col-md-6 admin-input-group">
                      <label className="admin-label">Nombre del Producto</label>
                      {editing ? (
                        <input type="text" className="admin-input" required value={nombre} onChange={e => setNombre(e.target.value)} />
                      ) : (
                        <div className="edit-display-value">{nombre || "—"}</div>
                      )}
                    </div>
                    <div className="col-md-3 admin-input-group">
                      <label className="admin-label">Marca</label>
                      {editing ? (
                        <input type="text" className="admin-input" value={marca} onChange={e => setMarca(e.target.value)} placeholder="Ej: Nike, Adidas" />
                      ) : (
                        <div className="edit-display-value">{marca || "—"}</div>
                      )}
                    </div>
                    <div className="col-md-3 admin-input-group">
                      <label className="admin-label">Categoría</label>
                      {editing ? (
                        <select className="admin-select" value={idCategoria} onChange={e => setIdCategoria(e.target.value)} required>
                          {categorias.map(cat => (
                            <option key={cat.ID_CATEGORIA} value={cat.ID_CATEGORIA}>{cat.NOMBRE_CATEGORIA}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="edit-display-value">{categoriaNombre}</div>
                      )}
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-6 admin-input-group">
                      <label className="admin-label">Proveedor</label>
                      {editing ? (
                        <select className="admin-select" value={idProveedor} onChange={e => setIdProveedor(e.target.value !== "" ? Number(e.target.value) : "")} required>
                          {proveedores.map(prov => {
                            const idReal = prov.ID_PROVEEDOR ?? prov.id_proveedor;
                            const nombreReal = prov.NOMBRE_PROVEEDOR ?? prov.nombre_proveedor;
                            return <option key={idReal} value={idReal}>{nombreReal}</option>;
                          })}
                        </select>
                      ) : (
                        <div className="edit-display-value">{proveedorNombre}</div>
                      )}
                    </div>
                    <div className="col-md-6 admin-input-group">
                      <label className="admin-label">Descuento (opcional)</label>
                      {editing ? (
                        <select className="admin-select" value={idDescuento} onChange={e => setIdDescuento(e.target.value)}>
                          <option value="">Sin descuento</option>
                          {descuentos.map(desc => (
                            <option key={desc.ID_DESCUENTO} value={desc.ID_DESCUENTO}>{desc.DESCRIPCION} ({desc.PORCENTAJE}%)</option>
                          ))}
                        </select>
                      ) : (
                        <div className="edit-display-value">{descuentoLabel ? `${descuentoLabel.DESCRIPCION} (${descuentoLabel.PORCENTAJE}%)` : "Ninguno"}</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="edit-card">
                  <div className="edit-card-title">Variantes</div>
                  {variantes.map((v, idx) => (
                    <div className="variant-row" key={idx}>
                      <div className="admin-input-group">
                        <label className="admin-label">Color</label>
                        {editing ? (
                          <input type="text" className="admin-input" value={v.COLOR} onChange={e => {
                            const next = [...variantes];
                            next[idx] = { ...next[idx], COLOR: e.target.value };
                            setVariantes(next);
                          }} placeholder="Ej: Negro" />
                        ) : (
                          <div className="edit-display-value">{v.COLOR || "—"}</div>
                        )}
                      </div>
                      <div className="admin-input-group">
                        <label className="admin-label">Tipo</label>
                        {editing ? (
                          <select className="admin-select" value={v.NOMBRE_ATRIBUTO} onChange={e => {
                            const next = [...variantes];
                            next[idx] = { ...next[idx], NOMBRE_ATRIBUTO: e.target.value };
                            setVariantes(next);
                          }}>
                            <option value="">Seleccionar...</option>
                            {tiposAtributo.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        ) : (
                          <div className="edit-display-value">{v.NOMBRE_ATRIBUTO || "—"}</div>
                        )}
                      </div>
                      <div className="admin-input-group">
                        <label className="admin-label">Valor</label>
                        {editing ? (
                          <input type="text" className="admin-input" value={v.ATRIBUTO} onChange={e => {
                            const next = [...variantes];
                            next[idx] = { ...next[idx], ATRIBUTO: e.target.value };
                            setVariantes(next);
                          }} placeholder="Ej: 40, M" disabled={!v.NOMBRE_ATRIBUTO} />
                        ) : (
                          <div className="edit-display-value">{v.ATRIBUTO || "—"}</div>
                        )}
                      </div>
                      <div className="admin-input-group">
                        <label className="admin-label">Stock</label>
                        {editing ? (
                          <input type="number" className="admin-input" value={v.STOCK} onChange={e => {
                            const next = [...variantes];
                            next[idx] = { ...next[idx], STOCK: Number(e.target.value) || 0 };
                            setVariantes(next);
                          }} min="0" />
                        ) : (
                          <div className="edit-display-value">{v.STOCK}</div>
                        )}
                      </div>
                      {editing && (
                        <div className="d-flex align-items-center" style={{ paddingBottom: "20px" }}>
                          <button type="button" className="btn btn-outline-danger btn-sm" style={{ width: "40px", height: "40px", borderRadius: "10px" }} onClick={() => setVariantes(variantes.filter((_, i) => i !== idx))}>✕</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {editing && (
                    <button type="button" className="btn btn-outline-secondary btn-sm mt-1" onClick={() => setVariantes([...variantes, { COLOR: "", NOMBRE_ATRIBUTO: "", ATRIBUTO: "", STOCK: 0 }])}>
                      + Agregar variante
                    </button>
                  )}
                </div>

                <div className="edit-card">
                  <div className="edit-card-title">Economía</div>
                  <div className="row">
                    <div className="col-md-6 admin-input-group">
                      <label className="admin-label">Precio de Venta (COP)</label>
                      {editing ? (
                        <input type="number" className="admin-input" required value={precio} onChange={e => setPrecio(e.target.value)} />
                      ) : (
                        <div className="edit-display-value">${Number(precio || 0).toLocaleString()}</div>
                      )}
                    </div>
                    <div className="col-md-6 admin-input-group">
                      <label className="admin-label">Variantes activas</label>
                      <div className="edit-display-value" style={{ color: stockTotal > 0 ? "#2e7d32" : "#c62828" }}>
                        <strong>{variantes.length}</strong> variante(s) — <strong>{stockTotal}</strong> uds totales
                      </div>
                    </div>
                  </div>
                </div>

                <div className="edit-card">
                  <div className="edit-card-title">Descripción</div>
                  {editing ? (
                    <textarea className="admin-textarea" rows={3} required value={descripcion} onChange={e => setDescripcion(e.target.value)} />
                  ) : (
                    <div className="edit-display-value" style={{ whiteSpace: "pre-wrap" }}>{descripcion || "—"}</div>
                  )}
                </div>

                <div className="edit-card">
                  <div className="edit-card-title">Ficha Técnica</div>
                  {caracteristicas.length === 0 && !editing && (
                    <div className="edit-display-value empty">Sin características</div>
                  )}
                  {caracteristicas.map((item, idx) => (
                    <div className="row mb-2" key={idx}>
                      <div className="col-5 admin-input-group mb-0">
                        {editing ? (
                          <input type="text" className="admin-input" value={item.propiedad} onChange={e => {
                            const newC = [...caracteristicas];
                            newC[idx] = { ...newC[idx], propiedad: e.target.value };
                            setCaracteristicas(newC);
                          }} placeholder="Propiedad" />
                        ) : (
                          <div className="edit-display-value">{item.propiedad || "—"}</div>
                        )}
                      </div>
                      <div className="col-5 admin-input-group mb-0">
                        {editing ? (
                          <input type="text" className="admin-input" value={item.valor} onChange={e => {
                            const newC = [...caracteristicas];
                            newC[idx] = { ...newC[idx], valor: e.target.value };
                            setCaracteristicas(newC);
                          }} placeholder="Valor" />
                        ) : (
                          <div className="edit-display-value">{item.valor || "—"}</div>
                        )}
                      </div>
                      {editing && (
                        <div className="col-2 d-flex align-items-center">
                          <button type="button" className="btn btn-outline-danger btn-sm w-100" onClick={() => setCaracteristicas(caracteristicas.filter((_, i) => i !== idx))}>✕</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {editing && (
                    <button type="button" className="btn btn-outline-secondary btn-sm mt-1" onClick={() => setCaracteristicas([...caracteristicas, { propiedad: "", valor: "" }])}>
                      + Agregar característica
                    </button>
                  )}
                </div>

                {/* Bottom actions */}
                <div className="edit-save-bar" style={{ flexDirection: "column", gap: "12px" }}>
                  {editing ? (
                    <>
                      <button type="button" className="btn btn-outline-secondary w-100" style={{ borderRadius: "10px", padding: "10px", fontWeight: 600 }} onClick={() => setShowPreview(true)}>
                        <FaEye /> Vista previa del producto
                      </button>
                      <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                        <button type="button" className="btn btn-outline-secondary" style={{ flex: 1, borderRadius: "10px", padding: "12px", fontWeight: 600 }} onClick={cancelarEdicion}>Cancelar</button>
                        <button type="submit" className="btn-save-admin" style={{ flex: 1 }} disabled={saving}>
                          {saving ? "Guardando..." : "Guardar Cambios"}
                        </button>
                      </div>
                      <button type="button" className="btn btn-outline-danger w-100" style={{ borderRadius: "10px", padding: "12px", fontWeight: 700 }} onClick={eliminarProducto}>
                        Eliminar Producto
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="btn-save-admin w-100" style={{ padding: "14px" }} onClick={iniciarEdicion}>
                        Editar Producto
                      </button>
                      <div style={{ display: "flex", gap: "12px", width: "100%" }}>
                        <button type="button" className="btn btn-outline-secondary" style={{ flex: 1, borderRadius: "10px", padding: "12px", fontWeight: 600 }} onClick={() => setShowPreview(true)}>
                          <FaEye /> Vista previa
                        </button>
                        <button type="button" className="btn btn-outline-secondary" style={{ flex: 1, borderRadius: "10px", padding: "12px", fontWeight: 600 }} onClick={() => id && window.open(`/producto/${id}`, "_blank")}>
                          <FaExternalLinkAlt /> Ver página
                        </button>
                      </div>
                      <button type="button" className="btn btn-outline-danger w-100" style={{ borderRadius: "10px", padding: "12px", fontWeight: 700 }} onClick={eliminarProducto}>
                        Eliminar Producto
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN */}
              <div className="edit-sidebar">
                <div className="edit-preview-card">
                  <h6 style={{ color: "#999", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>Vista previa</h6>
                  <GaleriaAdmin urls={imagenesUrls} activa={previewIdx} onCambiar={setPreviewIdx} />
                  <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                    <button type="button" className="btn btn-outline-secondary btn-sm" style={{ flex: 1, borderRadius: "10px", fontWeight: 600 }} onClick={() => setShowPreview(true)}>
                      <FaEye /> Vista previa
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" style={{ flex: 1, borderRadius: "10px", fontWeight: 600 }} onClick={() => id && window.open(`/producto/${id}`, "_blank")}>
                      <FaExternalLinkAlt /> Ver página
                    </button>
                  </div>
                </div>

                <div className="edit-summary-card">
                  <h6>Resumen</h6>
                  <div className="edit-summary-row"><span>Producto</span><span>{nombre || "—"}</span></div>
                  <div className="edit-summary-row"><span>Marca</span><span>{marca || "—"}</span></div>
                  <div className="edit-summary-row"><span>Categoría</span><span>{categoriaNombre}</span></div>
                  <div className="edit-summary-row"><span>Precio</span><span>${Number(precio || 0).toLocaleString()}</span></div>
                  <div className="edit-summary-row"><span>Stock total</span><span>{stockTotal} uds</span></div>
                  <div className="edit-summary-row"><span>Descuento</span><span>{descuentoLabel ? `${descuentoLabel.DESCRIPCION} (${descuentoLabel.PORCENTAJE}%)` : "Ninguno"}</span></div>
                  <div className="edit-summary-row"><span>Variantes</span><span>{variantes.length}</span></div>
                </div>

                <div className="edit-preview-card">
                  <h6 style={{ color: "#999", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>Imágenes del Producto</h6>
                  {imagenesUrls.length > 0 ? (
                    <GaleriaAdmin urls={imagenesUrls} activa={previewIdx} onCambiar={setPreviewIdx} principal={false} />
                  ) : (
                    <div className="edit-display-value">Sin imágenes</div>
                  )}
                  {editing && (
                    <div style={{ marginTop: "16px" }}>
                      <SubirImagenes urls={imagenesUrls} onChange={setImagenesUrls} idProducto={Number(id)} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>

          {showPreview && (
            <div className="pp-backdrop" onClick={() => setShowPreview(false)}>
              <div className="pp-modal" onClick={(e) => e.stopPropagation()}>
                <div className="pp-modal-header">
                  <h5>Vista previa del producto</h5>
                  <button type="button" className="pp-close" onClick={() => setShowPreview(false)}>✕</button>
                </div>
                <div className="pp-modal-body">
                  <div className="pp-col-izq">
                    <GaleriaAdmin urls={imagenesUrls} activa={previewIdx} onCambiar={setPreviewIdx} />
                  </div>
                  <div className="pp-col-der">
                    <span className="pp-chip-cat">{categoriaNombre}</span>
                    <h2 className="pp-nombre">{nombre || "—"}</h2>
                    <div className="pp-marca">{marca || "Marca Genérica"}</div>
                    <div className="pp-precios">
                      {descuentoLabel && (
                        <span className="pp-precio-viejo">${Math.round(Number(precio) / (1 - descuentoLabel.PORCENTAJE / 100)).toLocaleString()}</span>
                      )}
                      <span className="pp-precio">${Number(precio || 0).toLocaleString()}</span>
                      {descuentoLabel && <span className="pp-desc-chip">-{descuentoLabel.PORCENTAJE}%</span>}
                    </div>
                    <div className={`pp-stock-badge pp-stock-${stockTotal === 0 ? "agotado" : stockTotal <= 10 ? "bajo" : "ok"}`}>
                      {stockTotal === 0 ? "AGOTADO" : stockTotal <= 10 ? `¡Solo quedan ${stockTotal}!` : `Disponible · ${stockTotal} uds`}
                    </div>

                    <div className="pp-seccion-titulo">Variantes</div>
                    {variantes.length > 0 ? (
                      <div className="pp-variantes">
                        {variantes.map((v, i) => (
                          <span key={i} className={`pp-var-chip ${v.STOCK <= 0 ? "agotada" : ""}`}>
                            {v.COLOR && <><FaPalette /> {v.COLOR}</>}
                            {v.NOMBRE_ATRIBUTO && v.ATRIBUTO && <><FaTag /> {v.NOMBRE_ATRIBUTO}: {v.ATRIBUTO}</>}
                            <b>{v.STOCK} uds</b>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="pp-sin-variantes">Sin variantes</div>
                    )}

                    <div className="pp-seccion-titulo">Descripción</div>
                    <p className="pp-descripcion">{descripcion || "—"}</p>

                    {caracteristicas.length > 0 && (
                      <>
                        <div className="pp-seccion-titulo">Ficha técnica</div>
                        <div className="pp-ficha">
                          {caracteristicas.map((c, i) => (
                            <div className="pp-ficha-row" key={i}>
                              <span className="pp-ficha-prop">{c.propiedad || "—"}</span>
                              <span className="pp-ficha-valor">{c.valor || "—"}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="pp-modal-footer">
                  <button type="button" className="btn btn-outline-secondary" style={{ borderRadius: "10px", fontWeight: 600 }} onClick={() => setShowPreview(false)}>Cerrar</button>
                  <button type="button" className="btn-save-admin" style={{ borderRadius: "10px" }} onClick={() => id && window.open(`/producto/${id}`, "_blank")}>
                    <FaExternalLinkAlt /> Ver página real
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditarProductoAdmin;
