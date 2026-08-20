import PaginaInfo from "../components/PaginaInfo";

const SECCIONES = [
  {
    titulo: "1. Cambios de productos",
    parrafos: ["Los clientes podrán solicitar el cambio de un producto dentro de los treinta (30) días calendario siguientes a la entrega, siempre que:"],
    items: [
      "El producto no haya sido utilizado.",
      "Se encuentre limpio y en perfecto estado.",
      "Conserve sus etiquetas originales.",
      "Se entregue con su empaque original.",
    ],
  },
  {
    titulo: "2. Productos que no admiten cambios",
    parrafos: ["No se aceptarán cambios de:"],
    items: [
      "Productos personalizados.",
      "Productos deteriorados por mal uso.",
      "Artículos sin etiquetas o con signos evidentes de uso.",
      "Productos adquiridos mediante promociones especiales cuando así se indique.",
    ],
  },
  {
    titulo: "3. Garantía",
    parrafos: [
      "Todos los productos vendidos por Jadda Sports cuentan con garantía por defectos de fabricación conforme a la legislación colombiana.",
      "La garantía no cubre daños ocasionados por:",
    ],
    items: [
      "Uso inadecuado.",
      "Desgaste normal.",
      "Accidentes.",
      "Alteraciones realizadas por terceros.",
      "Incumplimiento de las recomendaciones de cuidado del fabricante.",
    ],
  },
  {
    titulo: "4. Procedimiento para solicitar una garantía",
    parrafos: ["El cliente deberá comunicarse con el servicio de atención al cliente indicando:"],
    items: [
      "Número del pedido.",
      "Nombre del comprador.",
      "Descripción del inconveniente.",
      "Evidencia fotográfica cuando sea necesaria.",
    ],
    extra: "Una vez recibida la solicitud, Jadda Sports evaluará el caso y dará respuesta dentro de los plazos establecidos por la legislación colombiana.",
  },
  {
    titulo: "5. Reembolsos",
    parrafos: [
      "Cuando proceda un reembolso, este se realizará utilizando el mismo medio de pago empleado por el cliente o mediante otro mecanismo acordado entre las partes.",
      "Los tiempos del reembolso dependerán de la entidad financiera correspondiente.",
    ],
  },
  {
    titulo: "6. Derecho de retracto",
    parrafos: ["Cuando la legislación colombiana lo permita, el consumidor podrá ejercer su derecho de retracto dentro del término legal establecido, siempre que el producto sea devuelto en las mismas condiciones en que fue entregado."],
  },
  {
    titulo: "7. Atención al cliente",
    parrafos: ["Para cualquier solicitud relacionada con cambios, devoluciones o garantías, el cliente podrá comunicarse a través de los canales oficiales de atención de Jadda Sports."],
  },
];

export default function PoliticasDevolucion() {
  return <PaginaInfo titulo="POLÍTICA DE DEVOLUCIONES Y GARANTÍAS" subtitulo="Última actualización: 29 de junio de 2026" secciones={SECCIONES} />;
}
