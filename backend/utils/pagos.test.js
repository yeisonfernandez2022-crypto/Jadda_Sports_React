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
    expect(url.searchParams.get('redirect-url')).toBe('http://localhost:5173/compra-exitosa/1');
    const [nombre, valor] = String(url.searchParams.get('signature:integrity')).split(':');
    expect(nombre).toBe('integrity');
    expect(valor).toBe(pagos.firmaIntegridad('JADDA-1-abc', 5800000, 'COP'));
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
