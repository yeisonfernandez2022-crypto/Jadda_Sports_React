import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import { useSearchParams } from "react-router-dom";
import SelectorVarianteModal from "../components/SelectorVarianteModal";
import TarjetaRetos from "../components/TarjetaRetos";

import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import Swal from "sweetalert2";
import LoadingPage from "../components/LoadingPage";

import "../css/catalogo.css";

interface Producto {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  IMAGEN: string;
  CATEGORIA?: string;
  ID_CATEGORIA?: number;
  ID_VARIANTE_POR_DEFECTO: number;
  ID_DESCUENTO: number | null;
  STOCK?: number;
  RATING?: number | null;
  RESENA_COUNT?: number;
}



const SINONIMOS: Record<string, string[]> = {
  "zapatos": ["zapatillas", "tenis", "calzado", "sneakers", "zapatilla"],
  "zapatilla": ["zapatillas", "zapatos", "tenis", "calzado", "sneakers"],
  "zapatillas": ["zapatos", "tenis", "calzado", "sneakers", "zapatilla"],
  "tenis": ["zapatos", "zapatillas", "calzado", "sneakers", "zapatilla"],
  "guayos": ["botines", "tachones", "guayo"],
  "balon": ["balones", "pelota", "pelotas"],
  "pelota": ["balon", "balones", "pelotas"],
  "mancuernas": ["pesas", "dumbbells", "mancuerna"],
  "mancuerna": ["mancuernas", "pesas", "dumbbells"],
  "pesas": ["mancuernas", "dumbbells", "mancuerna"],
  "proteina": ["proteina", "protein", "whey", "suplemento", "suplementos"],
  "proteinas": ["proteina", "protein", "whey", "suplemento", "suplementos"],
  "creatina": ["creatine", "suplemento", "suplementos"],
  "suplemento": ["suplementos", "proteina", "protein", "creatina", "whey", "vitaminas"],
  "suplementos": ["suplemento", "proteina", "protein", "creatina", "whey", "vitaminas"],
  "vitaminas": ["vitamins", "suplemento", "suplementos"],
  "camiseta": ["camisetas", "jersey", "remera", "playera"],
  "camisetas": ["camiseta", "jersey", "remera", "playera"],
  "pantalon": ["pantalones", "pants", "shorts", "bermudas"],
  "pantalones": ["pantalon", "pants", "shorts", "bermudas"],
  "chaqueta": ["chaquetas", "jacket", "sudaderas", "buzo"],
  "bicicleta": ["bicicletas", "bici", "bikes", "cicla"],
  "casco": ["cascos", "helmet"],
  "futbol": ["futbol", "fútbol", "balompie", "soccer", "balón"],
  "fútbol": ["futbol", "balompie", "soccer", "balón"],
  "baloncesto": ["basquetbol", "basketball", "basket"],
  "running": ["correr", "atletismo"],
  "gimnasio": ["gym", "pesas", "fitness"],
  "natacion": ["natacion", "swimming", "piscina"],
  "ciclismo": ["ciclismo", "biking", "cycling"],
  "accesorio": ["accesorios", "accessories", "complementos"],
  "accesorios": ["accesorio", "accessories", "complementos"],
  "proteccion": ["proteccion", "protección", "protectores", "safety"],
  "cardio": ["cardiovascular"],
  "ofertas": ["descuentos", "promociones"],
  "descuentos": ["ofertas", "promociones"],
  "deportes extremos": ["extremos", "extreme"],
  "ropa deportiva": ["ropa", "vestimenta", "sportswear"],
  "tecnologia": ["tecnologia", "tecnología", "smart", "gadgets"],
};

function Catalogo() {
  const [searchParams] = useSearchParams();
const categoriaInicial = searchParams.get("cat") || "";
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});
  const [categoriasLista, setCategoriasLista] = useState<{ ID_CATEGORIA: number; NOMBRE_CATEGORIA: string }[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] =
  useState<string[]>(
    categoriaInicial ? [categoriaInicial] : []
  );
  const [paginaActual, setPaginaActual] = useState(1);
  const productosPorPagina = 6;
  const [ordenPrecio, setOrdenPrecio] =
  useState("");
  

  const [precioMaximo, setPrecioMaximo] =
  useState(1000000);
  const [precioTope, setPrecioTope] = useState(1000000);
  const [sliderTocado, setSliderTocado] = useState(false);

  const { search } = useLocation();
  const navigate = useNavigate();

  const mostrarDescuento = searchParams.get("descuento") === "true";

  const { addToCart } = useCart();

  const [productoModal, setProductoModal] = useState<Producto | null>(null);

  const queryParams = new URLSearchParams(search);
  const searchTerm = queryParams.get("search");
  const { usuarioLogueado, esAdmin } = useAuth();

  interface FavoritoItem {
    ID: number;
    ID_FAVORITO: number;
  }

  const [favoritos, setFavoritos] = useState<FavoritoItem[]>([]);

  useEffect(() => {
    if (!usuarioLogueado) return;
    fetch("/api/favoritos", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        setFavoritos(data.map((f: any) => ({ ID: f.ID, ID_FAVORITO: f.ID_FAVORITO })));
      })
      .catch(() => {});
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
      await fetch(`/api/favoritos/${existente.ID_FAVORITO}`, {
        method: "DELETE",
        credentials: "include"
      });
      setFavoritos(prev => prev.filter(f => f.ID !== id));
      Toast.fire({
        icon: "success",
        timer: 4500,
        html: `Quitado de favoritos <a href="#" id="jadda-ver-favoritos" style="color:#e73737;font-weight:700;text-decoration:underline;margin-left:6px">Ver mis favoritos</a>`,
      });
      setTimeout(() => {
        const el = document.getElementById("jadda-ver-favoritos");
        if (el) {
          el.addEventListener("click", (e) => {
            e.preventDefault();
            Swal.close();
            navigate("/favoritos");
          });
        }
      }, 100);
    } else {
      const res = await fetch("/api/favoritos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id_producto: id })
      });
      if (!res.ok) {
        const data = await res.json();
        Toast.fire({ icon: "warning", title: data.msg || "Error al agregar" });
        return;
      }
      const favRes = await fetch("/api/favoritos", { credentials: "include" });
      const data = await favRes.json();
      setFavoritos(data.map((f: any) => ({ ID: f.ID, ID_FAVORITO: f.ID_FAVORITO })));
      Toast.fire({
        icon: "success",
        timer: 4500,
        html: `Agregado a favoritos <a href="#" id="jadda-ver-favoritos" style="color:#e73737;font-weight:700;text-decoration:underline;margin-left:6px">Ver mis favoritos</a>`,
      });
      setTimeout(() => {
        const el = document.getElementById("jadda-ver-favoritos");
        if (el) {
          el.addEventListener("click", (e) => {
            e.preventDefault();
            Swal.close();
            navigate("/favoritos");
          });
        }
      }, 100);
    }
  } catch (err) {
    console.error("Error al toggle favorito:", err);
  }
};

  const abrirModalVariantes = (p: Producto) => {
    setProductoModal(p);
  };

  const cerrarModalVariantes = () => {
    setProductoModal(null);
  };

useEffect(() => {
  if (categoriaInicial) {
    setCategoriaSeleccionada([categoriaInicial]);
  }
}, [categoriaInicial]);



useEffect(() => {

  if (categoriaInicial) {

    setCategoriaSeleccionada(
      [categoriaInicial]
    );

  }

}, [categoriaInicial]);

  useEffect(() => {
    AOS.init({ duration: 1000, once: true, offset: -120 });

    setLoading(true);

    fetch("/api/productos")
      .then((res) => {
        if (!res.ok) throw new Error("Error al obtener productos");
        return res.json();
      })
      .then((data) => {
        const maxPrecio = data.reduce((m: number, p: any) => Math.max(m, Number(p.PRECIO) || 0), 0);
        const topeNuevo = Math.max(1000000, Math.ceil(maxPrecio / 50000) * 50000);
        setPrecioTope(topeNuevo);
        if (!sliderTocado) setPrecioMaximo(topeNuevo);
        if (searchTerm) {
          const term = searchTerm.toLowerCase().trim();
          const terminos = [term];
          if (SINONIMOS[term]) {
            terminos.push(...SINONIMOS[term]);
          }
          for (const [clave, sinonimos] of Object.entries(SINONIMOS)) {
            if (clave !== term && (clave.includes(term) || term.includes(clave))) {
              terminos.push(clave, ...sinonimos);
            }
          }
          const terminosUnicos = [...new Set(terminos)];
          const filtrados = data.filter((p: any) => {
            const texto = `${p.NOMBRE} ${p.CATEGORIA || ""} ${p.MARCA || ""}`.toLowerCase();
            return terminosUnicos.some((t) => texto.includes(t));
          });
          setProductos(filtrados);
        } else {
          setProductos(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando productos:", err);
        setError(true);
        setLoading(false);
      });

    fetch("/api/productos/descuentos")
      .then((res) => res.json())
      .then((dcts: { ID_DESCUENTO: number; PORCENTAJE: number }[]) => {
        const map: Record<number, number> = {};
        dcts.forEach((d) => {
          map[d.ID_DESCUENTO] = d.PORCENTAJE;
        });
        setDescuentosMap(map);
      })
      .catch(() => {});

    fetch("/api/productos/categorias")
      .then((res) => res.json())
      .then(setCategoriasLista)
      .catch(() => {});
  }, [searchTerm]);

  const categoriasUnicas = [
  ...new Set(
    productos
      .map((p) => p.CATEGORIA)
      .filter(
        (categoria): categoria is string =>
          Boolean(categoria)
      )
  ),
];

const catIdsPorNombre: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    categoriasLista.forEach((c) => {
      map[c.NOMBRE_CATEGORIA.trim().toLowerCase()] = c.ID_CATEGORIA;
    });
    return map;
  }, [categoriasLista]);

const productosFiltrados = useMemo(() => {
    return [...productos]

    // FILTRO POR DESCUENTO
    .filter((producto) => {
      if (!mostrarDescuento) return true;
      return producto.ID_DESCUENTO != null;
    })

    // FILTRO POR CATEGORÍA
    .filter((producto) => {

      // SI NO HAY FILTROS
      if (
        categoriaSeleccionada.length === 0
      ) {
        return true;
      }

      // Match por ID_CATEGORIA numérico (robusto) o por nombre (case-insensitive)
      const nombreCategoria = (categoriaSeleccionada[0] || "").trim().toLowerCase();

      if (producto.ID_CATEGORIA != null && catIdsPorNombre) {
        const idEsperado = catIdsPorNombre[nombreCategoria];
        if (idEsperado != null && producto.ID_CATEGORIA === idEsperado) {
          return true;
        }
      }

      return categoriaSeleccionada.some(
        (categoria) =>
          categoria.toLowerCase().trim() ===
          (producto.CATEGORIA || "")
            .toLowerCase()
            .trim()
      );
    })

    // FILTRO PRECIO
    .filter(
      (producto) =>
        producto.PRECIO <= precioMaximo
    );
}, [productos, mostrarDescuento, categoriaSeleccionada, precioMaximo, catIdsPorNombre]);

const productosOrdenados = useMemo(() => {
  if (ordenPrecio === "menor") {
    return [...productosFiltrados].sort(
      (a, b) => a.PRECIO - b.PRECIO
    );
  }

  if (ordenPrecio === "mayor") {
    return [...productosFiltrados].sort(
      (a, b) => b.PRECIO - a.PRECIO
    );
  }

  if (ordenPrecio === "az") {
    return [...productosFiltrados].sort(
      (a, b) =>
        a.NOMBRE.localeCompare(b.NOMBRE)
    );
  }

  if (ordenPrecio === "za") {
    return [...productosFiltrados].sort(
      (a, b) =>
        b.NOMBRE.localeCompare(a.NOMBRE)
    );
  }

  return [...productosFiltrados];
}, [productosFiltrados, ordenPrecio]);
const totalPaginas = Math.ceil(
  productosOrdenados.length /
  productosPorPagina
);

const productosActuales = useMemo(() => {
  return productosOrdenados.slice(
    (paginaActual - 1) * productosPorPagina,
    paginaActual * productosPorPagina
  );
}, [productosOrdenados, paginaActual, productosPorPagina]);

  if (error) return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
      <div className="text-center">
        <h2 className="fw-bold text-danger mb-3">¡Oops! Algo salió mal</h2>
        <p className="text-muted mb-4">No pudimos cargar los productos. Intenta de nuevo.</p>
        <button className="btn btn-danger btn-lg fw-bold px-5" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    </div>
  );
  if (loading) return <LoadingPage mensaje="Cargando catálogo..." />;

  return (
    <div className="catalogo-wrapper d-flex flex-column min-vh-100">
      <header className="banner-catalogo position-relative overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="position-absolute w-100 h-100"
          style={{ objectFit: "cover" }}
        >
          <source src="/videos/catalogo-1.mp4" type="video/mp4" />
        </video>

        <div className="position-absolute top-0 start-0 w-100 h-100" style={{ background: "rgba(0,0,0,0.05)", zIndex: 2 }} />

        <div className="position-absolute top-50 start-50 translate-middle text-white text-center p-3" style={{ zIndex: 3 }}>
          <h1 className="fw-bold mb-0 text-uppercase" style={{ fontSize: "clamp(1.2rem, 3vw, 2.2rem)" }}>
            {searchTerm ? `BUSCANDO: ${searchTerm}` : "NUESTRO CATÁLOGO"}
          </h1>
          <p className="mt-1 fw-light text-uppercase mb-0" style={{ letterSpacing: "3px", fontSize: "clamp(0.7rem, 1.5vw, 1rem)" }}>
            Equipamiento de alto rendimiento
          </p>
        </div>
      </header>

      <main className="container-fluid mt-3 mb-5 px-4 flex-grow-1">
        <div className="d-flex justify-content-center mb-4">
  <nav>
    <ul className="pagination">

      {Array.from(
        { length: totalPaginas },
        (_, index) => (
          <li
            key={index}
            className={`page-item ${
              paginaActual === index + 1
                ? "active"
                : ""
            }`}
          >
            <button
              className="page-link"
              onClick={() =>
                setPaginaActual(index + 1)
              }
            >
              {index + 1}
            </button>
          </li>
        )
      )}

    </ul>
  </nav>
</div>
        <div className="row g-4">
          
          <aside className="col-md-3 filtros-container">
            <div className="p-4 filtros-card">
              <h4 className="fw-bold mb-4 text-dark">
  FILTROS
</h4>

              <div className="mb-4">
  <h6 className="fw-bold mb-3 text-danger">
    Categoría
  </h6>

  <select
    className="form-select"
    value={categoriaSeleccionada[0] || ""}
    onChange={(e) =>
      setCategoriaSeleccionada(
        e.target.value ? [e.target.value] : []
      )
    }
  >
    <option value="">
      Todas
    </option>

    {categoriasUnicas.map((categoria, index) => (
      <option
        key={index}
        value={categoria}
      >
        {categoria}
      </option>
    ))}
  </select>
</div>

              <div className="mb-4">
                <h6 className="fw-bold mb-3 text-danger">Ordenar por</h6>
                <select className="form-select" value={ordenPrecio} onChange={(e) => setOrdenPrecio(e.target.value)}>
                  <option value="">Seleccionar</option>
                  <option value="menor">Más baratos</option>
                  <option value="mayor">Más caros</option>
                  <option value="az">Nombre A-Z</option>
                  <option value="za">Nombre Z-A</option>
                </select>
              </div>

              <div className="mb-4">
                <h6 className="fw-bold mb-3 text-danger">Precio máximo</h6>
                <input
                  type="range" className="form-range" min="50000" max={precioTope} step="50000"
                  value={precioMaximo} onChange={(e) => { setSliderTocado(true); setPrecioMaximo(Number(e.target.value)); }}
                />
                <p className="fw-bold mt-2 text-dark">${precioMaximo.toLocaleString("es-CO")}</p>
              </div>

              <button className="btn btn-danger w-100 fw-bold rounded-3" onClick={() => {
                setCategoriaSeleccionada([]);
                setOrdenPrecio("");
                setSliderTocado(false);
                setPrecioMaximo(precioTope);
                navigate("/catalogo");
              }}>
                LIMPIAR FILTROS
              </button>
            </div>
          </aside>

          <section className="col-md-9">
            <div className="row g-4">
              {loading ? (
                <div className="col-12 text-center py-5">
                  <div className="spinner-border text-danger" role="status"></div>
                </div>
              ) : productosOrdenados.length > 0 ? (
                productosActuales.map((p, index) => (
                  <div key={p.ID} className="col-md-4 mb-4" data-aos="fade-up" data-aos-delay={Math.min(index * 50, 100)}>
                    <div className="card h-100 shadow-sm border-0 overflow-hidden product-card">

  <div className="position-relative">

    {p.ID_DESCUENTO != null && descuentosMap[p.ID_DESCUENTO] && (
      <span className="badge bg-danger position-absolute top-0 start-0 m-2 fs-6 z-1">-{descuentosMap[p.ID_DESCUENTO]}%</span>
    )}

    {(Number(p.STOCK) || 0) <= 0 ? (
      <span className="badge bg-secondary position-absolute top-0 start-0 m-2 fs-6 z-1">AGOTADO</span>
    ) : (Number(p.STOCK) || 0) <= 10 ? (
      <span className="badge bg-warning text-dark position-absolute top-0 start-0 m-2 fs-6 z-1">¡Solo quedan {p.STOCK}!</span>
    ) : null}

    {!esAdmin && (
    <button
      className="btn position-absolute top-0 end-0 m-2"
      style={{
        zIndex: 2,
        background: "white",
        borderRadius: "50%"
      }}
      onClick={() => toggleFavorito(p.ID)}
    >
      <i
        className={`fa${favoritos.some(f => f.ID === p.ID) ? "s" : "r"} fa-heart`}
        style={{
          color: favoritos.some(f => f.ID === p.ID)
            ? "red"
            : "#999"
        }}
      ></i>
    </button>
    )}

    <div
      className="img-container-custom"
      style={{ opacity: (Number(p.STOCK) || 0) <= 0 ? 0.55 : 1, cursor: "pointer" }}
      onClick={() => navigate(`/producto/${p.ID}`)}
      title={`Ver detalles de ${p.NOMBRE}`}
    >
      <img
        src={p.IMAGEN}
        className="img-fluid w-100 h-100"
        style={{ objectFit: "cover" }}
        alt={p.NOMBRE}
        loading="lazy"
        onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }}
      />
    </div>

  </div>

  <div className="card-body text-center p-2">
                        <h5 className="card-title fw-bold text-uppercase" style={{fontSize: '1rem'}}>{p.NOMBRE}</h5>
                        {(Number(p.RESENA_COUNT) || 0) > 0 && (
                          <div className="mb-2" style={{ fontSize: "0.8rem", lineHeight: 1 }}>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <i
                                key={star}
                                className={`fa${star <= Math.round(Number(p.RATING) || 0) ? "s" : "r"} fa-star`}
                                style={{ color: star <= Math.round(Number(p.RATING) || 0) ? "#f5b301" : "#ccc", marginRight: 1 }}
                              ></i>
                            ))}
                            <span className="text-muted ms-1" style={{ fontSize: "0.75rem" }}>
                              {(Number(p.RATING) || 0).toLocaleString("es-CO")} ({p.RESENA_COUNT})
                            </span>
                          </div>
                        )}
                        {p.ID_DESCUENTO != null && descuentosMap[p.ID_DESCUENTO] ? (
                          <>
                            <p className="text-muted mb-0" style={{ fontSize: "0.85rem", textDecoration: "line-through" }}>
                              ${Number(p.PRECIO).toLocaleString("es-CO")}
                            </p>
                            <p className="card-text text-danger fs-5 fw-bold mb-3">
                              ${(Number(p.PRECIO) - (Number(p.PRECIO) * descuentosMap[p.ID_DESCUENTO] / 100)).toLocaleString("es-CO")}
                            </p>
                          </>
                        ) : (
                          <p className="card-text text-danger fs-5 fw-bold mb-3">${Number(p.PRECIO).toLocaleString("es-CO")}</p>
                        )}
                        <div className="d-flex gap-2">
                          <button className="btn btn-dark flex-grow-1 fw-bold py-2" onClick={() => navigate(`/producto/${p.ID}`)}>VER DETALLES</button>
                          
                          {!esAdmin && (
                            <button
                              className="btn btn-outline-danger fw-bold py-2"
                              style={{ opacity: (Number(p.STOCK) || 0) <= 0 ? 0.5 : 1 }}
                              disabled={(Number(p.STOCK) || 0) <= 0}
                              title={(Number(p.STOCK) || 0) <= 0 ? "Producto agotado" : "Agregar al carrito"}
                              onClick={() => abrirModalVariantes(p)}
                            ><i className="fas fa-shopping-cart"></i></button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-12 text-center py-5">
                  <h3>
                    {categoriaSeleccionada.length > 0
                      ? `No encontramos productos en la categoría "${categoriaSeleccionada[0]}"`
                      : searchTerm
                      ? `No encontramos productos para "${searchTerm}"`
                      : "No encontramos productos"}
                  </h3>
                </div>
              )}
            </div>
            <div className="d-flex justify-content-center mt-4">
  <nav>
    <ul className="pagination">
      {Array.from(
        { length: totalPaginas },
        (_, index) => (
          <li
            key={index}
            className={`page-item ${
              paginaActual === index + 1
                ? "active"
                : ""
            }`}
          >
            <button
              className="page-link"
              onClick={() =>
                setPaginaActual(index + 1)
              }
            >
              {index + 1}
            </button>
          </li>
        )
      )}
    </ul>
  </nav>
</div>
          </section>
        </div>
      </main>

      {/* ===== TARJETA DE RETOS ===== */}
      <TarjetaRetos />

      {productoModal && (
        <SelectorVarianteModal
          producto={productoModal}
          esAdmin={esAdmin}
          onCerrar={cerrarModalVariantes}
          onAgregar={async (idVariante, cantidad) => {
            await addToCart(productoModal.ID, idVariante, cantidad);
            cerrarModalVariantes();
          }}
        />
      )}
    </div>
  );
}

export default Catalogo;