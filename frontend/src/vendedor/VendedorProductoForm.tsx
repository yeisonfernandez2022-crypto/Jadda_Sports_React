import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import {
  FaArrowLeft, FaPalette, FaTags, FaClipboardList, FaSave, FaTimes,
  FaTrashAlt, FaPlusCircle,
} from "react-icons/fa";
import VendedorNavbar from "./VendedorNavbar";
import AdminFooter from "../admin/AdminFooter";
import SubirImagenes from "../admin/SubirImagenes";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import "../css/vendedor.css";

interface Variante { COLOR: string; NOMBRE_ATRIBUTO: string; ATRIBUTO: string; STOCK: string; }
interface Caracteristica { propiedad: string; valor: string; }

const TIPOS_ATRIBUTO = ["Talla", "Peso", "Capacidad", "Longitud", "Diámetro", "Voltaje", "Potencia", "Resistencia", "Material", "Tamaño"];

const VendedorProductoForm = () => {
  const { id } = useParams<{ id: string }>();
  const esEdicion = !!id;
  const navigate = useNavigate();

  const [categorias, setCategorias] = useState<any[]>([]);
  const [descuentos, setDescuentos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(esEdicion);
  const [estado, setEstado] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [precio, setPrecio] = useState("");
  const [idCategoria, setIdCategoria] = useState<number | string>("");
  const [idDescuento, setIdDescuento] = useState<number | string>("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenes, setImagenes] = useState<string[]>([]);
  const [variantes, setVariantes] = useState<Variante[]>([{ COLOR: "", NOMBRE_ATRIBUTO: "Talla", ATRIBUTO: "", STOCK: "" }]);
  const [caracteristicas, setCaracteristicas] = useState<Caracteristica[]>([{ propiedad: "", valor: "" }]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/productos/categorias")
      .then((r) => r.json())
      .then((d) => {
        setCategorias(d);
        if (d.length > 0 && !idCategoria) setIdCategoria(d[0].ID_CATEGORIA);
      })
      .catch(() => {});
    fetch("/api/productos/descuentos")
      .then((r) => r.json())
      .then(setDescuentos)
      .catch(() => {});
    if (esEdicion) {
      fetch(`/api/vendedor/productos/${id}`, { credentials: "include" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((p) => {
          setNombre(p.NOMBRE || "");
          setMarca(p.MARCA || "");
          setPrecio(String(p.PRECIO ?? ""));
          setIdCategoria(p.ID_CATEGORIA || "");
          setIdDescuento(p.ID_DESCUENTO || "");
          setDescripcion(p.DESCRIPCION || "");
          setImagenes((p.IMAGENES || []).map((i: any) => i.url));
          setVariantes((p.VARIANTES || []).map((v: any) => ({
            COLOR: v.COLOR || "", NOMBRE_ATRIBUTO: v.NOMBRE_ATRIBUTO || "Talla",
            ATRIBUTO: v.ATRIBUTO || "", STOCK: String(v.STOCK ?? ""),
          })));
          setCaracteristicas((p.CARACTERISTICAS || []).map((c: any) => ({
            propiedad: c.NOMBRE_ATRIBUTO || "", valor: c.VALOR_ATRIBUTO || "",
          })));
          setEstado(p.ESTADO_PUBLICACION || null);
        })
        .catch(() => Swal.fire({ icon: "error", title: "No se pudo cargar el producto", confirmButtonColor: "#e63946" }))
        .finally(() => setCargando(false));
    } else {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const guardar = async () => {
    if (!nombre.trim() || !precio) {
      Swal.fire({ icon: "warning", title: "Completa los campos", text: "Nombre y precio son obligatorios.", confirmButtonColor: "#1aa084" });
      return;
    }
    if (imagenes.length === 0) {
      Swal.fire({ icon: "warning", title: "Falta la imagen", text: "Sube al menos una imagen del producto.", confirmButtonColor: "#1aa084" });
      return;
    }
    setGuardando(true);
    const body = {
      NOMBRE: nombre.trim(),
      MARCA: marca.trim(),
      PRECIO: Number(precio),
      ID_CATEGORIA: Number(idCategoria) || 1,
      ID_DESCUENTO: idDescuento ? Number(idDescuento) : null,
      DESCRIPCION: descripcion,
      IMAGENES: imagenes,
      VARIANTES: variantes
        .filter((v) => v.COLOR || v.ATRIBUTO)
        .map((v) => ({ ...v, STOCK: Number(v.STOCK) || 0 })),
      CARACTERISTICAS: caracteristicas.filter((c) => c.propiedad.trim() && c.valor.trim()),
    };
    const url = esEdicion ? `/api/vendedor/productos/${id}` : "/api/vendedor/productos";
    const method = esEdicion ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Error");
      await Swal.fire({
        icon: "success",
        title: esEdicion ? "Producto actualizado" : "Producto enviado a revisión",
        text: esEdicion
          ? "Volvió a revisión para re-aprobación."
          : "El equipo de JADDA lo revisará en menos de 48 horas.",
        confirmButtonColor: "#1aa084",
      });
      navigate("/vendedor/productos");
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "No se pudo guardar", text: err.message || "Error", confirmButtonColor: "#e63946" });
    } finally {
      setGuardando(false);
    }
  };

  const setV = (i: number, campo: keyof Variante, valor: string) =>
    setVariantes((arr) => arr.map((v, idx) => (idx === i ? { ...v, [campo]: valor } : v)));
  const setC = (i: number, campo: keyof Caracteristica, valor: string) =>
    setCaracteristicas((arr) => arr.map((c, idx) => (idx === i ? { ...c, [campo]: valor } : c)));

  return (
    <div className="admin-page">
      <VendedorNavbar />
      <div className="admin-content">
        <div className="au-header-col">
          <button className="ven-btn cancelar" onClick={() => navigate("/vendedor/productos")}>
            <FaArrowLeft /> Volver a mis productos
          </button>
          <div className="w-100 d-flex justify-content-between align-items-start">
            <div>
              <Breadcrumb
                items={[
                  { label: "Mi tienda", to: "/vendedor" },
                  { label: "Mis productos", to: "/vendedor/productos" },
                  { label: esEdicion ? "Editar producto" : "Publicar producto" },
                ]}
              />
              <div className="au-titulos">
                <h1>{esEdicion ? "Editar producto" : "Publicar producto"}</h1>
                <p>
                  {esEdicion
                    ? "Al guardar, el producto vuelve a revisión del equipo de JADDA."
                    : "Tu producto quedará en revisión antes de publicarse en la tienda."}
                </p>
              </div>
            </div>
            {esEdicion && estado && (
              <span className={`ven-badge ${estado === "APROBADO" ? "aprobado" : estado === "PENDIENTE" ? "pendiente" : "rechazado"}`}>
                {estado === "APROBADO" ? "Aprobado" : estado === "PENDIENTE" ? "En revisión" : "Rechazado"}
              </span>
            )}
          </div>
        </div>

        {cargando ? (
          <div className="ven-vacio">Cargando producto…</div>
        ) : (
          <div className="ven-form">
            <div className="ven-form-grid">
              <div>
                <label>Nombre del producto *</label>
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Balón de fútbol profesional" />
              </div>
              <div>
                <label>Marca</label>
                <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Ej: Adidas" />
              </div>
              <div>
                <label>Precio (COP) *</label>
                <input type="number" min="0" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Ej: 120000" />
              </div>
              <div>
                <label>Categoría</label>
                <select value={idCategoria} onChange={(e) => setIdCategoria(e.target.value)}>
                  {categorias.map((c) => (
                    <option key={c.ID_CATEGORIA} value={c.ID_CATEGORIA}>{c.NOMBRE_CATEGORIA}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>Descuento</label>
                <select value={idDescuento} onChange={(e) => setIdDescuento(e.target.value)}>
                  <option value="">Sin descuento</option>
                  {descuentos.map((d) => (
                    <option key={d.ID_DESCUENTO} value={d.ID_DESCUENTO}>{d.DESCRIPCION} (-{d.PORCENTAJE}%)</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="ven-form-section">
              <label>Descripción</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Describe el producto, sus usos y beneficios…" />
            </div>

            <div className="ven-form-section">
              <h4><FaTags /> Imágenes del producto</h4>
              <SubirImagenes urls={imagenes} onChange={setImagenes} idProducto={esEdicion ? Number(id) : undefined} />
            </div>

            <div className="ven-form-section">
              <h4><FaPalette /> Variantes (color, talla, stock)</h4>
              {variantes.map((v, i) => (
                <div key={i} className="ven-variante-row">
                  <input placeholder="Color (ej: Negro)" value={v.COLOR} onChange={(e) => setV(i, "COLOR", e.target.value)} />
                  <select value={v.NOMBRE_ATRIBUTO} onChange={(e) => setV(i, "NOMBRE_ATRIBUTO", e.target.value)}>
                    {TIPOS_ATRIBUTO.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input placeholder={`Valor (ej: 39)`} value={v.ATRIBUTO} onChange={(e) => setV(i, "ATRIBUTO", e.target.value)} />
                  <input type="number" min="0" placeholder="Stock" value={v.STOCK} onChange={(e) => setV(i, "STOCK", e.target.value)} />
                  <button className="ven-row-del" type="button" onClick={() => setVariantes((arr) => arr.filter((_, idx) => idx !== i))}><FaTrashAlt /></button>
                </div>
              ))}
              <button className="ven-row-add" type="button" onClick={() => setVariantes((arr) => [...arr, { COLOR: "", NOMBRE_ATRIBUTO: "Talla", ATRIBUTO: "", STOCK: "" }])}>
                <FaPlusCircle /> Agregar variante
              </button>
            </div>

            <div className="ven-form-section">
              <h4><FaClipboardList /> Características técnicas</h4>
              {caracteristicas.map((c, i) => (
                <div key={i} className="ven-carac-row">
                  <input placeholder="Propiedad (ej: Material)" value={c.propiedad} onChange={(e) => setC(i, "propiedad", e.target.value)} />
                  <input placeholder="Valor (ej: Poliéster)" value={c.valor} onChange={(e) => setC(i, "valor", e.target.value)} />
                  <button className="ven-row-del" type="button" onClick={() => setCaracteristicas((arr) => arr.filter((_, idx) => idx !== i))}><FaTrashAlt /></button>
                </div>
              ))}
              <button className="ven-row-add" type="button" onClick={() => setCaracteristicas((arr) => [...arr, { propiedad: "", valor: "" }])}>
                <FaPlusCircle /> Agregar característica
              </button>
            </div>

            <div className="ven-form-actions">
              <button className="ven-btn guardar" onClick={guardar} disabled={guardando}>
                <FaSave /> {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Enviar a revisión"}
              </button>
              <button className="ven-btn cancelar" onClick={() => navigate("/vendedor/productos")}>
                <FaTimes /> Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
      <AdminFooter />
    </div>
  );
};

export default VendedorProductoForm;