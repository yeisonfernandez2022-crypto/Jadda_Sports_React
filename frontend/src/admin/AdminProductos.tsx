import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import SubirImagenes from "./SubirImagenes";
import "../css/adminDashboard.css";
import {
  FaPlus, FaSearch, FaEdit, FaTrashAlt, FaChevronLeft, FaChevronRight,
  FaSort, FaSortUp, FaSortDown, FaBoxOpen,
} from "react-icons/fa";

interface Variante {
  COLOR: string;
  NOMBRE_ATRIBUTO: string;
  ATRIBUTO: string;
  STOCK: number;
}

type OrdenCampo = "ID" | "NOMBRE" | "PRECIO" | "STOCK";

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eef2f7'/><text x='50%25' y='55%25' font-family='sans-serif' font-size='11' fill='%2394a3b8' text-anchor='middle'>JADDA</text></svg>";

const colorCategoria = (nombre: string) => {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) % 360;
  return `hsl(${hash}, 65%, 45%)`;
};

const AdminProductos = () => {
  const navigate = useNavigate();
  const [productos, setProductos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [descuentos, setDescuentos] = useState<any[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [orden, setOrden] = useState<{ campo: OrdenCampo; dir: "asc" | "desc" }>({ campo: "ID", dir: "asc" });
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
    setProductos(data);
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

  const productosFiltrados = productos
    .filter((prod) => {
      if (filtroCategoria && (prod.CATEGORIA || prod.categoria) !== filtroCategoria) return false;
      if (!busqueda.trim()) return true;
      const q = busqueda.toLowerCase();
      const nom = (prod.NOMBRE || prod.nombre || "").toLowerCase();
      const mar = (prod.MARCA || prod.marca || "").toLowerCase();
      const cat = (prod.CATEGORIA || prod.categoria || "").toLowerCase();
      return nom.includes(q) || mar.includes(q) || cat.includes(q);
    })
    .sort((a, b) => {
      const dir = orden.dir === "asc" ? 1 : -1;
      const va = orden.campo === "ID"
        ? Number(a.ID ?? a.id ?? 0)
        : orden.campo === "PRECIO" ? Number(a.PRECIO ?? a.precio ?? 0)
        : orden.campo === "STOCK" ? Number(a.STOCK ?? a.stock ?? 0)
        : String(a.NOMBRE ?? a.nombre ?? "").toLowerCase();
      const vb = orden.campo === "ID"
        ? Number(b.ID ?? b.id ?? 0)
        : orden.campo === "PRECIO" ? Number(b.PRECIO ?? b.precio ?? 0)
        : orden.campo === "STOCK" ? Number(b.STOCK ?? b.stock ?? 0)
        : String(b.NOMBRE ?? b.nombre ?? "").toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });

  const totalPaginas = Math.max(1, Math.ceil(productosFiltrados.length / productosPorPagina));
  const paginaSegura = Math.min(paginaActual, totalPaginas);
  const productosActuales = productosFiltrados.slice(
    (paginaSegura - 1) * productosPorPagina,
    paginaSegura * productosPorPagina
  );

  const cambiarOrden = (campo: OrdenCampo) => {
    setOrden((o) => (o.campo === campo ? { campo, dir: o.dir === "asc" ? "desc" : "asc" } : { campo, dir: "asc" }));
    setPaginaActual(1);
  };

  const IconoOrden = ({ campo }: { campo: OrdenCampo }) => {
    if (orden.campo !== campo) return <FaSort className="ap-sort-ico" />;
    return orden.dir === "asc" ? <FaSortUp className="ap-sort-ico on" /> : <FaSortDown className="ap-sort-ico on" />;
  };

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

  const Paginacion = ({ top = false }: { top?: boolean }) =>
    totalPaginas > 1 ? (
      <div className={`ap-paginacion ${top ? "top" : ""}`}>
        <button
          className="ap-page-btn"
          disabled={paginaSegura === 1}
          onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
        >
          <FaChevronLeft /> Anterior
        </button>
        <div className="ap-pages">
          {Array.from({ length: totalPaginas }, (_, i) => (
            <button
              key={i}
              className={`ap-page-num ${paginaSegura === i + 1 ? "activa" : ""}`}
              onClick={() => setPaginaActual(i + 1)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button
          className="ap-page-btn"
          disabled={paginaSegura === totalPaginas}
          onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
        >
          Siguiente <FaChevronRight />
        </button>
      </div>
    ) : null;

  return (
    <div className="admin-page">
      <AdminNavbar />
      <div className="admin-content">
        <div className="admin-container">
          <div className="adm-header">
            <div>
              <h1 className="adm-header-title">Productos</h1>
              <p className="adm-header-sub">Gestiona el catálogo de tu tienda</p>
            </div>
            <button className="adm-btn-primary" onClick={() => setShowModal(true)}>
              <FaPlus /> Nuevo Producto
            </button>
          </div>

          <div className="ap-toolbar">
            <div className="ap-search">
              <FaSearch />
              <input
                type="text"
                placeholder="Buscar por nombre, marca o categoría..."
                value={busqueda}
                onChange={(e) => { setBusqueda(e.target.value); setPaginaActual(1); }}
              />
            </div>
            <select className="ap-filtro" value={filtroCategoria} onChange={(e) => { setFiltroCategoria(e.target.value); setPaginaActual(1); }}>
              <option value="">Todas las categorías</option>
              {categorias.map((cat) => (
                <option key={cat.ID_CATEGORIA} value={cat.NOMBRE_CATEGORIA}>{cat.NOMBRE_CATEGORIA}</option>
              ))}
            </select>
            <span className="ap-count">
              <FaBoxOpen /> {productosFiltrados.length} producto{productosFiltrados.length !== 1 ? "s" : ""}
            </span>
          </div>

          <Paginacion top />

          <div className="ap-tabla-wrap">
            {productosActuales.length === 0 ? (
              <div className="ap-vacio">
                <FaBoxOpen className="ap-vacio-ico" />
                <p>No se encontraron productos</p>
              </div>
            ) : (
              <table className="ap-tabla">
                <thead>
                  <tr>
                    <th className="ap-sortable" style={{ width: "44px" }} onClick={() => cambiarOrden("ID")}>
                      # <IconoOrden campo="ID" />
                    </th>
                    <th style={{ width: "120px" }}>Imagen</th>
                    <th className="ap-sortable" onClick={() => cambiarOrden("NOMBRE")}>
                      Producto <IconoOrden campo="NOMBRE" />
                    </th>
                    <th>Categoría</th>
                    <th className="ap-sortable" onClick={() => cambiarOrden("PRECIO")}>
                      Precio <IconoOrden campo="PRECIO" />
                    </th>
                    <th className="ap-sortable" onClick={() => cambiarOrden("STOCK")}>
                      Stock <IconoOrden campo="STOCK" />
                    </th>
                    <th className="ap-th-acciones">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {productosActuales.map((prod) => {
                    const idReal = prod.ID || prod.id;
                    const stockReal = Number(prod.STOCK ?? prod.stock ?? 0);
                    const precioReal = prod.PRECIO ?? prod.precio;
                    const nombreReal = prod.NOMBRE ?? prod.nombre;
                    const marcaReal = prod.MARCA ?? prod.marca ?? "";
                    const categoriaReal = prod.CATEGORIA ?? prod.categoria ?? "Sin categoría";
                    const imgReal = prod.URL_IMAGEN || prod.url_imagen || prod.IMAGEN || prod.imagen;
                    const colorCat = colorCategoria(categoriaReal);

                    return (
                      <tr key={idReal}>
                        <td>
                          <span className="ap-id">{idReal}</span>
                        </td>
                        <td>
                          <img
                            src={imgReal || PLACEHOLDER_IMG}
                            alt={nombreReal}
                            className="ap-img"
                            loading="lazy"
                            onError={(e) => { e.currentTarget.src = PLACEHOLDER_IMG; }}
                          />
                        </td>
                        <td>
                          <div className="ap-nombre">{nombreReal}</div>
                          {marcaReal && <div className="ap-marca">{marcaReal}</div>}
                        </td>
                        <td>
                          <span className="ap-chip" style={{ background: `${colorCat}18`, color: colorCat }}>
                            {categoriaReal}
                          </span>
                        </td>
                        <td className="ap-precio">${Number(precioReal || 0).toLocaleString("es-CO")}</td>
                        <td>
                          {stockReal <= 0 ? (
                            <span className="ap-stock agotado">Agotado</span>
                          ) : stockReal <= 10 ? (
                            <span className="ap-stock bajo">¡Solo quedan {stockReal}!</span>
                          ) : (
                            <span className="ap-stock ok">{stockReal} und</span>
                          )}
                        </td>
                        <td className="ap-acciones">
                          <button className="ap-btn-accion editar" title="Editar producto" onClick={() => navigate(`/admin/editar/${idReal}`)}>
                            <FaEdit />
                          </button>
                          <button className="ap-btn-accion eliminar" title="Eliminar producto" onClick={() => handleEliminarProducto(idReal, nombreReal)}>
                            <FaTrashAlt />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <Paginacion />
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
