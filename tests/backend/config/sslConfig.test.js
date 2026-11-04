/*
 * Pruebas del helper TLS de la BD (config/sslConfig.js) — entregable S04.
 * Cobertura: DB_SSL falso → null; sin CA → cifrado sin validación + aviso;
 * con CA (multilínea o \n literales) → cadena validada; escape hatch
 * DB_SSL_REJECT_UNAUTHORIZED.
 */
import { describe, test, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { construirOpcionesSsl, pemAReal } = require('../../../backend/config/sslConfig');

const PEM_REAL = [
  '-----BEGIN CERTIFICATE-----',
  'MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiyAwDQYJKoZIhvcNAQELBQAw',
  '-----END CERTIFICATE-----'
].join('\n');

describe('construirOpcionesSsl', () => {
  it('sin DB_SSL (o distinto de "true") devuelve null', () => {
    expect(construirOpcionesSsl({})).toBeNull();
    expect(construirOpcionesSsl({ DB_SSL: 'false' })).toBeNull();
    expect(construirOpcionesSsl({ DB_SSL: '1' })).toBeNull();
  });

  it('acepta "true" con espacios sobrantes (valores pegados desde UI)', () => {
    expect(construirOpcionesSsl({ DB_SSL: ' true ' })).not.toBeNull();
  });

  it('DB_SSL=true sin CA: cifra sin validar cadena y marca sinCa', () => {
    const r = construirOpcionesSsl({ DB_SSL: 'true' });
    expect(r).not.toBeNull();
    expect(r.sinCa).toBe(true);
    expect(r.ssl.minVersion).toBe('TLSv1.2');
    expect(r.ssl.rejectUnauthorized).toBe(false);
    expect(r.ssl.ca).toBeUndefined();
  });

  it('DB_SSL=true sin CA + DB_SSL_REJECT_UNAUTHORIZED=true obliga a validar', () => {
    const r = construirOpcionesSsl({ DB_SSL: 'true', DB_SSL_REJECT_UNAUTHORIZED: 'true' });
    expect(r.sinCa).toBe(true);
    expect(r.ssl.rejectUnauthorized).toBe(true);
  });

  it('DB_SSL=true con CA multilínea: valida cadena y repite el PEM', () => {
    const r = construirOpcionesSsl({ DB_SSL: 'true', DB_SSL_CA: PEM_REAL });
    expect(r.sinCa).toBe(false);
    expect(r.ssl.ca).toBe(PEM_REAL);
    expect(r.ssl.rejectUnauthorized).toBe(true);
  });

  it('CA en una línea con \\n literales se normaliza a saltos reales', () => {
    const r = construirOpcionesSsl({ DB_SSL: 'true', DB_SSL_CA: PEM_REAL.replace(/\n/g, '\\n') });
    expect(r.sinCa).toBe(false);
    expect(r.ssl.ca).toBe(PEM_REAL);
  });

  it('escape hatch: CA presente + DB_SSL_REJECT_UNAUTHORIZED=false desactiva la validación', () => {
    const r = construirOpcionesSsl({ DB_SSL: 'true', DB_SSL_CA: PEM_REAL, DB_SSL_REJECT_UNAUTHORIZED: 'false' });
    expect(r.sinCa).toBe(false);
    expect(r.ssl.rejectUnauthorized).toBe(false);
  });

  it('pemAReal deja intacto un PEM con saltos reales y normaliza el de una línea', () => {
    expect(pemAReal(PEM_REAL)).toBe(PEM_REAL);
    expect(pemAReal('a\\nb\\r\\nc')).toBe('a\nb\nc');
  });
});
