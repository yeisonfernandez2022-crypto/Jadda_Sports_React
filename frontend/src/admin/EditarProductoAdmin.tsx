import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
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
  const [imagenUrl, setImagenUrl] = useState("");
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [caracteristicas, setCaracteristicas] = useState<Caracteristica[]>([]);

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
      setImagenUrl(prodData.IMAGENES?.[0]?.url || "");

      const vars: Variante[] = (prodData.VARIANTES || []).map((v: any) => ({
        ID_VARIANTE: v.ID_VARIANTE,
        COLOR: v.COLOR || "",
        NOMBRE_ATRIBUTO: tiposAtributo.includes(v.NOMBRE_ATRIBUTO) ? v.NOMBRE_ATRIBUTO : v.NOMBRE_ATRIBUTO || "",
        ATRIBUTO: v.ATRIBUTO || "",
        STOCK: Number(v.STOCK) || 0,
      }));
      setVariantes(vars.length > 0 ? vars : [{ COLOR: "", NOMBRE_ATRIBUTO: "", ATRIBUTO: "", STOCK: 0 }]);

      const chars = Array.isArray(carData) ? carData : [];
      setCaracteristicas(
        chars
          .filter((c: any) => c.NOMBRE_ATRIBUTO !== "Color")
          .map((c: any) => ({ propiedad: c.NOMBRE_ATRIBUTO || "", valor: c.VALOR_ATRIBUTO || "" }))
      );

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

  const iniciarEdicion = () => {
    setEditing(true);
  };

  const cancelarEdicion = () => {
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
            navigate("/admin");
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
      URL_IMAGEN: imagenUrl || null,
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
            <a onClick={() => navigate("/admin")}>Dashboard</a>
            <span>›</span>
            <span style={{ color: "#666" }}>Editar Producto #{id}</span>
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
                  {imagenUrl ? (
                    <img src={imagenUrl} alt="Preview" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  ) : (
                    <div className="no-image">Sin imagen</div>
                  )}
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
                  <h6 style={{ color: "#999", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "16px" }}>URL de Imagen</h6>
                  {editing ? (
                    <input type="url" className="admin-input" value={imagenUrl} onChange={e => setImagenUrl(e.target.value)} placeholder="https://..." />
                  ) : (
                    <div className="edit-display-value">{imagenUrl || "—"}</div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditarProductoAdmin;
