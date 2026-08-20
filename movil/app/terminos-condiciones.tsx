import PaginaInfo from "../components/PaginaInfo";

const SECCIONES = [
  {
    titulo: "1. Objeto",
    parrafos: ["Jadda Sports es una tienda virtual dedicada a la comercialización de artículos deportivos, incluyendo calzado, ropa, accesorios y demás productos relacionados con la práctica del deporte."],
  },
  {
    titulo: "2. Registro de usuarios",
    parrafos: ["El usuario podrá navegar libremente por el sitio web. Para realizar compras, podrá ser necesario proporcionar información personal veraz y actualizada. El usuario es responsable de la confidencialidad de sus datos de acceso."],
  },
  {
    titulo: "3. Productos",
    parrafos: [
      "Los productos publicados incluyen fotografías, descripciones y precios con fines informativos. Aunque procuramos mantener la información actualizada, pueden presentarse diferencias mínimas en colores, tallas o especificaciones según el fabricante.",
      "La disponibilidad de los productos está sujeta al inventario existente al momento de la compra.",
    ],
  },
  {
    titulo: "4. Precios",
    parrafos: [
      "Todos los precios se expresan en pesos colombianos (COP) e incluyen los impuestos aplicables, salvo que se indique lo contrario.",
      "Jadda Sports podrá modificar los precios en cualquier momento sin previo aviso. Los cambios no afectarán las compras que ya hayan sido confirmadas.",
    ],
  },
  {
    titulo: "5. Formas de pago",
    parrafos: ["El cliente podrá realizar sus compras mediante los medios de pago habilitados en la plataforma. Toda transacción estará sujeta a procesos de validación y autorización por parte de la entidad financiera correspondiente."],
  },
  {
    titulo: "6. Envíos",
    parrafos: ["Los pedidos serán despachados dentro de los tiempos informados durante el proceso de compra. Los tiempos de entrega pueden variar según la ciudad de destino, la empresa transportadora y circunstancias externas."],
  },
  {
    titulo: "7. Garantías",
    parrafos: ["Todos los productos cuentan con garantía por defectos de fabricación conforme a la legislación colombiana. La garantía no cubre daños ocasionados por uso indebido, accidentes, desgaste natural o manipulación incorrecta del producto."],
  },
  {
    titulo: "8. Propiedad intelectual",
    parrafos: ["Todo el contenido del sitio web, incluyendo imágenes, logotipos, diseños, textos y demás elementos gráficos, pertenece a Jadda Sports o cuenta con la autorización correspondiente para su uso. Queda prohibida su reproducción sin autorización previa."],
  },
  {
    titulo: "9. Uso adecuado del sitio",
    parrafos: ["El usuario se compromete a utilizar el sitio web de manera responsable, absteniéndose de realizar actividades que puedan afectar su funcionamiento, vulnerar la seguridad o perjudicar a otros usuarios."],
  },
  {
    titulo: "10. Modificaciones",
    parrafos: ["Jadda Sports podrá modificar estos Términos y Condiciones en cualquier momento. Las modificaciones entrarán en vigor desde su publicación en el sitio web."],
  },
  {
    titulo: "11. Legislación aplicable",
    parrafos: ["Estos Términos y Condiciones se rigen por las leyes de la República de Colombia, especialmente por las disposiciones aplicables en materia de comercio electrónico y protección al consumidor."],
  },
];

export default function TerminosCondiciones() {
  return <PaginaInfo titulo="TÉRMINOS Y CONDICIONES DE USO" subtitulo="Última actualización: 29 de junio de 2026" secciones={SECCIONES} />;
}
