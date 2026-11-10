import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { volverAtras } from "../utils/volverAtras";

function PoliticaPrivacidad() {
  const navigate = useNavigate();
  return (
    <>
      <div className="container" style={{ paddingTop: "100px", paddingBottom: "60px" }}>
        <h1 className="text-center mb-1" style={{ color: "#002244", fontWeight: 800 }}>POLÍTICA DE PRIVACIDAD Y TRATAMIENTO DE DATOS</h1>
        <p className="text-center text-muted mb-1">Última actualización: 10 de noviembre de 2026 • Ley 1581 de 2012 y Decreto 1377 de 2013 (Colombia) • JADDA SPORTS S.A.S.</p>
        <p className="text-center mb-4"><span className="badge rounded-pill" style={{ background: "#002244" }}>Responsable: JADDA SPORTS S.A.S., Bogotá D.C., contacto: privacidad@jaddasports.com</span></p>
        <button onClick={() => volverAtras(navigate, "/")} className="btn p-0 text-dark fw-bold text-uppercase mb-3">
          <FaArrowLeft className="text-danger" /> Volver
        </button>
        <div className="row justify-content-center">
          <div className="col-lg-9">
            <div className="alert alert-light border d-flex gap-2" style={{ borderLeft: "4px solid #002244", background: "#f8fafc" }}>
              <span>🔒</span>
              <small className="text-muted">Usamos tus datos solo para operar la tienda, el chat por producto y las devoluciones. Nunca vendemos tu información. Puedes consultar, corregir o eliminar tus datos escribiendo a <strong>privacidad@jaddasports.com</strong>.</small>
            </div>
            <div className="card border-0 shadow-sm" style={{ borderRadius: "16px", overflow: "hidden" }}>
              <div className="card-body p-4 p-md-5">
                <p className="text-muted">Esta política describe qué datos recogemos, para qué, con quién los compartimos y cómo ejercer tus derechos como titular (Habeas Data).</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>1. Qué datos recogemos</h5>
                <ul className="text-muted">
                  <li><strong>Identificación y contacto:</strong> nombre, apellidos, tipo y número de documento, correo electrónico, teléfono, tu usuario y foto de perfil. Si inicias sesión con <strong>Google</strong>, recibimos de esa plataforma tu nombre, correo y foto de la cuenta; nunca vemos la contraseña de esa cuenta de Google.</li>
                  <li><strong>Verificación y seguridad:</strong> el código de verificación de tu correo (6 dígitos) y los códigos de recuperación se guardan de forma cifrada y expiran a los 15 minutos. Cuando inicias sesión registramos tu conexión más reciente (fecha, hora, IP y ubicación aproximada) para mostrarla en <em>Perfil &gt; Seguridad</em> y que puedas detectar accesos ajenos.</li>
                  <li><strong>Datos de tus compras:</strong> las direcciones de entrega que guardas, los métodos de pago que decides guardar (titular, banco y teléfono; <strong>nunca el número completo de la tarjeta</strong>), tus pedidos con su detalle, envíos y facturas.</li>
                  <li><strong>Soporte y reclamos:</strong> los mensajes del chat entre tú y cada tienda (con lenguaje ofensivo filtrado automáticamente), y las solicitudes de devolución o reembolso junto con las evidencias que adjuntes.</li>
                  <li><strong>Vendedores:</strong> si aplicas a “Ser vendedor”, conservamos la información de tu empresa (nombre, NIT, representante y contacto; empresa y NIT son opcionales si vendes de forma informal) para poder habilitarte y verificar tu cuenta.</li>
                  <li><strong>Datos técnicos:</strong> la cookie esencial de sesión (descrita en el punto 8) y, en la app móvil, la sesión guardada en el almacenamiento propio de tu teléfono.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>2. Para qué los usamos (finalidades)</h5>
                <ul className="text-muted">
                  <li>Crear tu cuenta, verificar tu correo con el código de 6 dígitos y ayudarte a recuperar tu contraseña.</li>
                  <li>Procesar tus pedidos, calcular el envío por departamento, generar la factura PDF y avisarte de cada cambio de estado (en camino, entregado, cancelado) por correo y en tu campanita.</li>
                  <li>Operar el <strong>chat con cada tienda</strong> y el <strong>chat de las devoluciones</strong>, dejando registro para que JADDA pueda atender un caso cuando tú lo escalas.</li>
                  <li>Gestionar devoluciones y reembolsos (incluyen el chat y las evidencias) y el rol de vendedor: sus productos pasan por revisión antes de publicarse.</li>
                  <li>Personalizar recomendaciones, retos y planes de entrenamiento, y enviarte el newsletter <strong>solo si te suscribes</strong> (puedes darte de baja con un clic en el correo o desde el panel).</li>
                  <li>Cumplir obligaciones legales, de garantía y protección al consumidor.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>3. Base legal y tu autorización</h5>
                <p className="text-muted">Al registrarte aceptas esta política. Para ser vendedor, al enviar el formulario de “Ser vendedor” autorizas la verificación de tu empresa y del NIT. Puedes revocar tu autorización escribiendo a privacidad@jaddasports.com, sin efecto retroactivo sobre pedidos ya ejecutados.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>4. Con quién compartimos (y con quién no)</h5>
                <ul className="text-muted">
                  <li><strong>Servicio de alojamiento de imágenes y videos (Cloudinary):</strong> tu foto de perfil, las imágenes y las evidencias que subes se almacenan allí y se muestran como enlaces seguros. Ese servicio es internacional y lo usamos porque es necesario para prestar el servicio; aceptas su uso al subir archivos.</li>
                  <li><strong>Servicio de ubicación por IP:</strong> al iniciar sesión consultamos la ubicación aproximada de tu IP para mostrarte la ciudad/región de tu última conexión en <em>Perfil &gt; Seguridad</em>. Recibimos únicamente la IP de ese momento.</li>
                  <li><strong>Google:</strong> si te registras o inicias sesión con esa cuenta, recibimos tu nombre, correo y foto; el resto de tu tratamiento ocurre en JADDA SPORTS conforme a esta política.</li>
                  <li><strong>Proveedor de correo:</strong> entrega los correos transaccionales (verificación de cuenta, facturas, estados del pedido, restablecimiento de contraseña) con los datos estrictamente necesarios.</li>
                  <li><strong>Solo cuando es necesario:</strong> transportadoras (dirección y teléfono de entrega), pasarelas de pago (datos necesarios para cobrar) y autoridades si la ley lo exige.</li>
                  <li><strong>Marketplace:</strong> si compras a un vendedor aliado, le compartimos tu nombre, correo y dirección de entrega <strong>solo para ese pedido</strong>. El vendedor no ve tus chats con JADDA ni con otras tiendas.</li>
                  <li><strong>Nunca vendemos</strong> tu información ni la cedemos para publicidad de terceros.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>5. Dónde y cuánto tiempo guardamos</h5>
                <ul className="text-muted">
                  <li>Tus datos están en la base de datos de JADDA SPORTS, con <strong>respaldos periódicos</strong> que conservamos 7 días.</li>
                  <li>Conservamos pedidos y facturas durante el tiempo que exige la ley; los chats y evidencias de una devolución permanecen mientras la solicitud esté activa más 1 año para trazabilidad, y luego se anonimizan.</li>
                  <li>Las imágenes y videos que subes se guardan en el servicio de alojamiento (Cloudinary) y se eliminan cuando tú los quitas o cuando el administrador resuelve tu solicitud.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>6. Cómo protegemos tu información</h5>
                <ul className="text-muted">
                  <li>Tu contraseña nunca se guarda en texto plano: se almacena cifrada y es irreversible.</li>
                  <li>Tus sesiones son seguras y privadas; si alguien insiste demasiado en entrar a una cuenta, la plataforma bloquea temporalmente el acceso.</li>
                  <li>El sistema valida siempre los datos que recibe (evitando inyecciones de código), los mensajes del chat admiten máximo 2.000 caracteres y tienen filtro automático de lenguaje ofensivo.</li>
                  <li>Los archivos que subes (fotos y videos de evidencias) se validan por tipo y tamaño (máx. 25 MB por archivo) antes de aceptarse.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>7. Tus derechos (consultar, corregir, eliminar, revocar, no ser spameado)</h5>
                <p className="text-muted">Escríbenos a <strong>privacidad@jaddasports.com</strong> con tu correo registrado y te respondemos en máximo 15 días hábiles. Puedes:</p>
                <ul className="text-muted">
                  <li><strong>Conocer</strong> qué información tenemos de ti (te la entregamos en un archivo descargable).</li>
                  <li><strong>Corregir</strong> tus datos desde <em>Perfil &gt; Editar</em> (cambiar el correo exige confirmar con un código enviada al nuevo correo; el teléfono pide tu contraseña actual).</li>
                  <li><strong>Pedir la eliminación</strong> de tu cuenta (los pedidos ya facturados solo se anonimizan, por obligación legal de conservación).</li>
                  <li><strong>Revocar</strong> el newsletter con un clic en el correo o escribirnos para revocar el tratamiento en los casos permitidos por la ley.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>8. Cookies, sesión y almacenamiento local</h5>
                <ul className="text-muted">
                  <li><strong>Una única cookie esencial de sesión:</strong> la usamos solo para mantenerte autenticado en el sitio. Es segura (el navegador no puede exponerla a otros sitios), se envía solo a nuestro servidor y tiene vigencia máxima de 24 horas. Si la bloqueas, no podrás iniciar sesión ni comprar.</li>
                  <li><strong>El carrito NO usa cookies:</strong> vive en nuestro servidor asociado a tu cuenta o sesión, por eso lo encuentras igual desde el computador o el teléfono.</li>
                  <li><strong>No usamos cookies publicitarias, de analítica ni de terceros.</strong></li>
                  <li><strong>Guardado técnico del navegador (no son cookies):</strong> el historial de productos que has visto (para la sección “Recientemente vistos”), los contadores de tiempo de los códigos de verificación y el aviso de cookies que ya cerraste. Puedes borrarlos desde los ajustes de tu navegador sin perder tu cuenta.</li>
                  <li><strong>App móvil:</strong> la sesión se guarda en el almacenamiento propio de tu teléfono, no en cookies del navegador.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>9. Cambios</h5>
                <p className="text-muted">Publicaremos la nueva versión aquí con fecha. Si el cambio es sustancial (por ejemplo, una nueva finalidad de tus datos), te pediremos aceptarla de nuevo al iniciar sesión. La vigencia siempre la verás en esta misma página.</p>

                <div className="mt-4 p-3 rounded text-center small text-muted" style={{ background: "#f8fafc", border: "1px dashed #e2e8f0" }}>
                  ¿Dudas? Soporte por el botón flotante de chat (producto) o <a href="/contacto">Contacto</a> / <a href="/pqr">PQR</a>. También en <a href="/terminos-condiciones">Términos</a> y <a href="/politicas-devolucion">Devoluciones</a>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default PoliticaPrivacidad;
