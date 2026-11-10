import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaChevronDown } from "react-icons/fa";
import { volverAtras } from "../utils/volverAtras";

function PreguntasFrecuentes() {
  const navigate = useNavigate();
  const [abiertas, setAbiertas] = useState<Record<number, boolean>>({});
  const alternar = (i: number) => setAbiertas((prev) => ({ ...prev, [i]: !prev[i] }));

  const faqs = [
    { p: "¿Cuánto tardan los envíos?", r: "Los envíos nacionales tardan entre 3 y 7 días hábiles dependiendo de la ubicación. Bogotá y principales ciudades: 2-3 días hábiles." },
    { p: "¿Cuál es el costo del envío?", r: "El envío es GRATIS en compras desde $800.000 COP. Para pedidos menores, el costo se calcula automáticamente según tu departamento en el checkout (por ejemplo, Bogotá $8.000; Medellín y Cali $9.000). El valor exacto se muestra antes de confirmar el pago." },
    { p: "¿Cómo puedo hacer un cambio o devolución?", r: "Tienes 3 días calendario desde que tu pedido se marca como Entregado para solicitarlo desde Mis compras. El reembolso sin devolver el producto aplica solo si llegó defectuoso o no coincide con la descripción; la devolución es para cambio de opinión o talla y el producto debe estar sin uso, con etiquetas y empaque original. En devoluciones posteriores a la entrega el costo de envío no se reembolsa; si cancelas un pedido pagado antes del despacho, se reembolsan los productos y el envío automáticamente." },
    { p: "¿Qué métodos de pago hay?", r: "Al pagar eliges el método dentro de un checkout seguro: tarjetas de crédito y débito (Visa, Mastercard, American Express), Nequi, PSE (todos los bancos), Bancolombia (transferencia y pagos en punto físico) y QR interoperable. También puedes guardar tus métodos en tu perfil para volver a usarlos sin digitarlos de nuevo." },
    { p: "¿Cómo me registro o inicio sesión?", r: "Puedes crear tu cuenta con tu correo (te enviamos un código de verificación de 6 dígitos, válido 15 minutos) o entrar con tu cuenta de Google. Después, tu usuario te da acceso a la tienda desde el computador o la app móvil." },
    { p: "¿Puedo cambiar mi correo, contraseña o datos?", r: "Sí. En Perfil > Editar cambias tu nombre, usuario y teléfono (el teléfono pide tu contraseña actual). Cambiar el correo exige confirmar con un código que te enviamos al correo nuevo. La contraseña se cambia desde Perfil > Seguridad; también verás ahí tu última conexión para detectar accesos ajenos." },
    { p: "¿Puedo poner o cambiar mi foto de perfil?", r: "Sí, desde tu Perfil: eliges la foto y la recortas y haces zoom a tu gusto antes de guardar. Se ve en el menú de la barra superior y en tus comentarios." },
    { p: "¿Puedo guardar varias direcciones de entrega?", r: "Sí, en Perfil > Mis direcciones agregas todas las que quieras (casa, trabajo, etc.), cada una con etiqueta y teléfono de contacto. La primera que guardas queda como principal y en el checkout eliges cuál usar en cada compra." },
    { p: "¿Puedo guardar mis métodos de pago?", r: "Sí: al pagar marcas la opción de guardar el método (tarjeta, etc.) y queda en tu Perfil > Métodos de pago. En tu próxima compra los verás como botones listos para elegir, sin digitar nada de nuevo." },
    { p: "¿Mi carrito se guarda si cambio de dispositivo?", r: "Sí. Tu carrito, direcciones, métodos de pago guardados y favoritos quedan asociados a tu cuenta en nuestro servidor: los ves igual desde el computador o desde la app móvil." },
    { p: "¿Puedo cambiar la dirección de un pedido que ya compré?", r: "Sí, mientras el pedido no haya salido de la bodega: en el detalle de la compra puedes editar la dirección y teléfono de entrega. Cuando el pedido está en camino, la ventana se bloquea para evitar extravíos." },
    { p: "¿Cómo sigo lo que pasa con mi pedido?", r: "En Mis compras ves el estado de cada pedido y su línea de tiempo: Pendiente → Por empaquetar → Empacado → En camino → Entregado (o Cancelado). Cada cambio te llega a la campanita de notificaciones y a tu correo. Al entregarte, tienes la opción de pedir reembolso o devolución." },
    { p: "¿Qué pasa si empiezo el pago y no lo termino?", r: "El pedido queda reservado por 10 minutos: si el pago no se completa en ese tiempo se cancela automáticamente y el inventario vuelve a la tienda. Si te arrepientes fuera de ese tiempo, puedes volver a comprar; si aún está pendiente, en Mis compras verás el botón para reintentar el pago." },
    { p: "¿Puedo recibir aviso si mi talla se reabastece?", r: "Sí: si la talla o color que quieres está agotada, en la página del producto aparece el botón “Avísame cuando vuelva a estar disponible”. Suscríbete y te notificamos en cuanto reingrese stock." },
    { p: "¿Puedo dejar una opinión sobre un producto?", r: "Sí, y solo sobre productos que hayas comprado: puedes dejar tu calificación de 1 a 5 estrellas con tu comentario desde la sección de Opiniones de la página del producto o justo después de confirmar tu compra." },
    { p: "¿Qué son los favoritos?", r: "En cada producto/carta verás el corazón: tócalo para guardar lo que te gustó y encontrarlo rápido en tu sección Favoritos (web: menú de tu cuenta). Puedes agregarlo al carrito o quitarlo cuando quieras." },
    { p: "¿Hay descuentos y cupones?", r: "Sí: algunos productos traen su precio de oferta marcado con etiqueta de descuento. Además puedes aplicar cupones de tienda publicados en el checkout, y si participas en retos ganas tu cupón personal exclusivo. Todo se valida en el momento del pago para que el total final sea correcto." },
    { p: "¿Cómo funcionan los retos deportivos?", r: "Elige un reto y únete gratis (puedes tener hasta 3 retos activos). Reporta tu avance subiendo capturas de tu app de fitness, reloj, fotos o videos cortos (hasta 25 MB por archivo): el equipo JADDA lo revisa en máximo 24 horas. Al completar la meta ganas un cupón personal de 3% a 10% de descuento (vigente 30 días, un solo uso y con compra mínima según el porcentaje). El cupón es personal e intransferible: solo tu cuenta puede usarlo." },
    { p: "¿Qué es el plan de entrenamiento?", r: "Al comprar cualquier producto te regalamos un plan de entrenamiento personalizado. Lo encuentras en Perfil > Mis planes, con rutinas por día que puedes marcar a medida que completas; tu progreso se guarda siempre." },
    { p: "¿Cómo hablo con la tienda antes de comprar?", r: "En el detalle de cada producto hay un botón para escribir al vendedor (o a JADDA SPORTS si el producto es nuestro). También puedes usar el chat flotante para soporte. Los mensajes pueden tener hasta 2.000 caracteres; el lenguaje ofensivo se filtra automáticamente." },
    { p: "¿Cómo me vuelvo vendedor en JADDA?", r: "Desde el menú > 'Ser vendedor' envías tu solicitud: nombre de la empresa, NIT y contacto. Si vendes de forma informal, puedes dejar empresa y NIT vacíos. El equipo JADDA revisa tu información en un máximo de 48 horas: si se aprueba, recibes tus credenciales por correo y activarás tu propia tienda dentro del marketplace (tus productos pasan por revisión antes de publicarse)." },
    { p: "¿Puedo recibir novedades y ofertas en mi correo?", r: "Sí: en el pie de la página está el espacio 'Novedades y ofertas en tu correo' — ingresa tu email y pulsa SUSCRIBIRME. Si prefieres no recibirlas, cada correo trae el enlace para darte de baja y también puedes hacerlo desde tu Perfil." },
    { p: "¿Puedo hacer envíos internacionales?", r: "Por ahora solo enviamos dentro de Colombia. Estamos trabajando para expandirnos a otros países pronto." },
  ];

  return (
    <>
      <div className="container" style={{ paddingTop: "100px", paddingBottom: "60px" }}>
        <h1 className="text-center mb-4" style={{ color: "#002244" }}>PREGUNTAS FRECUENTES</h1>
        <button onClick={() => volverAtras(navigate, "/")} className="btn p-0 text-dark fw-bold text-uppercase mb-3">
          <FaArrowLeft className="text-danger" /> Volver
        </button>
        <div className="row justify-content-center">
          <div className="col-md-8">
            {faqs.map((faq, i) => (
              <div key={i} className="card border-0 shadow-sm mb-3" style={{ borderRadius: "12px", overflow: "hidden" }}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={!!abiertas[i]}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") (e.currentTarget as HTMLElement).click(); }}
                  className="p-4 d-flex justify-content-between align-items-start gap-3 bg-white"
                  style={{ cursor: "pointer", userSelect: "none" }}
                  onClick={() => alternar(i)}
                >
                  <h5 className={`fw-bold mb-0 ${abiertas[i] ? "" : "text-truncate"}`} style={{ color: "#0f172a" }}>{faq.p}</h5>
                  <FaChevronDown
                    className="flex-shrink-0 mt-1 text-muted"
                    style={{ transition: "transform 0.2s ease", transform: abiertas[i] ? "rotate(180deg)" : "none" }}
                  />
                </div>
                {abiertas[i] && (
                  <div className="px-4 pb-4">
                    <div style={{ borderTop: "1px solid #f1f3f5" }} className="pt-3">
                      <p className="mb-0 text-muted" style={{ lineHeight: 1.7 }}>{faq.r}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default PreguntasFrecuentes;
