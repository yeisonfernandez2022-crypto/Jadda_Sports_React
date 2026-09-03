function PoliticasDevolucion() {
  return (
    <>
      <div className="container" style={{ paddingTop: "100px", paddingBottom: "60px" }}>
        <h1 className="text-center mb-4" style={{ color: "#002244", fontWeight: 800, letterSpacing: 0.5 }}>POLÍTICA DE DEVOLUCIONES, CAMBIOS Y GARANTÍAS</h1>
        <p className="text-center text-muted mb-1">Última actualización: 01 de septiembre de 2026</p>
        <p className="text-center mb-4"><span className="badge rounded-pill" style={{ background: "#e73737", fontSize: "0.75rem", letterSpacing: 1 }}>JADDA SPORTS S.A.S. • NIT 900.123.456-7 • Colombia</span></p>
        <div className="row justify-content-center">
          <div className="col-lg-9">
            <div className="alert alert-light border d-flex gap-3 align-items-start" style={{ borderLeft: "4px solid #e73737", background: "#fff8f8" }}>
              <span style={{ fontSize: "1.4rem" }}>🛡️</span>
              <div>
                <strong style={{ color: "#0f172a" }}>Resumen en 30 segundos:</strong>
                <ul className="mb-0 mt-1 text-muted small" style={{ lineHeight: 1.6 }}>
                  <li><strong>3 días</strong> para pedir devolución/reembolso desde que el pedido marca <em>Entregado</em> (plazo legal + trazabilidad por chat).</li>
                  <li><strong>30 días</strong> para cambios por talla/estado si no se ha usado y conserva etiquetas.</li>
                  <li>Chat <strong>por producto</strong> (<code>chat {"{producto}"} - {"{vendedor}"}</code>) y, si no hay acuerdo, <strong>escalas a JADDA</strong> que decide con todas las evidencias.</li>
                </ul>
              </div>
            </div>

            <div className="card border-0 shadow-sm" style={{ borderRadius: "16px", overflow: "hidden" }}>
              <div className="card-body p-4 p-md-5">
                <p className="text-muted" style={{ fontSize: "0.95rem" }}>En <strong style={{ color: "#0f172a" }}>JADDA SPORTS</strong> operamos como marketplace: vendemos productos propios (<strong>JADDA SPORTS</strong>) y de <strong>vendedores aliados verificados</strong> (verificados con NIT, cámara de comercio y muestras). Esta política aplica para ambos, con la diferencia de quién resuelve primero.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>1. Ventana para pedir devolución o reembolso</h5>
                <div className="p-3 rounded" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <ul className="text-muted mb-0">
                    <li><strong>3 días calendario</strong> desde que el envío pasa a <code>ENTREGADO</code> para abrir la solicitud en <em>Mis compras &gt; Devolver</em>. Pasado ese plazo el botón se deshabilita y muestra “Plazo vencido”.</li>
                    <li>Para productos no entregados o con falla evidente al recibir, el plazo no aplica: abre la solicitud de inmediato.</li>
                    <li>Cada solicitud es por <strong>producto y cantidad</strong> (ej. 1 de 2 unidades). No puedes pedir más de lo comprado menos lo ya solicitado/aprobado.</li>
                  </ul>
                </div>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>2. Cambios por talla / estado (30 días)</h5>
                <p className="text-muted">Solicita cambio dentro de 30 días si:</p>
                <ul className="text-muted">
                  <li>No se ha usado, está limpio, con etiquetas y empaque original.</li>
                  <li>No es personalizado ni deteriorado por mal uso.</li>
                  <li>No es de promoción con condición “no cambios” informada en el checkout.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>3. Qué cubre la garantía y qué no</h5>
                <p className="text-muted">Todos los productos tienen garantía por <strong>defectos de fabricación</strong> según la ley colombiana (Ley 1480 de 2011). No cubre: uso inadecuado, desgaste normal, accidentes, intervenciones de terceros o no seguir las recomendaciones del fabricante.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>4. Cómo pedirla (flujo con chat y evidencias)</h5>
                <ol className="text-muted">
                  <li>Ve a <strong>Mis compras</strong> y elige <em>Devolver</em> / <em>Pedir reembolso</em> sobre el pedido <strong>COMPLETADO</strong>.</li>
                  <li>Elige producto(s), cantidad, tipo (<strong>DEVOLUCIÓN</strong> con retorno físico vs <strong>REEMBOLSO</strong> sin retorno) y motivo (500 caracteres) + descripción opcional (2000) y adjunta <strong>hasta 8 evidencias</strong> (foto/video, 100MB c/u).</li>
                  <li>Si el producto es de un <strong>vendedor aliado</strong>, se habilita el botón <strong>Abrir chat</strong> (<code>chat devolucion {"{producto}"} - {"{usuario}"}</code>). Allí negocian: el vendedor puede <em>Aceptar devolución</em> (reingresa stock), <em>Aceptar solo reembolso</em>, <em>Pedir más pruebas</em> o <em>Rechazar</em> con motivo obligatorio. Solo <em>Aceptar</em> cierra el chat.</li>
                  <li>Si es <strong>JADDA SPORTS</strong> (sin vendedor), la solicitud va directo al equipo JADDA (notificación en campana admin).</li>
                </ol>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>5. Si no hay acuerdo — Escalar a JADDA</h5>
                <div className="p-3 rounded" style={{ background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
                  <p className="text-muted mb-2">Cuando el vendedor rechaza o no hay acuerdo, cualquiera pulsa <strong>⚖️ Llevarlo con soporte de JADDA</strong>. Entonces:</p>
                  <ul className="text-muted mb-2">
                    <li>El hilo de acuerdo se cierra y se crean <strong>dos hilos separados ESCALADA</strong> (<code>CLIENTE↔JADDA</code> y <code>VENDEDOR↔JADDA</code>) para evitar confusión.</li>
                    <li>Al admin le llega una notificación + mensaje del sistema con <strong>todos los datos</strong> (pedido, producto, motivo, cliente/vendedor, vendedor) para decidir sin salir del chat.</li>
                    <li>El admin decide: <strong>Devolver</strong> (reingresa stock + movimiento), <strong>Reembolsar</strong> (solo dinero), <strong>Más pruebas</strong> (vuelve a SOLICITADA y el cliente adjunta más evidencias) o <strong>Rechazar</strong>. La decisión cierra todos los hilos.</li>
                  </ul>
                  <small className="text-muted">El admin <strong>no ve</strong> los chats privados <code>chat {"{producto}"} - {"{usuario}"}</code> entre cliente y vendedor; solo ve <code>SOPORTE</code> y los hilos <code>ESCALADA</code>.</small>
                </div>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>6. Reembolsos y tiempos</h5>
                <ul className="text-muted">
                  <li>Si se aprueba, el reembolso va al <strong>mismo medio de pago</strong> (Nequi, PSE, tarjeta, etc.) en máximo <strong>7 días hábiles</strong> (depende de la entidad).</li>
                  <li>En <strong>DEVOLUCIÓN</strong> el cliente debe retornar el producto según indicaciones del chat; en <strong>REEMBOLSO</strong> no es necesario retornarlo.</li>
                  <li>Notificación in-app + correo con botón “Ver mi solicitud” a <code>/perfil/devolucion/{"{idVenta}"}</code> (no a <code>/perfil/compras</code> genérico).</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>7. Derecho de retracto</h5>
                <p className="text-muted">Cuando la ley lo permita, puedes retractarte dentro del término legal si el producto vuelve en las mismas condiciones de entrega. Usa el mismo flujo de devolución y adjunta evidencia del estado.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>8. Contacto</h5>
                <p className="text-muted">¿Dudas? Usa el <strong>botón flotante de chat</strong> (abajo derecha, como el carrito) en el detalle del producto con <em>Enviar mensaje</em> para preguntar por talla, envío o disponibilidad antes de comprar, o abre un ticket de <strong>Soporte</strong> desde el mismo widget. Tiempo de respuesta &lt;24h.</p>

                <div className="mt-4 p-3 rounded text-center small text-muted" style={{ background: "#f8fafc", border: "1px dashed #e2e8f0" }}>
                  Al crear una devolución aceptas que JADDA registre la conversación y las evidencias para trazabilidad. Más detalles en <a href="/politica-privacidad">Privacidad</a> y <a href="/terminos-condiciones">Términos</a>.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default PoliticasDevolucion;
