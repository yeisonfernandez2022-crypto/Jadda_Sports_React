import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";

import Navbar from "../components/Navbar";
import { FloatingCart } from "../components/FloatingCart";
import { MiniCartMenu } from "../components/MiniCartMenu";

import { useCart } from "../context/CartContext";

import "../css/catalogo.css";

interface Producto {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  IMAGEN: string;
  CATEGORIA?: string;
}

function Catalogo() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoriaSeleccionada, setCategoriaSeleccionada] =
  useState<string[]>([]);

const [ordenPrecio, setOrdenPrecio] =
  useState("");

const [precioMaximo, setPrecioMaximo] =
  useState(1000000);

  const { search } = useLocation();
  const navigate = useNavigate();

  const { addToCart } = useCart();

  const queryParams = new URLSearchParams(search);
  const searchTerm = queryParams.get("search");

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

const productosFiltrados = [...productos]

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


// ORDENAMIENTO

if (ordenPrecio === "menor") {

  productosFiltrados.sort(
    (a, b) => a.PRECIO - b.PRECIO
  );
}

if (ordenPrecio === "mayor") {

  productosFiltrados.sort(
    (a, b) => b.PRECIO - a.PRECIO
  );
}

if (ordenPrecio === "az") {

  productosFiltrados.sort(
    (a, b) =>
      a.NOMBRE.localeCompare(b.NOMBRE)
  );
}

if (ordenPrecio === "za") {

  productosFiltrados.sort(
    (a, b) =>
      b.NOMBRE.localeCompare(a.NOMBRE)
  );
}

  return (
    <div className="catalogo-wrapper d-flex flex-column min-vh-100">
      <Navbar />

      {/* BANNER */}
      <header className="banner-catalogo position-relative">
        <img
          src="https://www.gettyimages.com.mx/gi-resources/images/MX/2024-02/SPONBA2023260627.jpg"
          className="img-fluid w-100"
          style={{
            height: "400px",
            objectFit: "cover",
          }}
          alt="Banner Catálogo Jadda"
        />

        <div
          className="position-absolute top-50 start-50 translate-middle bg-jadda-overlay-catalogo text-white text-center p-4 rounded"
          data-aos="zoom-in"
          style={{ minWidth: "300px" }}
        >
          <h1 className="display-4 fw-bold mb-0 text-uppercase">
            {searchTerm
              ? `BUSCANDO: ${searchTerm}`
              : "NUESTRO CATÁLOGO"}
          </h1>

          <p
            className="h5 mt-2 fw-light text-uppercase"
            style={{ letterSpacing: "3px" }}
          >
            Equipamiento de alto rendimiento
          </p>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="container-fluid my-5 px-4 flex-grow-1">
        <div className="row g-4">
          
          {/* FILTROS */}
          <aside className="col-md-3">

  <div
    className="sticky-top"
    style={{ top: "100px" }}
  >

    <div
      className="p-4"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "20px",
        boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
      }}
    >

      {/* TITULO */}
      <h4
        className="fw-bold mb-4"
        style={{
          color: "#111",
        }}
      >
        FILTRAR PRODUCTOS
      </h4>

      {/* CATEGORÍAS */}
      <div className="mb-4">

        <h6
          className="fw-bold mb-3"
          style={{
            color: "#e63946",
          }}
        >
          Categorías
        </h6>
        
        {categoriasUnicas.map(
  (categoria, index) => (

    <div
      key={`${categoria}-${index}`}
      className="form-check mb-2"
    >

      <input
        className="form-check-input"
        type="checkbox"

        id={`categoria-${index}`}

        checked={categoriaSeleccionada.includes(
          categoria
        )}

        onChange={(e) => {

          if (e.target.checked) {

            setCategoriaSeleccionada([
              ...categoriaSeleccionada,
              categoria.trim(),
            ]);

          } else {

            setCategoriaSeleccionada(
              categoriaSeleccionada.filter(
                (c) => c !== categoria
              )
            );
          }
        }}
      />

      <label
        className="form-check-label"
        htmlFor={`categoria-${index}`}
      >
        {categoria}
      </label>

    </div>
  )
)}
      </div>

      {/* ORDENAR */}
      <div className="mb-4">

        <h6
          className="fw-bold mb-3"
          style={{
            color: "#e63946",
          }}
        >
          Ordenar por
        </h6>

        <select
          className="form-select"

          value={ordenPrecio}

          onChange={(e) =>
            setOrdenPrecio(e.target.value)
          }
        >

          <option value="">
            Seleccionar
          </option>

          <option value="menor">
            Más baratos
          </option>

          <option value="mayor">
            Más caros
          </option>

          <option value="az">
            Nombre A-Z
          </option>

          <option value="za">
            Nombre Z-A
          </option>

        </select>

      </div>

      {/* PRECIO */}
      <div className="mb-4">

        <h6
          className="fw-bold mb-3"
          style={{
            color: "#e63946",
          }}
        >
          Precio máximo
        </h6>

        <input
          type="range"
          className="form-range"
          min="50000"
          max="1000000"
          step="50000"

          value={precioMaximo}

          onChange={(e) =>
            setPrecioMaximo(
              Number(e.target.value)
            )
          }
        />

        <p
          className="fw-bold mt-2"
          style={{
            color: "#111",
          }}
        >
          $
          {precioMaximo.toLocaleString("es-CO")}
        </p>

      </div>

      {/* LIMPIAR */}
      <button
        className="btn w-100 fw-bold"

        style={{
          backgroundColor: "#e63946",
          color: "white",
          borderRadius: "12px",
        }}

        onClick={() => {

          setCategoriaSeleccionada([]);

          setOrdenPrecio("");

          setPrecioMaximo(1000000);

          navigate("/catalogo");
        }}
      >
        LIMPIAR FILTROS
      </button>

    </div>

  </div>

</aside>

          {/* PRODUCTOS */}
          <section className="col-md-9">
            <div className="row g-4">

              {loading ? (
                <div className="col-12 text-center py-5">
                  <div
                    className="spinner-border text-danger"
                    role="status"
                  ></div>

                  <p className="mt-3 fw-bold">
                    Cargando productos de JADDA...
                  </p>
                </div>

              ) : productosFiltrados.length > 0 ? (

                productosFiltrados.map((p, index) => (
                  <div
                    key={p.ID}
                    className="col-md-4 mb-4"
                    data-aos="fade-up"
                    data-aos-delay={index * 50}
                  >
                    <div className="card h-100 shadow-sm border-0 overflow-hidden product-card">

                      {/* IMAGEN */}
                      <div
                        className="img-container"
                        style={{
                          height: "250px",
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={p.IMAGEN}
                          className="img-fluid w-100 h-100"
                          style={{
                            objectFit: "cover",
                            transition: "0.3s",
                          }}
                          alt={p.NOMBRE}
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://placehold.co/400x400?text=Jadda+Sports";
                          }}
                        />
                      </div>

                      {/* BODY */}
                      <div className="card-body text-center p-4">
                        <h5
                          className="card-title fw-bold text-uppercase"
                          style={{ fontSize: "1.1rem" }}
                        >
                          {p.NOMBRE}
                        </h5>

                        <p className="card-text text-danger fs-5 fw-bold mb-3">
                          $
                          {Number(p.PRECIO).toLocaleString("es-CO")}
                        </p>

                        {/* BOTONES */}
                        <div className="d-flex gap-2">

                          <button
                            className="btn btn-dark flex-grow-1 fw-bold py-2"
                            onClick={() =>
                              navigate(`/producto/${p.ID}`)
                            }
                          >
                            VER DETALLES
                          </button>

                          <button
                            className="btn btn-outline-danger fw-bold py-2"
                            title="Añadir rápido al carrito"
                            onClick={() => addToCart(p.ID, 1)}
                          >
                            <i className="fas fa-shopping-cart"></i>
                          </button>

                        </div>
                      </div>
                    </div>
                  </div>
                ))

              ) : (

                <div className="col-12 text-center py-5">
                  <h3>
                    No encontramos productos para "{searchTerm}"
                  </h3>

                  <p>
                    Intenta con otra palabra clave o revisa las categorías.
                  </p>
                </div>

              )}
            </div>
          </section>
        </div>
      </main>

      {/* CARRITO FLOTANTE */}
      <FloatingCart />
<MiniCartMenu />

      {/* FOOTER */}
      <footer className="footer bg-dark text-white py-4 text-center mt-auto">
        <p className="mb-0">
          © 2026 JADDA SPORTS - Pasión por el Deporte
        </p>
      </footer>
    </div>
  );
}

export default Catalogo;