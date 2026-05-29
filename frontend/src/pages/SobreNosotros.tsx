import Navbar from "../components/Navbar";
import AOS from "aos";
import "aos/dist/aos.css";
import { useEffect } from "react";

function SobreNosotros() {

  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
    });
  }, []);

  const integrantes = [
    {
      nombre: "Yeison Alexander Fernandez Muñoz",
      rol: "Desarrollador Full Stack",
      descripcion:
        "Es uno de los principales desarrolladores de JADDA SPORTS y ha participado en gran parte de la creación y desarrollo del proyecto. Se encargó principalmente del diseño frontend, la estructura visual de la plataforma y múltiples funcionalidades esenciales del sistemaEntre sus aportes se encuentra la creación del catálogo dinámico de productos, el sistema de carrito de compras interactivo, el mini carrito flotante, la integración de componentes modernos con React y TypeScript, además de mejoras en la experiencia de usuario y el diseño general de la tienda. También participó en la organización de la estructura del proyecto, conexión con el backend y optimización de distintas secciones para lograr una experiencia más profesional, moderna y similar a la de un ecommerce real.",
      correo: "yeisonfernandez2022@gmail.com",
      imagen:
        "https://placehold.co/300x300?text=YEISON",
    },

    {
      nombre: "Duglas Montenegro",
      rol: "Desarrollador Backend",
      descripcion:
        "Aquí puedes colocar la descripción de Duglas, habilidades, aporte al proyecto y demás información.",
      correo: "correo@ejemplo.com",
      imagen:
        "https://placehold.co/300x300?text=DUGLAS",
    },

    {
      nombre: "Juan Arias",
      rol: "Diseñador UI/UX",
      descripcion:
        "Aquí puedes colocar la descripción de Juan, habilidades, aporte al proyecto y demás información.",
      correo: "correo@ejemplo.com",
      imagen:
        "https://placehold.co/300x300?text=JUAN",
    },

    {
      nombre: "Miguel Castro",
      rol: "Gestor de Base de Datos",
      descripcion:
        "Aquí puedes colocar la descripción de Miguel, habilidades, aporte al proyecto y demás información.",
      correo: "correo@ejemplo.com",
      imagen:
        "https://placehold.co/300x300?text=MIGUEL",
    },
  ];

  return (
    <div
      className="text-dark min-vh-100 d-flex flex-column"
      style={{
        backgroundColor: "#f5f5f5",
      }}
    >

      <Navbar />

      {/* HERO */}
      <header className="position-relative">

        <img
          src="https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=2070&auto=format&fit=crop"
          alt="Banner JADDA"
          className="w-100"
          style={{
            height: "500px",
            objectFit: "cover",
            filter: "brightness(35%)",
          }}
        />

        <div
          className="position-absolute top-50 start-50 translate-middle text-center text-white"
          data-aos="zoom-in"
        >

          <h1
            className="fw-bold text-uppercase"
            style={{
              fontSize: "4rem",
              letterSpacing: "4px",
              textShadow: "0 4px 15px rgba(0,0,0,0.5)",
            }}
          >
            Sobre Nosotros
          </h1>

          <p
            className="mt-3 mx-auto"
            style={{
              maxWidth: "750px",
              fontSize: "1.2rem",
              lineHeight: "1.8",
              textShadow: "0 2px 10px rgba(0,0,0,0.5)",
            }}
          >
            Conoce más sobre el equipo detrás de JADDA SPORTS y el propósito de nuestro proyecto.
          </p>

        </div>
      </header>

      {/* SOBRE EL PROYECTO */}
      <section className="container py-5">

        <div
          className="text-center mb-5"
          data-aos="fade-up"
        >

          <h2
            className="fw-bold mb-4"
            style={{
              color: "#e63946",
              fontSize: "2.5rem",
            }}
          >
            ¿Qué es JADDA SPORTS?
          </h2>

          <p
            className="mx-auto"
            style={{
              maxWidth: "950px",
              fontSize: "1.1rem",
              lineHeight: "2",
              color: "#555",
            }}
          >
            JADDA SPORTS es una tienda deportiva enfocada en brindar productos de calidad para personas apasionadas por el deporte, el rendimiento y el estilo. Nuestro objetivo es ofrecer ropa, calzado y accesorios deportivos modernos que se adapten tanto a atletas como a quienes buscan comodidad y actitud en su día a día.

Como proyecto, JADDA SPORTS nace con la idea de combinar tecnología, diseño y pasión por el deporte en una plataforma moderna e intuitiva, permitiendo a los usuarios explorar productos fácilmente, gestionar sus compras y vivir una experiencia similar a la de una tienda deportiva profesional.

Buscamos representar motivación, disciplina y superación, valores que identifican a quienes viven el deporte dentro y fuera de la cancha.
          </p>

        </div>

        {/* TECNOLOGÍAS */}
        <div
          className="row g-4 mb-5"
          data-aos="fade-up"
        >

          <div className="col-md-3">

            <div
              className="p-4 h-100 text-center"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
              }}
            >

              <h4
                className="fw-bold mb-3"
                style={{ color: "#e63946" }}
              >
                React
              </h4>

              <p style={{ color: "#666" }}>
                Librería utilizada para construir interfaces modernas y dinámicas.
              </p>

            </div>

          </div>

          <div className="col-md-3">

            <div
              className="p-4 h-100 text-center"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
              }}
            >

              <h4
                className="fw-bold mb-3"
                style={{ color: "#e63946" }}
              >
                TypeScript
              </h4>

              <p style={{ color: "#666" }}>
                Mejora la escalabilidad y seguridad del proyecto.
              </p>

            </div>

          </div>

          <div className="col-md-3">

            <div
              className="p-4 h-100 text-center"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
              }}
            >

              <h4
                className="fw-bold mb-3"
                style={{ color: "#e63946" }}
              >
                Node.js
              </h4>

              <p style={{ color: "#666" }}>
                Entorno backend encargado de la lógica del sistema.
              </p>

            </div>

          </div>

          <div className="col-md-3">

            <div
              className="p-4 h-100 text-center"
              style={{
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
              }}
            >

              <h4
                className="fw-bold mb-3"
                style={{ color: "#e63946" }}
              >
                MySQL
              </h4>

              <p style={{ color: "#666" }}>
                Base de datos utilizada para almacenar toda la información.
              </p>

            </div>

          </div>

        </div>

        {/* EQUIPO */}
        <div
          className="text-center"
          data-aos="fade-up"
        >

          <h2
            className="fw-bold mb-5"
            style={{
              color: "#e63946",
              fontSize: "2.5rem",
            }}
          >
            Nuestro Equipo
          </h2>

          <div className="row g-4">

            {integrantes.map((integrante, index) => (

              <div
                key={index}
                className="col-md-6 col-lg-3"
                data-aos="fade-up"
                data-aos-delay={index * 100}
              >

                <div
                  className="p-4 h-100"
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "22px",
                    boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
                    transition: "0.3s",
                    cursor: "pointer",
                  }}

                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform =
                      "translateY(-10px)";

                    e.currentTarget.style.boxShadow =
                      "0 15px 35px rgba(0,0,0,0.15)";
                  }}

                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform =
                      "translateY(0)";

                    e.currentTarget.style.boxShadow =
                      "0 8px 25px rgba(0,0,0,0.08)";
                  }}
                >

                  {/* FOTO */}
                  <img
                    src={integrante.imagen}
                    alt={integrante.nombre}
                    className="img-fluid rounded-circle mb-4"
                    style={{
                      width: "150px",
                      height: "150px",
                      objectFit: "cover",
                      border: "5px solid #e63946",
                    }}
                  />

                  {/* INFO */}
                  <h4
                    className="fw-bold mb-2"
                    style={{
                      color: "#111",
                    }}
                  >
                    {integrante.nombre}
                  </h4>

                  <p
                    className="fw-semibold mb-3"
                    style={{
                      color: "#e63946",
                    }}
                  >
                    {integrante.rol}
                  </p>

                  <p
                    style={{
                      fontSize: "0.95rem",
                      lineHeight: "1.8",
                      color: "#666",
                    }}
                  >
                    {integrante.descripcion}
                  </p>

                  <p
                    className="mt-4 mb-1 fw-bold"
                    style={{
                      color: "#111",
                    }}
                  >
                    Correo
                  </p>

                  <p
                    style={{
                      color: "#777",
                      wordBreak: "break-word",
                    }}
                  >
                    {integrante.correo}
                  </p>

                </div>

              </div>

            ))}

          </div>

        </div>

      </section>

      {/* FOOTER */}
      <footer
        className="text-white text-center py-4 mt-auto"
        style={{
          backgroundColor: "#111111",
        }}
      >

        <p className="mb-0">
          © 2026 JADDA SPORTS - Todos los derechos reservados.
        </p>

      </footer>

    </div>
  );
}

export default SobreNosotros;