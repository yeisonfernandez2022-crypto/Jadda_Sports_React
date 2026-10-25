/**
 * P6 — Firma real por magic bytes en las subidas de evidencias.
 *
 * El mimetype declarado por el cliente puede mentir; tras multer (que guarda
 * en disco) se leen los primeros 512 bytes del archivo y se exige que la
 * firma real coincida con el tipo declarado (MP4/WEBM/MOV añadidos a
 * formatoImagen.js) o se poda la petición completa con 400.
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const { detectarFormato } = require('../../utils/formatoImagen');
const { verificarContenidosReales } = require('../../utils/validarSubida');

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 7, 7, 7]);
const WEBM = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 9, 9]);
const MP4 = Buffer.concat([Buffer.from('XXXX', 'ascii'), Buffer.from('ftypisom', 'ascii'), Buffer.from('0006', 'ascii')]);
const MOV = Buffer.concat([Buffer.from('XXXX', 'ascii'), Buffer.from('ftypqt  ', 'ascii'), Buffer.from('0005', 'ascii')]);

describe('detectarFormato — firmas de imagen y video', () => {
  it('reconoce los formatos de imagen que ya se admitían', () => {
    expect(detectarFormato(PNG).mime).toBe('image/png');
    expect(detectarFormato(JPG).mime).toBe('image/jpeg');
  });

  it('reconoce los formatos de video por magic bytes', () => {
    expect(detectarFormato(WEBM).mime).toBe('video/webm');
    expect(detectarFormato(MP4).mime).toBe('video/mp4');
    expect(detectarFormato(MOV).mime).toBe('video/quicktime');
  });

  it('devuelve null con contenido desconocido (p. ej. un spider renombrado)', () => {
    expect(detectarFormato(Buffer.from('<!DOCTYPE html><html>'))).toBe(null);
    expect(detectarFormato(Buffer.alloc(0))).toBe(null);
  });
});

describe('verificarContenidosReales — después de multer', () => {
  let tmpDir;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evid-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  const reqCon = (archivos) => ({ files: archivos });
  const resFalsa = () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn((cuerpo) => cuerpo) };
    return res;
  };

  it('sin archivos pasa directo', async () => {
    const next = vi.fn();
    await verificarContenidosReales(reqCon([]), resFalsa(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('acepta evidencias cuyo contenido coincide con su mimetype declarado', async () => {
    const p1 = path.join(tmpDir, 'a.mp4');
    const p2 = path.join(tmpDir, 'b.png');
    fs.writeFileSync(p1, MP4);
    fs.writeFileSync(p2, PNG);
    const next = vi.fn();
    await verificarContenidosReales(reqCon([
      { path: p1, mimetype: 'video/mp4' },
      { path: p2, mimetype: 'image/png' },
    ]), resFalsa(), next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(p1) && fs.existsSync(p2)).toBe(true);
  });

  it('rechaza y poda TODOS los archivos si alguno miente su tipo', async () => {
    const mentiroso = path.join(tmpDir, 'video.mp4');
    const buenFile = path.join(tmpDir, 'foto.jpg');
    fs.writeFileSync(mentiroso, PNG); // bytes de PNG con mimetype video/mp4
    fs.writeFileSync(buenFile, JPG);
    const res = resFalsa();
    const next = vi.fn();
    await verificarContenidosReales(reqCon([
      { path: mentiroso, mimetype: 'video/mp4' },
      { path: buenFile, mimetype: 'image/jpeg' },
    ]), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].msg).toMatch(/no corresponde a su tipo declarado/);
    expect(next).not.toHaveBeenCalled();
    expect(fs.existsSync(mentiroso)).toBe(false);
    expect(fs.existsSync(buenFile)).toBe(false);
  });

  it('también acepta MOV de iPhone (ftyp + marca qt) declarado como quicktime', async () => {
    const p = path.join(tmpDir, 'c.mov');
    fs.writeFileSync(p, MOV);
    const next = vi.fn();
    await verificarContenidosReales(reqCon([{ path: p, mimetype: 'video/quicktime' }]), resFalsa(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('no revienta con req.file (subidas de archivo único)', async () => {
    const p = path.join(tmpDir, 'd.webm');
    fs.writeFileSync(p, WEBM);
    const next = vi.fn();
    await verificarContenidosReales({ files: [], file: { path: p, mimetype: 'video/webm' } }, resFalsa(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
