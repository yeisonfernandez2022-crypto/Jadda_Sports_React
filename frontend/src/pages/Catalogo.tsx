import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";

import { useCart } from "../context/CartContext";

import "../css/catalogo.css";

interface Producto {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  IMAGEN: string;
  CATEGORIA?: string;
  ID_VARIANTE_POR_DEFECTO: number;
}

interface Variante {
  ID_VARIANTE: number;
  ID_PRODUCTO: number;
  COLOR: string;
  NOMBRE_ATRIBUTO: string;
  ATRIBUTO: string;
  STOCK: number;
}



function Catalogo() {
  const [searchParams] = useSearchParams();
const categoriaInicial = searchParams.get("categoria") || "";
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaSeleccionada, setCategoriaSeleccionada] =
  useState<string[]>(
    categoriaInicial ? [categoriaInicial] : []
  );
  const [paginaActual, setPaginaActual] = useState(1);
  const productosPorPagina = 9;
  const [ordenPrecio, setOrdenPrecio] =
  useState("");
  

  const [precioMaximo, setPrecioMaximo] =
  useState(1000000);

  const { search } = useLocation();
  const navigate = useNavigate();


  const { addToCart } = useCart();

  const [productoModal, setProductoModal] = useState<Producto | null>(null);
  const [variantesModal, setVariantesModal] = useState<Variante[]>([]);
  const [colorModal, setColorModal] = useState("");
  const [atributoModal, setAtributoModal] = useState("");
  const [cantidadModal, setCantidadModal] = useState(1);
  const [cargandoVariantes, setCargandoVariantes] = useState(false);

  const queryParams = new URLSearchParams(search);
  const searchTerm = queryParams.get("search");
  const [favoritos, setFavoritos] = useState<number[]>(() => {
  return JSON.parse(localStorage.getItem("favoritos") || "[]");
});

const toggleFavorito = (id: number) => {
  const nuevosFavs = favoritos.includes(id) 
    ? favoritos.filter(f => f !== id) 
    : [...favoritos, id];
  setFavoritos(nuevosFavs);
  localStorage.setItem("favoritos", JSON.stringify(nuevosFavs));
};

  const abrirModalVariantes = async (p: Producto) => {
    setProductoModal(p);
    setColorModal("");
    setAtributoModal("");
    setCantidadModal(1);
    setCargandoVariantes(true);
    try {
      const res = await fetch(`http://localhost:5000/api/productos/${p.ID}/variantes`);
      const data = await res.json();
      setVariantesModal(data);
    } catch (err) {
      console.error("Error al cargar variantes:", err);
      setVariantesModal([]);
    } finally {
      setCargandoVariantes(false);
    }
  };

  const cerrarModalVariantes = () => {
    setProductoModal(null);
    setVariantesModal([]);
    setColorModal("");
    setAtributoModal("");
    setCantidadModal(1);
  };

  const agregarAlCarritoDesdeModal = async () => {
    if (!productoModal) return;
    const variante = variantesModal.find(
      v => v.COLOR === colorModal && v.ATRIBUTO === atributoModal
    );
    if (!variante) return;
    await addToCart(productoModal.ID, variante.ID_VARIANTE, cantidadModal);
    cerrarModalVariantes();
  };

  const coloresModal = [...new Set(variantesModal.map(v => v.COLOR))];
  const nombreAtributoModal = variantesModal[0]?.NOMBRE_ATRIBUTO || "Atributo";
  const atributosDisponiblesModal = colorModal
    ? [...new Set(variantesModal.filter(v => v.COLOR === colorModal).map(v => v.ATRIBUTO))]
    : [...new Set(variantesModal.map(v => v.ATRIBUTO))];
  const varianteSeleccionadaModal = variantesModal.find(
    v => v.COLOR === colorModal && v.ATRIBUTO === atributoModal
  );
  const stockModal = varianteSeleccionadaModal?.STOCK || 0;

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
    AOS.init({ duration: 800, once: true });

    setLoading(true);

    const apiUrl = searchTerm
      ? `http://localhost:5000/api/productos?search=${encodeURIComponent(searchTerm)}`
      : "http://localhost:5000/api/productos";

    fetch(apiUrl)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Error al obtener productos");
        }

        return res.json();
      })
      .then((data) => {
        setProductos(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error cargando productos:", err);
        setLoading(false);
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

console.log("PRODUCTOS:", productos);

console.log(
  "CATEGORIAS:",
  categoriasUnicas
);

const productosFiltrados = useMemo(() => {
  return [...productos]

    // FILTRO POR CATEGORÍA
    .filter((producto) => {

      // SI NO HAY FILTROS
      if (
        categoriaSeleccionada.length === 0
      ) {
        return true;
      }

      return categoriaSeleccionada.some(
        (categoria) =>
          categoria.toLowerCase() ===
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
}, [productos, categoriaSeleccionada, precioMaximo]);


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

  return (
    <div className="catalogo-wrapper d-flex flex-column min-vh-100">
      <Navbar />

      <header className="banner-catalogo position-relative">
        <img
          src="https://www.gettyimages.com.mx/gi-resources/images/MX/2024-02/SPONBA2023260627.jpg"
          className="img-fluid w-100 banner-img-custom"
          alt="Banner Catálogo Jadda"
        />

        <div className="position-absolute top-50 start-50 translate-middle bg-jadda-overlay-catalogo text-white text-center p-4 rounded" data-aos="zoom-in">
          <h1 className="display-4 fw-bold mb-0 text-uppercase">
            {searchTerm ? `BUSCANDO: ${searchTerm}` : "NUESTRO CATÁLOGO"}
          </h1>
          <p className="h5 mt-2 fw-light text-uppercase" style={{ letterSpacing: "3px" }}>
            Equipamiento de alto rendimiento
          </p>
        </div>
      </header>

      <main className="container-fluid my-5 px-4 flex-grow-1">
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
                  type="range" className="form-range" min="50000" max="1000000" step="50000"
                  value={precioMaximo} onChange={(e) => setPrecioMaximo(Number(e.target.value))}
                />
                <p className="fw-bold mt-2 text-dark">${precioMaximo.toLocaleString("es-CO")}</p>
              </div>

              <button className="btn btn-danger w-100 fw-bold rounded-3" onClick={() => {
                setCategoriaSeleccionada([]);
                setOrdenPrecio("");
                setPrecioMaximo(1000000);
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
                  <div key={p.ID} className="col-md-4 mb-4" data-aos="fade-up" data-aos-delay={index * 50}>
                    <div className="card h-100 shadow-sm border-0 overflow-hidden product-card">

  <div className="position-relative">

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
        className={`fa${favoritos.includes(p.ID) ? "s" : "r"} fa-heart`}
        style={{
          color: favoritos.includes(p.ID)
            ? "red"
            : "#999"
        }}
      ></i>
    </button>

    <div className="img-container-custom">
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

  <div className="card-body text-center p-4">
                        <h5 className="card-title fw-bold text-uppercase" style={{fontSize: '1.1rem'}}>{p.NOMBRE}</h5>
                        <p className="card-text text-danger fs-5 fw-bold mb-3">${Number(p.PRECIO).toLocaleString("es-CO")}</p>
                        <div className="d-flex gap-2">
                          <button className="btn btn-dark flex-grow-1 fw-bold py-2" onClick={() => navigate(`/producto/${p.ID}`)}>VER DETALLES</button>
                          
                          <button className="btn btn-outline-danger fw-bold py-2"  onClick={() => abrirModalVariantes(p)}><i className="fas fa-shopping-cart"></i></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-12 text-center py-5">
                  <h3>No encontramos productos para "{searchTerm}"</h3>
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
        <div className="modal-overlay" onClick={cerrarModalVariantes}>
          <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
            <div className="d-flex gap-3 mb-3">
              <img
                src={productoModal.IMAGEN}
                className="rounded border"
                style={{ width: "80px", height: "80px", objectFit: "cover", flexShrink: 0 }}
                alt={productoModal.NOMBRE}
                onError={(e) => { e.currentTarget.src = 'https://placehold.co/80x80?text=JADDA'; }}
              />
              <div className="flex-grow-1">
                <div className="d-flex justify-content-between align-items-start">
                  <h5 className="fw-bold mb-0">{productoModal.NOMBRE}</h5>
                  <button className="btn-close" onClick={cerrarModalVariantes}></button>
                </div>
                <p className="text-danger fw-bold mb-0 mt-1">${Number(productoModal.PRECIO).toLocaleString("es-CO")}</p>
              </div>
            </div>

            {cargandoVariantes ? (
              <div className="text-center py-4">
                <div className="spinner-border text-danger" role="status"></div>
              </div>
            ) : variantesModal.length === 0 ? (
              <div className="text-center py-4">
                <p className="mb-0">Este producto no tiene variantes disponibles.</p>
                <button className="btn btn-danger mt-2" onClick={() => addToCart(productoModal.ID, productoModal.ID_VARIANTE_POR_DEFECTO, 1)}>
                  Agregar igualmente
                </button>
              </div>
            ) : (
              <>
                <div className="mb-3">
                  <span className="fw-bold d-block mb-2">Color:</span>
                  <div className="d-flex gap-2 flex-wrap">
                    {coloresModal.map(color => (
                      <button
                        key={color}
                        onClick={() => {
                          if (color === colorModal) {
                            setColorModal("");
                          } else {
                            setColorModal(color);
                            const atributosDelNuevoColor = [...new Set(variantesModal.filter(v => v.COLOR === color).map(v => v.ATRIBUTO))];
                            if (!atributosDelNuevoColor.includes(atributoModal)) {
                              setAtributoModal("");
                            }
                          }
                        }}
                        className={`btn btn-sm ${colorModal === color ? "btn-danger" : "btn-outline-dark"}`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <span className="fw-bold d-block mb-2">{nombreAtributoModal}:</span>
                  <div className="d-flex gap-2 flex-wrap">
                    {atributosDisponiblesModal.map(opcion => (
                      <button
                        key={opcion}
                        onClick={() => setAtributoModal(atributoModal === opcion ? "" : opcion)}
                        className={`btn btn-sm ${atributoModal === opcion ? "btn-danger" : "btn-outline-dark"}`}
                        style={{ minWidth: "50px" }}
                      >
                        {opcion}
                      </button>
                    ))}
                  </div>
                </div>

                {colorModal && atributoModal && (
                  <div className="mb-3">
                    {stockModal > 0 ? (
                      <span className="text-success fw-bold">Stock disponible: {stockModal} unidades</span>
                    ) : (
                      <span className="text-danger fw-bold">Agotado por el momento</span>
                    )}
                  </div>
                )}

                <div className="mb-3">
                  <span className="fw-bold d-block mb-2">Cantidad:</span>
                  <div className="d-flex align-items-center border rounded overflow-hidden" style={{ width: "120px" }}>
                    <button
                      className="btn btn-light"
                      onClick={() => { if (cantidadModal > 1) setCantidadModal(cantidadModal - 1); }}
                    >
                      -
                    </button>
                    <div className="flex-grow-1 text-center fw-bold" style={{ userSelect: "none" }}>
                      {cantidadModal}
                    </div>
                    <button
                      className="btn btn-light"
                      onClick={() => { if (cantidadModal < stockModal) setCantidadModal(cantidadModal + 1); }}
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  className="btn btn-danger w-100 py-2 fw-bold"
                  onClick={agregarAlCarritoDesdeModal}
                  disabled={!colorModal || !atributoModal || stockModal <= 0}
                >
                  <i className="fas fa-shopping-cart me-2"></i>Agregar al carrito
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Catalogo;