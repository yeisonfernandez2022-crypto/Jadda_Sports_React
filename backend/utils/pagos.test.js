import { describe, test, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('pagos.js — cripto y convenciones Wompi', () => {
  const llaves = {
    WOMPI_PUBLIC_KEY: 'pub_test_Unitaria9sf7',
    WOMPI_PRIVATE_KEY: 'prv_test_Unitaria9sf7',
    WOMPI_INTEGRITY_KEY: 'test_integrity_unitaria9sf7',
    WOMPI_EVENTS_SECRET: 'test_events_unitaria9sf7',
  };

  beforeAll(() => {
    process.env.PAYMENT_GATEWAY = 'wompi';
    Object.assign(process.env, llaves);
  });

  test('gatewayActivo exige PAYMENT_GATEWAY=wompi y las tres llaves', () => {
    const pagos = require('./pagos');
    expect(pagos.gatewayActivo()).toBe(true);
    delete process.env.WOMPI_INTEGRITY_KEY;
    expect(pagos.configuracionCompleta()).toBe(false);
    process.env.WOMPI_INTEGRITY_KEY = llaves.WOMPI_INTEGRITY_KEY;
    process.env.PAYMENT_GATEWAY = '';
    expect(pagos.gatewayActivo()).toBe(false);
  });

  test('esAmbientePruebas distingue pub_test_ de producción', () => {
    const pagos = require('./pagos');
    expect(pagos.esAmbientePruebas()).toBe(true);
    process.env.WOMPI_PUBLIC_KEY = 'pub_prod_XXXX';
    expect(pagos.esAmbientePruebas()).toBe(false);
    process.env.WOMPI_PUBLIC_KEY = llaves.WOMPI_PUBLIC_KEY;
  });

  test('urlBase cambia sandbox ↔ producción con la llave', () => {
    const pagos = require('./pagos');
    expect(pagos.urlBase()).toBe('https://sandbox.wompi.co/v1');
    process.env.WOMPI_PUBLIC_KEY = 'pub_prod_XXXX';
    expect(pagos.urlBase()).toBe('https://production.wompi.co/v1');
    process.env.WOMPI_PUBLIC_KEY = llaves.WOMPI_PUBLIC_KEY;
  });

  test('firmaIntegridad = SHA256(reference + centavos + moneda + secret) y coincide con el cálculo manual', () => {
    const pagos = require('./pagos');
    const firma = pagos.firmaIntegridad('JADDA-1-abc', 5800000, 'COP');
    const esperada = pagos.sha256(`JADDA-1-abc5800000COPtest_integrity_unitaria9sf7`);
    expect(firma).toBe(esperada);
    // expiración opcional se interpola antes de la llave
    const conExpira = pagos.firmaIntegridad('JADDA-1-abc', 5800000, 'COP', '2030-01-01T00:00:00.000Z');
    expect(conExpira).toBe(pagos.sha256(`JADDA-1-abc5800000COP2030-01-01T00:00:00.000Ztest_integrity_unitaria9sf7`));
  });

  test('urlCheckoutWompi arma el widget con firma y correo del cliente', () => {
    const pagos = require('./pagos');
    const url = new URL(pagos.urlCheckoutWompi({
      referencia: 'JADDA-1-abc',
      centavos: 5800000,
      moneda: 'COP',
      correo: 'cliente@ejemplo.com',
      redirectUrl: 'http://localhost:5173/compra-exitosa/1',
    }));
    expect(url.toString().startsWith('https://checkout.wompi.co/p/')).toBe(true);
    expect(url.searchParams.get('public-key')).toBe(llaves.WOMPI_PUBLIC_KEY);
    expect(url.searchParams.get('amount-in-cents')).toBe('5800000');
    expect(url.searchParams.get('currency')).toBe('COP');
    expect(url.searchParams.get('reference')).toBe('JADDA-1-abc');
    expect(url.searchParams.get('customer-email')).toBe('cliente@ejemplo.com');
    // redirect-url de localhost se OMITE: el WAF de Wompi responde 403 si un
    // parámetro contiene "localhost"/"127.0.0.1" (verificado con fetch 2026-10-26).
    expect(url.searchParams.get('redirect-url')).toBeNull();
    // La firma es el HASH PLANO: el widget manda el valor del parámetro
    // verbatim como transaction.signature y con prefijo "integrity:" la API
    // responde 422 "La firma es inválida" (provado en sandbox 2026-10-26).
    expect(String(url.searchParams.get('signature:integrity')))
      .toBe(pagos.firmaIntegridad('JADDA-1-abc', 5800000, 'COP'));
  });

  test('urlCheckoutWompi solo incluye redirect-url con https público', () => {
    const pagos = require('./pagos');
    const base = { referencia: 'R', centavos: 500000, moneda: 'COP', correo: 'c@e.com' };
    expect(new URL(pagos.urlCheckoutWompi({ ...base, redirectUrl: 'https://jaddasports.com/compra-exitosa/1' })).searchParams.get('redirect-url'))
      .toBe('https://jaddasports.com/compra-exitosa/1');
    expect(new URL(pagos.urlCheckoutWompi({ ...base, redirectUrl: 'https://localhost:5173/x' })).searchParams.get('redirect-url')).toBeNull();
    expect(new URL(pagos.urlCheckoutWompi({ ...base, redirectUrl: 'http://midominio.com/x' })).searchParams.get('redirect-url')).toBeNull();
    expect(new URL(pagos.urlCheckoutWompi({ ...base, redirectUrl: 'https://192.168.1.7/x' })).searchParams.get('redirect-url')).toBeNull();
    expect(new URL(pagos.urlCheckoutWompi({ ...base, redirectUrl: 'no-es-url' })).searchParams.get('redirect-url')).toBeNull();
    expect(new URL(pagos.urlCheckoutWompi({ ...base })).searchParams.get('redirect-url')).toBeNull();
    expect(pagos.esUrlPublicaHttps('https://www.jaddasports.com/a')).toBe(true);
    expect(pagos.esUrlPublicaHttps('https://127.0.0.1/a')).toBe(false);
  });

  test('urlCheckoutWompi prefill del pagador (customer-data) y del envío (shipping-address)', () => {
    const pagos = require('./pagos');
    const url = new URL(pagos.urlCheckoutWompi({
      referencia: 'JADDA-9-xyz',
      centavos: 500000,
      moneda: 'COP',
      correo: 'comprador@ejemplo.com',
      nombrePagador: '  Andres  Felipe   Perez ',
      telefonoPagador: '300 111 2233',
      direccionEnvio: {
        linea1: 'Cra 1 # 2 - 03',
        linea2: 'Centro',
        ciudad: '  Bogotá ',
        region: ' Cundinamarca ',
        postal: '110111',
        telefono: '3204445566',
      },
    }));
    expect(url.searchParams.get('customer-data:email')).toBe('comprador@ejemplo.com');
    expect(url.searchParams.get('customer-data:full-name')).toBe('Andres Felipe Perez');
    expect(url.searchParams.get('customer-data:phone-number')).toBe('3001112233');
    expect(url.searchParams.get('customer-data:phone-number-prefix')).toBe('+57');
    expect(url.searchParams.get('shipping-address:address-line-1')).toBe('Cra 1 # 2 - 03');
    expect(url.searchParams.get('shipping-address:address-line-2')).toBe('Centro');
    expect(url.searchParams.get('shipping-address:country')).toBe('CO');
    expect(url.searchParams.get('shipping-address:city')).toBe('Bogotá');
    expect(url.searchParams.get('shipping-address:region')).toBe('Cundinamarca');
    expect(url.searchParams.get('shipping-address:postal-code')).toBe('110111');
    expect(url.searchParams.get('shipping-address:name')).toBe('Andres Felipe Perez');
    expect(url.searchParams.get('shipping-address:phone-number')).toBe('3204445566');
  });

  test('urlCheckoutWompi omite customer-data/shipping-address vacíos o incompletos', () => {
    const pagos = require('./pagos');
    const base = { referencia: 'R', centavos: 500000, moneda: 'COP', correo: 'c@e.com' };
    const minimo = new URL(pagos.urlCheckoutWompi({ ...base }));
    expect(minimo.searchParams.get('customer-data:full-name')).toBeNull();
    expect(minimo.searchParams.get('customer-data:phone-number')).toBeNull();
    // el correo va SIEMPRE que exista (base trae c@e.com)
    expect(minimo.searchParams.get('customer-data:email')).toBe('c@e.com');
    expect(minimo.searchParams.get('shipping-address:address-line-1')).toBeNull();
    // falta el teléfono del envío → el bloque completo se omite
    const incompleto = new URL(pagos.urlCheckoutWompi({
      ...base,
      direccionEnvio: { linea1: 'Cra 1', ciudad: 'Bogotá', region: 'Cundinamarca', telefono: '' },
    }));
    expect(incompleto.searchParams.get('shipping-address:address-line-1')).toBeNull();
    expect(incompleto.searchParams.get('shipping-address:city')).toBeNull();
  });

  test('compararSegura es insensible a mayúsculas y rechaza largos distintos', () => {
    const pagos = require('./pagos');
    expect(pagos.compararSegura('AB12', 'ab12')).toBe(true);
    expect(pagos.compararSegura('AB12', 'AB123')).toBe(false);
    expect(pagos.compararSegura('', '')).toBe(false);
  });

  describe('verificarEventosWompi (checksum del webhook)', () => {
    const pagos = require('./pagos');
    const construccionEvento = (transaccion, props, secret) => {
      const crypto = require('crypto');
      const evento = { event: 'transaction.updated', data: { transaction: transaccion } };
      const timestamp = 1750000000;
      // Espejo de la resolución del backend: rutas "data.*" se leen del cuerpo
      // completo; las relativas ("transaction.*"), del objeto data.
      const valores = props.map((ruta) => {
        let v = ruta.startsWith('data.') ? evento : evento.data;
        for (const p of ruta.split('.')) v = v?.[p];
        return String(v ?? '');
      });
      evento.signature = {
        properties: props,
        timestamp,
        checksum: crypto.createHash('sha256')
          .update(`${valores.join('')}${timestamp}${secret ?? llaves.WOMPI_EVENTS_SECRET}`, 'utf8')
          .digest('hex')
          .toUpperCase(),
      };
      return evento;
    };
    const tx = {
      id: '12235670-1-1',
      status: 'APPROVED',
      reference: 'JADDA-1-abc',
      amount_in_cents: 5800000,
      currency: 'COP',
      created_at: '2026-10-24T17:00:00.000Z',
    };

    test('propiedades relativas a data (convención Wompi real) pasan', () => {
      const evento = construccionEvento(tx, ['transaction.amount_in_cents', 'transaction.status', 'transaction.currency']);
      expect(pagos.verificarEventosWompi(evento)).toBe(true);
    });

    test('propiedades completas (data.transaction.*) también pasan', () => {
      const evento = construccionEvento(tx, ['data.transaction.id', 'data.transaction.status']);
      expect(pagos.verificarEventosWompi(evento)).toBe(true);
    });

    test('checksum adulterado → false', () => {
      const evento = construccionEvento(tx, ['transaction.status']);
      evento.signature.checksum = 'F'.repeat(64);
      expect(pagos.verificarEventosWompi(evento)).toBe(false);
    });

    test('cuerpo sin data o sin propiedades → false (sin lanzar)', () => {
      expect(pagos.verificarEventosWompi({ event: 'x' })).toBe(false);
      expect(pagos.verificarEventosWompi({ event: 'x', data: { transaction: tx }, signature: { properties: [] } })).toBe(false);
    });

    test('los valores ausentes se cuentan como "" (no "undefined"/"null")', () => {
      const evento = construccionEvento({ ...tx, amount_in_cents: undefined }, ['transaction.amount_in_cents']);
      expect(pagos.verificarEventosWompi(evento)).toBe(true);
      const falso = pagos.sha256(`undefined1750000000${llaves.WOMPI_EVENTS_SECRET}`).toUpperCase();
      evento.signature.checksum = falso;
      expect(pagos.verificarEventosWompi(evento)).toBe(false);
    });
  });
});

describe('validarPasarelaProduccion — arranque en producción (cierre-produccion)', () => {
  const pagos = require('./pagos');
  const claveGateway = 'PAYMENT_' + 'GATEWAY'; // se construye para escribir el nombre exacto
  const llavesWompi = ['WOMPI_PUBLIC_KEY', 'WOMPI_PRIVATE_KEY', 'WOMPI_INTEGRITY_KEY', 'WOMPI_EVENTS_SECRET'];

  const originales = {};
  beforeAll(() => {
    for (const k of [claveGateway, ...llavesWompi]) originales[k] = process.env[k];
    delete process.env.ALLOW_SIMULATED_PAYMENTS;
  });
  afterAll(() => {
    for (const k of [claveGateway, ...llavesWompi]) {
      if (originales[k] === undefined) delete process.env[k];
      else process.env[k] = originales[k];
    }
    delete process.env.ALLOW_SIMULATED_PAYMENTS;
  });

  test('desarrollo no bloquea ni avisa (cero impacto en dev/tests)', () => {
    process.env[claveGateway] = '';
    expect(pagos.validarPasarelaProduccion({ NODE_ENV: 'development' })).toEqual({ ok: true });
    expect(pagos.validarPasarelaProduccion({ NODE_ENV: 'test' })).toEqual({ ok: true });
  });

  test('producción sin pasarela → bloquea con mensaje de llaves', () => {
    process.env[claveGateway] = '';
    const r = pagos.validarPasarelaProduccion({ NODE_ENV: 'production' });
    expect(r.ok).toBe(false);
    expect(r.fatal).toContain('la pasarela es obligatoria');
    expect(r.fatal).toContain('WOMPI_PUBLIC_KEY');
  });

  test('producción sin pasarela + escape explícito → ok con aviso fuerte de simulados', () => {
    process.env[claveGateway] = '';
    const r = pagos.validarPasarelaProduccion({ NODE_ENV: 'production', ALLOW_SIMULATED_PAYMENTS: 'true' });
    expect(r.ok).toBe(true);
    expect(r.aviso).toContain('PAGOS SIMULADOS EN PRODUCCIÓN');
    expect(r.aviso).toContain('ALLOW_SIMULATED_PAYMENTS=true');
  });

  test('producción con wompi pero llave faltante → bloquea indicando cuál', () => {
    process.env[claveGateway] = 'wompi';
    for (const k of llavesWompi) process.env[k] = 'pub_test_x';
    delete process.env.WOMPI_INTEGRITY_KEY;
    const r = pagos.validarPasarelaProduccion({ NODE_ENV: 'production' });
    expect(r.ok).toBe(false);
    expect(r.fatal).toContain('WOMPI_INTEGRITY_KEY');
    process.env.WOMPI_INTEGRITY_KEY = 'pub_test_x';
  });

  test('producción con wompi + llaves de sandbox (pub_test_) → ok con aviso, sin bloqueo', () => {
    process.env[claveGateway] = 'wompi';
    for (const k of llavesWompi) process.env[k] = `${k.startsWith('WOMPI_P') ? 'pub_test_' : 'test_'}sandbox_aviso`;
    const r = pagos.validarPasarelaProduccion({ NODE_ENV: 'production' });
    expect(r.ok).toBe(true);
    expect(r.aviso).toContain('pub_test_');
    expect(r.aviso).toContain('DINERO DE PRUEBA');
  });

  test('producción con wompi + llaves de producción → ok limpio (sin aviso)', () => {
    process.env[claveGateway] = 'wompi';
    process.env.WOMPI_PUBLIC_KEY = 'pub_prod_JADDAKEY';
    process.env.WOMPI_PRIVATE_KEY = 'prv_prod_JADDAKEY';
    process.env.WOMPI_INTEGRITY_KEY = 'prod_integrity_key';
    process.env.WOMPI_EVENTS_SECRET = 'prod_events_secret';
    const r = pagos.validarPasarelaProduccion({ NODE_ENV: 'production' });
    expect(r).toEqual({ ok: true });
  });
});

describe('simulación de pagos sandbox (PAGOS v8 — cobro con cualquier Tarjeta en la app)', () => {
  const requireFresh = () => {
    const resuelto = require.resolve('./pagos');
    delete require.cache[resuelto];
    return require('./pagos');
  };

  afterAll(() => {
    delete process.env.PAGOS_SIMULACION_SEGUNDOS;
    requireFresh();
  });

  test('esVentaSimulada reconoce solo el prefijo SIMW- (SIM_ del checkout no cuenta)', () => {
    const pagos = require('./pagos');
    expect(pagos.esVentaSimulada('SIMW-125-mev3k2-a1b2')).toBe(true);
    expect(pagos.esVentaSimulada('  SIMW-1-x ')).toBe(true);
    expect(pagos.esVentaSimulada('JADDA-125-abc')).toBe(false);
    expect(pagos.esVentaSimulada('SIM_1759000000_1')).toBe(false);
    expect(pagos.esVentaSimulada('')).toBe(false);
    expect(pagos.esVentaSimulada(null)).toBe(false);
  });

  test('nuevaReferenciaSimulada crea SIMW-<id>-<momento><4hex> y diferencia llamadas', () => {
    const pagos = require('./pagos');
    const ref = pagos.nuevaReferenciaSimulada(125);
    expect(ref.startsWith('SIMW-125-')).toBe(true);
    expect(pagos.esVentaSimulada(ref)).toBe(true);
    expect(pagos.fechaSimulacionDeReferencia(ref)).toBeInstanceOf(Date);
    // dos llamadas seguidas (retry de simulación) generan referencias distintas
    const otra = pagos.nuevaReferenciaSimulada(125);
    expect(otra).not.toBe(ref);
    // el parseo marca como fecha la de la llamada (± 1,5 s)
    const marca = pagos.fechaSimulacionDeReferencia(ref);
    expect(Math.abs(Date.now() - marca.getTime())).toBeLessThanOrEqual(1500);
  });

  test('fechaSimulacionDeReferencia rechaza sim ref malformada o con marca inválida', () => {
    const pagos = require('./pagos');
    expect(pagos.fechaSimulacionDeReferencia('SIMW-125-abc')).toBe(null); // segmento corto
    expect(pagos.fechaSimulacionDeReferencia('JADDA-1-abc')).toBe(null); // no simulada
    expect(pagos.fechaSimulacionDeReferencia('SIMW-125-xy')).toBe(null); // marca vacía
    expect(pagos.fechaSimulacionDeReferencia('SIMW-125-zzzz0000')).toBe(null); // marca.zul
  });

  test('resultadoSimulacion: cualquier Tarjeta aprueba, la terminada en 1111 se rechaza', () => {
    const pagos = require('./pagos');
    expect(pagos.resultadoSimulacion('4242 4242 4242 4242')).toBe('APPROVED');
    expect(pagos.resultadoSimulacion('4242424242424242')).toBe('APPROVED');
    expect(pagos.resultadoSimulacion('5555 4444 3333 2222')).toBe('APPROVED');
    expect(pagos.resultadoSimulacion('4111 1111 1111 1111')).toBe('DECLINED');
    expect(pagos.resultadoSimulacion('4000 1111')).toBe('DECLINED');
    expect(pagos.resultadoSimulacion('')).toBe('APPROVED'); // sin dígitos no termina en 1111 (el endpoint exige 13-19)
  });

  test('marcaTarjeta infiere VISA/MASTER/AMEX/DISCOVER y vacío para desconocidas', () => {
    const pagos = require('./pagos');
    expect(pagos.marcaTarjeta('4242 4242 4242 4242')).toBe('VISA');
    expect(pagos.marcaTarjeta('5111 1111 1111 1111')).toBe('MASTERCARD');
    expect(pagos.marcaTarjeta('2221 0000 0000 0000')).toBe('MASTERCARD');
    expect(pagos.marcaTarjeta('3782 822463 10005')).toBe('AMEX');
    expect(pagos.marcaTarjeta('6011 1111 1111 1117')).toBe('DISCOVER');
    expect(pagos.marcaTarjeta('9000 0000 0000 0000')).toBe('');
    expect(pagos.marcaTarjeta('')).toBe('');
  });

  test('vencimientoValido solo acepta MM/AA o MM/AAAA futuros', () => {
    const pagos = require('./pagos');
    const ahora = new Date('2026-10-27T12:00:00');
    expect(pagos.vencimientoValido('12/30', ahora)).toBe(true);
    expect(pagos.vencimientoValido('12/2030', ahora)).toBe(true);
    expect(pagos.vencimientoValido('1/2030', ahora)).toBe(true);
    expect(pagos.vencimientoValido('10/2026', ahora)).toBe(true); // el mes de "ahora" completo cuenta

    expect(pagos.vencimientoValido('09/2026', ahora)).toBe(false); // septiembre ya pasó
    expect(pagos.vencimientoValido('13/2030', ahora)).toBe(false);
    expect(pagos.vencimientoValido('00/2030', ahora)).toBe(false);
    expect(pagos.vencimientoValido('12/2026', ahora)).toBe(true); // diciembre 2026 aún no llega → futuro
    expect(pagos.vencimientoValido('12/99', ahora)).toBe(true); // 12/99 → año 2099 (futuro): válido
    expect(pagos.vencimientoValido('12/29', ahora)).toBe(true);
    expect(pagos.vencimientoValido('abcd', ahora)).toBe(false);
    expect(pagos.vencimientoValido('', ahora)).toBe(false);
  });

  test('SEGUNDOS_SIMULACION: default 6 y configurable (clamp 1..60)', () => {
    delete process.env.PAGOS_SIMULACION_SEGUNDOS;
    expect(requireFresh().SEGUNDOS_SIMULACION).toBe(6);
    process.env.PAGOS_SIMULACION_SEGUNDOS = '3';
    expect(requireFresh().SEGUNDOS_SIMULACION).toBe(3);
    process.env.PAGOS_SIMULACION_SEGUNDOS = '0';
    expect(requireFresh().SEGUNDOS_SIMULACION).toBe(1);
    process.env.PAGOS_SIMULACION_SEGUNDOS = '999';
    expect(requireFresh().SEGUNDOS_SIMULACION).toBe(60);
    process.env.PAGOS_SIMULACION_SEGUNDOS = 'abc';
    expect(requireFresh().SEGUNDOS_SIMULACION).toBe(6);
  });
});

describe('ventana de expiración de pagos (antes 48 h → ahora minutos)', () => {
  const requireFresh = () => {
    const resuelto = require.resolve('./pagos');
    delete require.cache[resuelto];
    return require('./pagos');
  };

  afterAll(() => {
    delete process.env.PAGOS_EXPIRA_MINUTOS;
    requireFresh();
  });

  test('default = 10 minutos sin env', () => {
    delete process.env.PAGOS_EXPIRA_MINUTOS;
    const pagos = requireFresh();
    expect(pagos.MINUTOS_EXPIRACION).toBe(10);
  });

  test('PAGOS_EXPIRA_MINUTOS configura la ventana', () => {
    process.env.PAGOS_EXPIRA_MINUTOS = '5';
    expect(requireFresh().MINUTOS_EXPIRACION).toBe(5);
  });

  test('valores inválidos o pequeños se corrigen (abc→10, 0→1, 2.4→2)', () => {
    process.env.PAGOS_EXPIRA_MINUTOS = 'abc';
    expect(requireFresh().MINUTOS_EXPIRACION).toBe(10);
    process.env.PAGOS_EXPIRA_MINUTOS = '0';
    expect(requireFresh().MINUTOS_EXPIRACION).toBe(1);
    process.env.PAGOS_EXPIRA_MINUTOS = '2.4';
    expect(requireFresh().MINUTOS_EXPIRACION).toBe(2);
  });

  test('pagoVencido: FECHA_EXPIRA_PAGO manda, si es NULL usa FECHA_VENTA, NULL total → false', () => {
    process.env.PAGOS_EXPIRA_MINUTOS = '10';
    const pagos = requireFresh();
    const ahora = new Date('2026-10-26T12:00:00');
    // con ventana viva (nace ahora - 4 min) → no vencida
    expect(pagos.pagoVencido(new Date(ahora.getTime() - 4 * 60000), new Date('2020-01-01'), ahora)).toBe(false);
    // ventana vencida hace 1 min → vencida
    expect(pagos.pagoVencido(new Date(ahora.getTime() - 11 * 60000), new Date('2020-01-01'), ahora)).toBe(true);
    // justo al completar el plazo cuenta como vencida
    expect(pagos.pagoVencido(new Date(ahora.getTime() - 10 * 60000), new Date('2020-01-01'), ahora)).toBe(true);
    // legacy sin columna: se usa FECHA_VENTA (+10 min)
    expect(pagos.pagoVencido(null, new Date(ahora.getTime() - 9 * 60000), ahora)).toBe(false);
    expect(pagos.pagoVencido(null, new Date(ahora.getTime() - 11 * 60000), ahora)).toBe(true);
    // sin ninguna fecha → false (no expira)
    expect(pagos.pagoVencido(null, null, ahora)).toBe(false);
  });
});
