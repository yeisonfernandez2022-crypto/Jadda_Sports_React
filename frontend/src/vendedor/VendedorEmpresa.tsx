import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { FaBuilding, FaSave, FaLock, FaArrowLeft } from "react-icons/fa";
import VendedorNavbar from "./VendedorNavbar";
import AdminFooter from "../admin/AdminFooter";
import Breadcrumb from "../components/Breadcrumb";
import "../css/adminDashboard.css";
import "../css/vendedor.css";

const VendedorEmpresa = () => {
  const navigate = useNavigate();
  const [vendedor, setVendedor] = useState<any>(null);
  const [cargando, setCargando] = useState(true);
  const [telefono, setTelefono] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [direccion, setDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/vendedor/mi-tienda", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setVendedor(d.vendedor);
        setTelefono(d.vendedor.TELEFONO || "");
        setDepartamento(d.vendedor.DEPARTAMENTO || "");
        setCiudad(d.vendedor.CIUDAD || "");
        setDireccion(d.vendedor.DIRECCION || "");
      })
      .catch(() => setVendedor(null))
      .finally(() => setCargando(false));
  }, []);

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch("/api/vendedor/empresa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ TELEFONO: telefono, DEPARTAMENTO: departamento, CIUDAD: ciudad, DIRECCION: direccion }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.msg || "Error");
      setVendedor(data.vendedor);
      Swal.fire({ icon: "success", title: "Empresa actualizada", confirmButtonColor: "#1aa084" });
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "No se pudo actualizar", text: err.message, confirmButtonColor: "#e63946" });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="admin-page">
      <VendedorNavbar />
      <div className="admin-content">
        <div className="au-header-col">
          <button className="admin-volver" onClick={() => navigate("/vendedor")}>
            <FaArrowLeft /> Volver al Dashboard
          </button>
          <Breadcrumb items={[{ label: "Mi tienda", to: "/vendedor" }, { label: "Mi empresa" }]} />
          <div className="au-titulos">
            <h1>Mi empresa</h1>
            <p>Datos de tu tienda en JADDA SPORTS</p>
          </div>
        </div>

        {cargando ? (
          <div className="ven-vacio">Cargando datos de la empresa…</div>
        ) : !vendedor ? (
          <div className="ven-vacio">No pudimos cargar los datos de tu empresa.</div>
        ) : (
          <div className="ven-empresa-card">
            <div className="ven-empresa-datos">
              <div className="ven-dato-fijo">
                <span>Empresa</span>
                <strong><FaBuilding style={{ color: "#1aa084" }} /> {vendedor.NOMBRE_EMPRESA}</strong>
              </div>
              <div className="ven-dato-fijo">
                <span>NIT</span>
                <strong>{vendedor.NIT}</strong>
              </div>
              <div className="ven-dato-fijo">
                <span>Correo de la empresa</span>
                <strong>{vendedor.EMAIL_VENDEDOR}</strong>
              </div>
              <div className="ven-dato-fijo">
                <span>Categorías</span>
                <strong>{vendedor.CATEGORIAS || "—"}</strong>
              </div>
              <div className="ven-dato-fijo" style={{ gridColumn: "1 / -1" }}>
                <span><FaLock style={{ fontSize: "0.7rem" }} /> NIT, correo y categorías los gestiona el equipo de JADDA</span>
                <strong style={{ fontWeight: 500, fontSize: "0.78rem", color: "#64748b" }}>
                  Si necesitas cambiarlos, escribe a soporte desde la tienda.
                </strong>
              </div>
            </div>

            <h4 style={{ fontSize: "0.88rem", fontWeight: 800, color: "#0f172a", margin: "0 0 12px" }}>Datos de contacto editables</h4>
            <div className="ven-form-grid">
              <div>
                <label>Teléfono</label>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Ej: 3001234567" />
              </div>
              <div>
                <label>Departamento</label>
                <input value={departamento} onChange={(e) => setDepartamento(e.target.value)} placeholder="Ej: Antioquia" />
              </div>
              <div>
                <label>Ciudad</label>
                <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ej: Medellín" />
              </div>
              <div>
                <label>Dirección</label>
                <input value={direccion} onChange={(e) => setDireccion(e.target.value)} placeholder="Ej: Cra 45 # 23-12" />
              </div>
            </div>

            <div className="ven-form-actions">
              <button className="ven-btn guardar" onClick={guardar} disabled={guardando}>
                <FaSave /> {guardando ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        )}
      </div>
      <AdminFooter />
    </div>
  );
};

export default VendedorEmpresa;