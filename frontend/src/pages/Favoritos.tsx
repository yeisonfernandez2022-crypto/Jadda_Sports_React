import "../css/Favoritos.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaArrowLeft, FaHeart, FaTrash, FaShoppingCart } from "react-icons/fa";

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

  const fetchFavoritos = async () => {
    try {
      const res = await axios.get("http://localhost:5000/api/favoritos", { withCredentials: true });
      setFavoritos(res.data);
    } catch { console.error("Error al cargar favoritos");
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchFavoritos(); }, []);

  const eliminarFavorito = async (id: number) => {
    try {
      await axios.delete(`http://localhost:5000/api/favoritos/${id}`, { withCredentials: true });
      setFavoritos(prev => prev.filter(f => f.ID_FAVORITO !== id));
    } catch { console.error("Error al eliminar favorito"); }
  };

  return (
    <div className="favoritos-page">
      <div className="favoritos-card">
        <div className="fav-header">
          <button className="btn-volver-fav" onClick={() => navigate("/perfil")}>
            <FaArrowLeft /> Volver
          </button>
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
                    <button className="btn-remove-fav" onClick={() => eliminarFavorito(fav.ID_FAVORITO)} title="Eliminar">
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
