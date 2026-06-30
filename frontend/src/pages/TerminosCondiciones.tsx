import Navbar from "../components/Navbar";

function TerminosCondiciones() {
  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: "100px", paddingBottom: "60px" }}>
        <h1 className="text-center mb-5" style={{ color: "#002244" }}>TÉRMINOS Y CONDICIONES DE USO</h1>
        <p className="text-center text-muted mb-4">Última actualización: 29 de junio de 2026</p>
        <div className="row justify-content-center">
          <div className="col-md-8">
            <div className="card border-0 shadow-sm" style={{ borderRadius: "12px" }}>
              <div className="card-body p-4">
                <p className="text-muted">Bienvenido a Jadda Sports. Al acceder y utilizar nuestro sitio web, el usuario acepta los presentes Términos y Condiciones. Si no está de acuerdo con alguno de ellos, deberá abstenerse de utilizar nuestros servicios.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>1. Objeto</h5>
                <p className="text-muted">Jadda Sports es una tienda virtual dedicada a la comercialización de artículos deportivos, incluyendo calzado, ropa, accesorios y demás productos relacionados con la práctica del deporte.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>2. Registro de usuarios</h5>
                <p className="text-muted">El usuario podrá navegar libremente por el sitio web. Para realizar compras, podrá ser necesario proporcionar información personal veraz y actualizada. El usuario es responsable de la confidencialidad de sus datos de acceso.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>3. Productos</h5>
                <p className="text-muted">Los productos publicados incluyen fotografías, descripciones y precios con fines informativos. Aunque procuramos mantener la información actualizada, pueden presentarse diferencias mínimas en colores, tallas o especificaciones según el fabricante.</p>
                <p className="text-muted">La disponibilidad de los productos está sujeta al inventario existente al momento de la compra.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>4. Precios</h5>
                <p className="text-muted">Todos los precios se expresan en pesos colombianos (COP) e incluyen los impuestos aplicables, salvo que se indique lo contrario.</p>
                <p className="text-muted">Jadda Sports podrá modificar los precios en cualquier momento sin previo aviso. Los cambios no afectarán las compras que ya hayan sido confirmadas.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>5. Formas de pago</h5>
                <p className="text-muted">El cliente podrá realizar sus compras mediante los medios de pago habilitados en la plataforma. Toda transacción estará sujeta a procesos de validación y autorización por parte de la entidad financiera correspondiente.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>6. Envíos</h5>
                <p className="text-muted">Los pedidos serán despachados dentro de los tiempos informados durante el proceso de compra. Los tiempos de entrega pueden variar según la ciudad de destino, la empresa transportadora y circunstancias externas.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>7. Garantías</h5>
                <p className="text-muted">Todos los productos cuentan con garantía por defectos de fabricación conforme a la legislación colombiana. La garantía no cubre daños ocasionados por uso indebido, accidentes, desgaste natural o manipulación incorrecta del producto.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>8. Propiedad intelectual</h5>
                <p className="text-muted">Todo el contenido del sitio web, incluyendo imágenes, logotipos, diseños, textos y demás elementos gráficos, pertenece a Jadda Sports o cuenta con la autorización correspondiente para su uso. Queda prohibida su reproducción sin autorización previa.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>9. Uso adecuado del sitio</h5>
                <p className="text-muted">El usuario se compromete a utilizar el sitio web de manera responsable, absteniéndose de realizar actividades que puedan afectar su funcionamiento, vulnerar la seguridad o perjudicar a otros usuarios.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>10. Modificaciones</h5>
                <p className="text-muted">Jadda Sports podrá modificar estos Términos y Condiciones en cualquier momento. Las modificaciones entrarán en vigor desde su publicación en el sitio web.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>11. Legislación aplicable</h5>
                <p className="text-muted">Estos Términos y Condiciones se rigen por las leyes de la República de Colombia, especialmente por las disposiciones aplicables en materia de comercio electrónico y protección al consumidor.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default TerminosCondiciones;
