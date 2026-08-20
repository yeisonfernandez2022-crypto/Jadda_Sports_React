import PaginaInfo from "../components/PaginaInfo";

const SECCIONES = [
  {
    titulo: "1. Información recopilada",
    parrafos: ["Podremos recopilar información como:"],
    items: [
      "Nombre y apellidos.",
      "Documento de identificación.",
      "Dirección de entrega.",
      "Número de teléfono.",
      "Correo electrónico.",
      "Historial de compras.",
      "Información necesaria para la atención al cliente.",
    ],
  },
  {
    titulo: "2. Finalidad del tratamiento de los datos",
    parrafos: ["La información recopilada será utilizada para:"],
    items: [
      "Procesar pedidos.",
      "Gestionar pagos.",
      "Realizar envíos.",
      "Brindar atención al cliente.",
      "Informar sobre el estado de las compras.",
      "Mejorar la experiencia de navegación.",
      "Cumplir obligaciones legales.",
    ],
  },
  {
    titulo: "3. Protección de la información",
    parrafos: ["Jadda Sports implementa medidas de seguridad administrativas, técnicas y organizacionales para proteger la información personal contra pérdida, acceso no autorizado, alteración o divulgación."],
  },
  {
    titulo: "4. Compartición de datos",
    parrafos: [
      "La información personal únicamente podrá compartirse con empresas transportadoras, entidades financieras o autoridades competentes cuando sea necesario para la prestación del servicio o por obligación legal.",
      "Jadda Sports no vende ni comercializa la información personal de sus usuarios.",
    ],
  },
  {
    titulo: "5. Derechos del titular",
    parrafos: ["El usuario podrá:"],
    items: [
      "Conocer la información almacenada.",
      "Solicitar su actualización.",
      "Corregir datos inexactos.",
      "Solicitar la eliminación de la información cuando sea procedente.",
      "Revocar la autorización para el tratamiento de datos en los casos permitidos por la ley.",
    ],
  },
  {
    titulo: "6. Uso de cookies",
    parrafos: ["Nuestro sitio puede utilizar cookies para mejorar la experiencia de navegación, recordar preferencias del usuario y obtener estadísticas de uso."],
  },
  {
    titulo: "7. Conservación de la información",
    parrafos: ["Los datos personales serán conservados durante el tiempo necesario para cumplir las finalidades descritas o mientras exista una obligación legal que así lo requiera."],
  },
  {
    titulo: "8. Cambios a esta política",
    parrafos: ["Jadda Sports podrá actualizar esta Política de Privacidad cuando sea necesario. Las modificaciones serán publicadas oportunamente en el sitio web."],
    extra: "Esta política se encuentra elaborada conforme a la legislación colombiana sobre protección de datos personales.",
  },
];

export default function PoliticaPrivacidad() {
  return <PaginaInfo titulo="POLÍTICA DE PRIVACIDAD" subtitulo="Última actualización: 29 de junio de 2026" secciones={SECCIONES} />;
}
