import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";
import Navbar from "../components/Navbar"; 
import "../css/principal.css"; 

function Principal() {
  const navigate = useNavigate();

  // Inicialización única de las animaciones AOS al montar el componente
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
      {/* El Navbar interno se encargará de reaccionar al AuthContext */}
      <Navbar />

      <header>
        <div className="banner">
          <div data-aos="fade-up">
            <h1 className="display-3 fw-bold">BIENVENIDO A JADDA SPORTS</h1>
            <p className="h4 text-uppercase" style={{ letterSpacing: "4px", opacity: 0.9 }}>
              Tu tienda deportiva de confianza
            </p>
          </div>
        </div>
      </header>

      <main className="container">
        {/* Sección de Banner Principal / Edición Limitada */}
        <section className="my-5" data-aos="fade-up">
          <div className="row g-0 rounded overflow-hidden shadow-lg">
            <div className="col-md-8 p-0 position-relative">
              <img 
                src="https://images.unsplash.com/photo-1552674605-db6ffd4facb5?q=80&w=1470&auto=format&fit=crop" 
                className="img-fluid w-100" 
                style={{ height: "400px", objectFit: "cover" }}
                alt="Running Jadda"
              />
              <div className="position-absolute top-50 start-0 translate-middle-y bg-jadda-overlay text-white">
                <h1 className="display-4 fw-bold mb-0">SUPERA<br />TUS LÍMITES</h1>
                <p className="h5 mt-2 fw-light" style={{ letterSpacing: "3px" }}>EDICIÓN LIMITADA 2026</p>
              </div>
            </div>
            <div className="col-md-4 d-flex align-items-center p-5 bg-azul-jadda">
              <div>
                <h3 className="mb-3 text-uppercase">EL ADN DEL DEPORTE</h3>
                <p className="mb-4">Tecnología diseñada para elevar tu rendimiento.</p>
                <hr className="bg-white opacity-50 mb-4" />
                <Link to="/catalogo" className="btn btn-outline-light fw-bold">VER COLECCIÓN</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Sección de Categorías */}
        <section id="categorias" className="py-5">
          <h3 className="text-center mb-5" data-aos="fade-down" style={{ fontSize: "3rem" }}>CATEGORÍAS</h3>
          <div className="row g-4 text-center">
            {[
              { name: 'ROPA', icon: 'fa-tshirt' },
              { name: 'CALZADO', icon: 'fa-running' },
              { name: 'ACCESORIOS', icon: 'fa-dumbbell' }
            ].map((cat, index) => (
              <div key={cat.name} className="col-md-4" data-aos="fade-up" data-aos-delay={index * 100}>
                <div 
                  className="card p-4 shadow-sm h-100" 
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/catalogo?cat=${cat.name.toLowerCase()}`)}
                >
                  <i className={`fas ${cat.icon} fa-3x mb-3 text-danger`}></i>
                  <h4>{cat.name}</h4>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Banner de Oferta de Temporada */}
        <div className="container-fluid text-white py-5 my-5 text-center rounded shadow" 
             style={{ background: "linear-gradient(45deg, #e73737, #b32a2a)" }}>
          <div data-aos="zoom-in">
            <h1 className="display-4 fw-bold mb-0">¡OFERTA DE TEMPORADA!</h1>
            <p className="h4">30% DE DESCUENTO EN TODA LA LÍNEA DE RUNNING</p>
            <button className="btn btn-light fw-bold mt-3 px-5 py-2" onClick={() => navigate('/catalogo')}>COMPRAR YA</button>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p>©2026 JADDA SPORTS - Pasión por el Deporte</p>
      </footer>
    </div>
  );
}

export default Principal;