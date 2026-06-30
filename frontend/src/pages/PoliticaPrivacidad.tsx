import Navbar from "../components/Navbar";

function PoliticaPrivacidad() {
  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: "100px", paddingBottom: "60px" }}>
        <h1 className="text-center mb-5" style={{ color: "#002244" }}>POLÍTICA DE PRIVACIDAD</h1>
        <p className="text-center text-muted mb-4">Última actualización: 29 de junio de 2026</p>
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
              <div className="card-body p-4">
                <p className="text-muted">En Jadda Sports valoramos la privacidad de nuestros usuarios y protegemos la información personal suministrada durante el uso de nuestro sitio web.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>1. Información recopilada</h5>
                <p className="text-muted">Podremos recopilar información como:</p>
                <ul className="text-muted">
                  <li>Nombre y apellidos.</li>
                  <li>Documento de identificación.</li>
                  <li>Dirección de entrega.</li>
                  <li>Número de teléfono.</li>
                  <li>Correo electrónico.</li>
                  <li>Historial de compras.</li>
                  <li>Información necesaria para la atención al cliente.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>2. Finalidad del tratamiento de los datos</h5>
                <p className="text-muted">La información recopilada será utilizada para:</p>
                <ul className="text-muted">
                  <li>Procesar pedidos.</li>
                  <li>Gestionar pagos.</li>
                  <li>Realizar envíos.</li>
                  <li>Brindar atención al cliente.</li>
                  <li>Informar sobre el estado de las compras.</li>
                  <li>Mejorar la experiencia de navegación.</li>
                  <li>Cumplir obligaciones legales.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>3. Protección de la información</h5>
                <p className="text-muted">Jadda Sports implementa medidas de seguridad administrativas, técnicas y organizacionales para proteger la información personal contra pérdida, acceso no autorizado, alteración o divulgación.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>4. Compartición de datos</h5>
                <p className="text-muted">La información personal únicamente podrá compartirse con empresas transportadoras, entidades financieras o autoridades competentes cuando sea necesario para la prestación del servicio o por obligación legal.</p>
                <p className="text-muted">Jadda Sports no vende ni comercializa la información personal de sus usuarios.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>5. Derechos del titular</h5>
                <p className="text-muted">El usuario podrá:</p>
                <ul className="text-muted">
                  <li>Conocer la información almacenada.</li>
                  <li>Solicitar su actualización.</li>
                  <li>Corregir datos inexactos.</li>
                  <li>Solicitar la eliminación de la información cuando sea procedente.</li>
                  <li>Revocar la autorización para el tratamiento de datos en los casos permitidos por la ley.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>6. Uso de cookies</h5>
                <p className="text-muted">Nuestro sitio puede utilizar cookies para mejorar la experiencia de navegación, recordar preferencias del usuario y obtener estadísticas de uso.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>7. Conservación de la información</h5>
                <p className="text-muted">Los datos personales serán conservados durante el tiempo necesario para cumplir las finalidades descritas o mientras exista una obligación legal que así lo requiera.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>8. Cambios a esta política</h5>
                <p className="text-muted">Jadda Sports podrá actualizar esta Política de Privacidad cuando sea necesario. Las modificaciones serán publicadas oportunamente en el sitio web.</p>

                <p className="text-muted mt-4">Esta política se encuentra elaborada conforme a la legislación colombiana sobre protección de datos personales.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default PoliticaPrivacidad;
