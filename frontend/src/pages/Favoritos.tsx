import "../css/Favoritos.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { FaChevronDown, FaChevronUp, FaHeart, FaUndo } from "react-icons/fa";
import Breadcrumb from "../components/Breadcrumb";
import ProductCard from "../components/ProductCard";
import SelectorVarianteModal from "../components/SelectorVarianteModal";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";

interface Favorito {
  ID_FAVORITO: number;
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  MARCA: string;
  IMAGEN: string;
  FECHA_AGREGADO: string;
  ID_VARIANTE_POR_DEFECTO?: number | null;
  STOCK?: number;
  ID_DESCUENTO?: number | null;
  RATING?: number | null;
  RESENA_COUNT?: number;
}

type ProductoCatalogo = {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  MARCA?: string;
  IMAGEN: string;
  STOCK?: number;
  ID_VARIANTE_POR_DEFECTO?: number;
  ID_DESCUENTO?: number | null;
  RATING?: number | null;
  RESENA_COUNT?: number;
};

interface Recomendado {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  MARCA?: string;
  IMAGEN: string;
  ID_DESCUENTO?: number | null;
  STOCK?: number;
  RATING?: number | null;
  RESENA_COUNT?: number;
}

const RECO_INICIAL = 8;

export default function Favoritos() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { esVendedor } = useAuth();
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [loading, setLoading] = useState(true);
  const [deshacer, setDeshacer] = useState<{ favorito: Favorito | null; segundos: number }>({ favorito: null, segundos: 5 });
  const [recomendados, setRecomendados] = useState<Recomendado[]>([]);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});
  const [productosMap, setProductosMap] = useState<Record<number, ProductoCatalogo>>({});
  const [productoModal, setProductoModal] = useState<ProductoCatalogo | null>(null);
  const [verMasReco, setVerMasReco] = useState(false);

  const fetchFavoritos = async () => {
    try {
      const res = await axios.get("/api/favoritos", { withCredentials: true });
      setFavoritos(res.data);
    } catch { console.error("Error al cargar favoritos");
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchFavoritos();
    const cargarRecomendados = async () => {
      try {
        const [rec, dcts, prods] = await Promise.all([
          axios.get("/api/productos/recomendados?limite=16", { withCredentials: true }),
          axios.get("/api/productos/descuentos"),
          axios.get("/api/productos"),
        ]);
        setRecomendados(Array.isArray(rec.data?.productos) ? rec.data.productos : []);
        const map: Record<number, number> = {};
        (Array.isArray(dcts.data) ? dcts.data : []).forEach((d: { ID_DESCUENTO: number; PORCENTAJE: number }) => {
          map[d.ID_DESCUENTO] = d.PORCENTAJE;
        });
        setDescuentosMap(map);
        const mapaProductos: Record<number, ProductoCatalogo> = {};
        (Array.isArray(prods.data) ? prods.data : []).forEach((p: ProductoCatalogo) => {
          mapaProductos[p.ID] = p;
        });
        setProductosMap(mapaProductos);
      } catch { /* recomendados best-effort: sin sesión o error se ocultan */ }
    };
    cargarRecomendados();
  }, []);

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

  const esFavoritoDe = (idProducto: number) => favoritos.some(f => f.ID === idProducto);

  const quitarFavoritoPorId = (idProducto: number) => {
    const fav = favoritos.find(f => f.ID === idProducto);
    if (fav) eliminarFavorito(fav);
  };

  const abrirAgregarCarrito = (id: number) => {
    const prod = productosMap[id];
    if (!prod) return;
    if (esVendedor) {
      Swal.fire({
        icon: "info",
        title: "Cuenta de vendedor",
        text: "Los vendedores no pueden comprar en la tienda. Usa una cuenta de cliente para realizar compras.",
        confirmButtonColor: "#e63946",
      });
      return;
    }
    setProductoModal({ ...prod, ID_VARIANTE_POR_DEFECTO: prod.ID_VARIANTE_POR_DEFECTO ?? undefined });
  };

  const favoritosCards: Favorito[] = favoritos.map(fav => {
    const prod = productosMap[fav.ID];
    return {
      ...fav,
      ...(prod ?? {}),
      ID_FAVORITO: fav.ID_FAVORITO,
      ID: fav.ID,
      NOMBRE: fav.NOMBRE,
      PRECIO: fav.PRECIO,
      MARCA: fav.MARCA,
      IMAGEN: fav.IMAGEN || prod?.IMAGEN || "https://via.placeholder.com/200",
    };
  });

  const alternarFavoritoReco = async (idProducto: number) => {
    const fav = favoritos.find(f => f.ID === idProducto);
    if (fav) {
      try {
        await axios.delete(`/api/favoritos/${fav.ID_FAVORITO}`, { withCredentials: true });
        setFavoritos(prev => prev.filter(f => f.ID_FAVORITO !== fav.ID_FAVORITO));
      } catch { console.error("Error al quitar el favorito"); }
    } else {
      try {
        await axios.post("/api/favoritos", { id_producto: idProducto }, { withCredentials: true });
        fetchFavoritos();
      } catch { console.error("Error al agregar el favorito"); }
    }
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

      <div className="fav-bloque">
        <div className="fav-header">
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
          <div className="row g-4">
            {favoritosCards.map(fav => (
              <div key={fav.ID_FAVORITO} className="col-6 col-md-4 col-lg-3">
                <ProductCard
                  producto={fav}
                  descuentoPorcentaje={fav.ID_DESCUENTO != null ? descuentosMap[fav.ID_DESCUENTO] : undefined}
                  esFavorito
                  onToggleFavorito={quitarFavoritoPorId}
                  onVerDetalle={(id) => { navigate(`/producto/${id}`); window.scrollTo(0, 0); }}
                  onAgregarCarrito={abrirAgregarCarrito}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {recomendados.length > 0 && (
        <div className="favoritos-card fav-reco-card">
          <h2 className="fav-reco-titulo">✨ Recomendados para ti</h2>
          <div className="fav-reco-grid">
            {(verMasReco ? recomendados : recomendados.slice(0, RECO_INICIAL)).map(p => (
              <ProductCard
                key={p.ID}
                producto={p}
                descuentoPorcentaje={p.ID_DESCUENTO != null ? descuentosMap[p.ID_DESCUENTO] : undefined}
                esFavorito={esFavoritoDe(p.ID)}
                onToggleFavorito={alternarFavoritoReco}
                onVerDetalle={(id) => { navigate(`/producto/${id}`); window.scrollTo(0, 0); }}
              />
            ))}
          </div>
          {recomendados.length > RECO_INICIAL && (
            <button className="fav-reco-vermas" onClick={() => setVerMasReco(v => !v)}>
              {verMasReco
                ? <>Ver menos <FaChevronUp /></>
                : <>Ver más ({recomendados.length - RECO_INICIAL} artículos) <FaChevronDown /></>}
            </button>
          )}
        </div>
      )}

      {productoModal && (
        <SelectorVarianteModal
          producto={productoModal}
          onCerrar={() => setProductoModal(null)}
          onAgregar={async (idVariante, cantidad) => {
            await addToCart(productoModal.ID, idVariante, cantidad);
            setProductoModal(null);
          }}
        />
      )}
    </div>
  );
}
