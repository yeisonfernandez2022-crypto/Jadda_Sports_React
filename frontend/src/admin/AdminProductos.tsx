import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import "../css/adminDashboard.css";
import { FaArrowLeft } from "react-icons/fa";

const AdminProductos = () => {
  const navigate = useNavigate();
  const [productos, setProductos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [descuentos, setDescuentos] = useState<any[]>([]);
  const [showModal, setShowModal] = useState<boolean>(false);

  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [precio, setPrecio] = useState("");
  const [idCategoria, setIdCategoria] = useState<number | string>("");
  const [idProveedor, setIdProveedor] = useState<number | string>("");
  const [idDescuento, setIdDescuento] = useState<number | string>("");
  const [stock, setStock] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [caracteristicas, setCaracteristicas] = useState<{ propiedad: string; valor: string }[]>([]);
  const [color, setColor] = useState("");
  const [tipoAtributo, setTipoAtributo] = useState("");
  const [valorAtributo, setValorAtributo] = useState("");

  const tiposAtributo = ["Talla", "Peso", "Capacidad", "Longitud", "Diámetro", "Voltaje", "Potencia", "Resistencia"];

  const obtenerProductos = async () => {
    const res = await fetch("http://localhost:5000/api/productos");
    const data = await res.json();
    setProductos(data);
  };

  const obtenerProveedores = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/proveedores");
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
      const res = await fetch("http://localhost:5000/api/productos/categorias");
      const data = await res.json();
      setCategorias(data);
      if (data.length > 0) setIdCategoria(data[0].ID_CATEGORIA);
    } catch (error) {
      console.error("Error al obtener categorías:", error);
    }
  };

  const obtenerDescuentos = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/productos/descuentos");
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

  const handleGuardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    const listaCaracteristicas = caracteristicas
      .filter((c) => c.propiedad.trim() && c.valor.trim())
      .map((c) => ({ NOMBRE_ATRIBUTO: c.propiedad.trim(), VALOR_ATRIBUTO: c.valor.trim() }));

    if (color) {
      listaCaracteristicas.push({ NOMBRE_ATRIBUTO: "Color", VALOR_ATRIBUTO: color });
    }

    const nuevoProducto = {
      NOMBRE: nombre,
      MARCA: marca || "Genérico",
      PRECIO: Number(precio),
      STOCK: Number(stock),
      DESCRIPCION: descripcion,
      ID_CATEGORIA: Number(idCategoria),
      ID_PROVEEDOR: Number(idProveedor),
      ID_DESCUENTO: idDescuento ? Number(idDescuento) : null,
      COLOR: color,
      TIPO_ATRIBUTO: tipoAtributo,
      ATRIBUTO: valorAtributo,
      URL_IMAGEN: imagenUrl || "https://via.placeholder.com/150",
      CARACTERISTICAS: listaCaracteristicas,
    };

    try {
      const response = await fetch("http://localhost:5000/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoProducto),
      });

      if (response.ok) {
        Swal.fire("¡Éxito!", "Producto agregado correctamente", "success");
        setShowModal(false);
        setNombre(""); setMarca(""); setPrecio(""); setStock(""); setDescripcion(""); setImagenUrl("");
        setCaracteristicas([]); setColor(""); setTipoAtributo(""); setValorAtributo(""); setIdDescuento("");
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
          const response = await fetch(`http://localhost:5000/api/productos/${id}`, { method: "DELETE" });
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

          <div className="table-responsive bg-white rounded shadow-sm border">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light text-uppercase small text-secondary">
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
                {productos.map((prod) => {
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
                          <span className={stockReal <= 10 ? "text-warning fw-bold" : "text-success fw-bold"}>
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
                })}
              </tbody>
            </table>
          </div>
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

                <div className="form-section-title">Variante</div>
                <div className="row">
                  <div className="col-md-4 admin-input-group">
                    <label className="admin-label">Color</label>
                    <input type="text" className="admin-input" required value={color} onChange={(e) => setColor(e.target.value)} placeholder="Ej: Negro, Rojo" />
                  </div>
                  <div className="col-md-4 admin-input-group">
                    <label className="admin-label">Tipo de atributo</label>
                    <select className="admin-select" value={tipoAtributo} onChange={(e) => setTipoAtributo(e.target.value)}>
                      <option value="">Seleccionar...</option>
                      {tiposAtributo.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="col-md-4 admin-input-group">
                    <label className="admin-label">Valor del atributo</label>
                    <input type="text" className="admin-input" value={valorAtributo} onChange={(e) => setValorAtributo(e.target.value)} placeholder="Ej: M, 10kg, 2L" disabled={!tipoAtributo} />
                  </div>
                </div>

                <div className="form-section-title">Economía e Inventario</div>
                <div className="row">
                  <div className="col-md-6 admin-input-group">
                    <label className="admin-label">Precio de Venta (COP)</label>
                    <input type="number" className="admin-input" required value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="0" />
                  </div>
                  <div className="col-md-6 admin-input-group">
                    <label className="admin-label">Unidades en Stock</label>
                    <input type="number" className="admin-input" required value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Cantidad disponible" />
                  </div>
                </div>

                <div className="form-section-title">Visuales y Descripción</div>
                <div className="admin-input-group">
                  <label className="admin-label">URL de Imagen Principal</label>
                  <input type="url" className="admin-input" value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} placeholder="https://tu-servidor.com/imagen.jpg" />
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
