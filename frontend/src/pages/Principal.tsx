import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import Navbar from "../components/Navbar";
import "../css/principal.css";

function Principal() {
  const navigate = useNavigate();

  useEffect(() => {
    AOS.init({
      duration: 1000,
      once: false,
      mirror: true,
      offset: 120,
    });
  }, []);

  return (
    <div className="principal-wrapper">
      <Navbar />

      {/* Hero */}
      <header>
        <div className="banner">
          <div data-aos="fade-up">
            <h1 className="display-3 fw-bold">BIENVENIDO A JADDA SPORTS</h1>

            <p
              className="h4 text-uppercase"
              style={{ letterSpacing: "4px", opacity: 0.9 }}
            >
              Tu tienda deportiva de confianza
            </p>
          </div>
        </div>
      </header>

      <main className="container">

        {/* Banner Principal */}
        <section className="my-5" data-aos="fade-up">
          <div className="row g-0 rounded overflow-hidden shadow-lg">
            <div className="col-md-8 p-0 position-relative">
              <img
                src="https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=1470&auto=format&fit=crop"
                className="img-fluid w-100"
                style={{ height: "400px", objectFit: "cover" }}
                alt="Running"
              />

              <div className="position-absolute top-50 start-0 translate-middle-y bg-jadda-overlay text-white">
                <h1 className="display-4 fw-bold mb-0">
                  SUPERA
                  <br />
                  TUS LÍMITES
                </h1>

                <p
                  className="h5 mt-2 fw-light"
                  style={{ letterSpacing: "3px" }}
                >
                  EDICIÓN LIMITADA 2026
                </p>
              </div>
            </div>

            <div className="col-md-4 d-flex align-items-center p-5 bg-azul-jadda">
              <div>
                <h3 className="mb-3 text-uppercase">EL ADN DEL DEPORTE</h3>

                <p className="mb-4">
                  Tecnología diseñada para elevar tu rendimiento.
                </p>

                <hr className="bg-white opacity-50 mb-4" />

                <Link
                  to="/catalogo"
                  className="btn btn-outline-light fw-bold"
                >
                  VER COLECCIÓN
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Banners promocionales */}
        <section className="py-4">
          <div className="container">
            <div className="row g-3">
              <div className="col-md-6">
                <div style={{
                  background: "linear-gradient(135deg, #1a1a2e, #16213e)",
                  borderRadius: 20, padding: "28px 24px",
                  border: "1px solid rgba(230,57,70,0.15)",
                  height: "100%",
                }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{
                      fontSize: "2.2rem", width: 56, height: 56, borderRadius: 16,
                      background: "rgba(230,57,70,0.12)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <span role="img" aria-label="plan">🏋️</span>
                    </div>
                    <div>
                      <h5 className="fw-bold mb-1" style={{ color: "#fff", fontSize: "1rem" }}>
                        🎯 Plan de entrenamiento incluido
                      </h5>
                      <p className="mb-0" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>
                        Por la compra de cualquiera de nuestros productos te daremos un plan de entrenamiento personalizado.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div style={{
                  background: "linear-gradient(135deg, #1a1a2e, #16213e)",
                  borderRadius: 20, padding: "28px 24px",
                  border: "1px solid rgba(46,204,113,0.15)",
                  height: "100%",
                }}>
                  <div className="d-flex align-items-center gap-3">
                    <div style={{
                      fontSize: "2.2rem", width: 56, height: 56, borderRadius: 16,
                      background: "rgba(46,204,113,0.12)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <span role="img" aria-label="reto">🏆</span>
                    </div>
                    <div>
                      <h5 className="fw-bold mb-1" style={{ color: "#fff", fontSize: "1rem" }}>
                        🏆 Retos deportivos
                      </h5>
                      <p className="mb-0" style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>
                        Regístrate y cumple retos deportivos para ganar excelentes descuentos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Categorías */}
        <section className="py-5">
          <h2 className="text-center mb-5" data-aos="fade-down">
            CATEGORÍAS
          </h2>

          <div className="row g-4 text-center">
            {[
              { name: "ROPA", icon: "fa-tshirt" },
              { name: "CALZADO", icon: "fa-running" },
              { name: "ACCESORIOS", icon: "fa-dumbbell" },
            ].map((cat, index) => (
              <div
                className="col-md-4"
                key={cat.name}
                data-aos="fade-up"
                data-aos-delay={index * 100}
              >
                <div
                  className="card p-4 shadow-sm h-100"
                  style={{ cursor: "pointer" }}
                  onClick={() =>
                    navigate(`/catalogo?cat=${cat.name.toLowerCase()}`)
                  }
                >
                  <i className={`fas ${cat.icon} fa-3x text-danger mb-3`} />

                  <h4>{cat.name}</h4>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Productos destacados */}
        <section className="py-5">
          <h2 className="text-center mb-5" data-aos="fade-up">
            🔥 PRODUCTOS DESTACADOS
          </h2>

          <div className="row g-4">
            {[1, 2, 3, 4].map((item) => (
              <div className="col-md-3" key={item}>
                <div className="card shadow h-100">
                  <img
                    src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600"
                    className="card-img-top"
                    style={{ height: "250px", objectFit: "cover" }}
                  />

                  <div className="card-body">
                    <h5>Producto destacado</h5>

                    <p className="fw-bold text-danger">$149.900</p>

                    <button className="btn btn-dark w-100">
                      Ver producto
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Beneficios */}
        <section className="py-5 text-center">
          <h2 className="mb-5">¿POR QUÉ COMPRAR EN JADDA SPORTS?</h2>

          <div className="row g-4">
            <div className="col-md-3">
              <i className="fas fa-truck fa-3x text-danger mb-3"></i>
              <h5>Envíos nacionales</h5>
            </div>

            <div className="col-md-3">
              <i className="fas fa-lock fa-3x text-danger mb-3"></i>
              <h5>Pagos seguros</h5>
            </div>

            <div className="col-md-3">
              <i className="fas fa-undo fa-3x text-danger mb-3"></i>
              <h5>Cambios y devoluciones</h5>
            </div>

            <div className="col-md-3">
              <i className="fas fa-star fa-3x text-danger mb-3"></i>
              <h5>Calidad garantizada</h5>
            </div>
          </div>
        </section>

        {/* Banner intermedio */}
        <section
          className="text-white text-center rounded shadow py-5 my-5 position-relative overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg,rgba(30,41,59,0.92),rgba(15,23,42,0.85)), url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80') center/cover no-repeat",
            minHeight: "280px"
          }}
        >
          <h1 className="fw-bold">ENTRENA SIN LÍMITES</h1>

          <p className="fs-5">
            Encuentra todo para running, gimnasio y deportes urbanos.
          </p>

          <Link to="/catalogo" className="btn btn-danger mt-3">
            EXPLORAR CATÁLOGO
          </Link>
        </section>

        {/* Testimonios */}
        <section className="py-5">
          <h2 className="text-center mb-5">⭐ OPINIONES DE CLIENTES</h2>

          <div className="row g-4">
            <div className="col-md-4">
              <div className="card p-4 shadow">
                <h5>★★★★★</h5>
                <p>Excelente calidad y entrega rápida.</p>
                <strong>Carlos M.</strong>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card p-4 shadow">
                <h5>★★★★★</h5>
                <p>Muy buenos precios y atención.</p>
                <strong>Laura R.</strong>
              </div>
            </div>

            <div className="col-md-4">
              <div className="card p-4 shadow">
                <h5>★★★★★</h5>
                <p>Volvería a comprar sin dudarlo.</p>
                <strong>Andrés P.</strong>
              </div>
            </div>
          </div>
        </section>

        {/* Estadísticas */}
        <section className="py-5 text-center">
          <div className="row">
            <div className="col-md-3">
              <h1 className="text-danger">1000+</h1>
              <p>Productos</p>
            </div>

            <div className="col-md-3">
              <h1 className="text-danger">500+</h1>
              <p>Clientes felices</p>
            </div>

            <div className="col-md-3">
              <h1 className="text-danger">50+</h1>
              <p>Marcas</p>
            </div>

            <div className="col-md-3">
              <h1 className="text-danger">3+</h1>
              <p>Años de experiencia</p>
            </div>
          </div>
        </section>

        {/* Oferta */}
        <section
          className="text-white py-5 my-5 text-center rounded shadow"
          style={{
            background: "linear-gradient(45deg, #e73737, #b32a2a)",
          }}
        >
          <h1 className="display-4 fw-bold">
            ¡OFERTA DE TEMPORADA!
          </h1>

          <p className="h4">
            30% DE DESCUENTO EN TODA LA LÍNEA DE RUNNING
          </p>

          <button
            className="btn btn-light fw-bold mt-3 px-5 py-2"
            onClick={() => navigate("/catalogo")}
          >
            COMPRAR YA
          </button>
        </section>

        {/* Newsletter */}
        <section className="text-center py-5">
          <h2>Mantente informado</h2>

          <p>
            Recibe promociones y novedades de Jadda Sports.
          </p>

          <div className="row justify-content-center">
            <div className="col-md-6">
              <input
                type="email"
                className="form-control mb-3"
                placeholder="Ingresa tu correo"
              />

              <button className="btn btn-danger">
                SUSCRIBIRME
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* Footer.tsx irá aquí */}
    </div>
  );
}

export default Principal;

