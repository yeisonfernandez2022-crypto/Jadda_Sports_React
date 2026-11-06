import { test, expect } from '@playwright/test';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

const BASE_API = process.env.API_URL || 'http://localhost:5000';
const BASE_WEB = process.env.WEB_URL || 'http://localhost:5173';

// Credenciales SOLO por entorno (no hay valores por defecto en el código):
// CI las define; en local, copia tests/.env.example a tests/.env — la config
// de Playwright lo carga si existe.
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASS || !process.env.VENDOR_EMAIL || !process.env.VENDOR_PASS) {
  throw new Error(
    'Faltan credenciales para el suite E2E: define ADMIN_EMAIL, ADMIN_PASS, ' +
      'VENDOR_EMAIL y VENDOR_PASS en el entorno o en tests/.env (copia de tests/.env.example).'
  );
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASS = process.env.ADMIN_PASS;
const VENDOR_EMAIL = process.env.VENDOR_EMAIL;
const VENDOR_PASS = process.env.VENDOR_PASS;

interface TestClient {
  cookie: string;
  req(method: string, path: string, body?: any): Promise<{ status: number; data: any }>;
}

function createClient(): TestClient {
  let cookie = '';
  return {
    get cookie() { return cookie; },
    async req(method: string, path: string, body?: any) {
      const res = await fetch(BASE_API + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'manual',
      });
      const setCookie = res.headers.get('set-cookie');
      if (setCookie) cookie = setCookie.split(';')[0];
      let data = null;
      try { data = await res.json(); } catch { /* no json */ }
      return { status: res.status, data };
    },
  };
}

async function loginRobusto(client: TestClient, email: string, password: string, intentos = 3): Promise<boolean> {
  for (let i = 0; i < intentos; i++) {
    const r = await client.req('POST', '/api/auth/login', { email, password });
    if (r.status === 200) return true;
    const limitado = r.status === 429 || (r.status === 401 && /demasiados|intenta|m.s tarde/i.test(JSON.stringify(r.data)));
    if (!limitado || i === intentos - 1) return false;
    console.log(`    ⏳ login limitado, esperando 20s (${i + 1}/${intentos - 1})…`);
    await new Promise(r => setTimeout(r, 20000));
  }
  return false;
}

async function primeraVarianteDe(idProducto: number): Promise<number | null> {
  const r = await fetch(`${BASE_API}/api/productos/${idProducto}/variantes`);
  if (!r.ok) return null;
  const lista = await r.json();
  return Array.isArray(lista) && lista.length ? lista[0].ID_VARIANTE : null;
}

async function ventaConProductoDeVendedor(admin: TestClient): Promise<any> {
  const compras = await admin.req('GET', '/api/admin/compras');
  const lista = Array.isArray(compras.data) ? compras.data : [];
  return lista.find((c: any) => c.ES_DE_VENDEDOR && c.ESTADO === 'COMPLETADA') || null;
}

// Sesiones compartidas por rol: la API limita el login a 10/15 min por IP,
// así el suite usa UNA sesión de admin y UNA de vendedor para toda la corrida.
let adminSession: Promise<TestClient> | null = null;
let vendorSession: Promise<TestClient> | null = null;

async function iniciarSesion(email: string, password: string): Promise<TestClient> {
  const c = createClient();
  const ok = await loginRobusto(c, email, password);
  if (!ok) throw new Error(`No se pudo iniciar sesión como ${email}`);
  return c;
}

function getAdmin(): Promise<TestClient> {
  if (!adminSession) adminSession = iniciarSesion(ADMIN_EMAIL, ADMIN_PASS);
  return adminSession;
}

function getVendor(): Promise<TestClient> {
  if (!vendorSession) vendorSession = iniciarSesion(VENDOR_EMAIL, VENDOR_PASS);
  return vendorSession;
}

test.describe.configure({ retries: 0 });

test.describe('Autenticación', () => {
  test('Login admin OK', async () => {
    const admin = await getAdmin();
    expect((await admin.req('GET', '/api/auth/perfil')).status).toBe(200);
  });

  test('Login vendedor OK', async () => {
    const vendor = await getVendor();
    expect((await vendor.req('GET', '/api/auth/perfil')).status).toBe(200);
  });

  test('Password incorrecta rechazada (401)', async () => {
    const malo = createClient();
    const ok = await loginRobusto(malo, ADMIN_EMAIL, 'contrasena-equivocada', 1);
    expect(ok).toBe(false);
  });
});

test.describe('Catálogo', () => {
  test('Catálogo público responde con productos', async () => {
    const r = await fetch(BASE_API + '/api/productos');
    const data = await r.json();
    expect(r.ok).toBe(true);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test('Variantes de producto consultables', async () => {
    const v = await primeraVarianteDe(3);
    expect(v).toBeTruthy();
  });
});

test.describe('Reglas de compra', () => {
  let varianteP3: number | null = null;

  test.beforeAll(async () => {
    varianteP3 = await primeraVarianteDe(3);
  });

  test('Vendedor bloqueado para comprar (403)', async () => {
    const vendor = await getVendor();
    const r = await vendor.req('POST', '/api/carrito/agregar', { id_producto: 3, id_variante: varianteP3!, cantidad: 1 });
    expect(r.status).toBe(403);
  });

  test('Cupón JADDA10 válido (búsqueda exacta)', async () => {
    const vendor = await getVendor();
    const r = await vendor.req('POST', '/api/cupones/validar', { codigo: 'JADDA10' });
    expect(r.status).toBe(200);
    expect(r.data?.ok).toBe(true);
    
    const parcial = await vendor.req('POST', '/api/cupones/validar', { codigo: 'JADDA' });
    expect(parcial.status).toBe(404);
  });

  test('Panel cupones devuelve tienda y personales', async () => {
    const admin = await getAdmin();
    const disponibles = await admin.req('GET', '/api/cupones/disponibles');
    expect(disponibles.status).toBe(200);
    expect(Array.isArray(disponibles.data?.tienda)).toBe(true);
    expect(Array.isArray(disponibles.data?.personales)).toBe(true);
  });
});

test.describe('Checkout con compra mínima', () => {
  // Producto DEDICADO del suite (creado y eliminado en beforeAll/afterAll):
  // hace el flujo determinista en cualquier BD (la sema no debe depender del
  // stock/precios del catálogo demo).
  const NOMBRE_TEST = `SMOKE-checkout-${Date.now().toString(36)}`;
  let productoTest: number | null = null;
  let varianteTest: number | null = null;
  // Código ÚNICO por corrida: el checkout marca el cupón USADO=1 y no hay
  // endpoint para resetearlo, así un código fijo falla en la 2ª corrida.
  const CODIGO_MIN = `SMOKE-MIN-${Date.now().toString(36)}`;

  test.beforeAll(async () => {
    const admin = await getAdmin();

    // 1) Producto de prueba: precio $50.000, 1 variante con stock 6.
    const crear = await admin.req('POST', '/api/productos', {
      NOMBRE: NOMBRE_TEST,
      MARCA: 'SMOKE',
      PRECIO: 50000,
      DESCRIPCION: 'Producto autogenerado por el suite E2E para probar el mínimo de cupón',
      ID_CATEGORIA: 1,
      VARIANTES: [{ COLOR: 'Único', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: 'Único', STOCK: 6 }],
    });
    expect(crear.status).toBe(201);
    productoTest = crear.data?.id ?? crear.data?.ID ?? crear.data?.idProducto ?? null;
    expect(productoTest).toBeTruthy();

    // 2) Variante creada
    const vars = await fetch(`${BASE_API}/api/productos/${productoTest}/variantes`);
    const lista = vars.ok ? await vars.json() : [];
    expect(Array.isArray(lista) && lista.length).toBeGreaterThan(0);
    varianteTest = lista[0].ID_VARIANTE;
    expect(Number(lista[0].STOCK || 0)).toBeGreaterThanOrEqual(6);

    // 3) Cupón de prueba (código único por corrida, nunca queda USADO=1 sin uso)
    const fin = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const creado = await admin.req('POST', '/api/productos/descuentos', {
      DESCRIPCION: CODIGO_MIN,
      PORCENTAJE: 50,
      FECHA_FIN: fin,
      MONTO_MINIMO: 200000,
    });
    expect(creado.status).toBe(201);
    expect(Number(creado.data?.MONTO_MINIMO ?? 0)).toBe(200000);
  });

  test.afterAll(async () => {
    const admin = await getAdmin();
    // limpia el producto de prueba si quedó
    if (productoTest) {
      const del = await admin.req('DELETE', `/api/admin/productos/${productoTest}`);
      expect([200, 404]).toContain(del.status);
    }
  });

  test('Checkout bajo mínimo rechazado (400) — respuesta del servidor informada en fallo', async () => {
    const admin = await getAdmin();
    
    // Limpiar carrito
    const previo = await admin.req('GET', '/api/carrito');
    for (const it of Array.isArray(previo.data) ? previo.data : []) {
      await admin.req('DELETE', `/api/carrito/eliminar/${it.ID_CARRITO}`);
    }
    
    const agregar = await admin.req('POST', '/api/carrito/agregar', { id_producto: productoTest!, id_variante: varianteTest!, cantidad: 1 });
    expect([200, 201]).toContain(agregar.status);
    
    const bodyCheckout = {
      metodoPago: 'nequi',
      nombre: 'Smoke Test',
      correo: 'smoke@jadda.test',
      telefono: '3000000000',
      direccion: 'Cra 1 #2-3',
      ciudad: 'Bogota',
      departamento: 'Cundinamarca',
    };
    
    const bajo = await admin.req('POST', '/api/checkout/procesar', {
      ...bodyCheckout,
      cuponCodigo: CODIGO_MIN,
    });
    // Si CI devuelve distinto de 400, el reporte mostrará el cuerpo REAL para
    // diagnosticar nunca a ciegas.
    expect(bajo.status, `Respuesta inesperada del checkout con cupón bajo mínimo: ${JSON.stringify(bajo.data)}`).toBe(400);
    expect(String(bajo.data?.error || '')).toContain('200.000');
  });

  test('Checkout sobre el mínimo crea la venta', async () => {
    const admin = await getAdmin();
    
    // Limpiar carrito
    const previo = await admin.req('GET', '/api/carrito');
    for (const it of Array.isArray(previo.data) ? previo.data : []) {
      await admin.req('DELETE', `/api/carrito/eliminar/${it.ID_CARRITO}`);
    }
    
    // Armar compra ≥ $200.000: 6 × $50.000 = $300.000 (stock de la variante de prueba)
    const okAgregar = await admin.req('POST', '/api/carrito/agregar', { id_producto: productoTest!, id_variante: varianteTest!, cantidad: 6 });
    expect([200, 201]).toContain(okAgregar.status);
    
    const cart = await admin.req('GET', '/api/carrito');
    const filas = Array.isArray(cart.data) ? cart.data : [];
    const subtotal = filas.reduce((a: number, f: any) => a + Number(f.PRECIO || f.PRECIO_UNITARIO || 0) * Number(f.CANTIDAD || 1), 0);
    expect(subtotal, `Subtotal ${subtotal} insuficiente para el cupón de $200.000`).toBeGreaterThanOrEqual(200000);
    
    const bodyCheckout = {
      metodoPago: 'nequi',
      nombre: 'Smoke Test',
      correo: 'smoke@jadda.test',
      telefono: '3000000000',
      direccion: 'Cra 1 #2-3',
      ciudad: 'Bogota',
      departamento: 'Cundinamarca',
    };
    
    const ok = await admin.req('POST', '/api/checkout/procesar', {
      ...bodyCheckout,
      cuponCodigo: CODIGO_MIN,
    });
    expect(ok.status).toBe(200);
    expect(ok.data?.ventaId).toBeTruthy();
    
    // Limpiar: cancelar y eliminar
    if (ok.data?.ventaId) {
      const idVenta = ok.data.ventaId;
      const cancel = await admin.req('POST', `/api/compras/${idVenta}/cancelar`);
      expect(cancel.status).toBe(200);
      const del = await admin.req('DELETE', `/api/admin/compras/${idVenta}`);
      expect([200, 404]).toContain(del.status);
    }
  });
});

test.describe('Chats y disputas', () => {
  test('Contador de chats sin leer responde', async () => {
    const vendor = await getVendor();
    const nl = await vendor.req('GET', '/api/chat/no-leidos');
    expect(nl.status).toBe(200);
    expect(typeof nl.data?.total).toBe('number');
  });

  test('Lista de conversaciones por rol', async () => {
    const vendor = await getVendor();
    const convs = await vendor.req('GET', '/api/chat/conversaciones');
    expect(convs.status).toBe(200);
    expect(Array.isArray(convs.data)).toBe(true);
  });

  test('Cupones personales del vendedor consultables', async () => {
    const vendor = await getVendor();
    const disp = await vendor.req('GET', '/api/cupones/disponibles');
    expect(disp.status).toBe(200);
  });

  test('Pendientes admin incluye chats escaladas', async () => {
    const admin = await getAdmin();
    const pend = await admin.req('GET', '/api/admin/pendientes');
    expect(pend.status).toBe(200);
    expect('chats' in (pend.data || {})).toBe(true);
  });

  test('Admin identifica ventas de vendedores (ES_DE_VENDEDOR)', async () => {
    const admin = await getAdmin();
    const venta = await ventaConProductoDeVendedor(admin);
    expect(venta).toBeTruthy();
  });

  test('Admin NO gestiona envíos de ventas de vendedores (403)', async () => {
    const admin = await getAdmin();
    const venta = await ventaConProductoDeVendedor(admin);
    expect(venta).toBeTruthy();
    
    if (venta) {
      const r = await admin.req('PUT', `/api/admin/compras/${venta.ID_VENTA}/envio`, { estado_envio: 'EN_CAMINO' });
      const bloqueado = r.status === 403 || r.data?.sinCambios === true;
      expect(bloqueado).toBe(true);
    }
  });
});

test.describe('UI — páginas críticas', () => {
  let adminCookie: string = '';
  let vendorCookie: string = '';

  test.beforeAll(async () => {
    const admin = await getAdmin();
    adminCookie = admin.cookie;
    
    const vendor = await getVendor();
    vendorCookie = vendor.cookie;
  });

  test('Home carga sin errores JS', async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(String(e)));
    
    await page.goto(BASE_WEB + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    
    expect(errores.length).toBe(0);
  });

  test('Panel admin → /admin renderiza', async ({ page }) => {
    if (adminCookie) {
      await page.context().addCookies([{ 
        name: 'connect.sid', 
        value: decodeURIComponent(adminCookie.replace('connect.sid=', '')), 
        url: BASE_WEB 
      }]);
    }
    
    await page.goto(BASE_WEB + '/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.admin-sidebar', { timeout: 20000 }).catch(() => {});
    expect(await page.locator('.admin-sidebar').count()).toBeGreaterThan(0);
  });

  test('Widget de chat flotante disponible', async ({ page }) => {
    if (adminCookie) {
      await page.context().addCookies([{ 
        name: 'connect.sid', 
        value: decodeURIComponent(adminCookie.replace('connect.sid=', '')), 
        url: BASE_WEB 
      }]);
    }
    
    await page.goto(BASE_WEB + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#flotante-chat', { timeout: 20000 }).catch(() => {});
    expect(await page.locator('#flotante-chat').count()).toBeGreaterThan(0);
  });

  test('Panel vendedor → /vendedor/reportes renderiza', async ({ page }) => {
    if (vendorCookie) {
      const context = await page.context().browser()?.newContext({ viewport: { width: 1440, height: 900 } });
      if (context) {
        await context.addCookies([{ 
          name: 'connect.sid', 
          value: decodeURIComponent(vendorCookie.replace('connect.sid=', '')), 
          url: BASE_WEB 
        }]);
        const pv = await context.newPage();
        await pv.goto(BASE_WEB + '/vendedor/reportes', { waitUntil: 'domcontentloaded' });
        await pv.waitForSelector('table.ap-tabla, .text-center.text-muted', { timeout: 20000 }).catch(() => {});
        const count = await pv.locator('table.ap-tabla').count() + await pv.locator('.text-center.text-muted').count();
        expect(count).toBeGreaterThan(0);
        await context.close();
      }
    }
  });
});