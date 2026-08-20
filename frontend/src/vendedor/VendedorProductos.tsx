import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import {
  FaPlusCircle, FaEdit, FaTrashAlt, FaBoxOpen, FaStar, FaArrowLeft,
} from "react-icons/fa";
import VendedorNavbar from "./VendedorNavbar";
import AdminFooter from "../admin/AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import "../css/vendedor.css";

const PLACEHOLDER_IMG = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='%23eef2f7'/><text x='50%25' y='55%25' font-family='sans-serif' font-size='11' fill='%2394a3b8' text-anchor='middle'>JADDA</text></svg>";

const estadoBadge = (e: string | null) => {
  if (!e) return <span className="ven-badge publicado">Publicado</span>;
  if (e === "APROBADO") return <span className="ven-badge aprobado">Aprobado</span>;
  if (e === "PENDIENTE") return <span className="ven-badge pendiente">En revisión</span>;
  return <span className="ven-badge rechazado">Rechazado</span>;
};

const VendedorProductos = () => {
  const navigate = useNavigate();
  const [productos, setProductos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    setCargando(true);
    fetch("/api/vendedor/productos", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setProductos)
      .catch(() => setProductos([]))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const filtrados = productos.filter((p) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (p.NOMBRE || "").toLowerCase().includes(q) ||
      (p.MARCA || "").toLowerCase().includes(q) ||
      (p.CATEGORIA || "").toLowerCase().includes(q);
  });

  const eliminar = async (p: any) => {
    const r = await Swal.fire({
      title: "¿Eliminar producto?",
      text: `"${p.NOMBRE}" se eliminará permanentemente.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
      reverseButtons: true,
    });
    if (!r.isConfirmed) return;
    const res = await fetch(`/api/vendedor/productos/${p.ID}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      Swal.fire({ icon: "success", title: "Eliminado", text: data.msg, confirmButtonColor: "#1aa084" });
      cargar();
    } else {
      Swal.fire({ icon: "error", title: "No se pudo eliminar", text: data.msg || "Error", confirmButtonColor: "#e63946" });
    }
  };

  return (
    <div className="admin-page">
      <VendedorNavbar />
      <div className="admin-content">
        <div className="au-header-col">
          <div className="w-100 d-flex justify-content-between align-items-start">
            <div>
              <button className="admin-volver" onClick={() => navigate("/vendedor")}>
                <FaArrowLeft /> Volver al Dashboard
              </button>
              <div className="mt-2">
                <Breadcrumb items={[{ label: "Mi tienda", to: "/vendedor" }, { label: "Mis productos" }]} />
              </div>
              <div className="au-titulos">
                <h1>Mis productos</h1>
                <p>{productos.length} producto(s) · los que pasan revisión se publican en la tienda</p>
              </div>
            </div>
            <button className="ven-btn nuevo" onClick={() => navigate("/vendedor/productos/nuevo")}>
              <FaPlusCircle /> Publicar producto
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <input
            className="ap-search"
            placeholder="Buscar por nombre, marca o categoría…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        {cargando ? (
          <div className="ven-vacio">Cargando productos…</div>
        ) : filtrados.length === 0 ? (
          <div className="ven-vacio">
            <FaBoxOpen />
            <div>{busqueda ? "Sin resultados para tu búsqueda." : "Aún no has publicado productos. Usa el botón Publicar producto."}</div>
          </div>
        ) : (
          <div className="ven-tabla-wrap">
            <table className="ven-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  <th>Stock</th>
                  <th>Estado</th>
                  <th>Reseñas</th>
                  <th style={{ textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.ID}>
                    <td>
                      <div className="ven-prod">
                        <img className="ven-prod-img" src={p.IMAGEN || PLACEHOLDER_IMG} alt={p.NOMBRE} />
                        <div style={{ minWidth: 0 }}>
                          <div className="ven-prod-nombre">{p.NOMBRE}</div>
                          <div className="ven-prod-marca">{p.MARCA}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.CATEGORIA || "—"}</td>
                    <td className="ven-precio">{Number(p.PRECIO).toLocaleString("es-CO")}</td>
                    <td>
                      <span className={`ven-stock ${Number(p.STOCK) === 0 ? "agotado" : Number(p.STOCK) <= 10 ? "bajo" : ""}`}>
                        {Number(p.STOCK) === 0 ? "Agotado" : `${p.STOCK} uds`}
                      </span>
                    </td>
                    <td>{estadoBadge(p.ESTADO_PUBLICACION)}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <FaStar style={{ color: "#f59e0b", fontSize: "0.8rem" }} /> {Number(p.RESENA_COUNT) || 0}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button className="ven-btn editar" onClick={() => navigate(`/vendedor/productos/editar/${p.ID}`)}>
                        <FaEdit /> Editar
                      </button>{" "}
                      <button className="ven-btn eliminar" onClick={() => eliminar(p)}>
                        <FaTrashAlt /> Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <AdminFooter />
    </div>
  );
};

export default VendedorProductos;