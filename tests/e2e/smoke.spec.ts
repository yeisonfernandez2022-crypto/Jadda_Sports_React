import { test, expect } from '@playwright/test';
import { APIRequestContext, request as playwrightRequest } from '@playwright/test';

const BASE_API = process.env.API_URL || 'http://localhost:5000';
const BASE_WEB = process.env.WEB_URL || 'http://localhost:5173';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'yeison';
const ADMIN_PASS = process.env.ADMIN_PASS || 'Losquiero7';
const VENDOR_EMAIL = process.env.VENDOR_EMAIL || 'alejandro.mendoza@vendedor.com';
const VENDOR_PASS = process.env.VENDOR_PASS || 'Vendedor123';

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

test.describe.configure({ retries: 0 });

test.describe('Autenticación', () => {
  test('Login admin OK', async () => {
    const admin = createClient();
    const ok = await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
    expect(ok).toBe(true);
  });

  test('Login vendedor OK', async () => {
    const vendor = createClient();
    const ok = await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS);
    expect(ok).toBe(true);
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
    const vendor = createClient();
    await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS);
    const r = await vendor.req('POST', '/api/carrito/agregar', { id_producto: 3, id_variante: varianteP3!, cantidad: 1 });
    expect(r.status).toBe(403);
  });

  test('Cupón JADDA10 válido (búsqueda exacta)', async () => {
    const vendor = createClient();
    await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS);
    const r = await vendor.req('POST', '/api/cupones/validar', { codigo: 'JADDA10' });
    expect(r.status).toBe(200);
    expect(r.data?.ok).toBe(true);
    
    const parcial = await vendor.req('POST', '/api/cupones/validar', { codigo: 'JADDA' });
    expect(parcial.status).toBe(404);
  });

  test('Panel cupones devuelve tienda y personales', async () => {
    const admin = createClient();
    await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
    const disponibles = await admin.req('GET', '/api/cupones/disponibles');
    expect(disponibles.status).toBe(200);
    expect(Array.isArray(disponibles.data?.tienda)).toBe(true);
    expect(Array.isArray(disponibles.data?.personales)).toBe(true);
  });
});

test.describe('Checkout con compra mínima', () => {
  let varianteP3: number | null = null;
  const CODIGO_MIN = 'SMOKE-MIN-CUPON';

  test.beforeAll(async () => {
    varianteP3 = await primeraVarianteDe(3);
    const admin = createClient();
    await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
    
    // Crear cupón de prueba si no existe
    const existe = await admin.req('POST', '/api/cupones/validar', { codigo: CODIGO_MIN });
    if (existe.status === 404) {
      const fin = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      await admin.req('POST', '/api/productos/descuentos', {
        DESCRIPCION: CODIGO_MIN,
        PORCENTAJE: 50,
        FECHA_FIN: fin,
        MONTO_MINIMO: 200000,
      });
    }
  });

  test('Checkout bajo mínimo rechazado (400)', async () => {
    const admin = createClient();
    await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
    
    // Limpiar carrito
    const previo = await admin.req('GET', '/api/carrito');
    for (const it of Array.isArray(previo.data) ? previo.data : []) {
      await admin.req('DELETE', `/api/carrito/eliminar/${it.ID_CARRITO}`);
    }
    
    await admin.req('POST', '/api/carrito/agregar', { id_producto: 3, id_variante: varianteP3!, cantidad: 1 });
    
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
    expect(bajo.status).toBe(400);
    expect(String(bajo.data?.error || '')).toContain('200.000');
  });

  test('Checkout sobre el mínimo crea la venta', async () => {
    const admin = createClient();
    await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
    
    const cart = await admin.req('GET', '/api/carrito');
    const item = (Array.isArray(cart.data) ? cart.data : [])[0];
    expect(item).toBeTruthy();
    
    await admin.req('PUT', `/api/carrito/actualizar/${item!.ID_CARRITO}`, { cantidad: 4 });
    
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
    const vendor = createClient();
    await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS);
    const nl = await vendor.req('GET', '/api/chat/no-leidos');
    expect(nl.status).toBe(200);
    expect(typeof nl.data?.total).toBe('number');
  });

  test('Lista de conversaciones por rol', async () => {
    const vendor = createClient();
    await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS);
    const convs = await vendor.req('GET', '/api/chat/conversaciones');
    expect(convs.status).toBe(200);
    expect(Array.isArray(convs.data)).toBe(true);
  });

  test('Cupones personales del vendedor consultables', async () => {
    const vendor = createClient();
    await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS);
    const disp = await vendor.req('GET', '/api/cupones/disponibles');
    expect(disp.status).toBe(200);
  });

  test('Pendientes admin incluye chats escaladas', async () => {
    const admin = createClient();
    await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
    const pend = await admin.req('GET', '/api/admin/pendientes');
    expect(pend.status).toBe(200);
    expect('chats' in (pend.data || {})).toBe(true);
  });

  test('Admin identifica ventas de vendedores (ES_DE_VENDEDOR)', async () => {
    const admin = createClient();
    await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
    const venta = await ventaConProductoDeVendedor(admin);
    expect(venta).toBeTruthy();
  });

  test('Admin NO gestiona envíos de ventas de vendedores (403)', async () => {
    const admin = createClient();
    await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
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
    const admin = createClient();
    await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
    adminCookie = admin.cookie;
    
    const vendor = createClient();
    await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS);
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