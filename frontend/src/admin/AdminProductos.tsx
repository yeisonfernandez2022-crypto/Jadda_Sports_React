import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import SubirImagenes from "./SubirImagenes";
import "../css/adminDashboard.css";
import { FaArrowLeft } from "react-icons/fa";

interface Variante {
  COLOR: string;
  NOMBRE_ATRIBUTO: string;
  ATRIBUTO: string;
  STOCK: number;
}

const AdminProductos = () => {
  const navigate = useNavigate();
  const [productos, setProductos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [descuentos, setDescuentos] = useState<any[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [busqueda, setBusqueda] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const productosPorPagina = 10;

  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [precio, setPrecio] = useState("");
  const [idCategoria, setIdCategoria] = useState<number | string>("");
  const [idProveedor, setIdProveedor] = useState<number | string>("");
  const [idDescuento, setIdDescuento] = useState<number | string>("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenesUrls, setImagenesUrls] = useState<string[]>([]);
  const [caracteristicas, setCaracteristicas] = useState<{ propiedad: string; valor: string }[]>([]);
  const [variantes, setVariantes] = useState<Variante[]>([]);

  const tiposAtributo = ["Talla", "Peso", "Capacidad", "Longitud", "Diámetro", "Voltaje", "Potencia", "Resistencia"];

  const obtenerProductos = async () => {
    const res = await fetch("/api/productos");
    const data = await res.json();
    setProductos(data.sort(() => Math.random() - 0.5));
  };

  const obtenerProveedores = async () => {
    try {
      const res = await fetch("/api/proveedores");
      const data = await res.json();
      setProveedores(data);
      if (data.length > 0) {
        const primerId = data[0].ID_PROVEEDOR || data[0].id_proveedor;
        setIdProveedor(Number(primerId));
      }
    } catch (error) {
      console.error("Error al obtener los proveedores:", error);
    }
  };

  const obtenerCategorias = async () => {
    try {
      const res = await fetch("/api/productos/categorias");
      const data = await res.json();
      setCategorias(data);
      if (data.length > 0) setIdCategoria(data[0].ID_CATEGORIA);
    } catch (error) {
      console.error("Error al obtener categorías:", error);
    }
  };

  const obtenerDescuentos = async () => {
    try {
      const res = await fetch("/api/productos/descuentos");
      const data = await res.json();
      setDescuentos(data);
    } catch (error) {
      console.error("Error al obtener descuentos:", error);
    }
  };

  useEffect(() => {
    obtenerProductos();
    obtenerProveedores();
    obtenerCategorias();
    obtenerDescuentos();
  }, []);

  const productosFiltrados = productos.filter((prod) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    const nombre = (prod.NOMBRE || prod.nombre || "").toLowerCase();
    const marca = (prod.MARCA || prod.marca || "").toLowerCase();
    const categoria = (prod.CATEGORIA || prod.categoria || "").toLowerCase();
    return nombre.includes(q) || marca.includes(q) || categoria.includes(q);
  });

  const totalPaginas = Math.ceil(productosFiltrados.length / productosPorPagina);
  const productosActuales = productosFiltrados.slice(
    (paginaActual - 1) * productosPorPagina,
    paginaActual * productosPorPagina
  );

  const handleGuardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) {
      Swal.fire("Campo obligatorio", "Debes escribir el nombre del producto", "warning");
      return;
    }
    if (!precio || Number(precio) <= 0) {
      Swal.fire("Campo obligatorio", "Debes ingresar un precio válido mayor a 0", "warning");
      return;
    }
    if (!idCategoria) {
      Swal.fire("Campo obligatorio", "Debes seleccionar una categoría", "warning");
      return;
    }
    if (!idProveedor) {
      Swal.fire("Campo obligatorio", "Debes seleccionar un proveedor", "warning");
      return;
    }
    if (!descripcion.trim()) {
      Swal.fire("Campo obligatorio", "Debes escribir una descripción del producto", "warning");
      return;
    }

    const variantesValidas = variantes.filter(v => v.COLOR.trim() && v.NOMBRE_ATRIBUTO && v.ATRIBUTO.trim());
    if (variantesValidas.length === 0) {
      Swal.fire("Sin variantes", "Debes agregar al menos una variante completa (color, tipo y valor)", "warning");
      return;
    }

    const listaCaracteristicas = caracteristicas
      .filter((c) => c.propiedad.trim() && c.valor.trim())
      .map((c) => ({ NOMBRE_ATRIBUTO: c.propiedad.trim(), VALOR_ATRIBUTO: c.valor.trim() }));

    const hasColor = variantesValidas.some(v => v.COLOR.trim());
    if (hasColor && !listaCaracteristicas.some(c => c.NOMBRE_ATRIBUTO === "Color")) {
      listaCaracteristicas.push({ NOMBRE_ATRIBUTO: "Color", VALOR_ATRIBUTO: variantesValidas.map(v => v.COLOR).filter(Boolean).join(", ") });
    }

    const nuevoProducto = {
      NOMBRE: nombre.trim(),
      MARCA: marca.trim() || "Genérico",
      PRECIO: Number(precio),
      DESCRIPCION: descripcion.trim(),
      ID_CATEGORIA: Number(idCategoria),
      ID_PROVEEDOR: Number(idProveedor),
      ID_DESCUENTO: idDescuento ? Number(idDescuento) : null,
      IMAGENES: imagenesUrls.length > 0 ? imagenesUrls : undefined,
      URL_IMAGEN: imagenesUrls.length > 0 ? undefined : "https://via.placeholder.com/150",
      VARIANTES: variantesValidas,
      CARACTERISTICAS: listaCaracteristicas,
    };

    try {
      const response = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoProducto),
      });

      if (response.ok) {
        Swal.fire("¡Éxito!", "Producto agregado correctamente", "success");
        setShowModal(false);
        setNombre(""); setMarca(""); setPrecio(""); setDescripcion(""); setImagenesUrls([]);
        setCaracteristicas([]); setVariantes([]); setIdDescuento("");
        if (categorias.length > 0) setIdCategoria(categorias[0].ID_CATEGORIA);
        if (proveedores.length > 0) {
          const primerId = proveedores[0].ID_PROVEEDOR || proveedores[0].id_proveedor;
          setIdProveedor(Number(primerId));
        }
        obtenerProductos();
      } else {
        throw new Error(`Código de error: ${response.status}`);
      }
    } catch (error: any) {
      Swal.fire("Error al agregar", error.message || "No se pudo guardar el producto", "error");
    }
  };

  const handleEliminarProducto = (id: number, nombreProd: string) => {
    Swal.fire({
      title: `¿Eliminar ${nombreProd}?`,
      text: "Esta acción no se puede deshacer.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#6c757d",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`/api/productos/${id}`, { method: "DELETE" });
          if (response.ok) {
            Swal.fire("¡Eliminado!", "El producto ha sido borrado.", "success");
            obtenerProductos();
          } else {
            throw new Error();
          }
        } catch {
          Swal.fire("Error", "No se pudo eliminar el producto.", "error");
        }
      }
    });
  };

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="container">
          <div className="mb-2">
            <button className="btn btn-outline-dark btn-sm fw-bold mb-2" onClick={() => navigate("/admin")}>
              <FaArrowLeft className="me-1" /> Volver al Dashboard
            </button>
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <h1 className="fw-bold text-dark m-0">Productos</h1>
                <p className="text-muted small m-0">Gestiona el catálogo de productos</p>
              </div>
              <button className="btn btn-success fw-bold px-4 shadow-sm" onClick={() => setShowModal(true)}>
                + Nuevo Producto
              </button>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-md-6">
              <input
                type="text"
                className="form-control"
                placeholder="Buscar por nombre, marca o categoría..."
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
              />
            </div>
            <div className="col-md-6 text-end">
              <span className="text-muted small">{productosFiltrados.length} producto(s)</span>
            </div>
          </div>

          <div className="table-responsive bg-white rounded shadow-sm border" style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-uppercase small text-secondary" style={{ position: "sticky", top: 0, zIndex: 2 }}>
                <tr>
                  <th style={{ width: "80px" }}>Imagen</th>
                  <th>Nombre</th>
                  <th>Precio</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th className="text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productosActuales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4 text-muted">No se encontraron productos</td>
                  </tr>
                ) : (
                  productosActuales.map((prod) => {
                  const idReal = prod.ID || prod.id;
                  const stockReal = prod.STOCK ?? prod.stock;
                  const precioReal = prod.PRECIO ?? prod.precio;
                  const nombreReal = prod.NOMBRE ?? prod.nombre;
                  const categoriaReal = prod.CATEGORIA ?? prod.categoria;
                  const imgReal = prod.URL_IMAGEN || prod.url_imagen || prod.IMAGEN || prod.imagen;

                  return (
                    <tr key={idReal}>
                      <td>
                        <img
                          src={imgReal || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eee'/><text x='50%25' y='55%25' font-family='sans-serif' font-size='12' fill='%23aaa' text-anchor='middle'>No Image</text></svg>"}
                          alt={nombreReal}
                          className="rounded border"
                          style={{ width: "50px", height: "50px", objectFit: "cover" }}
                          loading="lazy"
                          onError={(e) => { e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eee'/><text x='50%27 y='55%27 font-family='sans-serif' font-size='12' fill='%23aaa' text-anchor='middle'>No Image</text></svg>"; }}
                        />
                      </td>
                      <td className="fw-bold">{nombreReal}</td>
                      <td className="text-secondary">${Number(precioReal || 0).toLocaleString()}</td>
                      <td><span className="badge bg-secondary">{categoriaReal}</span></td>
                      <td>
                        {stockReal === undefined || stockReal === null || stockReal <= 0 ? (
                          <span className="text-danger fw-bold text-uppercase small">Agotado</span>
                  ) : (
                    <span className="text-success fw-bold">
                      {stockReal} unidades
                    </span>
                  )}
                </td>
                <td className="text-center">
                  <button className="btn btn-outline-primary btn-sm me-2 fw-bold" onClick={() => navigate(`/admin/editar/${idReal}`)}>
                    Editar
                  </button>
                  <button className="btn btn-outline-danger btn-sm fw-bold" onClick={() => handleEliminarProducto(idReal, nombreReal)}>
                    Eliminar
                  </button>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  </div>

  {totalPaginas > 1 && (
    <div className="d-flex justify-content-center mt-3">
      <nav>
        <ul className="pagination mb-0">
          <li className={`page-item ${paginaActual === 1 ? "disabled" : ""}`}>
            <button className="page-link" onClick={() => setPaginaActual(p => Math.max(1, p - 1))}>Anterior</button>
          </li>
          {Array.from({ length: totalPaginas }, (_, i) => (
            <li key={i} className={`page-item ${paginaActual === i + 1 ? "active" : ""}`}>
              <button className="page-link" onClick={() => setPaginaActual(i + 1)}>{i + 1}</button>
            </li>
          ))}
          <li className={`page-item ${paginaActual === totalPaginas ? "disabled" : ""}`}>
            <button className="page-link" onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}>Siguiente</button>
          </li>
        </ul>
      </nav>
    </div>
  )}
        </div>
      </div>

      {showModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-container">
            <div className="modal-header-admin">
              <h5 className="fw-bold text-uppercase"><i className="fa-solid fa-plus-circle text-danger me-2"></i>Nuevo Producto</h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
            </div>
            <form onSubmit={handleGuardarProducto}>
              <div className="custom-modal-body">
                <div className="form-section-title">Información General</div>
                <div className="row">
                  <div className="col-md-6 admin-input-group">
                    <label className="admin-label">Nombre del Producto</label>
                    <input type="text" className="admin-input" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Sudadera Térmica Pro" />
                  </div>
                  <div className="col-md-3 admin-input-group">
                    <label className="admin-label">Marca</label>
                    <input type="text" className="admin-input" value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej: Nike, Adidas" />
                  </div>
                  <div className="col-md-3 admin-input-group">
                    <label className="admin-label">Categoría</label>
                    <select className="admin-select" value={idCategoria} onChange={(e) => setIdCategoria(e.target.value)} required>
                      {categorias.map((cat) => (
                        <option key={cat.ID_CATEGORIA} value={cat.ID_CATEGORIA}>{cat.NOMBRE_CATEGORIA}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="row">
                  <div className="col-md-6 admin-input-group">
                    <label className="admin-label">Proveedor</label>
                    <select className="admin-select" value={idProveedor} onChange={(e) => setIdProveedor(e.target.value !== "" ? Number(e.target.value) : "")} required>
                      {proveedores.map((prov) => {
                        const idReal = prov.ID_PROVEEDOR ?? prov.id_proveedor;
                        const nombreReal = prov.NOMBRE_PROVEEDOR ?? prov.nombre_proveedor;
                        return <option key={idReal} value={idReal}>{nombreReal}</option>;
                      })}
                    </select>
                  </div>
                  <div className="col-md-6 admin-input-group">
                    <label className="admin-label">Descuento (opcional)</label>
                    <select className="admin-select" value={idDescuento} onChange={(e) => setIdDescuento(e.target.value)}>
                      <option value="">Sin descuento</option>
                      {descuentos.map((desc) => (
                        <option key={desc.ID_DESCUENTO} value={desc.ID_DESCUENTO}>{desc.DESCRIPCION} ({desc.PORCENTAJE}%)</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-section-title">Variantes</div>
                {variantes.map((v, idx) => (
                  <div className="row mb-2 align-items-end" key={idx}>
                    <div className="col-md-3 admin-input-group mb-0">
                      <label className="admin-label">Color</label>
                      <input type="text" className="admin-input" value={v.COLOR} onChange={e => {
                        const next = [...variantes];
                        next[idx] = { ...next[idx], COLOR: e.target.value };
                        setVariantes(next);
                      }} placeholder="Ej: Negro" />
                    </div>
                    <div className="col-md-3 admin-input-group mb-0">
                      <label className="admin-label">Tipo</label>
                      <select className="admin-select" value={v.NOMBRE_ATRIBUTO} onChange={e => {
                        const next = [...variantes];
                        next[idx] = { ...next[idx], NOMBRE_ATRIBUTO: e.target.value };
                        setVariantes(next);
                      }}>
                        <option value="">Seleccionar...</option>
                        {tiposAtributo.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="col-md-3 admin-input-group mb-0">
                      <label className="admin-label">Valor</label>
                      <input type="text" className="admin-input" value={v.ATRIBUTO} onChange={e => {
                        const next = [...variantes];
                        next[idx] = { ...next[idx], ATRIBUTO: e.target.value };
                        setVariantes(next);
                      }} placeholder="Ej: 40, M" disabled={!v.NOMBRE_ATRIBUTO} />
                    </div>
                    <div className="col-md-2 admin-input-group mb-0">
                      <label className="admin-label">Stock</label>
                      <input type="number" className="admin-input" value={v.STOCK} onChange={e => {
                        const next = [...variantes];
                        next[idx] = { ...next[idx], STOCK: Number(e.target.value) || 0 };
                        setVariantes(next);
                      }} min="0" />
                    </div>
                    <div className="col-md-1 d-flex align-items-center pb-1">
                      <button type="button" className="btn btn-outline-danger btn-sm" style={{ width: "36px", height: "36px", borderRadius: "8px" }} onClick={() => setVariantes(variantes.filter((_, i) => i !== idx))}>✕</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btn-outline-secondary btn-sm mt-1" onClick={() => setVariantes([...variantes, { COLOR: "", NOMBRE_ATRIBUTO: "", ATRIBUTO: "", STOCK: 0 }])}>
                  + Agregar variante
                </button>

                <div className="form-section-title">Economía</div>
                <div className="row">
                  <div className="col-md-6 admin-input-group">
                    <label className="admin-label">Precio de Venta (COP)</label>
                    <input type="number" className="admin-input" required value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0" />
                  </div>
                  <div className="col-md-6 admin-input-group">
                    <label className="admin-label">Stock total</label>
                    <div className="form-control-plaintext fw-bold" style={{ paddingTop: "8px" }}>
                      {variantes.reduce((sum, v) => sum + (Number(v.STOCK) || 0), 0)} unidades
                    </div>
                  </div>
                </div>

                <div className="form-section-title">Visuales y Descripción</div>
                <div className="admin-input-group">
                  <label className="admin-label">Imágenes del Producto</label>
                  <SubirImagenes urls={imagenesUrls} onChange={setImagenesUrls} />
                </div>
                <div className="admin-input-group">
                  <label className="admin-label">Descripción del Producto</label>
                  <textarea className="admin-textarea" rows={3} required value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Escribe los detalles..." />
                </div>

                <div className="form-section-title">Ficha Técnica</div>
                {caracteristicas.map((item, idx) => (
                  <div className="row mb-2" key={idx}>
                    <div className="col-5 admin-input-group mb-0">
                      <input type="text" className="admin-input" value={item.propiedad} onChange={(e) => { const newC = [...caracteristicas]; newC[idx] = { ...newC[idx], propiedad: e.target.value }; setCaracteristicas(newC); }} placeholder="Propiedad ej: Material" />
                    </div>
                    <div className="col-5 admin-input-group mb-0">
                      <input type="text" className="admin-input" value={item.valor} onChange={(e) => { const newC = [...caracteristicas]; newC[idx] = { ...newC[idx], valor: e.target.value }; setCaracteristicas(newC); }} placeholder="Valor ej: Algodón" />
                    </div>
                    <div className="col-2 d-flex align-items-center">
                      <button type="button" className="btn btn-outline-danger btn-sm w-100" onClick={() => setCaracteristicas(caracteristicas.filter((_, i) => i !== idx))}>✕</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btn-outline-secondary btn-sm mt-1" onClick={() => setCaracteristicas([...caracteristicas, { propiedad: "", valor: "" }])}>
                  + Agregar característica
                </button>
                <small className="text-secondary d-block mt-2">* Cada par se mostrará como una fila en la ficha técnica del producto.</small>
              </div>

              <div className="modal-footer-admin">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Descartar</button>
                <button type="submit" className="btn-save-admin">Publicar Producto</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <AdminFooter />
    </div>
  );
};

export default AdminProductos;
