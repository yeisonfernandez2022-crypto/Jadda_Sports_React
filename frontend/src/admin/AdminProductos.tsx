import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import SubirImagenes from "./SubirImagenes";
import VistaPreviaProducto from "./VistaPreviaProducto";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import {
  FaSearch, FaEdit, FaTrashAlt, FaChevronLeft, FaChevronRight,
  FaSort, FaSortUp, FaSortDown, FaBoxOpen, FaPlusSquare,
  FaCheck, FaTimes, FaEye, FaExclamationTriangle, FaArrowLeft,
} from "react-icons/fa";

type OrdenCampo = "ID" | "NOMBRE" | "PRECIO" | "STOCK";
type Vista = "gestionar" | "publicar";

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eef2f7'/><text x='50%25' y='55%25' font-family='sans-serif' font-size='11' fill='%2394a3b8' text-anchor='middle'>JADDA</text></svg>";

const colorCategoria = (nombre: string) => {
  let hash = 0;
  for (let i = 0; i < nombre.length; i++) hash = (hash * 31 + nombre.charCodeAt(i)) % 360;
  return `hsl(${hash}, 65%, 45%)`;
};

const estadoBadge = (e: string | null) => {
  if (!e) return <span className="ap-estado jadda">Jadda</span>;
  if (e === "APROBADO") return <span className="ap-estado aprobado">Aprobado</span>;
  if (e === "PENDIENTE") return <span className="ap-estado pendiente">En revisión</span>;
  return <span className="ap-estado rechazado">Rechazado</span>;
};

const tiposAtributo = ["Talla", "Tipo", "Peso", "Capacidad", "Material", "Dimensiones"];

const PublicarForm = ({ onPublicado }: { onPublicado: () => void }) => {
  const [categorias, setCategorias] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [descuentos, setDescuentos] = useState<any[]>([]);
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [precio, setPrecio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [idCategoria, setIdCategoria] = useState("");
  const [idProveedor, setIdProveedor] = useState("");
  const [idDescuento, setIdDescuento] = useState("");
  const [imagenesUrls, setImagenesUrls] = useState<string[]>([]);
  const [variantes, setVariantes] = useState<{ COLOR: string; NOMBRE_ATRIBUTO: string; ATRIBUTO: string; STOCK: number }[]>([]);
  const [caracteristicas, setCaracteristicas] = useState<{ propiedad: string; valor: string }[]>([]);
  const [guardando, setGuardando] = useState(false);

  const variantesValidas = variantes.filter(v => v.COLOR.trim() && v.NOMBRE_ATRIBUTO && v.ATRIBUTO.trim());
  const stockTotal = variantes.reduce((sum, v) => sum + (Number(v.STOCK) || 0), 0);
  const categoriaSel = categorias.find((c) => String(c.ID_CATEGORIA) === String(idCategoria));
  const descuentoSel = descuentos.find((d) => String(d.ID_DESCUENTO) === String(idDescuento));
  const precioNum = Number(precio) || 0;
  const nombrePreview = nombre.trim() || "Nombre del producto";
  const marcaPreview = marca.trim() || "Genérico";
  const hayContenido =
    nombre.trim() !== "" ||
    marca.trim() !== "" ||
    precio !== "" ||
    descripcion.trim() !== "" ||
    idCategoria !== "" ||
    idProveedor !== "" ||
    imagenesUrls.length > 0 ||
    variantes.some((v) => v.COLOR.trim() || v.ATRIBUTO.trim());

  const camposFaltantes = [
    !nombre.trim() ? "nombre" : null,
    !(Number(precio) > 0) ? "precio" : null,
    !idCategoria ? "categoría" : null,
    !idProveedor ? "proveedor" : null,
    !descripcion.trim() ? "descripción" : null,
    imagenesUrls.length === 0 ? "al menos una imagen" : null,
    variantesValidas.length === 0 ? "una variante (color, tipo y valor)" : null,
  ].filter(Boolean) as string[];

  const puedePublicar = camposFaltantes.length === 0;

  useEffect(() => {
    fetch("/api/productos/categorias")
      .then((r) => r.json())
      .then((data) => {
        setCategorias(data);
        if (data.length > 0) setIdCategoria(String(data[0].ID_CATEGORIA));
      })
      .catch(() => {});

    fetch("/api/proveedores")
      .then((r) => r.json())
      .then((data) => {
        setProveedores(data);
        if (data.length > 0) {
          const primerId = data[0].ID_PROVEEDOR || data[0].id_proveedor;
          setIdProveedor(String(primerId));
        }
      })
      .catch(() => {});

    fetch("/api/productos/descuentos")
      .then((r) => r.json())
      .then(setDescuentos)
      .catch(() => {});
  }, []);

  const crearDescuento = async () => {
    const { value: datos, isConfirmed } = await Swal.fire({
      title: "Crear descuento",
      html: `
        <div style="display:flex;flex-direction:column;gap:12px;text-align:left">
          <div>
            <label style="font-size:.8rem;font-weight:700;color:#334155">Nombre del descuento</label>
            <input id="swal-desc-nombre" class="swal2-input" placeholder="Ej: Oferta apertura" style="width:100%;margin:4px 0 0" />
          </div>
          <div>
            <label style="font-size:.8rem;font-weight:700;color:#334155">Porcentaje (%)</label>
            <input id="swal-desc-pct" type="number" min="1" max="100" class="swal2-input" placeholder="Ej: 20" style="width:100%;margin:4px 0 0" />
          </div>
          <div>
            <label style="font-size:.8rem;font-weight:700;color:#334155">Fecha de expiración (opcional)</label>
            <input id="swal-desc-fin" type="date" class="swal2-input" style="width:100%;margin:4px 0 0" />
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Crear descuento",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      preConfirm: () => {
        const nombreInput = document.getElementById("swal-desc-nombre") as HTMLInputElement;
        const pctInput = document.getElementById("swal-desc-pct") as HTMLInputElement;
        const finInput = document.getElementById("swal-desc-fin") as HTMLInputElement;
        const nombre = (nombreInput?.value || "").trim();
        const pct = Number(pctInput?.value);
        const fin = (finInput?.value || "").trim();
        if (!nombre) {
          Swal.showValidationMessage("Escribe el nombre del descuento");
          return false;
        }
        if (!pct || pct < 1 || pct > 100) {
          Swal.showValidationMessage("El porcentaje debe estar entre 1 y 100");
          return false;
        }
        return { nombre, pct, fin };
      },
    });
    if (!isConfirmed || !datos) return;

    try {
      const res = await fetch("/api/productos/descuentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          DESCRIPCION: datos.nombre,
          PORCENTAJE: datos.pct,
          FECHA_FIN: datos.fin || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.msg || "No se pudo crear el descuento");
      await Swal.fire({
        icon: "success",
        title: "¡Descuento creado!",
        text: `${datos.nombre} (${datos.pct}%) ya está disponible para asignar`,
        confirmButtonColor: "#e63946",
      });
      const descsRes = await fetch("/api/productos/descuentos");
      setDescuentos(await descsRes.json());
      setIdDescuento(String(data.ID_DESCUENTO ?? data.id));
    } catch (err: any) {
      Swal.fire("Error", err.message || "No se pudo crear el descuento", "error");
    }
  };

  const cambiarDescuento = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === "__nuevo__") {
      crearDescuento();
      return;
    }
    setIdDescuento(e.target.value);
  };

  const handlePublicar = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre.trim()) return Swal.fire("Campo obligatorio", "Debes escribir el nombre del producto", "warning");
    if (!precio || Number(precio) <= 0) return Swal.fire("Campo obligatorio", "Debes ingresar un precio válido mayor a 0", "warning");
    if (!idCategoria) return Swal.fire("Campo obligatorio", "Debes seleccionar una categoría", "warning");
    if (!idProveedor) return Swal.fire("Campo obligatorio", "Debes seleccionar un proveedor", "warning");
    if (!descripcion.trim()) return Swal.fire("Campo obligatorio", "Debes escribir una descripción del producto", "warning");
    if (imagenesUrls.length === 0) return Swal.fire("Imágenes requeridas", "Sube al menos una imagen del producto", "warning");

    if (variantesValidas.length === 0) {
      return Swal.fire("Sin variantes", "Debes agregar al menos una variante completa (color, tipo y valor)", "warning");
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
      IMAGENES: imagenesUrls,
      VARIANTES: variantesValidas,
      CARACTERISTICAS: listaCaracteristicas,
    };

    setGuardando(true);
    try {
      const response = await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoProducto),
      });
      if (response.ok) {
        Swal.fire({
          icon: "success",
          title: "¡Producto publicado!",
          text: "Ya está visible en la tienda como JADDA SPORTS",
          confirmButtonColor: "#e63946",
        }).then(() => onPublicado());
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.msg || `Código de error: ${response.status}`);
      }
    } catch (error: any) {
      Swal.fire("Error al publicar", error.message || "No se pudo guardar el producto", "error");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={handlePublicar} className="ap-form">
      {hayContenido && (
        <div className="ap-preview">
          <div className="ap-preview-titulo">
            <FaEye /> Vista previa del producto
          </div>
          <VistaPreviaProducto
            imagen={imagenesUrls[0]}
            nombre={nombrePreview}
            marca={marcaPreview}
            precio={precioNum}
            descuentoPorcentaje={descuentoSel?.PORCENTAJE}
            categoria={categoriaSel?.NOMBRE_CATEGORIA}
            variantes={variantesValidas}
            stockTotal={stockTotal}
            descripcion={descripcion}
          />
        </div>
      )}

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
          <select className="admin-select" value={idProveedor} onChange={(e) => setIdProveedor(e.target.value)} required>
            {proveedores.map((prov) => {
              const idReal = prov.ID_PROVEEDOR ?? prov.id_proveedor;
              const nombreReal = prov.NOMBRE_PROVEEDOR ?? prov.nombre_proveedor;
              return <option key={idReal} value={idReal}>{nombreReal}</option>;
            })}
          </select>
        </div>
        <div className="col-md-6 admin-input-group">
          <label className="admin-label">Descuento (opcional)</label>
          <select className="admin-select" value={idDescuento} onChange={cambiarDescuento}>
            <option value="">Sin descuento</option>
            {descuentos.map((desc) => (
              <option key={desc.ID_DESCUENTO} value={desc.ID_DESCUENTO}>{desc.DESCRIPCION} ({desc.PORCENTAJE}%)</option>
            ))}
            <option value="__nuevo__">+ Crear nuevo descuento...</option>
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

      <div className="modal-footer-admin mt-4" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
        {!puedePublicar && (
          <p className="ap-form-aviso">
            <FaExclamationTriangle /> Debes completar todos los campos obligatorios antes de publicar
            {camposFaltantes.length > 0 && (
              <span className="ap-form-aviso-detalle">Faltan: {camposFaltantes.join(", ")}</span>
            )}
          </p>
        )}
        <button type="button" className="btn-cancel" onClick={onPublicado}>Cancelar</button>
        <button
          type="submit"
          className="btn-save-admin"
          disabled={guardando || !puedePublicar}
          title={!puedePublicar ? "Completa todos los campos obligatorios" : ""}
        >
          <FaPlusSquare className="me-1" /> {guardando ? "Publicando..." : "Publicar Producto"}
        </button>
      </div>
    </form>
  );
};

const AdminProductos = () => {
  const navigate = useNavigate();
  const [vista, setVista] = useState<Vista | null>(null);
  const [productos, setProductos] = useState<any[]>([]);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroVendedor, setFiltroVendedor] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [paginaActual, setPaginaActual] = useState(1);
  const [orden, setOrden] = useState<{ campo: OrdenCampo; dir: "asc" | "desc" }>({ campo: "ID", dir: "asc" });
  const [procesando, setProcesando] = useState<number | null>(null);
  const productosPorPagina = 10;

  const obtenerProductos = async () => {
    try {
      const res = await fetch("/api/admin/productos", { credentials: "include" });
      if (res.ok) setProductos(await res.json());
    } catch (error) {
      console.error("Error al obtener productos:", error);
    }
  };

  const obtenerCategorias = async () => {
    try {
      const res = await fetch("/api/productos/categorias");
      const data = await res.json();
      setCategorias(data);
    } catch (error) {
      console.error("Error al obtener categorías:", error);
    }
  };

  useEffect(() => {
    obtenerProductos();
    obtenerCategorias();
  }, []);

  const vendedores = Array.from(
    new Set(productos.filter((p) => p.ID_VENDEDOR).map((p) => p.VENDEDOR_NOMBRE).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, "es"));

  const productosFiltrados = productos
    .filter((prod) => {
      if (filtroCategoria && (prod.CATEGORIA || prod.categoria) !== filtroCategoria) return false;
      if (filtroVendedor) {
        if (filtroVendedor === "JADDA") {
          if (prod.ID_VENDEDOR) return false;
        } else if (!prod.ID_VENDEDOR || (prod.VENDEDOR_NOMBRE || "") !== filtroVendedor) return false;
      }
      if (filtroEstado) {
        const estado = prod.ESTADO_PUBLICACION || "";
        if (filtroEstado === "JADDA" ? estado !== "" : estado !== filtroEstado) return false;
      }
      if (!busqueda.trim()) return true;
      const q = busqueda.toLowerCase();
      const nom = (prod.NOMBRE || prod.nombre || "").toLowerCase();
      const mar = (prod.MARCA || prod.marca || "").toLowerCase();
      const cat = (prod.CATEGORIA || prod.categoria || "").toLowerCase();
      const ven = (prod.VENDEDOR_NOMBRE || "").toLowerCase();
      return nom.includes(q) || mar.includes(q) || cat.includes(q) || ven.includes(q);
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

  const cambiarEstado = async (id: number, estado: "aprobar" | "rechazar") => {
    if (procesando !== null) return;
    setProcesando(id);
    try {
      let observacion: string | undefined;
      if (estado === "rechazar") {
        const r = await Swal.fire({
          title: "Rechazar producto",
          input: "textarea",
          inputPlaceholder: "Motivo del rechazo (se lo notificamos al vendedor)…",
          inputValidator: (v) => (v && v.trim() ? "" : "Escribe el motivo del rechazo"),
          showCancelButton: true,
          confirmButtonText: "Rechazar",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#d33",
          reverseButtons: true,
        });
        if (!r.isConfirmed || !r.value) return;
        observacion = r.value.trim();
      } else {
        const r = await Swal.fire({
          title: "¿Aprobar producto?",
          text: "Se publicará en la tienda y el vendedor recibirá una notificación.",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Sí, aprobar",
          cancelButtonText: "Cancelar",
          confirmButtonColor: "#16a34a",
          reverseButtons: true,
        });
        if (!r.isConfirmed) return;
      }
      const res = await fetch(`/api/admin/productos/${id}/${estado}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ observacion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Error");
      if (!data.sinCambios) {
        Swal.fire({
          icon: "success",
          title: estado === "aprobar" ? "Producto aprobado" : "Producto rechazado",
          text: data.msg,
          confirmButtonColor: "#e63946",
        });
      }
      obtenerProductos();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.message || "No se pudo actualizar el estado", confirmButtonColor: "#e63946" });
    } finally {
      setProcesando(null);
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
          <div className="au-header-col">
            <button className="admin-volver" onClick={() => navigate("/admin")}>
              <FaArrowLeft /> Volver al Dashboard
            </button>
            <Breadcrumb items={[{ label: "Dashboard", to: "/admin" }, { label: "Productos" }]} />
            <div className="au-titulos">
              <h1>Productos</h1>
              <p>Publica nuevos productos o gestiona el catálogo completo</p>
            </div>
          </div>

          <div className="ap-cajitas">
            <button
              className={`ap-cajita ${vista === "publicar" ? "activa" : ""}`}
              onClick={() => setVista("publicar")}
            >
              <FaPlusSquare />
              <strong>Publicar</strong>
              <span>Publica un producto como JADDA SPORTS, visible de inmediato sin aprobación</span>
            </button>
            <button
              className={`ap-cajita ${vista === "gestionar" ? "activa" : ""}`}
              onClick={() => setVista("gestionar")}
            >
              <FaBoxOpen />
              <strong>Gestionar productos</strong>
              <span>Ver todos los productos: los de JADDA SPORTS y los de vendedores ({productos.length})</span>
            </button>
          </div>

          {vista === "publicar" && (
            <PublicarForm onPublicado={() => { setVista("gestionar"); obtenerProductos(); }} />
          )}

          {vista === "gestionar" && (
            <>
              <div className="ap-toolbar">
                <div className="ap-search">
                  <FaSearch />
                  <input
                    type="text"
                    placeholder="Buscar por nombre, marca, categoría o vendedor..."
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
                <select className="ap-filtro" value={filtroVendedor} onChange={(e) => { setFiltroVendedor(e.target.value); setPaginaActual(1); }}>
                  <option value="">Todas las tiendas/vendedores</option>
                  <option value="JADDA">Tienda Jadda Sports</option>
                  {vendedores.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
                <select className="ap-filtro" value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}>
                  <option value="">Todos los estados</option>
                  <option value="JADDA">Jadda Sports</option>
                  <option value="APROBADO">Aprobados</option>
                  <option value="PENDIENTE">En revisión</option>
                  <option value="RECHAZADO">Rechazados</option>
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
                    <colgroup>
                      <col style={{ width: "70px" }} />
                      <col style={{ width: "26%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "17%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "11%" }} />
                      <col style={{ width: "112px" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th style={{ width: "70px" }}>Imagen</th>
                        <th className="ap-sortable" onClick={() => cambiarOrden("NOMBRE")}>
                          Producto <IconoOrden campo="NOMBRE" />
                        </th>
                        <th>Categoría</th>
                        <th>Tienda / Vendedor</th>
                        <th>Estado</th>
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
                        const estado = prod.ESTADO_PUBLICACION || null;
                        const esVendedorProd = !!prod.ID_VENDEDOR;
                        const colorCat = colorCategoria(categoriaReal);

                        return (
                          <tr key={idReal}>
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
                              <div className="ap-nombre" title={nombreReal}>{nombreReal}</div>
                              {marcaReal && <div className="ap-marca" title={marcaReal}>{marcaReal}</div>}
                            </td>
                            <td>
                              <span className="ap-chip" style={{ background: `${colorCat}18`, color: colorCat }}>
                                {categoriaReal}
                              </span>
                            </td>
                            <td>
                              <span className={`ap-vendedor ${esVendedorProd ? "" : "jadda"}`}>
                                {esVendedorProd ? `Vendedor: ${prod.VENDEDOR_NOMBRE}` : "Tienda: Jadda Sports"}
                              </span>
                            </td>
                            <td>{estadoBadge(estado)}</td>
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
                              {esVendedorProd && estado === "PENDIENTE" && (
                                <>
                                  <button
                                    className="ap-btn-accion aprobar"
                                    title="Aprobar producto"
                                    disabled={procesando !== null}
                                    onClick={() => cambiarEstado(idReal, "aprobar")}
                                  >
                                    <FaCheck />
                                  </button>
                                  <button
                                    className="ap-btn-accion rechazar"
                                    title="Rechazar producto"
                                    disabled={procesando !== null}
                                    onClick={() => cambiarEstado(idReal, "rechazar")}
                                  >
                                    <FaTimes />
                                  </button>
                                </>
                              )}
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
            </>
          )}
        </div>
      </div>
      <AdminFooter />
    </div>
  );
};

export default AdminProductos;