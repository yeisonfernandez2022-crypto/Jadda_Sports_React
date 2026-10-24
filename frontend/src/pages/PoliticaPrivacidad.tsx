function PoliticaPrivacidad() {
  return (
    <>
      <div className="container" style={{ paddingTop: "100px", paddingBottom: "60px" }}>
        <h1 className="text-center mb-1" style={{ color: "#002244", fontWeight: 800 }}>POLÍTICA DE PRIVACIDAD Y TRATAMIENTO DE DATOS</h1>
        <p className="text-center text-muted mb-1">Última actualización: 24 de octubre de 2026 • Ley 1581 de 2012 y Decreto 1377 de 2013 (Colombia) • JADDA SPORTS S.A.S.</p>
        <p className="text-center mb-4"><span className="badge rounded-pill" style={{ background: "#002244" }}>Responsable: JADDA SPORTS S.A.S., Bogotá D.C., contacto: privacidad@jaddasports.com</span></p>
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
                  <li><strong>Identificación y contacto:</strong> nombre, apellidos, tipo/número de documento, email, teléfono, usuario, foto de perfil (<code>foto_url</code>). Si inicias sesión con <strong>Google o Facebook</strong>, recibimos de esas plataformas tu nombre, correo y foto, y guardamos el proveedor (<code>AUTH_PROVIDER</code>); nunca vemos tu contraseña de la red social.</li>
                  <li><strong>Verificación y seguridad:</strong> el código de verificación de email (6 dígitos) y los códigos de recuperación se guardan <strong>solo como hash</strong> y expiran a los 15 minutos; registramos tu conexión más reciente (fecha, IP y ubicación aproximada) para mostrarla en <em>Perfil &gt; Seguridad</em>.</li>
                  <li><strong>Transaccionales:</strong> direcciones (<code>DIRECCIONES</code>), métodos de pago guardados (<code>USUARIOS_METODOS_PAGO</code>: titular/banco/teléfono; no se registra número completo de tarjeta), historial de compras (<code>VENTAS</code>/<code>DETALLE_VENTAS</code>), envíos y factura.</li>
                  <li><strong>Soporte y marketplace:</strong> mensajes de chat por producto (<code>CHAT</code>/<code>CHAT_MENSAJE</code>, censurados automáticamente), solicitudes de devolución con evidencias (<code>DEVOLUCIONES</code>/<code>DEVOLUCIONES_EVIDENCIAS</code>).</li>
                  <li><strong>Vendedores:</strong> solicitudes de “Ser vendedor” (<code>SOLICITUDES_VENDEDOR</code>: empresa, NIT, representante, contacto; los campos empresa/NIT son opcionales para vendedor informal).</li>
                  <li><strong>Técnicos:</strong> cookie de sesión (<code>connect.sid</code>, detallada en el punto 8), almacenamiento local técnico del navegador (historial de productos vistos y temporizadores de verificación) y, en la <strong>app móvil</strong>, la sesión guardada en el almacenamiento propio del teléfono.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>2. Para qué los usamos (finalidades)</h5>
                <ul className="text-muted">
                  <li>Crear tu cuenta, verificar email con código de 6 dígitos y recuperar contraseña.</li>
                  <li>Procesar pedidos, calcular envío por departamento, generar factura PDF y notificar cambios de estado (pedido en camino/entregado) por email y campana in-app.</li>
                  <li>Operar el <strong>chat por producto</strong> (`chat {"{producto}"} - {"{vendedor}"}`) y el <strong>chat de devolución</strong> (`chat devolucion {"{producto}"}`) con trazabilidad para escalamiento a JADDA.</li>
                  <li>Gestionar devoluciones/reembolsos (incluye chat y evidencias) y el rol de vendedor (aprobación de productos con `ESTADO_PUBLICACION`).</li>
                  <li>Personalizar recomendaciones, retos y planes, y enviar newsletter solo si te suscribes (`backend/data/newsletter.json`).</li>
                  <li>Cumplir obligaciones legales y de garantía.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>3. Base legal y tu autorización</h5>
                <p className="text-muted">Al registrarte aceptas esta política (checkbox). Para vendedores, al enviar el formulario de “Ser vendedor” autorizas la verificación de NIT/empresa. Puedes revocar tu autorización escribiendo a privacidad@jaddasports.com, sin efecto retroactivo sobre pedidos ya ejecutados.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>4. Con quién compartimos (y con quién no)</h5>
                <ul className="text-muted">
                  <li><strong>Cloudinary</strong> (alojamiento de imágenes y videos de productos, perfiles, retos y devoluciones). Se sirven como URLs de <code>res.cloudinary.com</code>; la transferencia internacional de datos es necesaria para prestar el servicio y se ampara en el consentimiento dado al subir la foto o evidencia.</li>
                  <li><strong>ip-api.com</strong>: geolocalización aproximada usada solo al iniciar sesión, para mostrarte la ciudad/región de tu <em>última conexión</em> en <em>Perfil &gt; Seguridad</em>. Recibe únicamente tu IP en ese momento. (Sus términos actuales limitan el uso comercial; su reemplazo o licenciamiento está en evaluación.)</li>
                  <li><strong>Google / Facebook</strong>: si te registras o inicias sesión con esa red, recibimos de la plataforma tu nombre, correo y foto; el resto del tratamiento ocurre en Jadda Sports conforme a esta política.</li>
                  <li><strong>Proveedor de correo (SMTP)</strong>: entrega los correos transaccionales (verificación de cuenta, facturas, estados de pedido, restablecimiento de contraseña). Solo recibe los datos estrictamente necesarios del envío.</li>
                  <li><strong>Solo cuando es necesario:</strong> transportadoras (dirección/teléfono), pasarelas de pago (datos de pago), autoridades si lo exige la ley.</li>
                  <li><strong>Marketplace:</strong> si compras a un vendedor aliado, compartimos con él tu nombre, email y dirección de entrega solo para ese pedido; el vendedor no ve tu chat con JADDA ni con otros vendedores.</li>
                  <li><strong>Nunca vendemos</strong> tu base de datos ni la cedemos para publicidad de terceros.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>5. Dónde y cuánto tiempo guardamos</h5>
                <ul className="text-muted">
                  <li>BD MySQL 8 en `jadda_sports_db` (35 tablas, `utf8mb4`), hosteada en el contenedor `jadda_mysql` (volumen `mysql_data`). Backups cifrados vía `scripts/backup.ps1` (mysqldump + zip de imágenes, rotación 7 días).</li>
                  <li>Conservamos pedidos/facturas por el tiempo legal; chats y evidencias de devolución mientras la solicitud esté activa + 1 año para trazabilidad; luego se anonimiza.</li>
                  <li>Imágenes y videos en <strong>Cloudinary</strong> (carpetas <code>jadda/productos</code>, <code>jadda/perfiles</code>, <code>jadda/retos</code>, <code>jadda/devoluciones</code>), servidos como URLs de <code>res.cloudinary.com</code>; existe copia local de respaldo en <code>frontend/public/images/...</code>. Se eliminan cuando tú los quitas o el administrador resuelve una solicitud.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>6. Cómo protegemos</h5>
                <ul className="text-muted">
                  <li>Contraseñas con `bcrypt` (nunca en texto plano), sesiones con `express-session` + `MySQLStore` y `httpOnly` cookies, `rateLimiter` en login/registro.</li>
                  <li>Consultas parametrizadas (`mysql2`) contra inyección SQL, validación de tipos y `MAX_MENSAJE 2000` + censura de groserías en chat.</li>
                  <li>Archivos validados por `multer` (25 MB máx por archivo, tipos `jpg/png/webp/gif/mp4/webm/mov`).</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>7. Tus derechos (consultar, corregir, eliminar, revocar, no ser spameado)</h5>
                <p className="text-muted">Escríbenos a <strong>privacidad@jaddasports.com</strong> con tu email registrado y te respondemos en máximo 15 días hábiles. Puedes:</p>
                <ul className="text-muted">
                  <li>Conocer qué tenemos de ti (exportamos tu JSON de `USUARIOS`+`DIRECCIONES`+`VENTAS`).</li>
                  <li>Corregir datos desde <em>Perfil &gt; Editar</em> (email requiere código al nuevo correo, teléfono requiere tu contraseña actual).</li>
                  <li>Pedir eliminación (anonimizamos pedidos ya facturados por obligación legal) o revocar newsletter con un clic.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>8. Cookies, sesión y almacenamiento local</h5>
                <ul className="text-muted">
                  <li><strong>Cookie esencial única — <code>connect.sid</code>:</strong> es la cookie de sesión de la plataforma (esencial, <code>httpOnly</code>, <code>SameSite=Lax</code> y además <code>secure</code> en producción con HTTPS), con vigencia máxima de 24 horas. Su contenido cifrado no viaja en la cookie: se guarda en la tabla <code>sessions</code> de la BD. Si la bloqueas, no podrás iniciar sesión ni comprar.</li>
                  <li><strong>El carrito NO usa cookies:</strong> vive en el servidor (tabla <code>CARRITO</code>) asociado a tu sesión/cuenta, por lo que se conserva entre dispositivos.</li>
                  <li><strong>No usamos cookies publicitarias, de analítica ni de terceros.</strong></li>
                  <li><strong>Almacenamiento local técnico del navegador</strong> (no son cookies): <code>historial</code> (últimos productos vistos para la sección “Recientemente vistos”), <code>token_expira_&lt;email&gt;</code> / <code>timer_expira_&lt;email&gt;</code> / <code>resendExpiry</code> (cuenta regresiva de los códigos de verificación) y <code>jadda_aviso_cookies</code> (recuerda que ya cerraste este aviso). Puedes borrarlas desde los ajustes de tu navegador sin perder tu cuenta.</li>
                  <li><strong>App móvil:</strong> la sesión se guarda en el almacenamiento propio del teléfono (AsyncStorage), no en cookies del navegador.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>9. Cambios</h5>
                <p className="text-muted">Publicaremos la nueva versión aquí con fecha. Si el cambio es sustancial (ej. nueva finalidad), te pediremos re-aceptar al iniciar sesión. Última versión siempre en <code>/politica-privacidad</code>.</p>

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
