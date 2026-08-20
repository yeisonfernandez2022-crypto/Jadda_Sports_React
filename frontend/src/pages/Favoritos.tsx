import "../css/Favoritos.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaArrowLeft, FaHeart, FaTrash, FaShoppingCart, FaUndo } from "react-icons/fa";
import Breadcrumb from "../components/Breadcrumb";

interface Favorito {
  ID_FAVORITO: number;
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  MARCA: string;
  IMAGEN: string;
  FECHA_AGREGADO: string;
}

export default function Favoritos() {
  const navigate = useNavigate();
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [loading, setLoading] = useState(true);
  const [deshacer, setDeshacer] = useState<{ favorito: Favorito | null; segundos: number }>({ favorito: null, segundos: 5 });

  const fetchFavoritos = async () => {
    try {
      const res = await axios.get("/api/favoritos", { withCredentials: true });
      setFavoritos(res.data);
    } catch { console.error("Error al cargar favoritos");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchFavoritos(); }, []);

  useEffect(() => {
    if (!deshacer.favorito) return;
    if (deshacer.segundos <= 0) {
      setDeshacer({ favorito: null, segundos: 5 });
      return;
    }
    const timer = setTimeout(() => {
      setDeshacer(prev => ({ ...prev, segundos: prev.segundos - 1 }));
    }, 1000);
    return () => clearTimeout(timer);
  }, [deshacer]);

  const eliminarFavorito = async (fav: Favorito) => {
    try {
      await axios.delete(`/api/favoritos/${fav.ID_FAVORITO}`, { withCredentials: true });
      setFavoritos(prev => prev.filter(f => f.ID_FAVORITO !== fav.ID_FAVORITO));
      setDeshacer({ favorito: fav, segundos: 5 });
    } catch { console.error("Error al eliminar favorito"); }
  };

  const deshacerEliminacion = async () => {
    const fav = deshacer.favorito;
    if (!fav) return;
    try {
      await axios.post("/api/favoritos", { id_producto: fav.ID }, { withCredentials: true });
      setDeshacer({ favorito: null, segundos: 5 });
      fetchFavoritos();
    } catch { console.error("Error al restaurar favorito"); }
  };

  return (
    <div className="favoritos-page">
      {deshacer.favorito && (
        <div className="fav-undo-bar">
          <span>
            Se eliminó <strong>{deshacer.favorito.NOMBRE}</strong> de favoritos
          </span>
          <button className="fav-undo-btn" onClick={deshacerEliminacion}>
            <FaUndo /> Deshacer ({deshacer.segundos}s)
          </button>
        </div>
      )}

      <div className="favoritos-card">
        <div className="fav-header">
          <button className="btn-volver-fav" onClick={() => navigate("/perfil")}>
            <FaArrowLeft /> Volver
          </button>
          <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Mis Favoritos" }]} />
          <h1>
            <FaHeart className="fav-icon-title" /> Mis Favoritos
          </h1>
          {!loading && <p className="fav-count">{favoritos.length} productos</p>}
        </div>

        {loading ? (
          <div className="fav-loading">Cargando...</div>
        ) : favoritos.length === 0 ? (
          <div className="fav-empty">
            <FaHeart className="fav-empty-icon" />
            <h3>No tienes favoritos</h3>
            <p>Agrega productos a tu lista de deseos</p>
            <button className="btn-ir-tienda" onClick={() => navigate("/catalogo")}>
              Ir a la tienda
            </button>
          </div>
        ) : (
          <div className="fav-grid">
            {favoritos.map(fav => (
              <div key={fav.ID_FAVORITO} className="fav-item">
                <div className="fav-img-wrapper" onClick={() => navigate(`/producto/${fav.ID}`)}>
                  <img src={fav.IMAGEN || "https://via.placeholder.com/200"} alt={fav.NOMBRE} loading="lazy" onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }} />
                </div>
                <div className="fav-item-body">
                  <small className="fav-marca">{fav.MARCA}</small>
                  <h3 onClick={() => navigate(`/producto/${fav.ID}`)}>{fav.NOMBRE}</h3>
                  <p className="fav-precio">${fav.PRECIO.toLocaleString("es-CO")}</p>
                  <div className="fav-actions">
                    <button className="btn-add-cart" onClick={() => navigate(`/producto/${fav.ID}`)}>
                      <FaShoppingCart /> Ver producto
                    </button>
                    <button className="btn-remove-fav" onClick={() => eliminarFavorito(fav)} title="Eliminar">
                      <FaTrash />
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
