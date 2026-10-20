# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Chats y disputas >> Admin identifica ventas de vendedores (ES_DE_VENDEDOR)
- Location: e2e\smoke.spec.ts:258:7

# Error details

```
Error: expect(received).toBeTruthy()

Received: null
```

# Test source

```ts
  162 |     // Limpiar carrito
  163 |     const previo = await admin.req('GET', '/api/carrito');
  164 |     for (const it of Array.isArray(previo.data) ? previo.data : []) {
  165 |       await admin.req('DELETE', `/api/carrito/eliminar/${it.ID_CARRITO}`);
  166 |     }
  167 |     
  168 |     await admin.req('POST', '/api/carrito/agregar', { id_producto: 3, id_variante: varianteP3!, cantidad: 1 });
  169 |     
  170 |     const bodyCheckout = {
  171 |       metodoPago: 'nequi',
  172 |       nombre: 'Smoke Test',
  173 |       correo: 'smoke@jadda.test',
  174 |       telefono: '3000000000',
  175 |       direccion: 'Cra 1 #2-3',
  176 |       ciudad: 'Bogota',
  177 |       departamento: 'Cundinamarca',
  178 |     };
  179 |     
  180 |     const bajo = await admin.req('POST', '/api/checkout/procesar', {
  181 |       ...bodyCheckout,
  182 |       cuponCodigo: CODIGO_MIN,
  183 |     });
  184 |     expect(bajo.status).toBe(400);
  185 |     expect(String(bajo.data?.error || '')).toContain('200.000');
  186 |   });
  187 | 
  188 |   test('Checkout sobre el mínimo crea la venta', async () => {
  189 |     const admin = createClient();
  190 |     await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
  191 |     
  192 |     const cart = await admin.req('GET', '/api/carrito');
  193 |     const item = (Array.isArray(cart.data) ? cart.data : [])[0];
  194 |     expect(item).toBeTruthy();
  195 |     
  196 |     await admin.req('PUT', `/api/carrito/actualizar/${item!.ID_CARRITO}`, { cantidad: 4 });
  197 |     
  198 |     const bodyCheckout = {
  199 |       metodoPago: 'nequi',
  200 |       nombre: 'Smoke Test',
  201 |       correo: 'smoke@jadda.test',
  202 |       telefono: '3000000000',
  203 |       direccion: 'Cra 1 #2-3',
  204 |       ciudad: 'Bogota',
  205 |       departamento: 'Cundinamarca',
  206 |     };
  207 |     
  208 |     const ok = await admin.req('POST', '/api/checkout/procesar', {
  209 |       ...bodyCheckout,
  210 |       cuponCodigo: CODIGO_MIN,
  211 |     });
  212 |     expect(ok.status).toBe(200);
  213 |     expect(ok.data?.ventaId).toBeTruthy();
  214 |     
  215 |     // Limpiar: cancelar y eliminar
  216 |     if (ok.data?.ventaId) {
  217 |       const idVenta = ok.data.ventaId;
  218 |       const cancel = await admin.req('POST', `/api/compras/${idVenta}/cancelar`);
  219 |       expect(cancel.status).toBe(200);
  220 |       const del = await admin.req('DELETE', `/api/admin/compras/${idVenta}`);
  221 |       expect([200, 404]).toContain(del.status);
  222 |     }
  223 |   });
  224 | });
  225 | 
  226 | test.describe('Chats y disputas', () => {
  227 |   test('Contador de chats sin leer responde', async () => {
  228 |     const vendor = createClient();
  229 |     await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS);
  230 |     const nl = await vendor.req('GET', '/api/chat/no-leidos');
  231 |     expect(nl.status).toBe(200);
  232 |     expect(typeof nl.data?.total).toBe('number');
  233 |   });
  234 | 
  235 |   test('Lista de conversaciones por rol', async () => {
  236 |     const vendor = createClient();
  237 |     await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS);
  238 |     const convs = await vendor.req('GET', '/api/chat/conversaciones');
  239 |     expect(convs.status).toBe(200);
  240 |     expect(Array.isArray(convs.data)).toBe(true);
  241 |   });
  242 | 
  243 |   test('Cupones personales del vendedor consultables', async () => {
  244 |     const vendor = createClient();
  245 |     await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS);
  246 |     const disp = await vendor.req('GET', '/api/cupones/disponibles');
  247 |     expect(disp.status).toBe(200);
  248 |   });
  249 | 
  250 |   test('Pendientes admin incluye chats escaladas', async () => {
  251 |     const admin = createClient();
  252 |     await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
  253 |     const pend = await admin.req('GET', '/api/admin/pendientes');
  254 |     expect(pend.status).toBe(200);
  255 |     expect('chats' in (pend.data || {})).toBe(true);
  256 |   });
  257 | 
  258 |   test('Admin identifica ventas de vendedores (ES_DE_VENDEDOR)', async () => {
  259 |     const admin = createClient();
  260 |     await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
  261 |     const venta = await ventaConProductoDeVendedor(admin);
> 262 |     expect(venta).toBeTruthy();
      |                   ^ Error: expect(received).toBeTruthy()
  263 |   });
  264 | 
  265 |   test('Admin NO gestiona envíos de ventas de vendedores (403)', async () => {
  266 |     const admin = createClient();
  267 |     await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
  268 |     const venta = await ventaConProductoDeVendedor(admin);
  269 |     expect(venta).toBeTruthy();
  270 |     
  271 |     if (venta) {
  272 |       const r = await admin.req('PUT', `/api/admin/compras/${venta.ID_VENTA}/envio`, { estado_envio: 'EN_CAMINO' });
  273 |       const bloqueado = r.status === 403 || r.data?.sinCambios === true;
  274 |       expect(bloqueado).toBe(true);
  275 |     }
  276 |   });
  277 | });
  278 | 
  279 | test.describe('UI — páginas críticas', () => {
  280 |   test('Home carga sin errores JS', async ({ page }) => {
  281 |     const errores: string[] = [];
  282 |     page.on('pageerror', (e) => errores.push(String(e)));
  283 |     
  284 |     await page.goto(BASE_WEB + '/', { waitUntil: 'domcontentloaded' });
  285 |     await page.waitForTimeout(1500);
  286 |     
  287 |     expect(errores.length).toBe(0);
  288 |   });
  289 | 
  290 |   test('Panel admin → /admin renderiza', async ({ page }) => {
  291 |     const admin = createClient();
  292 |     await loginRobusto(admin, ADMIN_EMAIL, ADMIN_PASS);
  293 |     
  294 |     if (admin.cookie) {
  295 |       await page.context().addCookies([{ 
  296 |         name: 'connect.sid', 
  297 |         value: decodeURIComponent(admin.cookie.replace('connect.sid=', '')), 
  298 |         url: BASE_WEB 
  299 |       }]);
  300 |     }
  301 |     
  302 |     await page.goto(BASE_WEB + '/admin', { waitUntil: 'domcontentloaded' });
  303 |     await page.waitForSelector('.admin-sidebar', { timeout: 20000 }).catch(() => {});
  304 |     expect(await page.locator('.admin-sidebar').count()).toBeGreaterThan(0);
  305 |   });
  306 | 
  307 |   test('Widget de chat flotante disponible', async ({ page }) => {
  308 |     await page.goto(BASE_WEB + '/', { waitUntil: 'domcontentloaded' });
  309 |     await page.waitForSelector('#flotante-chat', { timeout: 20000 }).catch(() => {});
  310 |     expect(await page.locator('#flotante-chat').count()).toBeGreaterThan(0);
  311 |   });
  312 | 
  313 |   test('Panel vendedor → /vendedor/reportes renderiza', async ({ page }) => {
  314 |     const vendor = createClient();
  315 |     await loginRobusto(vendor, VENDOR_EMAIL, VENDOR_PASS);
  316 |     
  317 |     if (vendor.cookie) {
  318 |       const context = await page.context().browser()?.newContext({ viewport: { width: 1440, height: 900 } });
  319 |       if (context) {
  320 |         await context.addCookies([{ 
  321 |           name: 'connect.sid', 
  322 |           value: decodeURIComponent(vendor.cookie.replace('connect.sid=', '')), 
  323 |           url: BASE_WEB 
  324 |         }]);
  325 |         const pv = await context.newPage();
  326 |         await pv.goto(BASE_WEB + '/vendedor/reportes', { waitUntil: 'domcontentloaded' });
  327 |         await pv.waitForSelector('table.ap-tabla, .text-center.text-muted', { timeout: 20000 }).catch(() => {});
  328 |         const count = await pv.locator('table.ap-tabla').count() + await pv.locator('.text-center.text-muted').count();
  329 |         expect(count).toBeGreaterThan(0);
  330 |         await context.close();
  331 |       }
  332 |     }
  333 |   });
  334 | });
```