import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumb from "../components/Breadcrumb";
import { FaEye, FaHistory, FaShoppingCart } from "react-icons/fa";
import "../css/Historial.css";

interface HistorialItem {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  IMAGEN: string;
  FECHA_VISTO: string;
}

export default function Historial() {
  const navigate = useNavigate();
  const [historial, setHistorial] = useState<HistorialItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHistorial = async () => {
    try {
      const res = await fetch("/api/historial", { credentials: "include" });
      const data = await res.json();
      setHistorial(data);
    } catch {
      console.error("Error al cargar historial");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistorial(); }, []);

  const formatearFecha = (fecha: string) => {
    if (!fecha) return "";
    const d = new Date(fecha);
    return d.toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="hist-page">
      <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Historial" }]} />
      <div className="hist-header">
        <h1>
          <FaHistory className="hist-icon-title" /> Productos vistos
        </h1>
        <p className="hist-subtitle">
          {historial.length === 1
            ? "Has visto 1 producto en la tienda."
            : `Has visto ${historial.length} productos en la tienda.`}
        </p>
      </div>

      {loading ? (
        <div className="hist-loading">Cargando...</div>
      ) : historial.length === 0 ? (
        <div className="hist-empty">
          <FaHistory className="hist-empty-icon" />
          <h3>No has visto productos</h3>
          <p>Los productos que visites aparecerán aquí</p>
          <button className="hist-ir-tienda" onClick={() => navigate("/catalogo")}>
            Ir a la tienda
          </button>
        </div>
      ) : (
        <div className="hist-grid">
          {historial.map(item => (
            <div key={item.ID} className="hist-card" onClick={() => navigate(`/producto/${item.ID}`)}>
              <div className="hist-img">
                <img
                  src={item.IMAGEN || "https://via.placeholder.com/200"}
                  alt={item.NOMBRE}
                  loading="lazy"
                  onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }}
                />
              </div>
              <div className="hist-body">
                <small className="hist-visto">
                  <FaEye /> Visto: {formatearFecha(item.FECHA_VISTO)}
                </small>
                <h3>{item.NOMBRE}</h3>
                <p className="hist-precio">${Number(item.PRECIO).toLocaleString("es-CO")}</p>
                <button className="hist-ver" onClick={(e) => { e.stopPropagation(); navigate(`/producto/${item.ID}`); }}>
                  <FaShoppingCart /> Ver producto
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
