import Navbar from "../components/Navbar";

function PreguntasFrecuentes() {
  const faqs = [
    { p: "¿Cuánto tardan los envíos?", r: "Los envíos nacionales tardan entre 3 y 7 días hábiles dependiendo de la ubicación. Bogotá y principales ciudades: 2-3 días hábiles." },
    { p: "¿Cuál es el costo del envío?", r: "El envío es GRATIS para pedidos superiores a $150,000 COP. Para pedidos menores, el costo varía según la ubicación (desde $10,000 COP)." },
    { p: "¿Cómo puedo hacer un cambio o devolución?", r: "Puedes solicitar cambios hasta 30 días después de recibir tu pedido. Los productos deben estar sin uso, con etiquetas y empaque original. Inicia tu solicitud desde la sección Mis Pedidos en tu perfil." },
    { p: "¿Qué métodos de pago aceptan?", r: "Aceptamos tarjetas de crédito/débito (Visa, Mastercard, American Express), transferencia bancaria, consignación y pago contraentrega (según disponibilidad)." },
    { p: "¿Cómo sé mi talla?", r: "Cada producto tiene una guía de tallas en su página de detalle. Si tienes dudas, contáctanos y te asesoramos." },
    { p: "¿Hacen envíos internacionales?", r: "Por el momento solo realizamos envíos dentro de Colombia. Pronto expandiremos a otros países." },
  ];

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: "100px", paddingBottom: "60px" }}>
        <h1 className="text-center mb-5" style={{ color: "#002244" }}>PREGUNTAS FRECUENTES</h1>
        <div className="row justify-content-center">
          <div className="col-md-8">
            {faqs.map((faq, i) => (
              <div key={i} className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px" }}>
                <div className="card-body p-4">
                  <h5 className="fw-bold mb-2" style={{ color: "#e73737" }}>{faq.p}</h5>
                  <p className="mb-0 text-muted">{faq.r}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default PreguntasFrecuentes;
