import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import "../css/adminDashboard.css"; 

const AdminDashboard = () => {
  const [productos, setProductos] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]); 
  const [showModal, setShowModal] = useState<boolean>(false);
  const navigate = useNavigate();

  // Estados del formulario
  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState("Running");
  const [idProveedor, setIdProveedor] = useState<number | string>(""); 
  const [stock, setStock] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [caracteristicas, setCaracteristicas] = useState(""); 
  
  // 👈 NUEVOS ESTADOS: Color y Talla independientes
  const [color, setColor] = useState("");
  const [talla, setTalla] = useState("M"); // 'M' por defecto

  // Lista de tallas estándar para el select
  const opcionesTallas = ["XS", "S", "M", "L", "XL", "XXL", "35", "36", "37", "38", "39", "40", "41", "42", "Única"];

  // Obtener productos
  const obtenerProductos = async () => {
    const res = await fetch("http://localhost:5000/api/productos");
    const data = await res.json();
    setProductos(data);
  };

  // Obtener proveedores reales desde el Backend
  const obtenerProveedores = async () => {
    try {
      const res = await fetch("http://localhost:5000/api/proveedores");
      const data = await res.json();
      setProveedores(data);
      
      // SOLUCIÓN AL NULL: Forzamos a que guarde el ID numérico del primer proveedor de inmediato
      if (data.length > 0) {
        const primerId = data[0].ID_PROVEEDOR !== undefined ? data[0].ID_PROVEEDOR : data[0].id_proveedor;
        setIdProveedor(Number(primerId));
      }
    } catch (error) {
      console.error("Error al obtener los proveedores:", error);
    }
  };

  useEffect(() => {
    obtenerProductos();
    obtenerProveedores();
  }, []);

  const handleGuardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();

    // Procesamos la ficha técnica manual que escribe el usuario
    const listaCaracteristicas = caracteristicas
      .split("\n")
      .filter((linea) => linea.includes(":"))
      .map((linea) => {
        const [prop, val] = linea.split(":");
        return {
          NOMBRE_ATRIBUTO: prop.trim(),
          VALOR_ATRIBUTO: val.trim(),
        };
      });

    // Función auxiliar para extraer solo la Marca de la ficha técnica (Color y Talla ya tienen su input)
    const encontrarAtributo = (nombreAtributo: string) => {
      const encontrado = listaCaracteristicas.find(
        (attr) => attr.NOMBRE_ATRIBUTO.toLowerCase() === nombreAtributo.toLowerCase()
      );
      return encontrado ? encontrado.VALOR_ATRIBUTO : null;
    };

    const marcaExtraida = encontrarAtributo("Marca") || "Genérico";

    // Si el usuario no escribió explícitamente el Color o la Talla en la ficha técnica, 
    // los agregamos automáticamente para que queden guardados en la tabla de atributos también.
    if (!encontrarAtributo("Color") && color) {
      listaCaracteristicas.push({ NOMBRE_ATRIBUTO: "Color", VALOR_ATRIBUTO: color });
    }
    if (!encontrarAtributo("Talla")) {
      listaCaracteristicas.push({ NOMBRE_ATRIBUTO: "Talla", VALOR_ATRIBUTO: talla });
    }

    // Mapear la categoría seleccionada a su respectivo ID de la BD
    const mapeoCategorias: { [key: string]: number } = {
      "Running": 1,
      "Fútbol": 2,
      "Gimnasio": 3
    };
    const idCategoriaBD = mapeoCategorias[categoria] || 1;

    // Asegurarnos de tener un ID de proveedor válido antes de enviar
    let proveedorIdFinal = Number(idProveedor);
    if (!proveedorIdFinal && proveedores.length > 0) {
      proveedorIdFinal = Number(proveedores[0].ID_PROVEEDOR || proveedores[0].id_proveedor);
    }

    // Objeto estructurado final para tu backend
    const nuevoProducto = {
      NOMBRE: nombre,
      nombre: nombre,
      
      MARCA: marcaExtraida,
      marca: marcaExtraida,
      
      COLOR: color, // 👈 Toma el estado directo del input de texto
      color: color,
      
      TALLA: talla, // 👈 Toma el estado directo del select de tallas
      talla: talla,
      
      PRECIO: Number(precio),
      precio: Number(precio),
      
      STOCK: Number(stock),
      stock: Number(stock),
      
      DESCRIPCION: descripcion,
      descripcion: descripcion,
      
      ID_CATEGORIA: idCategoriaBD,
      id_categoria: idCategoriaBD,
      
      ID_PROVEEDOR: proveedorIdFinal, // 👈 Garantizamos que vaya como un número entero válido
      id_proveedor: proveedorIdFinal,
      
      ID_DESCUENTO: null, 
      id_descuento: null,

      URL_IMAGEN: imagenUrl || "https://via.placeholder.com/150", 
      url_imagen: imagenUrl || "https://via.placeholder.com/150", 
      
      CARACTERISTICAS: listaCaracteristicas,
      caracteristicas: listaCaracteristicas
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
        
        // Limpiamos campos
        setNombre(""); 
        setPrecio(""); 
        setStock(""); 
        setDescripcion(""); 
        setImagenUrl(""); 
        setCaracteristicas("");
        setColor("");
        setTalla("M");
        
        if (proveedores.length > 0) {
          const primerId = proveedores[0].ID_PROVEEDOR !== undefined ? proveedores[0].ID_PROVEEDOR : proveedores[0].id_proveedor;
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
          const response = await fetch(`http://localhost:5000/api/productos/${id}`, {
            method: "DELETE",
          });
          if (response.ok) {
            Swal.fire("¡Eliminado!", "El producto ha sido borrado.", "success");
            obtenerProductos(); 
          } else {
            throw new Error();
          }
        } catch (error) {
          Swal.fire("Error", "No se pudo eliminar el producto.", "error");
        }
      }
    });
  };

  return (
    <div className="bg-light min-vh-100 pb-5">
      <div className="bg-dark text-white py-3 mb-5 shadow-sm">
        <div className="container d-flex justify-content-between align-items-center">
          <span className="fw-bold fs-4 text-uppercase tracking-wider text-danger">JADDA <span className="text-white fs-6">| Panel Admin</span></span>
          <button onClick={() => navigate("/")} className="btn btn-outline-light btn-sm fw-bold">
            Ver Tienda
          </button>
        </div>
      </div>
      
      <div className="container">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="fw-bold text-dark m-0">Dashboard de Productos</h1>
          <button className="btn btn-success fw-bold px-4 shadow-sm" onClick={() => setShowModal(true)}>
            + Nuevo Producto
          </button>
        </div>

        <div className="table-responsive rounded shadow-sm bg-white">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-dark text-uppercase small">
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
                const stockReal = prod.STOCK !== undefined ? prod.STOCK : prod.stock;
                const precioReal = prod.PRECIO !== undefined ? prod.PRECIO : prod.precio;
                const nombreReal = prod.NOMBRE !== undefined ? prod.NOMBRE : prod.nombre;
                const categoriaReal = prod.CATEGORIA !== undefined ? prod.CATEGORIA : prod.categoria;
                const imgReal = prod.URL_IMAGEN || prod.url_imagen || prod.IMAGEN || prod.imagen;

                return (
                  <tr key={prod.ID || prod.id}>
                    <td>
                      <img 
                        src={imgReal || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eee'/><text x='50%27 y='55%27 font-family='sans-serif' font-size='12' fill='%23aaa' text-anchor='middle'>No Image</text></svg>"} 
                        alt={nombreReal} 
                        className="rounded border"
                        style={{ width: "50px", height: "50px", objectFit: "cover" }}
                        onError={(e) => { 
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='50' height='50' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eee'/><text x='50%27 y='55%27 font-family='sans-serif' font-size='12' fill='%23aaa' text-anchor='middle'>No Image</text></svg>"; 
                        }}
                      />
                    </td>
                    <td className="fw-bold text-dark">{nombreReal}</td>
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
                      <button 
                        className="btn btn-outline-primary btn-sm me-2 fw-bold"
                        onClick={() => navigate(`/admin/editar/${prod.ID || prod.id}`)}
                      >
                        Editar
                      </button>
                      <button 
                        className="btn btn-outline-danger btn-sm fw-bold"
                        onClick={() => handleEliminarProducto(prod.ID || prod.id, nombreReal)}
                      >
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

      {/* MODAL NUEVO PRODUCTO */}
      {showModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal-container">
            <div className="modal-header-admin">
              <h5 className="fw-bold text-uppercase">
                <i className="fa-solid fa-plus-circle text-danger me-2"></i>
                Nuevo Producto
              </h5>
              <button type="button" className="btn-close btn-close-white" onClick={() => setShowModal(false)}></button>
            </div>

            <form onSubmit={handleGuardarProducto}>
              <div className="custom-modal-body">
                
                <div className="form-section-title">Información General</div>
                <div className="row">
                  {/* Nombre del Producto */}
                  <div className="col-md-6 admin-input-group">
                    <label className="admin-label">Nombre del Producto</label>
                    <input type="text" className="admin-input" required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Sudadera Térmica Pro" />
                  </div>
                  
                  {/* Categoría */}
                  <div className="col-md-3 admin-input-group">
                    <label className="admin-label">Categoría</label>
                    <select className="admin-select" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                      <option value="Running">Running</option>
                      <option value="Fútbol">Fútbol</option>
                      <option value="Gimnasio">Gimnasio</option>
                    </select>
                  </div>

                  {/* Selector de Proveedores */}
                  <div className="col-md-3 admin-input-group">
                    <label className="admin-label">Proveedor</label>
                    <select 
                      className="admin-select" 
                      value={idProveedor} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setIdProveedor(val !== "" ? Number(val) : "");
                      }}
                      required
                    >
                      {proveedores.map((prov) => {
                        const idReal = prov.ID_PROVEEDOR !== undefined ? prov.ID_PROVEEDOR : prov.id_proveedor;
                        const nombreReal = prov.NOMBRE_PROVEEDOR !== undefined ? prov.NOMBRE_PROVEEDOR : prov.nombre_proveedor;
                        return (
                          <option key={idReal} value={idReal}>
                            {nombreReal}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* 👈 NUEVA SECCIÓN: Especificaciones de Variante */}
                <div className="form-section-title">Variante (Estilo y Medidas)</div>
                <div className="row">
                  {/* Campo Color */}
                  <div className="col-md-6 admin-input-group">
                    <label className="admin-label">Color del Producto</label>
                    <input 
                      type="text" 
                      className="admin-input" 
                      required 
                      value={color} 
                      onChange={(e) => setColor(e.target.value)} 
                      placeholder="Ej: Negro, Blanco/Rojo, Azul Turquesa" 
                    />
                  </div>

                  {/* Selector de Tallas (No es texto libre) */}
                  <div className="col-md-6 admin-input-group">
                    <label className="admin-label">Talla / Medida</label>
                    <select 
                      className="admin-select" 
                      value={talla} 
                      onChange={(e) => setTalla(e.target.value)}
                      required
                    >
                      {opcionesTallas.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
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

                <div className="form-section-title">Ficha Técnica Opcional</div>
                <div className="admin-input-group">
                  <label className="admin-label">Otros Atributos (Propiedad: Valor)</label>
                  <textarea 
                    className="admin-textarea" 
                    style={{ fontFamily: "monospace", fontSize: "0.85rem", borderColor: "#444" }}
                    rows={3} 
                    value={caracteristicas} 
                    onChange={(e) => setCaracteristicas(e.target.value)} 
                    placeholder={`Marca: Nike\nMaterial: Poliéster\nTecnología: Dri-FIT`}
                  />
                  <small className="text-secondary mt-2 d-block">
                    * Escribe una característica adicional por línea separada por dos puntos. La talla y el color ya se agregan automáticamente.
                  </small>
                </div>

              </div>

              <div className="modal-footer-admin">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Descartar</button>
                <button type="submit" className="btn-save-admin">Publicar Producto</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;