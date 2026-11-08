import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import { useSearchParams } from "react-router-dom";
import SelectorVarianteModal from "../components/SelectorVarianteModal";

import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import Swal from "sweetalert2";
import { toggleFavoritoUI } from "../utils/favoritosUI";
import type { FavoritoItem } from "../utils/favoritosUI";
import { leerListaJson } from "../utils/leerListaJson";
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
  MARCA?: string;
  VENDEDOR_NOMBRE?: string;
  ID_VENDEDOR?: number | null;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const categoriaInicial = searchParams.get("cat") || "";
  const marcaInicial = searchParams.get("marca") || "";
  const vendedorInicial = searchParams.get("vendedor") || "";
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});
  const [categoriasLista, setCategoriasLista] = useState<{ ID_CATEGORIA: number; NOMBRE_CATEGORIA: string }[]>([]);
  const [vendedoresLista, setVendedoresLista] = useState<{ ID_VENDEDOR: number; NOMBRE_EMPRESA: string }[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] =
  useState<string[]>(
    categoriaInicial ? [categoriaInicial] : []
  );
  const [marcaSeleccionada, setMarcaSeleccionada] = useState<string>(marcaInicial);
  const [vendedorSeleccionado, setVendedorSeleccionado] = useState<string>(vendedorInicial);
  const productosPorPagina = 6;
  const [ordenPrecio, setOrdenPrecio] =
  useState(searchParams.get("orden") || "");
  // Paginación persistida en URL (?page=8) para que el botón Atrás restaure la página
  const paginaParam = Number.parseInt(searchParams.get("page") || "1", 10);
  const paginaActual = Number.isNaN(paginaParam) || paginaParam < 1 ? 1 : paginaParam;
  const setPaginaActual = (nueva: number) => {
    const params = new URLSearchParams(searchParams);
    if (nueva <= 1) params.delete("page");
    else params.set("page", String(nueva));
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  // APLICAR FILTROS: UNA sola escritura de URL con los borradores.
  // Defaults NO se escriben (equivale a "sin filtro"): vacíos en selects,
  // precioMin 0 y precioMax == tope.
  const aplicarFiltros = () => {
    const params = new URLSearchParams(searchParams);
    const setOQuitar = (clave: string, valor: string) => {
      if (valor) params.set(clave, valor); else params.delete(clave);
    };
    setOQuitar("cat", borradorCat);
    setOQuitar("marca", borradorMarca);
    setOQuitar("vendedor", borradorVendedor);
    setOQuitar("orden", borradorOrden);
    params.delete("precio"); // param legacy del slider viejo: ya no se escribe
    if (borradorPrecioMin > 0) params.set("precioMin", String(borradorPrecioMin)); else params.delete("precioMin");
    if (borradorPrecioMax < precioTopeRef.current) params.set("precioMax", String(borradorPrecioMax)); else params.delete("precioMax");
    params.delete("page");
    // Si la URL queda idéntica, no empujar una entrada de historial repetida
    if (params.toString() !== searchParams.toString()) setSearchParams(params);
  };

  // ELIMINAR FILTROS: borra los params de filtros (conserva search/descuento/otra
  // cosa que no sea filtro) y deja que el efecto [searchParams] re-sincronice todo.
  const eliminarFiltros = () => {
    const params = new URLSearchParams(searchParams);
    ["cat", "marca", "vendedor", "orden", "precioMin", "precioMax", "precio", "page"]
      .forEach((p) => params.delete(p));
    if (params.toString() !== searchParams.toString()) setSearchParams(params);
  };
  

  const [precioMaximo, setPrecioMaximo] =
  useState(1000000);
  const [precioTope, setPrecioTope] = useState(1000000);
  const [sliderTocado, setSliderTocado] = useState(false);

  // ═══ FILTROS CON BOTÓN APLICAR (borrador ⇄ URL comprometida) ═══
  // Borradores: lo que el usuario mueve en el panel SIN tocar la URL.
  // Solo APLICAR FILTROS escribe estos valores en la URL (fuente de verdad del
  // filtrado); Atrás/adelante re-sincroniza los borradores en el efecto [searchParams].
  const [borradorCat, setBorradorCat] = useState<string>(categoriaInicial);
  const [borradorMarca, setBorradorMarca] = useState<string>(marcaInicial);
  const [borradorVendedor, setBorradorVendedor] = useState<string>(vendedorInicial);
  const [borradorOrden, setBorradorOrden] = useState<string>(searchParams.get("orden") || "");
  const [borradorPrecioMin, setBorradorPrecioMin] = useState(0);
  const [borradorPrecioMax, setBorradorPrecioMax] = useState(1000000);
  const [borradorPrecioTocado, setBorradorPrecioTocado] = useState(false); // el tope async (fetch) no pisa borradores tocados por el usuario
  const [precioMinimo, setPrecioMinimo] = useState(0); // compromiso de la manecilla izquierda (espejo de precioMaximo)
  // Refs espejo: los valores llegan ASYNC (precioTope del fetch) y el efecto
  // [searchParams] (deps: solo searchParams) no vería el último valor en su closure.
  const precioTopeRef = useRef(precioTope);
  useEffect(() => { precioTopeRef.current = precioTope; }, [precioTope]);
  const sliderTocadoRef = useRef(sliderTocado);
  useEffect(() => { sliderTocadoRef.current = sliderTocado; }, [sliderTocado]);

  const { search } = useLocation();
  const navigate = useNavigate();

  const mostrarDescuento = searchParams.get("descuento") === "true";

  const { addToCart } = useCart();

  const [productoModal, setProductoModal] = useState<Producto | null>(null);

  const queryParams = new URLSearchParams(search);
  const searchTerm = queryParams.get("search");
  const { usuarioLogueado, esAdmin, esVendedor } = useAuth();

  const [favoritos, setFavoritos] = useState<FavoritoItem[]>([]);

  useEffect(() => {
    if (!usuarioLogueado) return;
    fetch("/api/favoritos", { credentials: "include" })
      .then(res => res.json())
      .then((data: unknown) => {
        // Ventana de BD → el 500 llega como objeto: sin este guard,
        // data.map revienta (lo ocultaba el catch, no lo preparaba).
        if (Array.isArray(data)) {
          setFavoritos(data.map((f: any) => ({ ID: f.ID, ID_FAVORITO: f.ID_FAVORITO })));
        }
      })
      .catch(() => {});
  }, [usuarioLogueado]);

  const toggleFavorito = async (id: number) => {
    await toggleFavoritoUI({ id, logueado: usuarioLogueado, favoritos, setFavoritos, navigate });
  };

  const abrirModalVariantes = (p: Producto) => {
    setProductoModal(p);
  };

  const cerrarModalVariantes = () => {
    setProductoModal(null);
  };

useEffect(() => {
  // ── espejos comprometidos (igual que antes: los usa el useMemo de filtrado)
  const cat = searchParams.get("cat") || "";
  setCategoriaSeleccionada(cat ? [cat] : []);
  setMarcaSeleccionada(searchParams.get("marca") || "");
  setVendedorSeleccionado(searchParams.get("vendedor") || "");
  const ord = searchParams.get("orden") || "";
  setOrdenPrecio(ord);

  // ── precio comprometido: precioMin/precioMax nuevos o legacy ?precio= (solo máximo)
  const precioUrl = searchParams.get("precio");
  const minUrl = searchParams.get("precioMin");
  const maxUrl = searchParams.get("precioMax");
  if (minUrl !== null || maxUrl !== null || precioUrl !== null) {
    const minV = minUrl !== null ? Number(minUrl) : 0;
    const maxV = maxUrl !== null ? Number(maxUrl)
      : (precioUrl !== null ? Number(precioUrl) : precioTopeRef.current);
    setPrecioMinimo(minV);
    setPrecioMaximo(maxV);
    setSliderTocado(true);
    setBorradorPrecioMin(minV);
    setBorradorPrecioMax(maxV);
    setBorradorPrecioTocado(true);
  } else {
    // sin params de precio = sin filtro de precio: resetea espejos y borradores
    if (sliderTocadoRef.current) {
      setPrecioMinimo(0);
      setPrecioMaximo(precioTopeRef.current);
    }
    setSliderTocado(false);
    setBorradorPrecioMin(0);
    setBorradorPrecioMax(precioTopeRef.current);
    setBorradorPrecioTocado(false);
  }

  // ── borradores de los selects (atrás/adelante/eliminar re-sincronizan la vista)
  setBorradorCat(cat);
  setBorradorMarca(searchParams.get("marca") || "");
  setBorradorVendedor(searchParams.get("vendedor") || "");
  setBorradorOrden(ord);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [searchParams]);

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
        if (!borradorPrecioTocado) setBorradorPrecioMax(topeNuevo);
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

    // leerListaJson devuelve [] ante bodies de error (ventanas de BD en prod):
    // antes el objeto {error,mensaje} entraba directo al estado y los useMemo
    // (catIdsPorNombre/vendedoresUnicos) reventaban con "v.forEach is not a
    // function" → ¡Oops! (misma raíz que Principal/mega-menú — 2026-11-08).
    leerListaJson("/api/productos/descuentos").then((dcts) => {
      const map: Record<number, number> = {};
      (dcts as { ID_DESCUENTO: number; PORCENTAJE: number }[]).forEach((d) => {
        map[d.ID_DESCUENTO] = d.PORCENTAJE;
      });
      setDescuentosMap(map);
    });

    leerListaJson("/api/productos/categorias").then((data) => {
      if (Array.isArray(data)) setCategoriasLista(data);
    });

    leerListaJson("/api/productos/vendedores").then((data) => {
      if (Array.isArray(data)) setVendedoresLista(data);
    });
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

  const marcasUnicas = useMemo(() => {
    const set = new Set<string>();
    productos.forEach((p) => {
      const m = (p.MARCA || "").trim();
      if (m) set.add(m);
    });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [productos]);

  const vendedoresUnicos = useMemo(() => {
    const set = new Set<string>();
    // Primero los que tienen productos visibles
    productos.forEach((p) => {
      const v = (p.VENDEDOR_NOMBRE || "JADDA SPORTS").trim() || "JADDA SPORTS";
      set.add(v);
    });
    // Luego todos los vendedores registrados (aunque aún no tengan productos aprobados)
    vendedoresLista.forEach((v) => {
      const n = (v.NOMBRE_EMPRESA || "").trim();
      if (n) set.add(n);
    });
    // Asegura que JADDA siempre esté
    set.add("JADDA SPORTS");
    return [...set].sort((a, b) => {
      if (a === "JADDA SPORTS") return -1;
      if (b === "JADDA SPORTS") return 1;
      return a.localeCompare(b);
    });
  }, [productos, vendedoresLista]);

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

    // FILTRO MARCA
    .filter((producto) => {
      if (!marcaSeleccionada) return true;
      return (producto.MARCA || "").trim().toLowerCase() === marcaSeleccionada.trim().toLowerCase();
    })

    // FILTRO VENDEDOR
    .filter((producto) => {
      if (!vendedorSeleccionado) return true;
      const v = (producto.VENDEDOR_NOMBRE || "JADDA SPORTS").trim();
      return v.toLowerCase() === vendedorSeleccionado.trim().toLowerCase();
    })

    // FILTRO PRECIO (rango comprometido de la URL; desde>0 excluye los baratos:
    // el slider viejo no podía, con min=50000 fijo)
    .filter(
      (producto) =>
        producto.PRECIO <= precioMaximo && producto.PRECIO >= precioMinimo
    );
}, [productos, mostrarDescuento, categoriaSeleccionada, marcaSeleccionada, vendedorSeleccionado, precioMaximo, precioMinimo, catIdsPorNombre]);

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

// Si los filtros reducen páginas y la actual queda fuera de rango, vuelve a la última válida
// No clavar a 1 mientras aún está cargando (evita perder ?page=8 al volver con Atrás)
useEffect(() => {
  if (loading) return;
  if (totalPaginas > 0 && paginaActual > totalPaginas) {
    setPaginaActual(totalPaginas);
  }
  // Si no hay resultados, no forzar a 1 si viene de historial con page>1 y aún no hay filtros
  // Solo resetear si el usuario está en una página vacía por filtros y ya cargó
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [totalPaginas, loading]);

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
          <source src="https://res.cloudinary.com/nggcplfk/video/upload/v1792553564/jadda/estaticos/videos/catalogo-1.mp4" type="video/mp4" />
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
    value={borradorCat}
    onChange={(e) => setBorradorCat(e.target.value)}
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
                <h6 className="fw-bold mb-3 text-danger">Marca</h6>
                <select
                  className="form-select"
                  value={borradorMarca}
                  onChange={(e) => setBorradorMarca(e.target.value)}
                >
                  <option value="">Todas las marcas</option>
                  {marcasUnicas.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <h6 className="fw-bold mb-3 text-danger">Vendedor</h6>
                <select
                  className="form-select"
                  value={borradorVendedor}
                  onChange={(e) => setBorradorVendedor(e.target.value)}
                >
                  <option value="">Todos los vendedores</option>
                  {vendedoresUnicos.map((v) => (
                    <option key={v} value={v}>{v === "JADDA SPORTS" ? "JADDA SPORTS (Oficial)" : v}</option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <h6 className="fw-bold mb-3 text-danger">Ordenar por</h6>
                <select className="form-select" value={borradorOrden} onChange={(e) => setBorradorOrden(e.target.value)}>
                  <option value="">Seleccionar</option>
                  <option value="menor">Más baratos</option>
                  <option value="mayor">Más caros</option>
                  <option value="az">Nombre A-Z</option>
                  <option value="za">Nombre Z-A</option>
                </select>
              </div>

              <div className="mb-4">
                <h6 className="fw-bold mb-3 text-danger">Rango de precio</h6>
                <div className="catalogo-precio-dual">
                  <span
                    className="precio-fill"
                    style={{
                      left: `${(borradorPrecioMin / (precioTope || 1)) * 100}%`,
                      width: `${((borradorPrecioMax - borradorPrecioMin) / (precioTope || 1)) * 100}%`,
                    }}
                  />
                  <input
                    type="range" aria-label="Precio mínimo" className="catalogo-precio-min"
                    min="0" max={precioTope} step="50000"
                    value={borradorPrecioMin}
                    onChange={(e) => {
                      setBorradorPrecioTocado(true);
                      setBorradorPrecioMin(Math.min(Number(e.target.value), borradorPrecioMax)); // clamp: nunca se cruzan
                    }}
                  />
                  <input
                    type="range" aria-label="Precio máximo" className="catalogo-precio-max"
                    min="0" max={precioTope} step="50000"
                    value={borradorPrecioMax}
                    onChange={(e) => {
                      setBorradorPrecioTocado(true);
                      setBorradorPrecioMax(Math.max(Number(e.target.value), borradorPrecioMin)); // clamp: nunca se cruzan
                    }}
                  />
                </div>
                <p className="fw-bold mt-2 text-dark">
                  Desde ${borradorPrecioMin.toLocaleString("es-CO")} hasta ${borradorPrecioMax.toLocaleString("es-CO")}
                </p>
              </div>

              <div className="d-flex flex-column price-filter-btns">
                <button className="btn btn-danger w-100 fw-bold rounded-3" onClick={aplicarFiltros}>
                  APLICAR FILTROS
                </button>
                <button className="btn btn-outline-danger w-100 fw-bold rounded-3" onClick={eliminarFiltros}>
                  ELIMINAR FILTROS
                </button>
              </div>
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

    {(p.ID_DESCUENTO != null && descuentosMap[p.ID_DESCUENTO]) ? (
      <span className="badge bg-danger position-absolute top-0 start-0 m-2 fs-6 z-1">-{descuentosMap[p.ID_DESCUENTO]}%</span>
    ) : null}

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

    <div role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLElement).click(); }}
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
                              style={{ opacity: (Number(p.STOCK) || 0) <= 0 || esVendedor ? 0.5 : 1, cursor: esVendedor ? "not-allowed" : undefined }}
                              disabled={(Number(p.STOCK) || 0) <= 0}
                              title={(Number(p.STOCK) || 0) <= 0 ? "Producto agotado" : esVendedor ? "Los vendedores no pueden comprar en la tienda" : "Agregar al carrito"}
                              onClick={() => {
                                if (esVendedor) {
                                  void Swal.fire({
                                    icon: "info",
                                    title: "Cuenta de vendedor",
                                    text: "Los vendedores no pueden comprar en la tienda. Usa una cuenta de cliente para realizar compras.",
                                    confirmButtonColor: "#e63946",
                                  });
                                  return;
                                }
                                abrirModalVariantes(p);
                              }}
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