import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import { volverAtras } from "../utils/volverAtras";

function TerminosCondiciones() {
  const navigate = useNavigate();
  // Los retos enlazan aquí con /terminos-condiciones#retos → baja a esa sección
  useEffect(() => {
    if (window.location.hash !== "#retos") return;
    const timer = window.setTimeout(() => {
      document.getElementById("retos")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <div className="container" style={{ paddingTop: "100px", paddingBottom: "60px" }}>
        <h1 className="text-center mb-1" style={{ color: "#002244", fontWeight: 800 }}>TÉRMINOS Y CONDICIONES DE USO</h1>
        <p className="text-center text-muted mb-1">Última actualización: 10 de noviembre de 2026 • JADDA SPORTS S.A.S.</p>
        <p className="text-center mb-4"><span className="badge rounded-pill" style={{ background: "#002244" }}>Marketplace deportivo • Web + App Móvil</span></p>
        <button onClick={() => volverAtras(navigate, "/")} className="btn p-0 text-dark fw-bold text-uppercase mb-3">
          <FaArrowLeft className="text-danger" /> Volver
        </button>
        <div className="row justify-content-center">
          <div className="col-lg-9">
            <div className="card border-0 shadow-sm" style={{ borderRadius: "16px", overflow: "hidden" }}>
              <div className="card-body p-4 p-md-5">
                <p className="text-muted">Bienvenido a <strong style={{ color: "#0f172a" }}>JADDA SPORTS</strong>. Al crear cuenta, comprar o chatear aceptas estos términos. Si no estás de acuerdo, no uses la plataforma.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>1. Qué es JADDA SPORTS</h5>
                <p className="text-muted">Somos un marketplace colombiano de artículos deportivos. Vendemos productos de forma directa como <strong>JADDA SPORTS</strong> y también somos intermediarios de <strong>vendedores aliados verificados</strong> (empresas y personas que verificamos antes de habilitarles la venta). En cada producto verás claramente quién lo vende: la marca <span className="badge" style={{ background: "#f1f5f9", color: "#0f172a", border: "1px solid #e2e8f0" }}>JADDA SPORTS</span> o el nombre del <span className="badge" style={{ background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" }}>vendedor aliado</span> con la información de su tienda.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>2. Cuenta y seguridad</h5>
                <ul className="text-muted">
                  <li>Para registrarte usamos tu correo electrónico con un código de verificación de 6 dígitos (válido por 15 minutos) o el ingreso con tu cuenta de Google.</li>
                  <li>Tu contraseña se guarda protegida y tus sesiones son seguras. Si hay demasiados intentos fallidos de inicio de sesión, la plataforma se protege y bloquea temporalmente el acceso.</li>
                  <li>Eres responsable de tu contraseña y de no compartir tu sesión. Desde <em>Perfil &gt; Seguridad</em> puedes ver tu última conexión (fecha, hora y ubicación aproximada) y cambiar tu contraseña en cualquier momento.</li>
                  <li>La foto de perfil y los datos de tu cuenta son visibles y editables solo por ti, desde la sección <em>Perfil</em>.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>3. Productos, precios e inventario</h5>
                <ul className="text-muted">
                  <li>Las fotos, descripciones y características de los productos son administradas por JADDA SPORTS y por cada vendedor aliado para sus artículos.</li>
                  <li>Los precios están en pesos colombianos (COP) e incluyen los impuestos aplicables, salvo que se indique lo contrario. Pueden cambiar sin aviso previo.</li>
                  <li><strong>El total de tu carrito siempre se recalcula en el servidor al momento de confirmar la compra.</strong> Los montos que ves en pantalla son de referencia hasta que el sistema valida inventario, cupones y tarifas definitivas.</li>
                  <li>Cada talla y color tiene su propio inventario. Las unidades se reservan al confirmar la compra y se descuentan al completar el pago; si cancelas un pedido antes de que salga del almacén, el inventario vuelve automáticamente a la tienda.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>4. Chat con la tienda y mensajes</h5>
                <p className="text-muted">En cada producto tienes dos formas de hablar con la tienda: un botón flotante de chat (abajo a la derecha, junto al carrito) y el botón <strong>Enviar mensaje</strong> que aparece junto al vendedor del producto. El chat lleva el nombre del producto y de la tienda que lo vende (por ejemplo, “Balón de fútbol — JADDA SPORTS").</p>
                <ul className="text-muted">
                  <li>Cada conversación es privada entre tú y la tienda. Los mensajes admiten hasta 2.000 caracteres.</li>
                  <li>El lenguaje ofensivo se filtra automáticamente para mantener una comunicación respetuosa.</li>
                  <li>Si inicias una devolución, el chat con la tienda se abre cuando tú lo solicitas desde tu solicitud.</li>
                  <li>Si tu devolución necesita que JADDA la decida, se abren conversaciones por separado entre tú y el equipo JADDA (el vendedor igualmente tiene su propio hilo) y recibirás una notificación en tu campanita.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>5. Pagos, envíos y factura</h5>
                <ul className="text-muted">
                  <li><strong>Métodos de pago:</strong> al pagar eliges el método dentro del checkout seguro (tarjetas de crédito y débito, Nequi, PSE, Bancolombia, QR y más). Puedes guardar tus métodos en tu perfil para volver a usarlos sin digitarlos otra vez.</li>
                  <li><strong>Envío:</strong> el costo se calcula según tu departamento y es <strong>gratis en compras desde $800.000</strong>. La dirección del pedido se guarda con tu compra y puedes actualizarla hasta que el pedido salga de la bodega.</li>
                  <li><strong>Factura:</strong> cada compra genera una factura PDF con el detalle de tus productos, que puedes descargar desde tu perfil y llega adjunta al correo de confirmación.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>6. Devoluciones, reembolsos y garantías (resumen)</h5>
                <p className="text-muted">Tienes la política completa en <a href="/politicas-devolucion">Política de Devoluciones</a>. En resumen: luego de recibir tu pedido tienes <strong>3 días calendario</strong> para pedir <strong>reembolso</strong> (solo si el producto llegó dañado, defectuoso o no coincide con la descripción) o <strong>devolución</strong> (por cambio de opinión, talla u otro motivo). El envío no se reembolsa en estos casos. En cambio, si <strong>cancelas tu pedido pagado antes de que sea despachado</strong>, el reembolso incluye los productos y el costo de envío. Cada estado se te avisa en tu campanita y por correo.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>7. Roles de la plataforma</h5>
                <ul className="text-muted">
                  <li><strong>Usuario comprador:</strong> puedes explorar la tienda, chatear por producto, comprar, hacer devoluciones o reembolsos y participar de los retos.</li>
                  <li><strong>Vendedor aliado:</strong> publica sus productos, que pasan por la revisión de JADDA antes de publicarse, y gestiona sus propias ventas y conversaciones con sus compradores. Cada vendedor solo ve sus ventas y sus chats.</li>
                  <li><strong>Equipo JADDA (administración):</strong> aprueba productos de vendedores, atiende los soportes generales y las decisiones escaladas de devoluciones con todo el contexto. No revisa los chats personales entre un cliente y un vendedor aliado: esa conversación es privada de ellos.</li>
                </ul>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>8. Propiedad intelectual y uso</h5>
                <p className="text-muted">Imágenes, logo JADDA y textos son de JADDA o de sus vendedores con autorización. No los reproduzcas sin permiso. No intentes vulnerar la plataforma (inyección, spam). El incumplimiento lleva a bloqueo y reporte.</p>

                <h5 className="fw-bold mt-4" style={{ color: "#e73737" }}>9. Cambios y ley</h5>
                <p className="text-muted">Podemos actualizar estos términos; se publican aquí con fecha. Se rigen por la ley colombiana (Estatuto del Consumidor, Ley 1480, y Habeas Data).</p>

                <h5 className="fw-bold mt-4" id="retos" style={{ color: "#e73737", scrollMarginTop: "90px" }}>10. Retos deportivos y cupones (RETO-)</h5>
                <p className="text-muted" style={{ fontSize: "0.92rem" }}>
                  <strong>Al aceptar un reto (unirte a él), aceptas automáticamente la totalidad de estos términos.</strong>
                </p>
                <ul className="text-muted">
                  <li><strong>Inscripción:</strong> gratis, 1 vez por reto activo; puedes inscribirte a todos los que quieras. La meta se mide por el tipo del reto (kilómetros, calorías, minutos, series...).</li>
                  <li><strong>Evidencias de avance:</strong> capturas de tu app de fitness o pulsera, o fotos y videos cortos (hasta 25 MB por archivo, máx. 5 por avance). Un avance con material queda <code>En revisión</code> y el equipo JADDA lo califica en un máximo de 24 horas; sin material suma directo. Si es rechazado verás el motivo y tu material se conserva, con opción de eliminarlo o reenviarlo.</li>
                  <li><strong>Recompensa:</strong> al completar la meta se genera un cupón exclusivo de retos con <strong>un solo uso</strong>, vigencia de <strong>30 días</strong> y descuento del <strong>3% al 10%</strong> según la meta, con una compra mínima entre $50.000 y $200.000 que depende del porcentaje (por ejemplo, 7–9% pide mínimo $150.000 y un 10% pide $200.000). Se consume en el checkout al aplicar el descuento. <strong>Es personal e intransferible: solo la cuenta que completó el reto puede validarlo o usarlo; al intentar usarlo desde otra cuenta el cupón será rechazado.</strong></li>
                  <li><strong>Fraude:</strong> evidencias imaginarias, editadas o que no correspondan al progreso reportado permiten cancelar el avance o la recompensa, y repetirlo puede suspender la participación en retos.</li>
                </ul>

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
