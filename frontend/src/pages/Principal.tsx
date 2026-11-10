import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type TransitionEvent as ReactTransitionEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import ProductCard from "../components/ProductCard";
import SelectorVarianteModal from "../components/SelectorVarianteModal";
import TarjetaPlan from "../components/TarjetaPlan";
import TarjetaRetos from "../components/TarjetaRetos";
import "../css/principal.css";
import "../css/catalogo.css";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import Swal from "sweetalert2";
import { toggleFavoritoUI } from "../utils/favoritosUI";
import type { FavoritoItem } from "../utils/favoritosUI";
import { leerListaJson } from "../utils/leerListaJson";

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
  { src: "https://res.cloudinary.com/nggcplfk/image/upload/v1792553400/jadda/estaticos/banner-principal-1.png", alt: "Lo mejor del deporte" },
  { src: "https://res.cloudinary.com/nggcplfk/image/upload/v1792553441/jadda/estaticos/banner-principal-2.png", alt: "Para cada meta, solo lo mejor" },
  { src: "https://res.cloudinary.com/nggcplfk/image/upload/v1792553441/jadda/estaticos/banner-principal-3.png", alt: "Tu tienda deportiva de confianza" },
  { src: "https://res.cloudinary.com/nggcplfk/image/upload/v1792553441/jadda/estaticos/banner-principal-4.png", alt: "Equípate con JADDA Sports" },
];

function Principal() {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { usuarioLogueado, esVendedor } = useAuth();
  // ===== BANNER CARRUSEL pegado: pista contigua con clones para el loop infinito =====
  // La pista es [última, b0..b3, primera]: la imagen real i vive en pos i+1. Al arrastrar
  // SIEMPRE hay un vecino pegado (nunca se ve el fondo blanco) y al cruzar un clon el
  // track teletransporta sin animación a su equivalente real (carrusel circular).
  const headerRef = useRef<HTMLElement | null>(null);
  const N = BANNERS.length;
  const pista = [BANNERS[N - 1], ...BANNERS, BANNERS[0]];
  const [pos, setPos] = useState(1); // posición del track: clon 0 · reales 1..N · clon N+1
  const posRef = useRef(1);
  const [sinAnimacion, setSinAnimacion] = useState(false);
  const [arrastre, setArrastre] = useState({ activa: false, x: 0 });
  const inicioXRef = useRef(0);
  // >10px = deslizamiento: suprime el click que navega al catálogo en el img del banner
  const arrastroRef = useRef(false);
  const slideIndex = (pos - 1 + N) % N; // derivado: puntos/arrows/auto-avance usan índice real

  useEffect(() => { posRef.current = pos; }, [pos]);

  // tras el salto invisible (transition off → reflow → transition on)
  useEffect(() => {
    if (!sinAnimacion) return undefined;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setSinAnimacion(false)));
    return () => cancelAnimationFrame(id);
  }, [sinAnimacion]);

  const terminarArrastre = (dxCrudo: number) => {
    setArrastre({ activa: false, x: 0 });
    const UMBRAL = 50;
    if (dxCrudo <= -UMBRAL) setPos((p) => p + 1); // deslizar a la izquierda → siguiente
    else if (dxCrudo >= UMBRAL) setPos((p) => p - 1); // a la derecha → anterior
  };

  const bannerPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    arrastroRef.current = false;
    inicioXRef.current = e.clientX;
    setArrastre({ activa: true, x: 0 });
  };

  const bannerPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!arrastre.activa) return;
    const dx = e.clientX - inicioXRef.current;
    if (Math.abs(dx) > 10) arrastroRef.current = true;
    // tope = un ancho: más allá, el tope evita descubrir el fondo en tus yankes largos
    const ancho = headerRef.current?.clientWidth ?? 640;
    setArrastre({ activa: true, x: Math.max(-ancho, Math.min(ancho, dx)) });
  };

  const bannerPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    if (!arrastre.activa) return;
    terminarArrastre(e.clientX - inicioXRef.current);
  };

  // El dedo/ratón salió del banner arrastrando o el navegador canceló el gesto
  // (scroll vertical): termina el arrastre con el último desplazamiento
  const bannerPointerLeave = (e: ReactPointerEvent<HTMLElement>) => {
    if (!arrastre.activa) return;
    terminarArrastre(e.clientX - inicioXRef.current);
  };

  const bannerPointerCancel = () => {
    if (arrastre.activa) terminarArrastre(0);
  };

  const bannerClick = () => {
    // deslizamiento ⇒ NO es un clic en el banner
    if (arrastroRef.current) {
      arrastroRef.current = false;
      return;
    }
    navigate("/catalogo");
  };

  // al completar una animación sobre un CLON, salto invisible al equivalente real
  const alTerminarTransicion = (e: ReactTransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== "transform") return;
    const p = posRef.current;
    if (p <= 0) {
      setSinAnimacion(true);
      setPos(p + N);
    } else if (p >= N + 1) {
      setSinAnimacion(true);
      setPos(p - N);
    }
  };
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoritos, setFavoritos] = useState<FavoritoItem[]>([]);
  const [productoModal, setProductoModal] = useState<Producto | null>(null);

  // Los vendedores no pueden comprar: mensaje en lugar del modal de variantes
  const abrirAgregarCarrito = (p: Producto) => {
    if (esVendedor) {
      void Swal.fire({
        icon: "info",
        title: "Cuenta de vendedor",
        text: "Los vendedores no pueden comprar en la tienda. Usa una cuenta de cliente para realizar compras.",
        confirmButtonColor: "#e63946",
      });
      return;
    }
    setProductoModal(p);
  };

  useEffect(() => {
    AOS.init({ duration: 1000, once: true, offset: -120 });
  }, []);

  useEffect(() => {
    // dependencia [pos]: cada interacción (flecha/punto/arrastre/auto-avance/teleport)
    // reinicia el ciclo de 5 s — el auto-avance no salta a medio tiempo del gesto
    const timer = setInterval(() => {
      setPos((p) => p + 1);
    }, 5000);
    return () => clearInterval(timer);
  }, [pos]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // leerListaJson devuelve [] si la API responde 500 (ventanas de BD en
        // prod): antes el body {error,mensaje} entraba en el estado y el home
        // reventaba con "l.filter is not a function" → ¡Oops! del ErrorBoundary.
        const [prods, cats, dcts] = await Promise.all([
          leerListaJson("/api/productos"),
          leerListaJson("/api/productos/categorias"),
          leerListaJson("/api/productos/descuentos"),
        ]);
        setProductos(prods);
        setCategorias(cats);

        const map: Record<number, number> = {};
        dcts.forEach((d: Descuento) => {
          map[d.ID_DESCUENTO] = d.PORCENTAJE;
        });
        setDescuentosMap(map);
      } catch {
        setError("Error al cargar la página. Intenta de nuevo.");
      } finally {
        setLoading(false);
      }
    };

    void fetchAll();
  }, []);

  useEffect(() => {
    if (!usuarioLogueado) return;
    fetch("/api/favoritos", { credentials: "include" })
      .then(res => res.json())
      .then((data: unknown) => {
        // El 500 de una ventana de BD llega como objeto: sin el guard,
        // data.map revienta (el catch de abajo oculta el error, no lo prepara).
        if (Array.isArray(data)) {
          setFavoritos(data.map((f: any) => ({ ID: f.ID, ID_FAVORITO: f.ID_FAVORITO })));
        }
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
    void cargarHistorial();
  }, [usuarioLogueado]);

  const [recomendados, setRecomendados] = useState<Producto[]>([]);

  useEffect(() => {
    if (!usuarioLogueado) {
      setRecomendados([]);
      return;
    }
    fetch("/api/productos/recomendados", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.productos)) setRecomendados(data.productos);
      })
      .catch(() => {});
  }, [usuarioLogueado]);

  const toggleFavorito = async (id: number) => {
    await toggleFavoritoUI({ id, logueado: usuarioLogueado, favoritos, setFavoritos, navigate });
  };

  /** Ficha de producto compartida por las 4 secciones de la portada:
   *  mismas props de ProductCard en TODAS (evita la duplicación del detalle). */
  const tarjeta = (p: Producto) => (
    <ProductCard
      producto={p}
      descuentoPorcentaje={
        p.ID_DESCUENTO != null ? descuentosMap[p.ID_DESCUENTO] : undefined
      }
      onVerDetalle={(id) => {
        navigate(`/producto/${id}`);
        window.scrollTo(0, 0);
      }}
      onAgregarCarrito={() => abrirAgregarCarrito(p)}
      onToggleFavorito={toggleFavorito}
      esFavorito={favoritos.some(f => f.ID === p.ID)}
    />
  );

  const productosOferta = productos.filter((p) => p.ID_DESCUENTO != null);
  // PRODUCTOS: excluye los que están en OFERTAS para que no se repitan entre secciones
  const idsEnOferta = new Set(productosOferta.map((p) => p.ID));
  const productosMostrados = productos.filter((p) => !idsEnOferta.has(p.ID)).slice(0, 12);
  const historialCompleto = historial.map((h: any) => productos.find((p) => p.ID === h.ID) || h);

  if (loading) {
    return (
      <div className="principal-wrapper">
        <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
          <div className="spinner-border text-danger" style={{ width: "3rem", height: "3rem" }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="principal-wrapper">
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
      {/* ===== 1. BANNER CARRUSEL (track pegado + flechas + puntos + ARRASTRE) ===== */}
      <header
        ref={headerRef}
        className={`position-relative overflow-hidden slideshow-header${arrastre.activa ? " arrastrando" : ""}`}
        onPointerDown={bannerPointerDown}
        onPointerMove={bannerPointerMove}
        onPointerUp={bannerPointerUp}
        onPointerLeave={bannerPointerLeave}
        onPointerCancel={bannerPointerCancel}
        onClick={bannerClick}
      >
        <div
          className={`slideshow-track${sinAnimacion ? " sin-animacion" : ""}`}
          style={{
            // pos en unidades de 100% (un slide por copia) + el pixel de arrastre vivo
            transform: `translateX(calc(${-pos * 100}% + ${arrastre.x}px))`,
          }}
          onTransitionEnd={alTerminarTransicion}
        >
          {pista.map((b, i) => (
            <div key={i} className="slideshow-slide">
              <img
                src={b.src}
                alt={b.alt}
                className="w-100 h-100"
                draggable={false}
                style={{ objectFit: "cover", cursor: "pointer" }}
              />
            </div>
          ))}
        </div>

        <button className="slideshow-arrow slideshow-arrow-prev" onClick={(e) => { e.stopPropagation(); setPos((p) => p - 1); }}>
          <i className="fas fa-chevron-left"></i>
        </button>

        <button className="slideshow-arrow slideshow-arrow-next" onClick={(e) => { e.stopPropagation(); setPos((p) => p + 1); }}>
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
                setPos(i + 1);
              }}
            />
          ))}
        </div>
      </header>

      <main className="container">
        {/* ===== 2. PRODUCTOS + OFERTAS + TARJETAS ===== */}
        <section className="mb-5 pt-4">
          <div className="row g-4 align-items-stretch">
            {/* PRODUCTOS (izquierda) */}
            <div className="col-lg-6">
              <h2 className="text-center mb-4" data-aos="fade-down">
                PRODUCTOS
              </h2>

              <div className="row row-cols-1 row-cols-sm-2 g-3">
                {productosMostrados.slice(0, 4).map((p) => (
                  <div className="col" key={p.ID} data-aos="fade-up">
                    {tarjeta(p)}
                  </div>
                ))}
              </div>
            </div>

            {/* OFERTAS (derecha) */}
            <div className="col-lg-6">
              <h2 className="text-center mb-4" data-aos="fade-down">
                {productosOferta.length > 0 ? "🏷️ OFERTAS" : "PRODUCTOS DESTACADOS"}
              </h2>

              <div className="row row-cols-1 row-cols-sm-2 g-3">
                {(productosOferta.length > 0 ? productosOferta : productosMostrados.slice(4, 8))
                  .slice(0, 4)
                  .map((p) => (
                    <div className="col" key={p.ID} data-aos="fade-up">
                      {tarjeta(p)}
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* TARJETAS DE BENEFICIOS (debajo) */}
          <div className="beneficios-pie row g-4 mt-2">
            <div className="col-md-6">
              <TarjetaPlan />
            </div>
            <div className="col-md-6">
              <TarjetaRetos />
            </div>
          </div>

          <div className="text-center mt-4">
            <Link to="/catalogo" className="btn btn-danger fw-bold px-5 py-2">
              VER TODO EL CATÁLOGO →
            </Link>
          </div>
        </section>

        {/* ===== 3. RECOMENDADOS PARA TI (RF-038) ===== */}
        {recomendados.length > 0 && (
          <section className="mb-5">
            <h2 className="text-center mb-4" data-aos="fade-down">
              ✨ RECOMENDADOS PARA TI
            </h2>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
              {recomendados.slice(0, 8).map((p) => (
                <div className="col" key={p.ID} data-aos="fade-up">
                  {tarjeta(p)}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== 5. RECIENTEMENTE VISTOS ===== */}
        {historial.length > 0 && (
          <section className="mb-5">
            <h2 className="text-center mb-4" data-aos="fade-down">
              🕐 RECIENTEMENTE VISTOS
            </h2>

            <div className="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-lg-4 g-3">
              {historialCompleto.slice(0, 8).map((p, i) => (
                <div className="col" key={`${p.ID}-${i}`} data-aos="fade-up">
                  {tarjeta(p)}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ===== 6. CATEGORÍAS ===== */}
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
                <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLElement).click(); }}
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

export default Principal;
