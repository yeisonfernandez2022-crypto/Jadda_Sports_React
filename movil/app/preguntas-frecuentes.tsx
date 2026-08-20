import PaginaInfo from "../components/PaginaInfo";

const FAQS = [
  {
    titulo: "¿Cuánto tardan los envíos?",
    parrafos: ["Los envíos nacionales tardan entre 3 y 7 días hábiles dependiendo de la ubicación. Bogotá y principales ciudades: 2-3 días hábiles."],
  },
  {
    titulo: "¿Cuál es el costo del envío?",
    parrafos: ["El envío es GRATIS para pedidos superiores a $150,000 COP. Para pedidos menores, el costo varía según la ubicación (desde $10,000 COP)."],
  },
  {
    titulo: "¿Cómo puedo hacer un cambio o devolución?",
    parrafos: ["Puedes solicitar cambios hasta 30 días después de recibir tu pedido. Los productos deben estar sin uso, con etiquetas y empaque original. Inicia tu solicitud desde la sección Mis Pedidos en tu perfil."],
  },
  {
    titulo: "¿Qué métodos de pago aceptan?",
    parrafos: ["Aceptamos tarjetas de crédito/débito (Visa, Mastercard, American Express), PSE, Nequi, Daviplata y otros métodos habilitados en la plataforma."],
  },
  {
    titulo: "¿Cómo sé mi talla?",
    parrafos: ["Cada producto tiene una guía de tallas en su página de detalle. Si tienes dudas, contáctanos y te asesoramos."],
  },
  {
    titulo: "¿Hacen envíos internacionales?",
    parrafos: ["Por el momento solo realizamos envíos dentro de Colombia. Pronto expandiremos a otros países."],
  },
];

export default function PreguntasFrecuentes() {
  return <PaginaInfo titulo="PREGUNTAS FRECUENTES" secciones={FAQS} />;
}
