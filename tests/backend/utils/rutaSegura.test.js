import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { rutaSegura } from '../../../backend/utils/rutaSegura.js';

// Se usa path.resolve para que las aserciones sean portables (Windows/Linux):
// lo que importa es la RELACIÓN entre base y ruta pedida, no el prefijo.
const base = path.resolve('/app/uploads/perfiles');

describe('rutaSegura - contención de rutas', () => {
  it('acepta una ruta relativa simple dentro de la base', () => {
    expect(rutaSegura(base, 'perfil/perfil.png')).toBe(path.resolve(base, 'perfil/perfil.png'));
  });

  it('acepta rutas anidadas profundas legítimas', () => {
    expect(rutaSegura(base, 'u1/perfil/2026/foto.jpg')).toBe(
      path.resolve(base, 'u1/perfil/2026/foto.jpg')
    );
  });

  it('acepta una ruta absoluta que ya está dentro de la base', () => {
    // Forma absoluta con separadores "/" (así guardan las URLs en BD):
    // path.resolve produce backslashes en Windows y rutaSegura rechaza
    // backslashes por diseño, así que el input se construye con "/".
    const dentro = base.split(path.sep).join('/') + '/perfil/perfil.png';
    expect(rutaSegura(base, dentro)).toBe(path.resolve(base, 'perfil/perfil.png'));
  });

  it('rechaza traversal directo con ../', () => {
    expect(rutaSegura(base, '../secreto.txt')).toBeNull();
  });

  it('rechaza traversal anidado que se escapa (a/../../x)', () => {
    expect(rutaSegura(base, 'a/../../etc/passwd')).toBeNull();
  });

  it('rechaza una ruta absoluta ajena a la base', () => {
    expect(rutaSegura(base, path.resolve('/etc/passwd'))).toBeNull();
  });

  it('rechaza backslashes (separador de Windows / traversal oculto)', () => {
    expect(rutaSegura(base, '..\\..\\secreto.txt')).toBeNull();
    expect(rutaSegura(base, 'a\\b.png')).toBeNull();
  });

  it('rechaza rutas que resuelven a la propia base (directorio, no archivo)', () => {
    expect(rutaSegura(base, '.')).toBeNull();
    expect(rutaSegura(base, 'a/..')).toBeNull();
  });

  it('rechaza cadena vacía y valores no string', () => {
    expect(rutaSegura(base, '')).toBeNull();
    expect(rutaSegura(base, null)).toBeNull();
    expect(rutaSegura(base, undefined)).toBeNull();
    expect(rutaSegura(base, 123)).toBeNull();
  });
});
