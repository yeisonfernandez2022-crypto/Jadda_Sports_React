/**
 * P5 — IP real (req.ip + net.isIP) y geolocalización de la última conexión.
 *
 * ipDe ya NO confía en headers forjados por el cliente (x-forwarded-for se
 * resuelve dentro de Express según trust proxy y llega por req.ip).
 * La geolocalización es opt-in (GEOLOCALIZAR_IP=true) y va por HTTPS.
 */
const SUT = require('../../controllers/authController');

const UPDATE_CONEXION =
  "UPDATE USUARIOS SET ULTIMA_CONEXION = NOW(), ULTIMA_IP = ?, ULTIMA_UBICACION = ? WHERE ID_USUARIO = ?";

describe('ipDe — IP real con validación net.isIP', () => {
  it('usa req.ip (Express ya aplicó trust proxy) y normaliza ::ffff:', () => {
    expect(SUT.ipDe({ ip: '::ffff:203.0.113.10' })).toBe('203.0.113.10');
    expect(SUT.ipDe({ ip: '203.0.113.10' })).toBe('203.0.113.10');
    expect(SUT.ipDe({ ip: '::1' })).toBe('::1');
  });

  it('si req.ip no es una IP válida devuelve null (nada de basura a la BD)', () => {
    expect(SUT.ipDe({ ip: '203.0.113.10, 10.0.0.2' })).toBe(null);
    expect(SUT.ipDe({ ip: 'no-soy-una-ip' })).toBe(null);
    expect(SUT.ipDe({ ip: '' })).toBe(null);
  });

  it('respaldo en socket.remoteAddress cuando se invoca fuera de Express (tests)', () => {
    expect(SUT.ipDe({ socket: { remoteAddress: '::ffff:203.0.113.7' } })).toBe('203.0.113.7');
    expect(SUT.ipDe({ ip: '::ffff:203.0.113.7', socket: { remoteAddress: 'otra' } })).toBe('203.0.113.7');
  });
});

describe('registrarConexion — geolocalización opt-in (HTTPS)', () => {
  let consulta;
  beforeEach(() => {
    consulta = vi.fn().mockResolvedValue([{}]);
    SUT._useDb({ query: consulta });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.GEOLOCALIZAR_IP;
  });

  it('flag desactivada (default): NO consulta terceros, guarda fecha + IP', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await SUT.registrarConexion(1, '203.0.113.50');
    expect(fetch).not.toHaveBeenCalled();
    expect(consulta).toHaveBeenCalledWith(UPDATE_CONEXION, ['203.0.113.50', null, 1]);
  });

  it('flag activa + IP PRIVADA: por más que la flag exista, no se geolocaliza', async () => {
    process.env.GEOLOCALIZAR_IP = 'true';
    vi.stubGlobal('fetch', vi.fn());
    for (const ip of ['192.168.1.56', '10.20.30.40', '172.20.0.5', '::1']) {
      await SUT.registrarConexion(1, ip);
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(consulta).toHaveBeenCalledWith(UPDATE_CONEXION, ['::1', null, 1]);
  });

  it('flag activa + IP pública: consulta HTTPS ipwho.is y guarda la ubicación compuesta', async () => {
    process.env.GEOLOCALIZAR_IP = 'true';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ success: true, city: 'Bogotá', region: 'Cundinamarca', country: 'Colombia' }),
    }));
    await SUT.registrarConexion(9, '203.0.113.20');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('https://ipwho.is/203.0.113.20', expect.objectContaining({ signal: expect.anything() }));
    expect(consulta).toHaveBeenCalledWith(UPDATE_CONEXION, ['203.0.113.20', 'Bogotá, Cundinamarca, Colombia', 9]);
  });

  it('respuesta sin success=true → sin ubicación, no revienta', async () => {
    process.env.GEOLOCALIZAR_IP = 'true';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: async () => ({ success: false, message: 'limit' }),
    }));
    await SUT.registrarConexion(9, '203.0.113.20');
    expect(consulta).toHaveBeenCalledWith(UPDATE_CONEXION, ['203.0.113.20', null, 9]);
  });

  it('si el servicio de geo rechaza, la conexión queda registrada igual (nunca bloquea el login)', async () => {
    process.env.GEOLOCALIZAR_IP = 'true';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red caída')));
    await SUT.registrarConexion(9, '203.0.113.20');
    expect(consulta).toHaveBeenCalledWith(UPDATE_CONEXION, ['203.0.113.20', null, 9]);
  });
});
