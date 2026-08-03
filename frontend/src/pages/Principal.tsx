import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import Navbar from "../components/Navbar";
import ProductCard from "../components/ProductCard";
import "../css/principal.css";
import "../css/catalogo.css";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import Swal from "sweetalert2";

interface Producto {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  MARCA: string;
  IMAGEN: string;
  ID_DESCUENTO: number | null;
  ID_VARIANTE_POR_DEFECTO: number;
}

interface Categoria {
  ID_CATEGORIA: number;
  NOMBRE_CATEGORIA: string;
}

interface Descuento {
  ID_DESCUENTO: number;
  PORCENTAJE: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  "Fútbol": "fa-futbol",
  "Baloncesto": "fa-basketball-ball",
  "Running": "fa-running",
  "Gimnasio": "fa-dumbbell",
  "Natación": "fa-swimmer",
  "Ciclismo": "fa-bicycle",
  "Deportes extremos": "fa-mountain",
  "Ropa deportiva": "fa-tshirt",
  "Accesorios": "fa-cogs",
  "Protección": "fa-shield-alt",
  "Cardio": "fa-heartbeat",
  "Hogar fitness": "fa-home",
  "Suplementos": "fa-flask",
  "Tecnología deportiva": "fa-microchip",
  "Ofertas": "fa-tags",
};

const BANNERS = [
  { src: "/images/banner-principal-1.png?v=3", alt: "Lo mejor del deporte" },
  { src: "/images/banner-principal-2.png?v=3", alt: "Para cada meta, solo lo mejor" },
  { src: "/images/banner-principal-3.png?v=3", alt: "Tu tienda deportiva de confianza" },
  { src: "/images/banner-principal-4.png?v=3", alt: "Equípate con JADDA Sports" },
];

function Principal() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { usuarioLogueado } = useAuth();
  const [slideIndex, setSlideIndex] = useState(0);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoritos, setFavoritos] = useState<{ ID: number; ID_FAVORITO: number }[]>([]);

  useEffect(() => {
    AOS.init({ duration: 1000, once: true, offset: -120 });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [prods, cats, dcts] = await Promise.all([
          fetch("/api/productos").then((r) => r.json()),
          fetch("/api/productos/categorias").then((r) => r.json()),
          fetch("/api/productos/descuentos").then((r) => r.json()),
        ]);
        setProductos(prods);
        setCategorias(cats);

        const map: Record<number, number> = {};
        (dcts as Descuento[]).forEach((d) => {
          map[d.ID_DESCUENTO] = d.PORCENTAJE;
        });
        setDescuentosMap(map);
      } catch {
        setError("Error al cargar la página. Intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  useEffect(() => {
    if (!usuarioLogueado) return;
    fetch("/api/favoritos", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        setFavoritos(data.map((f: any) => ({ ID: f.ID, ID_FAVORITO: f.ID_FAVORITO })));
      })
      .catch(() => {});
  }, [usuarioLogueado]);

  const [historial, setHistorial] = useState<any[]>([]);

  useEffect(() => {
    const cargarHistorial = async () => {
      try {
        if (usuarioLogueado) {
          const res = await fetch("/api/historial", { credentials: "include" });
          if (res.ok) setHistorial(await res.json());
        } else {
          setHistorial(JSON.parse(localStorage.getItem("historial") || "[]"));
        }
      } catch { /* sin historial */ }
    };
    cargarHistorial();
  }, [usuarioLogueado]);

  const toggleFavorito = async (id: number) => {
    if (!usuarioLogueado) {
      Swal.fire({
        title: "INICIA SESIÓN",
        text: "Debes iniciar sesión para guardar favoritos.",
        icon: "warning",
        background: '#121212',
        color: '#ffffff',
        confirmButtonColor: '#e73737'
      });
      return;
    }
    const Toast = Swal.mixin({ toast: true, position: "bottom", showConfirmButton: false, timer: 2000, timerProgressBar: true });
    const existente = favoritos.find(f => f.ID === id);
    try {
      if (existente) {
        await fetch(`/api/favoritos/${existente.ID_FAVORITO}`, { method: "DELETE", credentials: "include" });
        setFavoritos(prev => prev.filter(f => f.ID !== id));
        Toast.fire({ icon: "success", title: "Se quitó de favoritos" });
      } else {
        const res = await fetch("/api/favoritos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id_producto: id })
        });
        if (!res.ok) return;
        const favRes = await fetch("/api/favoritos", { credentials: "include" });
        const data = await favRes.json();
        setFavoritos(data.map((f: any) => ({ ID: f.ID, ID_FAVORITO: f.ID_FAVORITO })));
        Toast.fire({ icon: "success", title: "Se agregó a favoritos" });
      }
    } catch (err) {
      console.error("Error al toggle favorito:", err);
    }
  };

  const productosMostrados = productos.slice(0, 12);
  const productosOferta = productos.filter((p) => p.ID_DESCUENTO != null);
  const historialCompleto = historial.map((h: any) => productos.find((p) => p.ID === h.ID) || h);

  if (loading) {
    return (
      <div className="principal-wrapper">
        <Navbar />
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
          <div className="spinner-border text-danger" style={{ width: "3rem", height: "3rem" }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="principal-wrapper">
        <Navbar />
        <div className="d-flex flex-column justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
          <h3 className="text-muted">{error}</h3>
          <button className="btn btn-danger mt-3" onClick={() => window.location.reload()}>
            REINTENTAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="principal-wrapper">
      <Navbar />

      {/* ===== 1. BANNER SLIDESHOW ===== */}
      <header className="position-relative overflow-hidden slideshow-header">
        {BANNERS.map((b, i) => (
          <div
            key={i}
            className="position-absolute w-100 h-100 slideshow-slide"
            style={{
              opacity: i === slideIndex ? 1 : 0,
              zIndex: i === slideIndex ? 1 : 0,
            }}
          >
            <img
              src={b.src}
              alt={b.alt}
              className="w-100 h-100"
              style={{ objectFit: "cover", cursor: "pointer" }}
              onClick={() => navigate("/catalogo")}
            />
          </div>
        ))}

        <button className="slideshow-arrow slideshow-arrow-prev" onClick={(e) => { e.stopPropagation(); setSlideIndex((prev) => (prev - 1 + BANNERS.length) % BANNERS.length); }}>
          <i className="fas fa-chevron-left"></i>
        </button>

        <button className="slideshow-arrow slideshow-arrow-next" onClick={(e) => { e.stopPropagation(); setSlideIndex((prev) => (prev + 1) % BANNERS.length); }}>
          <i className="fas fa-chevron-right"></i>
        </button>

        <div className="position-absolute bottom-0 start-50 translate-middle-x mb-3 d-flex gap-2 z-2">
          {BANNERS.map((_, i) => (
            <button
              key={i}
              className="border-0 rounded-circle slideshow-dot"
              style={{
                width: 12,
                height: 12,
                background: i === slideIndex ? "#e73737" : "rgba(255,255,255,0.5)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSlideIndex(i);
              }}
            />
          ))}
        </div>
      </header>

      <main className="container">
        {/* ===== 2. PRODUCTOS ===== */}
        <section className="mb-5 pt-4">
          <h2 className="text-center mb-4" data-aos="fade-down">
            PRODUCTOS
          </h2>

          <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
            {productosMostrados.map((p) => (
              <div className="col" key={p.ID} data-aos="fade-up">
                <ProductCard
                  producto={p}
                  onVerDetalle={(id) => {
                    navigate(`/producto/${id}`);
                    window.scrollTo(0, 0);
                  }}
                  onAgregarCarrito={async (id) => {
                    const prod = productos.find(x => x.ID === id);
                    if (prod) {
                      await addToCart(id, prod.ID_VARIANTE_POR_DEFECTO);
                    }
                  }}
                  onToggleFavorito={toggleFavorito}
                  esFavorito={favoritos.some(f => f.ID === p.ID)}
                />
              </div>
            ))}
          </div>

          <div className="text-center mt-4">
            <Link to="/catalogo" className="btn btn-danger fw-bold px-5 py-2">
              VER TODO EL CATÁLOGO →
            </Link>
          </div>
        </section>

        {/* ===== 3. OFERTAS ===== */}
        {productosOferta.length > 0 && (
          <section className="mb-5">
            <h2 className="text-center mb-4" data-aos="fade-down">
              🏷️ OFERTAS
            </h2>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
              {productosOferta.map((p) => (
                <div className="col" key={p.ID} data-aos="fade-up">
                  <ProductCard
                    producto={p}
                    descuentoPorcentaje={descuentosMap[p.ID_DESCUENTO!]}
                    onVerDetalle={(id) => {
                      navigate(`/producto/${id}`);
                      window.scrollTo(0, 0);
                    }}
                    onAgregarCarrito={async (id) => {
                      const prod = productos.find(x => x.ID === id);
                      if (prod) {
                        await addToCart(id, prod.ID_VARIANTE_POR_DEFECTO);
                      }
                    }}
                    onToggleFavorito={toggleFavorito}
                    esFavorito={favoritos.some(f => f.ID === p.ID)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== 4. RECIENTEMENTE VISTOS ===== */}
        {historial.length > 0 && (
          <section className="mb-5">
            <h2 className="text-center mb-4" data-aos="fade-down">
              🕐 RECIENTEMENTE VISTOS
            </h2>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
              {historialCompleto.slice(0, 8).map((p, i) => (
                <div className="col" key={`${p.ID}-${i}`} data-aos="fade-up">
                  <ProductCard
                    producto={p}
                    descuentoPorcentaje={
                      p.ID_DESCUENTO != null ? descuentosMap[p.ID_DESCUENTO] : undefined
                    }
                    onVerDetalle={(id) => {
                      navigate(`/producto/${id}`);
                      window.scrollTo(0, 0);
                    }}
                    onAgregarCarrito={
                      p.ID_VARIANTE_POR_DEFECTO
                        ? async (id) => { await addToCart(id, p.ID_VARIANTE_POR_DEFECTO); }
                        : undefined
                    }
                    onToggleFavorito={toggleFavorito}
                    esFavorito={favoritos.some(f => f.ID === p.ID)}
                  />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== 5. CATEGORÍAS ===== */}
        <section className="mb-5">
          <h2 className="text-center mb-4" data-aos="fade-down">
            CATEGORÍAS
          </h2>

          <div className="row row-cols-2 row-cols-sm-3 row-cols-md-5 g-3">
            {categorias.map((cat, i) => (
              <div
                className="col"
                key={cat.ID_CATEGORIA}
                data-aos="fade-up"
                data-aos-delay={(i % 5) * 50}
              >
                <div
                  className="categoria-card card h-100 shadow-sm border-0 d-flex flex-column align-items-center justify-content-center p-3 text-center"
                  style={{ cursor: "pointer", borderRadius: "16px", minHeight: "130px" }}
                  onClick={() =>
                    navigate(`/catalogo?cat=${encodeURIComponent(cat.NOMBRE_CATEGORIA)}`)
                  }
                >
                  <i className={`fas ${CATEGORY_ICONS[cat.NOMBRE_CATEGORIA] || "fa-tag"} fa-2x text-danger mb-2`} />
                  <h6 className="fw-bold text-uppercase mb-0" style={{ fontSize: "0.78rem", color: "#002244" }}>
                    {cat.NOMBRE_CATEGORIA}
                  </h6>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}

export default Principal;
