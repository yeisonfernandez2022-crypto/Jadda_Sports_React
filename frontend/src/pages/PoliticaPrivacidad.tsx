function PoliticaPrivacidad() {
  return (
    <>
      <div className="container" style={{ paddingTop: "100px", paddingBottom: "60px" }}>
        <h1 className="text-center mb-1" style={{ color: "#002244", fontWeight: 800 }}>POLÍTICA DE PRIVACIDAD Y TRATAMIENTO DE DATOS</h1>
        <p className="text-center text-muted mb-1">Última actualización: 01 de septiembre de 2026 • Ley 1581 de 2012 y Decreto 1377 de 2013 (Colombia) • JADDA SPORTS S.A.S.</p>
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
                  <li><strong>Identificación y contacto:</strong> nombre, apellidos, tipo/número de documento, email, teléfono, usuario, foto de perfil (`foto_url`).</li>
                  <li><strong>Transaccionales:</strong> direcciones (`DIRECCIONES`), métodos de pago tokenizados (`USUARIOS_METODOS_PAGO` solo guarda titular/banco/teléfono, no el número completo), historial de compras (`VENTAS`/`DETALLE_VENTAS`), envíos y factura.</li>
                  <li><strong>Soporte y marketplace:</strong> mensajes de chat por producto (`CHAT`/`CHAT_MENSAJE` con `ID_PRODUCTO`, censurados), solicitudes de devolución con evidencias (`DEVOLUCIONES`/`DEVOLUCIONES_EVIDENCIAS`), solicitudes de vendedor (`SOLICITUDES_VENDEDOR` con NIT/empresa).</li>
                  <li><strong>Técnicos:</strong> `ULTIMA_CONEXION`, `ULTIMA_IP`, `ULTIMA_UBICACION` (para “Última conexión” en Perfil &gt; Seguridad), cookies de sesión (`sessions` con `express-mysql-session`), historial de navegación y favoritos.</li>
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
                  <li><strong>Solo cuando es necesario:</strong> transportadoras (dirección/teléfono), pasarelas de pago (datos de pago), autoridades si lo exige la ley.</li>
                  <li><strong>Marketplace:</strong> si compras a un vendedor aliado, compartimos con él tu nombre, email y dirección de entrega solo para ese pedido; el vendedor no ve tu chat con JADDA ni con otros vendedores.</li>
                  <li><strong>Nunca vendemos</strong> tu base de datos ni la cedemos para publicidad de terceros.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>5. Dónde y cuánto tiempo guardamos</h5>
                <ul className="text-muted">
                  <li>BD MySQL 8 en `jadda_sports_db` (35 tablas, `utf8mb4`), hosteada en el contenedor `jadda_mysql` (volumen `mysql_data`). Backups cifrados vía `scripts/backup.ps1` (mysqldump + zip de imágenes, rotación 7 días).</li>
                  <li>Conservamos pedidos/facturas por el tiempo legal; chats y evidencias de devolución mientras la solicitud esté activa + 1 año para trazabilidad; luego se anonimiza.</li>
                  <li>Imágenes de perfil/retos/devoluciones en `frontend/public/images/usuarios|retos|devoluciones` (bind-mount), servidas como `/images/...`.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>6. Cómo protegemos</h5>
                <ul className="text-muted">
                  <li>Contraseñas con `bcrypt` (nunca en texto plano), sesiones con `express-session` + `MySQLStore` y `httpOnly` cookies, `rateLimiter` en login/registro.</li>
                  <li>Consultas parametrizadas (`mysql2`) contra inyección SQL, validación de tipos y `MAX_MENSAJE 2000` + censura de groserías en chat.</li>
                  <li>Archivos validados por `multer` (100MB máx, tipos `jpg/png/webp/mp4/webm/mov`).</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>7. Tus derechos (consultar, corregir, eliminar, revocar, no ser spameado)</h5>
                <p className="text-muted">Escríbenos a <strong>privacidad@jaddasports.com</strong> con tu email registrado y te respondemos en máximo 15 días hábiles. Puedes:</p>
                <ul className="text-muted">
                  <li>Conocer qué tenemos de ti (exportamos tu JSON de `USUARIOS`+`DIRECCIONES`+`VENTAS`).</li>
                  <li>Corregir datos desde <em>Perfil &gt; Editar</em> (email requiere código al nuevo correo, teléfono requiere tu contraseña actual).</li>
                  <li>Pedir eliminación (anonimizamos pedidos ya facturados por obligación legal) o revocar newsletter con un clic.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>8. Cookies y sesión</h5>
                <p className="text-muted">Usamos cookies esenciales de sesión (`connect.sid`, 24h) y de carrito. No usamos cookies de terceros para publicidad. Puedes bloquearlas en tu navegador, pero no podrás comprar. Ver `sessions` en la BD.</p>

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
