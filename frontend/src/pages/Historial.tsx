import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaHistory, FaShoppingCart } from "react-icons/fa";
import "../css/Favoritos.css";

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
    <div className="favoritos-page" style={{ paddingTop: "120px" }}>
      <div className="favoritos-card">
        <div className="fav-header">
          <button className="btn-volver-fav" onClick={() => navigate(-1)}>
            <FaArrowLeft /> Volver
          </button>
          <h1>
            <FaHistory style={{ color: "#e63946" }} /> Productos vistos
          </h1>
          <p className="fav-count">{historial.length} productos</p>
        </div>

        {loading ? (
          <div className="fav-loading">Cargando...</div>
        ) : historial.length === 0 ? (
          <div className="fav-empty">
            <FaHistory className="fav-empty-icon" />
            <h3>No has visto productos</h3>
            <p>Los productos que visites aparecerán aquí</p>
            <button className="btn-ir-tienda" onClick={() => navigate("/catalogo")}>
              Ir a la tienda
            </button>
          </div>
        ) : (
          <div className="fav-grid">
            {historial.map(item => (
              <div key={item.ID} className="fav-item">
                <div className="fav-img-wrapper" onClick={() => navigate(`/producto/${item.ID}`)}>
                  <img
                    src={item.IMAGEN || "https://via.placeholder.com/200"}
                    alt={item.NOMBRE}
                    loading="lazy"
                    onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }}
                  />
                </div>
                <div className="fav-item-body">
                  <small className="fav-marca">Visto: {formatearFecha(item.FECHA_VISTO)}</small>
                  <h3 onClick={() => navigate(`/producto/${item.ID}`)}>{item.NOMBRE}</h3>
                  <p className="fav-precio">${item.PRECIO.toLocaleString("es-CO")}</p>
                  <div className="fav-actions">
                    <button className="btn-add-cart" onClick={() => navigate(`/producto/${item.ID}`)}>
                      <FaShoppingCart /> Ver producto
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
