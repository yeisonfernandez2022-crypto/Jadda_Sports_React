const db = require('../config/db');
const transporter = require('../config/mailer');
const { generarFacturaPdf } = require('../utils/facturaPdf');
const { plantillaCorreo } = require('../utils/correo');
const { registrarMovimientoStock } = require('../utils/movimientosStock');
const { numeroPedido } = require('../utils/numeroPedido');
const { crearNotificacion } = require('./notificacionController');
const pagos = require('../utils/pagos');

/**
 * Pasarela de pagos (Fase 6) — Wompi:
 * POST /api/pagos/pagar            → crea sesión/redirige al checkout Wompi
 * GET  /api/pagos/estado/:idVenta  → pull: consulta la transacción en Wompi y
 *                                    confirma (o cancela) la venta PENDIENTE_PAGO
 * POST /api/pagos/simular          → SOLO sandbox (llave pub_test_): registra
 *                                    bajo SIMW- una "cobro con tarjeta" hecho
 *                                    en la app — el pull lo confirma/cancela
 *                                    según los datos (cualquier Tarjeta aprueba,
 *                                    terminada en 1111 se rechaza)
 * POST /api/pagos/webhook          → evento firmado transaction.updated
 * GET  /api/pagos/config           → indica al frontend si la pasarela está activa
 * Job: cada 1 min cancela ventas PENDIENTE_PAGO vencidas (ventana de pago,
 *      10 min por defecto — PAGOS_EXPIRA_MINUTOS —, se reinicia cada vez que
 *      el cliente abre una sesión de pago nueva).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const METODO_WOMPI = {
  CARD: 2,
  PSE: 7,
  NEQUI: 4,
  DAVIPLATA: 5,
  BANCOLOMBIA: 6,
};

const MEDIO_ES = {
  CARD: 'Tarjeta',
  PSE: 'PSE',
  NEQUI: 'Nequi',
  DAVIPLATA: 'Daviplata',
  BANCOLOMBIA: 'Bancolombia',
  OTHER: '',
};

/** GET /api/pagos/config — sin secretos: solo indica si la pasarela está activa
 *  y si sus llaves son de sandbox (pub_test_): en ese ambiente el frontend
 *  pide TODAS las tarjetas y /simular se las aprueba/rechaza (no abre Wompi). */
async function configPagos(_req, res) {
  const activo = pagos.gatewayActivo();
  res.json({
    ok: true,
    gateway: activo ? 'wompi' : null,
    pruebas: activo && pagos.esAmbientePruebas(),
  });
}

/**
 * POST /api/pagos/pagar { idVenta }
 * Crea una nueva referencia (firma única por pago) y devuelve la URL de
 * checkout. La venta sigue PENDIENTE_PAGO hasta que la pasarela confirme.
 */
async function crearSesionPago(req, res) {
  if (!pagos.gatewayActivo()) {
    return res.status(400).json({ ok: false, message: 'La pasarela de pagos no está configurada' });
  }
  const idVenta = Number(req.body?.idVenta);
  if (!Number.isInteger(idVenta) || idVenta <= 0) {
    return res.status(400).json({ ok: false, message: 'idVenta inválido' });
  }
  const [filas] = await db.query(
    `SELECT v.*, u.EMAIL, u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.telefono
       FROM VENTAS v
       JOIN USUARIOS u ON u.ID_USUARIO = v.ID_CLIENTE
      WHERE v.ID_VENTA = ?`,
    [idVenta]
  );
  const venta = filas[0];
  if (!venta || venta.ID_CLIENTE !== req.user.ID_USUARIO) {
    return res.status(404).json({ ok: false, message: 'Pedido no encontrado' });
  }
  if (venta.ESTADO === 'CONFIRMADA') {
    return res.status(400).json({ ok: false, message: 'Este pedido ya está pagado' });
  }
  if (venta.ESTADO === 'CANCELADA') {
    return res.status(400).json({ ok: false, message: 'Este pedido fue cancelado' });
  }
  if (venta.ESTADO !== 'PENDIENTE_PAGO') {
    return res.status(400).json({ ok: false, message: `Este pedido está en estado ${venta.ESTADO}` });
  }

  // Referencia única por intento dePago: toda sesión nueva produce una firma nueva.
  // Se reinicia TAMBIÉN la ventana de expiración: pagar a los 8 min desde
  // "Mis compras" no debe chocar con el vencimiento a los 10 min de la venta.
  const referencia = `JADDA-${idVenta}-${Date.now().toString(36)}`;
  const [actualizados] = await db.query(
    `UPDATE VENTAS SET REFERENCIA_PAGO = ?, FECHA_EXPIRA_PAGO = DATE_ADD(NOW(), INTERVAL ? MINUTE)
      WHERE ID_VENTA = ? AND ESTADO = 'PENDIENTE_PAGO' AND ID_CLIENTE = ?`,
    [referencia, pagos.MINUTOS_EXPIRACION, idVenta, req.user.ID_USUARIO]
  );
  if (actualizados.affectedRows !== 1) {
    return res.status(409).json({ ok: false, message: 'El pedido ya no está pendiente de pago' });
  }

  const correo = EMAIL_RE.test(String(venta.EMAIL || '')) ? String(venta.EMAIL) : `pago${idVenta}@ejemplo.com`;
  const centavos = Math.round(Number(venta.TOTAL) * 100);
  const frontend = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');

  // Datos del pagador para el prefill del widget: método guardado del usuario
  // (si coincide con el de la venta) y dirección del envío.
  const [metodos] = await db.query(
    `SELECT TITULAR, TELEFONO FROM USUARIOS_METODOS_PAGO
      WHERE ID_USUARIO = ? AND ID_METODO = ?
      ORDER BY ES_PRINCIPAL DESC, ID DESC LIMIT 1`,
    [venta.ID_CLIENTE, venta.ID_METODO || null]
  );
  const [envio] = await db.query(
    `SELECT DIRECCION_ENVIO, BARRIO, CIUDAD, DEPARTAMENTO, CODIGO_POSTAL, TELEFONO_CONTACTO
       FROM ENVIOS WHERE ID_VENTA = ? LIMIT 1`,
    [idVenta]
  );
  const metodoGuardado = metodos[0];
  const filaEnvio = envio[0] || null;
  const nombrePerfil = `${venta.NOMBRE_USUARIO || ''} ${venta.APELLIDO_USUARIO || ''}`.trim();
  const telefonoPerfil = String(venta.telefono || '');

  try {
    const urlCheckout = pagos.urlCheckoutWompi({
      referencia,
      centavos,
      moneda: 'COP',
      correo,
      redirectUrl: `${frontend}/compra-exitosa/${idVenta}`,
      nombrePagador: String(metodoGuardado?.TITULAR || nombrePerfil || ''),
      telefonoPagador: String(metodoGuardado?.TELEFONO || telefonoPerfil || filaEnvio?.TELEFONO_CONTACTO || ''),
      direccionEnvio: filaEnvio
        ? {
            linea1: String(filaEnvio.DIRECCION_ENVIO || ''),
            linea2: String(filaEnvio.BARRIO || ''),
            ciudad: String(filaEnvio.CIUDAD || ''),
            region: String(filaEnvio.DEPARTAMENTO || ''),
            postal: String(filaEnvio.CODIGO_POSTAL || ''),
            telefono: String(filaEnvio.TELEFONO_CONTACTO || ''),
          }
        : null,
    });
    res.json({ ok: true, idVenta, referencia, urlCheckout });
  } catch (e) {
    console.error('Error creando sesión de pago Wompi:', e.message);
    res.status(500).json({
      ok: false,
      message: 'No se pudo iniciar el pago con la pasarela. Verifica la configuración del servidor',
    });
  }
}

/** Transacción sintética para ventas simuladas (el pull y confirmarPagoWompi
 *  la usan como si viniera de Wompi: mismo contrato de campos). */
function transaccionSimulada(venta, estado, fecha) {
  return {
    id: `sim-${venta.REFERENCIA_PAGO.toLowerCase().replace(/[^a-z0-9-]/g, '')}`,
    reference: venta.REFERENCIA_PAGO,
    amount_in_cents: Math.round(Number(venta.TOTAL) * 100),
    currency: 'COP',
    status: estado,
    payment_method: { type: 'CARD' },
    created_at: (fecha || new Date()).toISOString(),
  };
}

/**
 * POST /api/pagos/simular { idVenta, numero, titular, vencimiento }
 * SOLO llaves pub_test_ (sandbox). Registra el "cobro a tarjeta" hecho en la
 * app por el método Wompi cuando el usuario no quiere (o no puede) salir a
 * la pasarela real: la referencia queda SIMW-<id>-<momento><rand> (el pull
 * reconoce el prefijo y decide según los datos) y DATOS_PAGO guarda
 * brand/last4/titular/vencimiento — NUNCA el número completo ni el CVV.
 * Determinista: cualquier Tarjeta aprueba, la terminada en 1111 se rechaza.
 */
async function simularPago(req, res) {
  if (!pagos.gatewayActivo() || !pagos.esAmbientePruebas()) {
    return res.status(400).json({
      ok: false,
      message: 'La simulación de pagos solo está disponible con llaves de pruebas (sandbox)',
    });
  }
  const idVenta = Number(req.body?.idVenta);
  if (!Number.isInteger(idVenta) || idVenta <= 0) {
    return res.status(400).json({ ok: false, message: 'idVenta inválido' });
  }
  const numero = String(req.body?.numero || '').replace(/\D/g, '');
  const titular = String(req.body?.titular || '').trim().slice(0, 100);
  const vencimiento = String(req.body?.vencimiento || '').trim().slice(0, 7);
  if (numero.length < 13 || numero.length > 19) {
    return res.status(400).json({ ok: false, message: 'El número de tarjeta debe tener entre 13 y 19 dígitos' });
  }
  if (!titular) {
    return res.status(400).json({ ok: false, message: 'El titular de la tarjeta es obligatorio' });
  }
  if (!pagos.vencimientoValido(vencimiento)) {
    return res.status(400).json({ ok: false, message: 'La fecha de vencimiento de la tarjeta no es válida (usa MM/AA futura)' });
  }

  // El guard de estado/dueño está en el UPDATE condicional (idempotente con
  // el de crearSesionPago: re-simular una PENDIENTE_PAGO reinicia la espera).
  const resultado = pagos.resultadoSimulacion(numero);
  const referencia = pagos.nuevaReferenciaSimulada(idVenta);
  const [actualizados] = await db.query(
    `UPDATE VENTAS SET REFERENCIA_PAGO = ?, FECHA_EXPIRA_PAGO = DATE_ADD(NOW(), INTERVAL ? MINUTE), DATOS_PAGO = ?
      WHERE ID_VENTA = ? AND ESTADO = 'PENDIENTE_PAGO' AND ID_CLIENTE = ?`,
    [referencia, pagos.MINUTOS_EXPIRACION,
      JSON.stringify({
        simulacion: true,
        brand: pagos.marcaTarjeta(numero),
        last4: numero.slice(-4),
        titular,
        vencimiento,
        resultado,
      }),
      idVenta, req.user.ID_USUARIO]
  );
  if (actualizados.affectedRows !== 1) {
    return res.status(409).json({ ok: false, message: 'El pedido ya no está pendiente de pago' });
  }
  res.json({
    ok: true,
    idVenta,
    referencia,
    simulado: true,
    resultado,
    esperaSegundos: pagos.SEGUNDOS_SIMULACION,
  });
}

/** GET /api/pagos/estado/:idVenta — pull del estado procesal del pago. */
async function estadoVenta(req, res) {
  const idVenta = Number(req.params.idVenta);
  if (!Number.isInteger(idVenta) || idVenta <= 0) {
    return res.status(400).json({ ok: false, message: 'idVenta inválido' });
  }
  const [filas] = await db.query(
    `SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO, FECHA_VENTA, FECHA_EXPIRA_PAGO, DATOS_PAGO FROM VENTAS WHERE ID_VENTA = ?`,
    [idVenta]
  );
  const venta = filas[0];
  if (!venta || venta.ID_CLIENTE !== req.user.ID_USUARIO) {
    return res.status(404).json({ ok: false, message: 'Pedido no encontrado' });
  }
  if (venta.ESTADO !== 'PENDIENTE_PAGO') {
    return res.json({ ok: true, estado: venta.ESTADO, transaccion: null });
  }
  if (!pagos.gatewayActivo()) {
    return res.json({ ok: true, estado: venta.ESTADO, transaccion: null });
  }

  // Flag de caducidad: se resuelve aquí y solo se actúa cuando la pasarela no
  // reportó cobro. Un APPROVED tardío confirmado en el mismo pull tiene
  // PRIORIDAD sobre la caducidad (se consulta Wompi primero, ver abajo).
  const vencida = pagos.pagoVencido(venta.FECHA_EXPIRA_PAGO, venta.FECHA_VENTA);

  if (!venta.REFERENCIA_PAGO) {
    if (vencida) {
      await cancelarVentaWompi(
        venta,
        `el pago no se completó dentro de los ${pagos.MINUTOS_EXPIRACION} minutos de la orden`
      );
      return res.json({ ok: true, estado: 'CANCELADA', transaccion: null });
    }
    return res.json({ ok: true, estado: venta.ESTADO, transaccion: null });
  }

  // Venta simulada (sandbox): la referencia SIMW-... no existe en Wompi y el
  // pull la aprueba/rechaza él mismo según los datos guardados por /simular.
  // Tras SEGUNDOS_SIMULACION de espera ("Esperando confirmación...") se manda
  // la misma transición que una transacción real (idempotente + avisos).
  if (pagos.esVentaSimulada(venta.REFERENCIA_PAGO)) {
    const inicio = pagos.fechaSimulacionDeReferencia(venta.REFERENCIA_PAGO);
    const enEspera = !inicio || Date.now() - inicio.getTime() < pagos.SEGUNDOS_SIMULACION * 1000;
    if (enEspera) {
      return res.json({
        ok: true,
        estado: 'PENDIENTE_PAGO',
        transaccion: resumenTransaccion(transaccionSimulada(venta, 'PENDING', inicio)),
      });
    }
    let datosSimulacion = {};
    try {
      const parseado = venta.DATOS_PAGO && typeof venta.DATOS_PAGO === 'object'
        ? venta.DATOS_PAGO
        : JSON.parse(venta.DATOS_PAGO || '{}');
      if (parseado.simulacion) datosSimulacion = parseado;
    } catch (e) {
      datosSimulacion = {};
    }
    const estadoFinal = datosSimulacion.resultado === 'DECLINED' ? 'DECLINED' : 'APPROVED';
    const transaccionSim = transaccionSimulada(venta, estadoFinal, inicio);
    if (estadoFinal === 'DECLINED') {
      // Igual que una DECLINED real: la venta sigue PENDIENTE_PAGO para reintentar.
      return res.json({ ok: true, estado: 'DECLINADA', transaccion: resumenTransaccion(transaccionSim) });
    }
    const resultado = await confirmarPagoWompi(venta, transaccionSim, datosSimulacion);
    if (resultado.diferencia) {
      // Imposible con montos sintéticos (se derivan del TOTAL), defensa igual a la vía real.
      return res.json({
        ok: true,
        estado: 'PENDIENTE_PAGO',
        transaccion: resumenTransaccion(transaccionSim),
        advertencia: 'La pasarela reportó un monto distinto al del pedido',
      });
    }
    const [refresco] = await db.query(`SELECT ESTADO FROM VENTAS WHERE ID_VENTA = ?`, [venta.ID_VENTA]);
    return res.json({
      ok: true,
      estado: refresco.length > 0 ? refresco[0].ESTADO : venta.ESTADO,
      transaccion: resumenTransaccion(transaccionSim),
    });
  }

  const transacciones = await pagos.buscarTransaccionesPorReferencia(venta.REFERENCIA_PAGO);
  const transaccion = transacciones
    .filter((t) => t.reference === venta.REFERENCIA_PAGO)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];

  if (!transaccion) {
    if (vencida) {
      await cancelarVentaWompi(
        venta,
        `el pago no se completó dentro de los ${pagos.MINUTOS_EXPIRACION} minutos de la orden`
      );
      return res.json({ ok: true, estado: 'CANCELADA', transaccion: null });
    }
    return res.json({ ok: true, estado: 'PENDIENTE_PAGO', transaccion: null });
  }

  const estado = String(transaccion.status || '').toUpperCase();
  if (estado === 'APPROVED') {
    const resultado = await confirmarPagoWompi(venta, transaccion);
    if (resultado.diferencia) {
      return res.json({
        ok: true,
        estado: 'PENDIENTE_PAGO',
        transaccion: resumenTransaccion(transaccion),
        advertencia: 'La pasarela reportó un monto distinto al del pedido',
      });
    }
    // confirmada / duplicado / ya confirmada antes → confirmar el estado real en BD.
    const [refresco] = await db.query(`SELECT ESTADO FROM VENTAS WHERE ID_VENTA = ?`, [venta.ID_VENTA]);
    return res.json({
      ok: true,
      estado: refresco.length > 0 ? refresco[0].ESTADO : venta.ESTADO,
      transaccion: resumenTransaccion(transaccion),
    });
  }
  if (estado === 'VOIDED') {
    await cancelarVentaWompi(venta, `Pago cancelado en la pasarela (${transaccion.id})`);
    return res.json({ ok: true, estado: 'CANCELADA', transaccion: resumenTransaccion(transaccion) });
  }
  if (estado === 'DECLINED' || estado === 'ERROR') {
    if (vencida) {
      await cancelarVentaWompi(
        venta,
        `el pago fue rechazado y expiró la ventana de ${pagos.MINUTOS_EXPIRACION} minutos de la orden`
      );
      return res.json({ ok: true, estado: 'CANCELADA', transaccion: resumenTransaccion(transaccion) });
    }
    // La venta sigue PENDIENTE_PAGO: el usuario puede reintentar ("Pagar ahora").
    return res.json({ ok: true, estado: 'DECLINADA', transaccion: resumenTransaccion(transaccion) });
  }
  if (vencida) {
    await cancelarVentaWompi(
      venta,
      `el pago no se completó dentro de los ${pagos.MINUTOS_EXPIRACION} minutos de la orden`
    );
    return res.json({ ok: true, estado: 'CANCELADA', transaccion: resumenTransaccion(transaccion) });
  }
  return res.json({ ok: true, estado: 'PENDIENTE_PAGO', transaccion: resumenTransaccion(transaccion) });
}

function resumenTransaccion(t) {
  return {
    id: t.id,
    status: String(t.status || '').toUpperCase(),
    referencia: t.reference,
    monto_centavos: t.amount_in_cents,
    medio: (t.payment_method && t.payment_method.type) || null,
    fecha: t.created_at || null,
    // Motivo del rechazo/error que reporta la pasarela (ej. «Número no válido
    // en Sandbox»); se muestra al usuario para que corrija el dato al reintentar.
    mensaje: t.status_message || null,
  };
}

/**
 * Confirma la venta dentro de una transacción (idempotente): valida el monto
 * contra el pedido, bloquea la fila y solo pasa CONFIRMADA si sigue
 * PENDIENTE_PAGO. Los avisos (notificaciones + PDF + correo) salen tras el
 * commit y nunca bloquean la respuesta del pull/webhook.
 */
async function confirmarPagoWompi(venta, transaccion, extras = null) {
  const centavosEsperados = Math.round(Number(venta.TOTAL) * 100);
  if (Number(transaccion.amount_in_cents) !== centavosEsperados) {
    console.error(
      `Montos distintos en venta ${venta.ID_VENTA}: pedido ${centavosEsperados} vs transacción ${transaccion.amount_in_cents} (${transaccion.id}) — NO se confirma`
    );
    return { diferencia: true };
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [actual] = await conn.query(`SELECT ESTADO FROM VENTAS WHERE ID_VENTA = ? FOR UPDATE`, [
      venta.ID_VENTA,
    ]);
    if (actual.length === 0) {
      await conn.rollback();
      return { revivir: false };
    }
    if (actual[0].ESTADO === 'CONFIRMADA') {
      await conn.commit();
      return { duplicado: true };
    }
    if (actual[0].ESTADO !== 'PENDIENTE_PAGO') {
      await conn.commit();
      return { ignorado: actual[0].ESTADO };
    }

    const medio = (transaccion.payment_method && transaccion.payment_method.type) || null;
    const datosPago = JSON.stringify({
      pasarela: 'wompi',
      transaccion_id: transaccion.id,
      medio,
      fecha_confirmacion: new Date().toISOString(),
      // Ventas simuladas: conservar los datos "de tarjeta" que la app guardó
      // en DATOS_PAGO al momento del cobro (brand/last4/titular/vencimiento).
      ...(extras && extras.simulacion
        ? {
            simulacion: true,
            brand: extras.brand || null,
            last4: extras.last4 || null,
            titular: extras.titular || null,
            vencimiento: extras.vencimiento || null,
          }
        : {}),
    });
    const idMetodo = medio && METODO_WOMPI[medio];
    await conn.query(
      `UPDATE VENTAS SET ESTADO = 'CONFIRMADA', DATOS_PAGO = ?
        WHERE ID_VENTA = ? AND ESTADO = 'PENDIENTE_PAGO'`,
      [datosPago, venta.ID_VENTA]
    );
    if (idMetodo) {
      try {
        await conn.query(`UPDATE VENTAS SET ID_METODO = ? WHERE ID_VENTA = ?`, [idMetodo, venta.ID_VENTA]);
      } catch (e) {
        console.error('No se pudo actualizar ID_METODO con el medio de la pasarela:', e.message);
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    console.error('Error confirmando pago Wompi:', e.message);
    throw e;
  } finally {
    conn.release();
  }

  try {
    await notificarVentaConfirmada(venta.ID_VENTA);
  } catch (e) {
    console.error('Avisos post-confirmación fallaron (no bloquea):', e.message);
  }
  return { confirmada: true };
}

/**
 * Cancela la venta PENDIENTE_PAGO (webhook VOIDED o expiración del job):
 * reingresa el stock de las variantes y cancela el envío.
 */
async function cancelarVentaWompi(venta, motivo) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [actual] = await conn.query(`SELECT ESTADO FROM VENTAS WHERE ID_VENTA = ? FOR UPDATE`, [
      venta.ID_VENTA,
    ]);
    if (actual.length === 0 || actual[0].ESTADO !== 'PENDIENTE_PAGO') {
      await conn.commit();
      return { ignorado: true };
    }
    const [items] = await conn.query(
      `SELECT ID_VARIANTE, ID_PRODUCTO, CANTIDAD FROM DETALLE_VENTAS
        WHERE ID_VENTA = ? AND ID_VARIANTE IS NOT NULL FOR UPDATE`,
      [venta.ID_VENTA]
    );
    for (const item of items) {
      await conn.query(`UPDATE PRODUCTO_VARIANTES SET STOCK = STOCK + ? WHERE ID_VARIANTE = ?`, [
        item.CANTIDAD,
        item.ID_VARIANTE,
      ]);
      await registrarMovimientoStock({
        conn,
        idProducto: item.ID_PRODUCTO,
        tipo: 'ENTRADA',
        cantidad: item.CANTIDAD,
      });
    }
    await conn.query(
      `UPDATE VENTAS SET ESTADO = 'CANCELADA', CANCELADA_POR = 'SISTEMA' WHERE ID_VENTA = ?`,
      [venta.ID_VENTA]
    );
    await conn.query(
      `UPDATE ENVIOS SET ESTADO_ENVIO = 'CANCELADO' WHERE ID_VENTA = ? AND ESTADO_ENVIO = 'PENDIENTE'`,
      [venta.ID_VENTA]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    console.error('Error cancelando venta por pagos:', e.message);
    throw e;
  } finally {
    conn.release();
  }

  try {
    await crearNotificacion({
      idUsuario: venta.ID_CLIENTE,
      tipo: 'pedido',
      titulo: `Pedido cancelado ⏰`,
      mensaje: `Tu pedido #${numeroPedido(venta.ID_VENTA)} fue cancelado: ${motivo || 'no se registró el pago a tiempo'}.`,
      ruta: `/perfil/compra/${venta.ID_VENTA}`,
    });
  } catch (e) {
    console.error('Error notificando cancelación:', e.message);
  }
  return { cancelada: true };
}

/**
 * Avisos de "pedido confirmado" (post-commit): mismo contenido que el bloque
 * sin pasarela de checkout — notificaciones comprador/admin/vendedores,
 * factura PDF adjunta y correo.
 */
async function notificarVentaConfirmada(idVenta) {
  const [ventas] = await db.query(
    `SELECT v.*, u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.EMAIL,
            e.DIRECCION_ENVIO, e.CIUDAD, e.BARRIO, e.DEPARTAMENTO,
            e.TELEFONO_CONTACTO, e.COSTO_ENVIO
       FROM VENTAS v
       JOIN USUARIOS u ON u.ID_USUARIO = v.ID_CLIENTE
       LEFT JOIN ENVIOS e ON e.ID_VENTA = v.ID_VENTA
      WHERE v.ID_VENTA = ?`,
    [idVenta]
  );
  const venta = ventas[0];
  if (!venta) return;

  let datos = {};
  try {
    datos = venta.DATOS_PAGO && typeof venta.DATOS_PAGO === 'object' ? venta.DATOS_PAGO : JSON.parse(venta.DATOS_PAGO || '{}');
  } catch (e) {
    datos = {};
  }
  const medio = datos.medio ? MEDIO_ES[datos.medio] || datos.medio : '';
  const correo = EMAIL_RE.test(String(venta.EMAIL || '')) ? String(venta.EMAIL) : '';
  const nombre = [venta.NOMBRE_USUARIO, venta.APELLIDO_USUARIO].filter(Boolean).join(' ').trim();

  const [items] = await db.query(
    `SELECT p.NOMBRE AS NOMBRE, dv.CANTIDAD, dv.PRECIO_UNITARIO, dv.SUBTOTAL, dv.ID_PRODUCTO, pi.URL_IMAGEN
       FROM DETALLE_VENTAS dv
       LEFT JOIN PRODUCTOS p ON p.ID = dv.ID_PRODUCTO
       LEFT JOIN PRODUCTO_IMAGENES pi ON pi.ID_PRODUCTO = dv.ID_PRODUCTO AND pi.ORDEN = 1
      WHERE dv.ID_VENTA = ?`,
    [idVenta]
  );
  const total = Number(venta.TOTAL);
  const costoEnvio = Number(venta.COSTO_ENVIO || 0);

  try {
    await crearNotificacion({
      idUsuario: venta.ID_CLIENTE,
      tipo: 'pedido',
      titulo: '¡Pago confirmado! 🛒',
      mensaje: `Tu pago del pedido #${numeroPedido(idVenta)} por $${total.toLocaleString('es-CO')} fue aprobado por la pasarela.`,
      ruta: `/perfil/compra/${idVenta}`,
    });
  } catch (e) {
    console.error('Error noti comprador (pagos):', e.message);
  }
  try {
    await crearNotificacion({
      idUsuario: null,
      tipo: 'pedido',
      titulo: `🛒 Nuevo pedido pagado #${numeroPedido(idVenta)}`,
      mensaje: `${nombre || 'Un cliente'} completó el pago de ${items.length} producto(s) por $${total.toLocaleString('es-CO')}.`,
      ruta: '/admin/ordenes',
    });
  } catch (e) {
    console.error('Error noti admin (pagos):', e.message);
  }
  try {
    const [vendedores] = await db.query(
      `SELECT DISTINCT v.ID_USUARIO, v.NOMBRE_EMPRESA
         FROM PRODUCTOS p JOIN VENDEDORES v ON v.ID_VENDEDOR = p.ID_VENDEDOR
        WHERE p.ID IN (${items.map(() => '?').join(',') || 'NULL'}) AND p.ID_VENDEDOR IS NOT NULL`,
      items.map((i) => i.ID_PRODUCTO)
    );
    for (const vendedor of vendedores) {
      await crearNotificacion({
        idUsuario: vendedor.ID_USUARIO,
        tipo: 'vendedor',
        titulo: '¡Tienes una nueva venta pagada! 🎉',
        mensaje: `Se confirmó el pago de productos de ${vendedor.NOMBRE_EMPRESA} en el pedido #${numeroPedido(idVenta)}.`,
        ruta: '/vendedor/ventas',
      });
    }
  } catch (e) {
    console.error('Error noti vendedores (pagos):', e.message);
  }

  try {
    const facturaPdf = await generarFacturaPdf({
      venta: { ID_VENTA: idVenta, FECHA_VENTA: venta.FECHA_VENTA, TOTAL: total, REFERENCIA_PAGO: venta.REFERENCIA_PAGO },
      usuario: { NOMBRE_USUARIO: nombre, APELLIDO_USUARIO: '', EMAIL: correo },
      items: items.map((i) => ({
        NOMBRE: i.NOMBRE,
        CANTIDAD: i.CANTIDAD,
        PRECIO_UNITARIO: Number(i.PRECIO_UNITARIO),
        SUBTOTAL: Number(i.SUBTOTAL),
        URL_IMAGEN: i.URL_IMAGEN,
      })),
      metodoPago: medio || 'Pasarela de pagos',
      envio: {
        DIRECCION_ENVIO: venta.DIRECCION_ENVIO,
        CIUDAD: venta.CIUDAD,
        BARRIO: venta.BARRIO,
        DEPARTAMENTO: venta.DEPARTAMENTO,
        TELEFONO_CONTACTO: venta.TELEFONO_CONTACTO,
        COSTO_ENVIO: costoEnvio,
      },
    });

    const itemsHtml = items
      .map(
        (i) =>
          `<tr>
        <td style="padding:8px;border-bottom:1px solid #ddd;font-size:0.9rem">${i.NOMBRE}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">${i.CANTIDAD}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">$${Number(i.PRECIO_UNITARIO).toLocaleString()}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">$${Number(i.SUBTOTAL).toLocaleString()}</td>
      </tr>`
      )
      .join('');
    if (correo) {
      const frontend = String(process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
      await transporter.sendMail({
        from: `"JADDA SPORTS" <${process.env.EMAIL_USER}>`,
        to: correo,
        subject: `¡Pago confirmado ${nombre ? nombre : ''}, tu pedido ya está en marcha!`,
        attachments: facturaPdf
          ? [{ filename: `factura-compra-${idVenta}.pdf`, content: facturaPdf, contentType: 'application/pdf' }]
          : [],
        html: plantillaCorreo({
          emoji: '✅',
          titulo: `¡Pago aprobado! Tu pedido quedó confirmado`,
          subtitulo: `Pedido ${numeroPedido(idVenta)} · ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}`,
          saludo: `Hola ${nombre || 'cliente'}, tu pago con referencia <strong>${venta.REFERENCIA_PAGO}</strong> fue aprobado.`,
          contenido: `
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin:10px 0 4px">
              <thead><tr style="background:#f1f5f9;color:#334155;font-size:12px">
                <th style="padding:9px;text-align:left;border-radius:8px 0 0 8px">Producto</th>
                <th style="padding:9px;text-align:center">Cant</th>
                <th style="padding:9px;text-align:right">P/U</th>
                <th style="padding:9px;text-align:right;border-radius:0 8px 8px 0">Subtotal</th>
              </tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            ${costoEnvio > 0 ? `<p style="text-align:right;margin:4px 0 0;font-size:13px;color:#64748b">Envío: $${costoEnvio.toLocaleString('es-CO')}</p>` : `<p style="text-align:right;margin:4px 0 0;font-size:13px;color:#16a34a">Envío: <strong>GRATIS</strong></p>`}
            <p style="text-align:right;margin:8px 0 0;font-size:17px;font-weight:800">Total: <span style="color:#e63946">$${total.toLocaleString('es-CO')}</span></p>
            <div style="margin-top:16px;padding:12px 14px;background:#f8fafc;border-left:4px solid #e63946;border-radius:8px;font-size:13px;color:#475569">
              <p style="margin:0 0 4px"><strong>🚚 Datos de envío</strong></p>
              <p style="margin:0">${venta.DIRECCION_ENVIO || ''}, ${venta.CIUDAD || ''}, ${venta.DEPARTAMENTO || ''}</p>
              <p style="margin:4px 0 0">💳 Método: ${medio || 'Pasarela de pagos'}</p>
            </div>`,
          botonTexto: 'Ver mi pedido',
          botonEnlace: `${frontend}/perfil/compra/${idVenta}`,
          notas: ['📎 Te adjuntamos tu factura en PDF.', '🔔 Te avisaremos por este correo cada vez que tu pedido cambie de estado.'],
        }),
      });
    }
  } catch (e) {
    console.error('Error armando factura/correo post-pago:', e.message);
  }
}

/**
 * POST /api/pagos/webhook — evento transaction.updated de Wompi.
 * Verifica la firma (403 si es inválida), registra en PAGOS_EVENTOS
 * (idempotencia) y re-consulta la transacción en la API antes de confirmar
 * (nunca confía en el payload del evento).
 */
async function webhookWompi(req, res) {
  const valido = pagos.verificarEventosWompi(req.body, req.get('X-Event-Checksum'));
  const evento = String(req.body?.event || 'desconocido');
  const idExterno = String(req.body?.data?.transaction?.id || req.body?.data?.id || '');
  const checksum = String(req.body?.signature?.checksum || req.get('X-Event-Checksum') || '');

  if (!valido) {
    try {
      await db.query(
        `INSERT IGNORE INTO PAGOS_EVENTOS (PROVEEDOR, EXTERNO_ID, EVENTO, CHECKSUM, ESTADO_PROCESADO)
         VALUES ('wompi', ?, ?, ?, 'FIRMA_INVALIDA')`,
        [idExterno, evento, checksum]
      );
    } catch (e) {
      console.error('No se pudo registrar evento inválido:', e.message);
    }
    console.warn(`Evento Wompi con firma inválida rechazado (evento=${evento}, tx=${idExterno})`);
    return res.status(403).json({ ok: false, message: 'Firma inválida' });
  }

  let duplicado = false;
  try {
    const [r] = await db.query(
      `INSERT IGNORE INTO PAGOS_EVENTOS (PROVEEDOR, EXTERNO_ID, EVENTO, CHECKSUM, ESTADO_PROCESADO)
       VALUES ('wompi', ?, ?, ?, 'RECIBIDO')`,
      [idExterno, evento, checksum]
    );
    duplicado = r.affectedRows === 0;
  } catch (e) {
    console.error('No se pudo registrar el evento en PAGOS_EVENTOS:', e.message);
  }

  if (evento !== 'transaction.updated' || !idExterno) {
    return res.status(200).json({ ok: true, estado: 'ignorado' });
  }

  const transaccion = await pagos.obtenerTransaccionWompi(idExterno);
  if (!transaccion) {
    // La API no confirmó la transacción: no se actúa sobre la venta.
    return res.status(200).json({ ok: true, estado: 'transaccion_no_verificada' });
  }

  const referencia = String(transaccion.reference || '');
  let venta = null;
  if (referencia) {
    const [ventas] = await db.query(
      `SELECT ID_VENTA, ID_CLIENTE, TOTAL, ESTADO, REFERENCIA_PAGO FROM VENTAS WHERE REFERENCIA_PAGO = ? ORDER BY ID_VENTA DESC LIMIT 1`,
      [referencia]
    );
    venta = ventas[0] || null;
  }

  const estado = String(transaccion.status || '').toUpperCase();
  if (!venta) {
    // Responder siempre 200 a Wompi (si no, reintenta 24 h).
    return res.status(200).json({ ok: true, estado: 'venta_no_encontrada' });
  }

  try {
    await db.query(`UPDATE PAGOS_EVENTOS SET ID_VENTA = ? WHERE EXTERNO_ID = ? AND CHECKSUM = ?`, [
      venta.ID_VENTA,
      idExterno,
      checksum,
    ]);
  } catch (e) {
    console.error('No se pudo vincular el evento con la venta:', e.message);
  }

  if (estado === 'APPROVED') {
    await confirmarPagoWompi(venta, transaccion);
  } else if (estado === 'VOIDED') {
    await cancelarVentaWompi(venta, `Pago cancelado en la pasarela (${transaccion.id})`);
  }
  // DECLINED/ERROR: la venta sigue PENDIENTE_PAGO para reintentar.

  return res.status(200).json({ ok: true, estado: duplicado ? 'duplicado_procesado' : 'procesado' });
}

/** Job: cancela las ventas PENDIENTE_PAGO vencidas (reingresando stock).
 *  Vida útil: FECHA_EXPIRA_PAGO cuando existe (nace = venta + ventana, se
 *  reinicia por cada sesión de pago nueva); ventas previas a la columna usan
 *  FECHA_VENTA + ventana como fallback. */
async function expirarVentasPendientes() {
  const [vencidas] = await db.query(
    `SELECT ID_VENTA, ID_CLIENTE FROM VENTAS
      WHERE ESTADO = 'PENDIENTE_PAGO'
        AND ((FECHA_EXPIRA_PAGO IS NOT NULL AND FECHA_EXPIRA_PAGO < NOW())
          OR (FECHA_EXPIRA_PAGO IS NULL AND FECHA_VENTA < DATE_SUB(NOW(), INTERVAL ? MINUTE)))`,
    [pagos.MINUTOS_EXPIRACION]
  );
  let expiradas = 0;
  for (const venta of vencidas) {
    try {
      const r = await cancelarVentaWompi(
        venta,
        `el pago no se completó dentro de los ${pagos.MINUTOS_EXPIRACION} minutos de la orden`
      );
      if (r.cancelada) expiradas += 1;
    } catch (e) {
      console.error(`Error expirando venta ${venta.ID_VENTA}:`, e.message);
    }
  }
  return { expiradas, revisadas: vencidas.length };
}

module.exports = {
  configPagos,
  crearSesionPago,
  simularPago,
  estadoVenta,
  webhookWompi,
  expirarVentasPendientes,
};
