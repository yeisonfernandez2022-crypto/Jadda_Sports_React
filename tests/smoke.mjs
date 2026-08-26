/**
 * tests/smoke.mjs â€” Suite E2E de humo de JADDA SPORTS (â‰ˆ16 checks crÃ­ticos).
 *
 * Uso:      npm run test:e2e        (desde la raÃ­z del proyecto)
 *           node tests/smoke.mjs    (directo)
 *
 * Requisitos: backend (5000) y frontend (5173) corriendo.
 * Credenciales demo por defecto (sobrescribibles con variables de entorno):
 *   ADMIN_EMAIL / ADMIN_PASS / VENDOR_EMAIL / VENDOR_PASS
 *
 * Limpieza: las ventas que crea se cancelan y eliminan por API, dejando la BD
 * como estaba. Los chats de soporte reutilizan el chat ACTIVA existente.
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require2 = createRequire(path.join(__dirname, "index.js"));

const BASE_API = process.env.API_URL || "http://localhost:5000";
const BASE_WEB = process.env.WEB_URL || "http://localhost:5173";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "yeison";
const ADMIN_PASS = process.env.ADMIN_PASS || "Losquiero7";
const VENDOR_EMAIL = process.env.VENDOR_EMAIL || "prueba.vendedor@test.com";
const VENDOR_PASS = process.env.VENDOR_PASS || "Prueba123";

// ---------- mini framework ----------
let pass = 0;
let fail = 0;
const fallos = [];

function check(nombre, cond, extra = "") {
  if (cond) {
    pass++;
    console.log(`  âœ… ${nombre}`);
  } else {
    fail++;
    fallos.push(nombre);
    console.log(`  âŒ ${nombre}${extra ? ` â€” ${extra}` : ""}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cliente HTTP con cookies (para mantener sesiÃ³n express). */
function cliente() {
  let cookie = "";
  return {
    get cookie() { return cookie; },
    async req(metodo, ruta, body) {
      const res = await fetch(BASE_API + ruta, {
        method: metodo,
        headers: {
          "Content-Type": "application/json",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
      });
      const setCookie = res.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";")[0];
      let data = null;
      try { data = await res.json(); } catch { /* no json */ }
      return { status: res.status, data };
    },
  };
}

// ---------- helpers API ----------
async function login(cliente, email, password) {
  const r = await cliente.req("POST", "/api/auth/login", { email, password });
  return r.status === 200;
}

async function primeraVarianteDe(idProducto) {
  // vÃ­a admin (necesita sesiÃ³n) o pÃºblico si expone variantes; usamos SQL-free:
  const r = await fetch(`${BASE_API}/api/productos/${idProducto}/variantes`);
  if (!r.ok) return null;
  const lista = await r.json();
  return Array.isArray(lista) && lista.length ? lista[0].ID_VARIANTE : null;
}

async function ventaConProductoDeVendedor(admin) {
  const compras = await admin.req("GET", "/api/admin/compras");
  const lista = Array.isArray(compras.data) ? compras.data : [];
  return lista.find((c) => c.ES_DE_VENDEDOR && c.ESTADO === "COMPLETADA") || null;
}

// ---------- navegador (opcional) ----------
function extraerChromium(mod) {
  const m = mod?.default && mod.default.chromium ? mod.default : mod;
  return m?.chromium?.launch ? m.chromium : null;
}

async function cargarBrowser() {
  try {
    const mod = await import("playwright-core");
    const c = extraerChromium(mod);
    if (c) return { chromium: c };
  } catch { /* sigue con el fallback */ }
  try {
    const require3 = createRequire(path.join(__dirname, "package.json"));
    const c = extraerChromium(require3("playwright-core"));
    if (c) return { chromium: c };
  } catch { /* sin navegador */ }
  return { chromium: null };
}

/** Login con reintento: el rate limiter permite ~10 logins/min por IP y la
 *  suite hace varios; espera si nos limita. */
async function loginRobusto(cliente, email, password, intentos = 3) {
  for (let i = 0; i < intentos; i++) {
    const r = await cliente.req("POST", "/api/auth/login", { email, password });
    if (r.status === 200) return true;
    const limitado =
      r.status === 429 ||
      (r.status === 401 && /demasiados|intenta|más tarde/i.test(JSON.stringify(r.data)));
    if (!limitado || i === intentos - 1) return false;
    console.log(`    ⏳ login limitado, esperando 20s (${i + 1}/${intentos - 1})…`);
    await sleep(20000);
  }
  return false;
}

async function checksUI({ chromium, cookieAdmin, cookieVendor }) {
  if (!chromium) {
    console.log("\n▶ UI: OMITIDO (playwright-core no está instalado en tests/)");
    return;
  }
  console.log("\nâ–¶ UI â€” pÃ¡ginas crÃ­ticas");
  let browser;
  try {
    browser = await chromium.launch({ channel: "msedge", headless: true });
  } catch (e) {
    console.log("  âš ï¸ msedge fallÃ³:", e?.stack || String(e));
    try { browser = await chromium.launch({ headless: true }); } catch (e2) { browser = null; }
  }
  if (!browser) {
    console.log("  âš ï¸ No se pudo abrir navegador (Â¿Edge instalado?). UI omitida.");
    return;
  }

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const erroresJS = [];
  page.on("pageerror", (e) => erroresJS.push(String(e)));

  await page.goto(BASE_WEB + "/", { waitUntil: "domcontentloaded" });
  await sleep(1500);
  check("Home carga sin errores JS", erroresJS.length === 0);

  if (cookieAdmin) {
    await ctx.addCookies([{ name: "connect.sid", value: decodeURIComponent(cookieAdmin.replace("connect.sid=", "")), url: BASE_WEB }]);
  }
  await page.goto(BASE_WEB + "/admin/chats", { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".chat-item, .chats-vacio", { timeout: 15000 }).catch(() => {});
  check("Panel admin â†’ /admin/chats renderiza", (await page.locator(".admin-sidebar").count()) > 0);

  const ctxV = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (cookieVendor) {
    await ctxV.addCookies([{ name: "connect.sid", value: decodeURIComponent(cookieVendor.replace("connect.sid=", "")), url: BASE_WEB }]);
  }
  const pv = await ctxV.newPage();
  await pv.goto(BASE_WEB + "/vendedor/reportes", { waitUntil: "domcontentloaded" });
  await pv.waitForTimeout(1200);
  check("Panel vendedor â†’ /vendedor/reportes renderiza",
    (await pv.locator("table.ap-tabla").count() + (await pv.locator(".text-center.text-muted").count())) > 0);

  await browser.close();
}

// ---------- suite ----------
console.log("ðŸ”¥ JADDA SPORTS â€” smoke E2E");
console.log(`   API ${BASE_API} Â· WEB ${BASE_WEB}\n`);

const admin = cliente();
const vendor = cliente();

console.log("â–¶ AutenticaciÃ³n");
check("Login admin OK", await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS));
check("Login vendedor OK", await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS));
{
  const malo = cliente();
  const okMalo = await loginRobusto(malo, ADMIN_EMAIL, "contrasena-equivocada", 1);
  check("Password incorrecta rechazada (401)", !okMalo);
}

console.log("\nâ–¶ CatÃ¡logo");
{
  const r = await fetch(BASE_API + "/api/productos");
  const data = await r.json();
  check("CatÃ¡logo pÃºblico responde con productos", Array.isArray(data) && data.length > 0);
}
{
  const v = await primeraVarianteDe(3);
  check("Variantes de producto consultables", !!v);
}

console.log("\nâ–¶ Reglas de compra");
const varianteP3 = await primeraVarianteDe(3);
{
  const r = await vendor.req("POST", "/api/carrito/agregar", { id_producto: 3, id_variante: varianteP3, cantidad: 1 });
  check("Vendedor bloqueado para comprar (403)", r.status === 403);
}
{
  const r = await vendor.req("POST", "/api/cupones/validar", { codigo: "JADDA10" });
  check("CupÃ³n JADDA10 vÃ¡lido (bÃºsqueda exacta)", r.status === 200 && r.data?.ok);
  const parcial = await vendor.req("POST", "/api/cupones/validar", { codigo: "JADDA" });
  check("CÃ³digo parcial 'JADDA' NO matchea (exactitud)", parcial.status === 404);
}
{
  const disponibles = await admin.req("GET", "/api/cupones/disponibles");
  check(
    "Panel cupones devuelve tienda y personales",
    disponibles.status === 200 && Array.isArray(disponibles.data?.tienda) && Array.isArray(disponibles.data?.personales)
  );
}

console.log("\nâ–¶ Checkout con compra mÃ­nima");
{
  // Limpia el carrito del admin antes de la prueba
  const previo = await admin.req("GET", "/api/carrito");
  for (const it of Array.isArray(previo.data) ? previo.data : []) {
    await admin.req("DELETE", `/api/carrito/eliminar/${it.ID_CARRITO}`);
  }

  // CupÃ³n desechable REUTILIZABLE de nombre fijo (promo con mÃ­nimo; los
  // cÃ³digos no-RETO nunca se marcan como usados, asÃ­ que sirve para siempre)
  const CODIGO_MIN = "SMOKE-MIN-CUPON";
  const existe = await admin.req("POST", "/api/cupones/validar", { codigo: CODIGO_MIN });
  if (existe.status === 404) {
    const fin = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const creado = await admin.req("POST", "/api/productos/descuentos", {
      DESCRIPCION: CODIGO_MIN,
      PORCENTAJE: 50,
      FECHA_FIN: fin,
      MONTO_MINIMO: 200000,
    });
    check("CupÃ³n de prueba creado (admin)", creado.status === 201, JSON.stringify(creado.data).slice(0, 80));
  }

  await admin.req("POST", "/api/carrito/agregar", { id_producto: 3, id_variante: varianteP3, cantidad: 1 });

  const bodyCheckout = {
    metodoPago: "nequi",
    nombre: "Smoke Test",
    correo: "smoke@jadda.test",
    telefono: "3000000000",
    direccion: "Cra 1 #2-3",
    ciudad: "Bogota",
    departamento: "Cundinamarca",
  };

  // A) Bajo el mÃ­nimo â†’ rechaza SIN consumir el cupÃ³n
  const bajo = await admin.req("POST", "/api/checkout/procesar", {
    ...bodyCheckout,
    cuponCodigo: CODIGO_MIN,
  });
  check(
    "Checkout bajo mÃ­nimo rechazado (400)",
    bajo.status === 400 && String(bajo.data?.error || "").includes("200.000"),
    JSON.stringify(bajo.data).slice(0, 90)
  );

  // B) Sobre el mÃ­nimo ($70k x4 = $280k) â†’ crea la venta con descuento
  const cart = await admin.req("GET", "/api/carrito");
  const item = (Array.isArray(cart.data) ? cart.data : [])[0];
  if (!item) {
    check("Checkout sobre el mÃ­nimo crea la venta", false, "carrito vacÃ­o");
  } else {
    await admin.req("PUT", `/api/carrito/actualizar/${item.ID_CARRITO}`, { cantidad: 4 });
    const ok = await admin.req("POST", "/api/checkout/procesar", {
      ...bodyCheckout,
      cuponCodigo: CODIGO_MIN,
    });
    check("Checkout sobre el mÃ­nimo crea la venta", ok.status === 200 && !!ok.data?.ventaId);

    if (ok.data?.ventaId) {
      const idVenta = ok.data.ventaId;
      const cancel = await admin.req("POST", `/api/compras/${idVenta}/cancelar`);
      check("Pedido creado se cancela (libera stock)", cancel.status === 200);
      const del = await admin.req("DELETE", `/api/admin/compras/${idVenta}`);
      check("Registro cancelado se elimina (limpieza)", del.status === 200 || del.status === 404);
    }
  }
}

console.log("\nâ–¶ Chats y disputas");
{
  const nl = await vendor.req("GET", "/api/chat/no-leidos");
  check("Contador de chats sin leer responde", nl.status === 200 && typeof nl.data?.total === "number");
  const convs = await vendor.req("GET", "/api/chat/conversaciones");
  check("Lista de conversaciones por rol", convs.status === 200 && Array.isArray(convs.data));
  const disp = await vendor.req("GET", "/api/cupones/disponibles");
  check("Cupones personales del vendedor consultables", disp.status === 200);
}
{
  const pend = await admin.req("GET", "/api/admin/pendientes");
  check("Pendientes admin incluye chats escaladas", pend.status === 200 && "chats" in (pend.data || {}));
}
{
  const venta = await ventaConProductoDeVendedor(admin);
  check("Admin identifica ventas de vendedores (ES_DE_VENDEDOR)", !!venta);
  if (venta) {
    const r = await admin.req("PUT", `/api/admin/compras/${venta.ID_VENTA}/envio`, { estado_envio: "EN_CAMINO" });
    const bloqueado = r.status === 403 || r.data?.sinCambios === true;
    check("Admin NO gestiona envÃ­os de ventas de vendedores (403)", bloqueado, `status=${r.status}`);
  }
}

const ui = await cargarBrowser();
await checksUI({ chromium: ui.chromium, cookieAdmin: admin.cookie, cookieVendor: vendor.cookie });

// ---------- resumen ----------
console.log("\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•");
console.log(`  RESULTADO: ${pass} PASS Â· ${fail} FAIL`);
if (fail) {
  console.log("  Fallidos:");
  for (const f of fallos) console.log(`   - ${f}`);
}
console.log("â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•\n");
process.exit(fail ? 1 : 0);






