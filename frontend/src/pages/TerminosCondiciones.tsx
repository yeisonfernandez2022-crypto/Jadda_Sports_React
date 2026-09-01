function TerminosCondiciones() {
  return (
    <>
      <div className="container" style={{ paddingTop: "100px", paddingBottom: "60px" }}>
        <h1 className="text-center mb-1" style={{ color: "#002244", fontWeight: 800 }}>TÉRMINOS Y CONDICIONES DE USO</h1>
        <p className="text-center text-muted mb-1">Última actualización: 01 de septiembre de 2026 • JADDA SPORTS S.A.S.</p>
        <p className="text-center mb-4"><span className="badge rounded-pill" style={{ background: "#002244" }}>Marketplace deportivo • Web + App Móvil</span></p>
        <div className="row justify-content-center">
          <div className="col-lg-9">
            <div className="card border-0 shadow-sm" style={{ borderRadius: "16px", overflow: "hidden" }}>
              <div className="card-body p-4 p-md-5">
                <p className="text-muted">Bienvenido a <strong style={{ color: "#0f172a" }}>JADDA SPORTS</strong>. Al crear cuenta, comprar o chatear aceptas estos términos. Si no estás de acuerdo, no uses la plataforma.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>1. Qué es JADDA</h5>
                <p className="text-muted">Marketplace colombiano de artículos deportivos: vendemos como <strong>JADDA SPORTS</strong> y como intermediarios de <strong>vendedores aliados verificados</strong> (NIT, empresa, muestras). Cada producto indica claramente si es <span className="badge" style={{ background: "#f1f5f9", color: "#0f172a", border: "1px solid #e2e8f0" }}>JADDA SPORTS</span> o <span className="badge" style={{ background: "#f5f3ff", color: "#7c3aed" }}>Vendedor: {"{empresa}"}</span> con su ficha. Web en <code>React 19 + Vite</code> y app en <code>React Native Expo 54</code> comparten la misma API <code>Express 5</code> y BD MySQL 8 (35 tablas).</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>2. Cuenta y seguridad</h5>
                <ul className="text-muted">
                  <li>Registro con email + código de 6 dígitos (15 min) o login social (Google/Facebook). Contraseña con <code>bcrypt</code>, sesión con <code>express-session</code> en MySQL (24h) y <code>rateLimiter</code> (10 intentos/15 min).</li>
                  <li>Eres responsable de tu contraseña y de no compartir tu sesión. Usa <em>Perfil &gt; Seguridad</em> para ver tu última conexión (IP/ubicación) y cambiarla.</li>
                  <li>Foto de perfil y datos se guardan en <code>USUARIOS</code> (<code>foto_url</code> en <code>/images/usuarios/{"{tu_usuario}"}/perfil/</code>).</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>3. Productos, precio y stock</h5>
                <ul className="text-muted">
                  <li>Fotos, descripciones y características vienen de <code>contenidos-producto.js</code> (104 productos con ficha curada) y del vendedor si es marketplace (`ID_VENDEDOR` + `ESTADO_PUBLICACION: PENDIENTE/APROBADO`).</li>
                  <li>Precios en COP, incluyen IVA salvo que se indique; pueden cambiar sin aviso, pero tu carrito se recalcula 100% en servidor en <code>POST /checkout/procesar</code> (ignora el total del cliente, valida cupón y stock por variante).</li>
                  <li>Stock es por variante (`PRODUCTO_VARIANTES.STOCK`) y se descuenta solo al pagar; si cancelas antes de <code>EN_CAMINO</code> se reingresa.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>4. Chat por producto y censurado</h5>
                <p className="text-muted">Botón flotante (abajo derecha, como el carrito) + botón <strong>Enviar mensaje</strong> bajo el vendedor en el detalle. Cada producto abre <code>chat {"{producto}"} - {"{vendedor|JADDA}"}</code> (JADDA si <code>ID_VENDEDOR IS NULL</code> lo atiende el admin). En devolución, <code>chat devolucion {"{producto}"} - {"{usuario}"}</code> solo se crea al pulsar <strong>Abrir chat</strong> (evita vacíos) y, si escalas, se crean dos hilos separados con JADDA. Mensajes máx 2000, censurados insensibles a tildes (<code>cabrón</code>→<code>******</code>, <code>reputación</code> intacto) y notificados solo si es mensaje de devolución escalada (los chats normales no generan campana).</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>5. Pagos, envíos y factura</h5>
                <ul className="text-muted">
                  <li>Pagos: PSE, Nequi, Daviplata, Bancolombia, tarjetas, etc. (`METODOS_PAGO` 15 opciones, guardables en <code>USUARIOS_METODOS_PAGO</code>).</li>
                  <li>Envío: se calcula por departamento en el checkout (<code>utils/envio.js</code>, gratis ≥ $800.000). Dirección se guarda en <code>ENVIOS</code> y es editable hasta que sale de bodega.</li>
                  <li>Factura: PDF con `pdfkit` (logo, tabla de productos, totales) descargable y adjunta al correo de confirmación.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>6. Devoluciones y garantías (resumen)</h5>
                <p className="text-muted">Ver <a href="/politicas-devolucion">Política de Devoluciones</a> completa: 3 días para pedir desde <code>ENTREGADO</code>, 30 días para cambios, chat a demanda y escalado con mensaje del sistema que lleva todos los datos al admin.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>7. Roles</h5>
                <ul className="text-muted">
                  <li><strong>Usuario</strong> (rol 4): compra, chatea por producto, pide devolución, valora retos.</li>
                  <li><strong>Vendedor</strong> (rol 6): publica productos (quedan <code>PENDIENTE</code> hasta que JADDA los aprueba), ve solo sus ventas y sus chats (cada uno sus chats aparte, no ve los de otros).</li>
                  <li><strong>Admin</strong> (rol 1): ve todo excepto chats privados <code>chat {"{producto}"} - {"{usuario}"}</code> entre cliente y vendedor; solo ve <code>SOPORTE</code> y <code>ESCALADA</code> con el resumen para decidir. No tiene “Mi perfil” en la tienda.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>8. Propiedad intelectual y uso</h5>
                <p className="text-muted">Imágenes, logo JADDA y textos son de JADDA o de sus vendedores con autorización. No los reproduzcas sin permiso. No intentes vulnerar la plataforma (inyección, spam). El incumplimiento lleva a bloqueo y reporte.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>9. Cambios y ley</h5>
                <p className="text-muted">Podemos actualizar estos términos; se publican aquí con fecha. Se rigen por la ley colombiana (Estatuto del Consumidor, Ley 1480, y Habeas Data).</p>

                <div className="mt-4 p-3 rounded text-center small text-muted" style={{ background: "#f8fafc", border: "1px dashed #e2e8f0" }}>
                  ¿Dudas? Usa el chat flotante del producto o <a href="/contacto">Contacto</a>. También ver <a href="/politica-privacidad">Privacidad</a>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default TerminosCondiciones;
