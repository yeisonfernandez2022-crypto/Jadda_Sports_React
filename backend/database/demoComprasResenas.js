/*
 * demoComprasResenas.js — DEMO v3: cobertura de reseñas para TODOS los productos visibles.
 *
 * Reglas del sistema que este bloque respeta:
 *  - agregarResena (A04): solo califica quien COMPRÓ (venta no CANCELADA) y máximo 1 reseña
 *    por usuario y producto — por eso primero se siembran compras coherentes con TOTAL
 *    derivado de PRODUCTOS en el propio SELECT (sin drift) y las reseñas salen de esos compradores.
 *  - envío (utils/envio.js): Cundinamarca/Bogotá 8000 · Antioquia y Valle del Cauca 9000;
 *    subtotal >= ENVIO_GRATIS_DESDE (800.000) → envío $0 (la regla real del checkout).
 *  - Visibilidad: solo productos con ESTADO_PUBLICACION NULL o 'APROBADO'.
 *
 * Determinista: PRNG con semilla fija — la misma lista de productos y compradores produce
 * el MISMO bloque en la BD viva (TiDB) y en BD nuevas (setup.js), sin transcribir filas.
 * Idempotente: si ya existen >= LIMITE_RESENA_SKIP reseñas de cuentas *.demo@ devuelve null.
 */
const SEMILLA_PRNG = 20261110;
const LIMITE_RESENA_SKIP = 20;
const MAX_ITEMS_POR_VENTA = 6;
const ENVIO_GRATIS_DESDE = 800000;

const EMAILS_COMPRADORES = [
  'mario.perez.demo@gmail.com',
  'daniela.torres.demo@gmail.com',
  'jorge.ruiz.demo@gmail.com',
  'camila.vega.demo@gmail.com',
];

/* PRNG mulberry32 — determinista y estable entre espacios de IDs (no depende de IDs). */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const esc = (s) => String(s == null ? '' : s).replace(/'/g, "''");
const sinTildes = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* ---------- Pools de comentarios (sin apóstrofes ni paréntesis: el splitter de setup cuenta ';' por línea) ---------- */
const POSITIVO = [
  'La calidad es mucho mejor de lo que esperaba por el precio.',
  'Material resistente y acabados limpios, se nota la diferencia.',
  'Cumple exactamente con la descripción del producto, sin sorpresas.',
  'Muy buena compra, la uso casi todos los días.',
  'Excelente acabado, nada flojo ni mal pulido.',
  'Llegó como en las fotos, muy satisfecho con la compra.',
  'Perfecto para entrenar con frecuencia sin que se dañe rápido.',
  'Buena relación calidad precio, lo recomiendo sin pensarlo mucho.',
  'Diseño elegante y práctico, cómodo para practicar deporte.',
  'Resistente y cómodo a la vez, lo que buscaba.',
  'Llegó impecable y funcionó mejor de lo que esperaba.',
  'Superó mis expectativas, definitivamente lo volvería a comprar.',
  'Las medidas coinciden con la ficha técnica, bien.',
  'Detalles de fabricación sorprendentemente buenos para este precio.',
];
const MEDIO = [
  'Cumple su función, aunque esperaba algo más por el precio.',
  'Está bien para uso ocasional, sin grandes lujos.',
  'Aceptable, el material se siente algo ligero en las manos.',
  'Funciona bien pero la referencia venía un poco ajustada.',
  'Regular: cumple, pero no es la mejor opción del mercado.',
  'Correcto para empezar, y se nota el desgaste con el tiempo.',
];
const NEGATIVO = [
  'La calidad no me convenció, se aprecia frágil en las uniones.',
  'Dudo mucho de la durabilidad del material con uso diario.',
  'No quedó satisfecho, el acabado llegó con detalles.',
  'Viene más pequeño de lo que indicaba la ficha técnica.',
  'La costura se nota débil en las esquinas tras una semana.',
  'Fue una compra que lamenté, para mi gusto no lo recomiendo.',
];

/*
 * Extras por categoría (keyword → textos adicionales por nivel). Se SUMAN al pool genérico,
 * así los productos sin categoría reconocida nunca quedan sin texto. Keywords SIN tildes
 * (se comparan contra la categoría normalizada).
 */
const EXTRAS_CATEGORIA = [
  { kw: ['futbol', 'balon', 'soccer', 'espinillera', 'arquero', 'portero'], p: ['Agarre y respuesta en cancha sobresalientes.'], m: ['Sirve para jugar los fines de semana, no más que eso.'], b: ['Se desinfla rápido tras un par de usos.'] },
  { kw: ['baloncesto', 'basket'], p: ['El rebote y el agarre del balón se sienten muy naturales.'], m: ['Para tirar está bien, no para uso intenso.'], b: ['La válvula pierde aire antes de lo esperado.'] },
  { kw: ['ciclismo', 'bici', 'pedal'], p: ['En ruta responde muy bien y se siente ligero.'], m: ['Servible, aunque algo pesado para subidas largas.'], b: ['El ajuste venía flojo desde la caja.'] },
  { kw: ['suplemento', 'proteina', 'nutricion', 'creatina', 'aminoacido'], p: ['Se disuelve bien y el sabor no cansa.'], m: ['Sabor aceptable, aunque algo pastoso.'], b: ['El sabor varía mucho según el lote.'] },
  { kw: ['ropa', 'camiseta', 'buso', 'hoodie', 'pantaloneta', 'sueter'], p: ['La tela respira bien y no se marca el sudor.'], m: ['La talla corre algo pequeña, pedir una más.'], b: ['Se salió el acabado tras el segundo lavado.'] },
  { kw: ['zapato', 'guayo', 'zapatilla', 'calzado', 'botines'], p: ['Buen soporte del arco y suela con buen agarre.'], m: ['Cómodos la primera semana, luego piden descanso.'], b: ['La suela despegó antes de un mes.'] },
  { kw: ['natacion', 'nadador', 'piscina', 'aletas'], p: ['Ajuste perfecto y sin entradas de agua.'], m: ['Sirven bien, aunque aprietan un poco.'], b: ['El empaque perdió su sello rápido.'] },
  { kw: ['pesa', 'mancuerna', 'gimnasio', 'fitness', 'cardio', 'eliptica', 'cinta', 'crossfit'], p: ['Para entrenamiento diario responde excelente.'], m: ['Funcional, aunque hace ruido con uso intensivo.'], b: ['Oscila al usarlo y no da estabilidad.'] },
];

const poolsParaCategoria = (categoria) => {
  const cat = sinTildes(categoria);
  const hit = EXTRAS_CATEGORIA.find((g) => g.kw.some((k) => cat.includes(k)));
  return {
    p: POSITIVO.concat(hit ? hit.p : []),
    m: MEDIO.concat(hit ? hit.m : []),
    b: NEGATIVO.concat(hit ? hit.b : []),
  };
};

const eligeEstrella = (rng) => {
  const r = rng();
  if (r < 0.35) return 5;
  if (r < 0.70) return 4;
  if (r < 0.85) return 3;
  if (r < 0.95) return 2;
  return 1;
};
const eligeTexto = (pools, estrella, rng) => {
  const tier = estrella >= 4 ? 'p' : estrella === 3 ? 'm' : 'b';
  const arr = pools[tier];
  return arr[Math.floor(rng() * arr.length) % arr.length];
};

const TARIFA_DEPTO = (depto) => {
  const d = sinTildes(depto);
  if (d.includes('cundinamarca') || d.includes('bogota')) return 8000;
  return 9000; // Antioquia, Valle del Cauca y resto — tarifas reales del checkout
};

const ULTIMOS4 = ['1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '0000'];
const ultimos4 = (i) => ULTIMOS4[((i % ULTIMOS4.length) + ULTIMOS4.length) % ULTIMOS4.length];

const DIA = 24 * 60 * 60 * 1000;
const fecha = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const minimo = (a, b) => (a.getTime() < b.getTime() ? a : b);
const BASE_PRIMERA_COMPRA = new Date('2026-09-08T08:00:00');
const TOPE_RESENA = new Date('2026-11-09T21:00:00');

/**
 * construirBloqueComprasResenas(connection)
 *   → { bloque, statements, resumen }  |  null si ya está sembrado o falta algo.
 * `bloque` es el SQL de una pieza para ejecutarBloqueSQL (setup.js);
 * `statements` es el array de sentencias individuales (runner de la BD viva).
 */
async function construirBloqueComprasResenas(connection) {
  if (!connection) throw new Error('construirBloqueComprasResenas: falta la connection');

  // 0) idempotencia: ¿ya hay suficientes reseñas demo? (emails *.demo@)
  //    Solo omite si además TODOS los productos visibles ya tienen reseña — si más
  //    adelante se agregan productos, el arranque self-heals la cobertura.
  const [[cont]] = await connection.query(
    `SELECT COUNT(*) AS n FROM RESENAS r JOIN USUARIOS u ON u.ID_USUARIO = r.ID_USUARIO
      WHERE u.EMAIL LIKE '%.demo@%'`);
  if (Number(cont.n) >= LIMITE_RESENA_SKIP) {
    const [[falta]] = await connection.query(
      `SELECT COUNT(*) AS n FROM PRODUCTOS p
        WHERE (p.ESTADO_PUBLICACION IS NULL OR p.ESTADO_PUBLICACION = 'APROBADO')
          AND NOT EXISTS (SELECT 1 FROM RESENAS r WHERE r.ID_PRODUCTO = p.ID)`);
    if (Number(falta.n) === 0) return null;
  }

  // 1) compradores demo (creados por DEMO_DATA) con su dirección principal
  const ph = EMAILS_COMPRADORES.map(() => '?').join(', ');
  const [buyers] = await connection.query(
    `SELECT u.ID_USUARIO, u.EMAIL, u.NOMBRE_USUARIO, u.APELLIDO_USUARIO, u.telefono,
            d.DIRECCION, d.BARRIO, d.CIUDAD, d.DEPARTAMENTO, d.CODIGO_POSTAL, d.TELEFONO_CONTACTO
       FROM USUARIOS u JOIN DIRECCIONES d ON d.ID_USUARIO = u.ID_USUARIO AND d.ES_PRINCIPAL = 1
      WHERE u.EMAIL IN (${ph}) AND u.ID_ROL = 4
      ORDER BY u.EMAIL`, EMAILS_COMPRADORES);
  if (!buyers.length) return null;

  // 2) productos visibles SIN reseñas (pendientes/rechazados quedan fuera)
  const [prods] = await connection.query(
    `SELECT p.ID, p.NOMBRE, p.PRECIO, p.ID_VENDEDOR, c.NOMBRE_CATEGORIA
       FROM PRODUCTOS p
       LEFT JOIN CATEGORIAS c ON c.ID_CATEGORIA = p.ID_CATEGORIA
      WHERE (p.ESTADO_PUBLICACION IS NULL OR p.ESTADO_PUBLICACION = 'APROBADO')
        AND NOT EXISTS (SELECT 1 FROM RESENAS r WHERE r.ID_PRODUCTO = p.ID)
      ORDER BY p.ID`);
  if (!prods.length) return null;

  const rng = mulberry32(SEMILLA_PRNG);

  // 3) pares ya respaldados por compras demo existentes (no necesitan compra nueva)
  const [duenos] = await connection.query(
    `SELECT dv.ID_PRODUCTO, v.ID_CLIENTE
       FROM DETALLE_VENTAS dv
       JOIN VENTAS v ON v.ID_VENTA = dv.ID_VENTA
      WHERE v.ID_CLIENTE IN (${buyers.map(() => '?').join(', ')})
        AND v.ESTADO <> 'CANCELADA'`,
    buyers.map((b) => b.ID_USUARIO));
  const respaldados = new Set(duenos.map((d) => `${d.ID_CLIENTE}:${d.ID_PRODUCTO}`));

  // 4) plan de reseñas: k compradores distintos por producto (1-3)
  const paresPorUsuario = new Map(); // idUsuario → [{producto, precio, cant, estrella, texto, respaldado}]
  for (const p of prods) {
    const precio = Number(p.PRECIO);
    if (!(precio > 0)) continue;
    const pools = poolsParaCategoria(p.NOMBRE_CATEGORIA || '');
    const r = rng();
    const k = Math.min(r < 0.45 ? 1 : r < 0.85 ? 2 : 3, buyers.length);
    const off = Math.floor(rng() * buyers.length);
    for (let d = 0; d < k; d++) {
      const u = buyers[(off + d) % buyers.length];
      const estrella = eligeEstrella(rng);
      const texto = eligeTexto(pools, estrella, rng);
      const cant = rng() < 0.8 ? 1 : 2;
      if (!paresPorUsuario.has(u.ID_USUARIO)) paresPorUsuario.set(u.ID_USUARIO, []);
      paresPorUsuario.get(u.ID_USUARIO).push({
        producto: p.ID, precio, cant, estrella, texto,
        respaldado: respaldados.has(`${u.ID_USUARIO}:${p.ID}`),
      });
    }
  }
  const totalPares = [...paresPorUsuario.values()].reduce((s, l) => s + l.length, 0);
  if (!totalPares) return null;

  // 5) IDs nuevos a partir del MAX real de cada tabla (sirve en BD viva y en BD nueva)
  const [[mv]] = await connection.query('SELECT COALESCE(MAX(ID_VENTA), 0) AS m FROM VENTAS');
  const [[md]] = await connection.query('SELECT COALESCE(MAX(ID_DETALLE), 0) AS m FROM DETALLE_VENTAS');
  const [[me]] = await connection.query('SELECT COALESCE(MAX(ID_ENVIO), 0) AS m FROM ENVIOS');
  const [[mr]] = await connection.query('SELECT COALESCE(MAX(ID_RESENA), 0) AS m FROM RESENAS');
  let idVenta = Number(mv.m) + 1;
  let idDetalle = Number(md.m) + 1;
  let idEnvio = Number(me.m) + 1;
  let idResena = Number(mr.m) + 1;

  const enVentas = [];  // VENTAS+DETALLE+ENVIOS (una venta completa con sus items)
  const enResenas = []; // reseñas de pares con compra nueva (fecha = entrega + 1-2 días)
  const enResenasRespaldadas = []; // reseñas de pares ya respaldados (fecha determinista sin rng)

  const clauseExisteVenta = (ventaId, ref, email) =>
    ref === 'NULL'
      ? `WHERE EXISTS (SELECT 1 FROM VENTAS v WHERE v.ID_VENTA = ${ventaId} AND v.REFERENCIA_PAGO IS NULL AND v.ID_CLIENTE = (SELECT u2.ID_USUARIO FROM USUARIOS u2 WHERE u2.EMAIL = '${esc(email)}'))`
      : `WHERE EXISTS (SELECT 1 FROM VENTAS v WHERE v.ID_VENTA = ${ventaId} AND v.REFERENCIA_PAGO = ${ref})`;

  let gVenta = 0;
  for (const u of buyers) {
    const pendientes = (paresPorUsuario.get(u.ID_USUARIO) || []).filter((x) => !x.respaldado);
    for (let i = 0; i < pendientes.length; i += MAX_ITEMS_POR_VENTA) {
      const items = pendientes.slice(i, i + MAX_ITEMS_POR_VENTA);
      const subtotal = items.reduce((s, it) => s + it.precio * it.cant, 0);
      const envio = subtotal >= ENVIO_GRATIS_DESDE ? 0 : TARIFA_DEPTO(u.DEPARTAMENTO);

      const compra = new Date(BASE_PRIMERA_COMPRA.getTime() + gVenta * 63 * 3600 * 1000);
      compra.setUTCHours(8 + Math.floor(rng() * 10), Math.floor(rng() * 60), 0, 0);
      const entrega = minimo(new Date(compra.getTime() + (3 + Math.floor(rng() * 3)) * DIA), new Date('2026-11-06T20:00:00'));
      const fechaCompra = fecha(compra);
      const fechaEntrega = fecha(entrega);
      const fechaEnvio = fecha(new Date(minimo(new Date(compra.getTime() + DIA), entrega)));

      const metodo = [3, 4, 6, 1][gVenta % 4];
      const idxTitular = buyers.indexOf(u);
      let datosPago = 'NULL';
      let ref = 'NULL';
      if (metodo === 3) {
        datosPago = `'{"tipo":"tarjeta","franquicia":"VISA","ultimos":"${ultimos4(idxTitular)}","titular":"${esc(u.NOMBRE_USUARIO)} ${esc(u.APELLIDO_USUARIO)}"}'`;
        ref = `'SIM_${Math.floor(1788000000 + gVenta * 86400)}_${gVenta + 1}'`;
      } else if (metodo === 4) {
        datosPago = `'{"tipo":"nequi","celular":"${esc(u.telefono || '3000000000')}"}'`;
        ref = `'SIM_${Math.floor(1788000000 + gVenta * 86400)}_${gVenta + 1}'`;
      } else if (metodo === 6) {
        datosPago = `'{"tipo":"transferencia","banco":"Bancolombia"}'`;
        ref = `'SIM_${Math.floor(1788000000 + gVenta * 86400)}_${gVenta + 1}'`;
      }

      enVentas.push([
        `INSERT IGNORE INTO VENTAS (ID_VENTA,ID_CLIENTE,FECHA_VENTA,DATOS_PAGO,TOTAL,ESTADO,ID_METODO,REFERENCIA_PAGO)`,
        `SELECT ${idVenta}, ${u.ID_USUARIO}, '${fechaCompra}', ${datosPago}, SUM(p.PRECIO * i.cant) + ${envio}, 'COMPLETADA', ${metodo}, ${ref}`,
        `FROM (${items.map((it) => `SELECT ${it.producto} AS idp, ${it.cant} AS cant`).join(' UNION ALL ')}) i`,
        `JOIN PRODUCTOS p ON p.ID = i.idp;`,
      ].join('\n'));

      for (const it of items) {
        enVentas.push([
          `INSERT IGNORE INTO DETALLE_VENTAS (ID_DETALLE,ID_VENTA,ID_PRODUCTO,ID_VARIANTE,CANTIDAD,PRECIO_UNITARIO,SUBTOTAL)`,
          `SELECT ${idDetalle}, ${idVenta}, p.ID, (SELECT MIN(ID_VARIANTE) FROM PRODUCTO_VARIANTES pv WHERE pv.ID_PRODUCTO = p.ID), ${it.cant}, p.PRECIO, p.PRECIO * ${it.cant}`,
          `FROM PRODUCTOS p WHERE p.ID = ${it.producto};`,
        ].join('\n'));
        idDetalle += 1;
      }

      enVentas.push([
        `INSERT IGNORE INTO ENVIOS (ID_ENVIO,ID_VENTA,DIRECCION_ENVIO,CIUDAD,BARRIO,DEPARTAMENTO,CODIGO_POSTAL,OBSERVACIONES,TELEFONO_CONTACTO,COSTO_ENVIO,ESTADO_ENVIO,FECHA_ENVIO,FECHA_ENTREGA)`,
        `SELECT ${idEnvio}, ${idVenta}, '${esc(u.DIRECCION)}', '${esc(u.CIUDAD)}', '${esc(u.BARRIO)}', '${esc(u.DEPARTAMENTO)}', '${esc(u.CODIGO_POSTAL)}', NULL, '${esc(u.TELEFONO_CONTACTO || u.telefono)}', ${envio}, 'ENTREGADO', '${fechaEnvio}', '${fechaEntrega}'`,
        `FROM DUAL`,
        clauseExisteVenta(idVenta, ref, u.EMAIL) + ';',
      ].join('\n'));

      // reseñas de los items de ESTA venta: fecha = entrega + 1-2 días (cap tope)
      for (const it of items) {
        const fRes = fecha(minimo(new Date(entrega.getTime() + (1 + Math.floor(rng() * 2)) * DIA), TOPE_RESENA));
        enResenas.push([
          `INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA)`,
          `VALUES (${idResena}, ${it.producto}, ${u.ID_USUARIO}, ${it.estrella}, '${esc(it.texto)}', '${fRes}');`,
        ].join('\n'));
        idResena += 1;
      }

      idVenta += 1;
      idEnvio += 1;
      gVenta += 1;
    }
  }

  // 6) reseñas de pares YA respaldados (existe compra demo previa): fecha determinista, 1 por par
  let gPar = 0;
  for (const u of buyers) {
    const respaldadas = (paresPorUsuario.get(u.ID_USUARIO) || []).filter((x) => x.respaldado);
    for (const par of respaldadas) {
      const base = new Date(BASE_PRIMERA_COMPRA.getTime() + gPar * 2.2 * DIA);
      const fRes = fecha(minimo(base, TOPE_RESENA));
      enResenasRespaldadas.push([
        `INSERT IGNORE INTO RESENAS (ID_RESENA,ID_PRODUCTO,ID_USUARIO,CALIFICACION,COMENTARIO,FECHA)`,
        `VALUES (${idResena}, ${par.producto}, ${u.ID_USUARIO}, ${par.estrella}, '${esc(par.texto)}', '${fRes}');`,
      ].join('\n'));
      idResena += 1;
      gPar += 1;
    }
  }

  // Orden del bloque: compras (venta+detalle+envio) → reseñas de esas compras → reseñas respaldadas
  const partes = [...enVentas, ...enResenas, ...enResenasRespaldadas];
  const ventasNuevas = partes.filter((s) => s.startsWith('INSERT IGNORE INTO VENTAS')).length;
  const resumen = {
    productosSinResena: prods.length,
    compradores: buyers.length,
    pares: totalPares,
    paresConCompra: totalPares - enResenasRespaldadas.length,
    paresRespaldados: enResenasRespaldadas.length,
    ventasNuevas,
    resenas: parseInt(idResena - Number(mr.m) - 1, 10),
  };
  const statements = partes.map((s) => (s.endsWith(';') ? s : s + ';'));
  return { bloque: statements.join('\n\n') + '\n', statements, resumen };
}

module.exports = { construirBloqueComprasResenas };
