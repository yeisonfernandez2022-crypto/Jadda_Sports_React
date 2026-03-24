import { useEffect, useState } from "react";
import AOS from "aos";
import "aos/dist/aos.css";
import Navbar from "../components/Navbar"; 
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

  useEffect(() => {
    // Una duración un poco más corta para evitar el parpadeo inicial
    AOS.init({ duration: 600, once: true });

    fetch("/api/productos")
      .then((res) => {
        if (!res.ok) throw new Error("Error al obtener productos");
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
  }, []);

  return (
    /* Agregamos el padding-top directamente aquí para asegurar que el banner no se pegue arriba */
    <div className="catalogo-wrapper" style={{ paddingTop: '85px' }}>
      <Navbar /> 

      <header className="banner-header">
        <div className="banner text-center py-5" style={{ background: '#f8f9fa' }}>
          <h2 data-aos="zoom-in" className="fw-bold display-4">NUESTRO CATÁLOGO</h2>
          <p data-aos="fade-up" className="text-muted text-uppercase" style={{ letterSpacing: '2px' }}>
            Equipamiento de alto rendimiento
          </p>
        </div>
      </header>

      <main className="container-fluid my-5 px-4">
        <div className="row g-4">
          <aside className="col-md-3">
            <div className="filtros p-4 shadow-sm rounded bg-white sticky-top" style={{ top: '100px' }}>
              <h4 className="fw-bold mb-3">FILTRAR</h4>
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="ropa" /> 
                <label className="form-check-label" htmlFor="ropa">Ropa</label>
              </div>
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="calzado" /> 
                <label className="form-check-label" htmlFor="calzado">Calzado</label>
              </div>
              <div className="form-check mb-2">
                <input className="form-check-input" type="checkbox" id="accesorios" /> 
                <label className="form-check-label" htmlFor="accesorios">Accesorios</label>
              </div>
            </div>
          </aside>

          <section className="col-md-9">
            <div className="row g-4">
              {loading ? (
                <div className="col-12 text-center py-5">
                  <div className="spinner-border text-danger" role="status"></div>
                  <p className="mt-3 fw-bold">Cargando productos de JADDA...</p>
                </div>
              ) : (
                productos.map((p, index) => (
                  <div key={p.ID} className="col-md-4 mb-4" data-aos="fade-up" data-aos-delay={index * 50}>
                    <div className="card h-100 shadow-sm product-card border-0 overflow-hidden">
                      <div className="img-container" style={{ height: '250px', overflow: 'hidden' }}>
                        <img 
                          src={p.IMAGEN} 
                          className="img-fluid w-100 h-100" 
                          style={{ objectFit: 'cover', transition: '0.3s' }}
                          alt={p.NOMBRE}
                          onError={(e) => (e.currentTarget.src = 'https://placehold.co/400x400?text=Jadda+Sports')}
                        />
                      </div>
                      <div className="card-body text-center p-4">
                        <h5 className="card-title fw-bold text-uppercase" style={{ fontSize: '1.1rem' }}>{p.NOMBRE}</h5>
                        <p className="card-text text-danger fs-5 fw-bold mb-3">
                          ${Number(p.PRECIO).toLocaleString('es-CO')}
                        </p>
                        <button className="btn btn-dark w-100 fw-bold btn-buy py-2">
                          <i className="fas fa-shopping-cart me-2"></i>VER DETALLES
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="footer bg-dark text-white py-4 text-center mt-5">
        <p className="mb-0">© 2026 JADDA SPORTS - Pasión por el Deporte</p>
      </footer>
    </div>
  );
}

export default Catalogo;