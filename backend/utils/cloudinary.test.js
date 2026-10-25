const { avisoCloudinarySiFalta } = require('./cloudinary');

const URL_PRUEBA = 'cloudinary://clave:test@nube-demo';

describe('avisoCloudinarySiFalta (cierre-produccion-2, punto 3)', () => {
  let urlOriginal;
  let clavesOriginales;

  beforeEach(() => {
    urlOriginal = process.env.CLOUDINARY_URL;
    clavesOriginales = {
      name: process.env.CLOUDINARY_CLOUD_NAME,
      key: process.env.CLOUDINARY_API_KEY,
      secret: process.env.CLOUDINARY_API_SECRET,
    };
    delete process.env.CLOUDINARY_URL;
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  afterEach(() => {
    if (urlOriginal === undefined) delete process.env.CLOUDINARY_URL;
    else process.env.CLOUDINARY_URL = urlOriginal;
    if (clavesOriginales.name === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = clavesOriginales.name;
    if (clavesOriginales.key === undefined) delete process.env.CLOUDINARY_API_KEY;
    else process.env.CLOUDINARY_API_KEY = clavesOriginales.key;
    if (clavesOriginales.secret === undefined) delete process.env.CLOUDINARY_API_SECRET;
    else process.env.CLOUDINARY_API_SECRET = clavesOriginales.secret;
  });

  it('en producción sin credenciales devuelve un aviso fuerte (no bloquea el arranque)', () => {
    const aviso = avisoCloudinarySiFalta(true);
    expect(typeof aviso).toBe('string');
    expect(aviso).toMatch(/CLOUDINARY NO ESTÁ CONFIGURADO EN PRODUCCIÓN/);
    expect(aviso).toMatch(/backup\.ps1/);
    expect(aviso).toMatch(/frontend\/public\/images/);
  });

  it('en producción CON credenciales (CLOUDINARY_URL) no avisa', () => {
    process.env.CLOUDINARY_URL = URL_PRUEBA;
    expect(avisoCloudinarySiFalta(true)).toBeNull();
  });

  it('en producción CON credenciales desglosadas (clname/apiKey/secret) no avisa', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'nube-demo';
    process.env.CLOUDINARY_API_KEY = 'clave';
    process.env.CLOUDINARY_API_SECRET = 'test';
    expect(avisoCloudinarySiFalta(true)).toBeNull();
  });

  it('fuera de producción no avisa aunque no haya credenciales', () => {
    expect(avisoCloudinarySiFalta(false)).toBeNull();
  });
});
