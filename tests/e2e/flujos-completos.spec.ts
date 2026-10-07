import { test, expect } from '@playwright/test';

test.describe('Flujos Completos E2E', () => {
  test('Flujo completo: Visitante -> Cliente -> Compra', async ({ page }) => {
    await page.goto('/');
    
    // 1. Navegar como visitante
    await expect(page.locator('text=JADDA SPORTS')).toBeVisible();
    await page.click('text=CATÁLOGO');
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 10000 });
    
    // 2. Registrarse
    await page.click('text=CREAR CUENTA, text=Regístrate');
    const email = `e2e${Date.now()}@test.com`;
    await page.fill('input[placeholder="Nombre"]', 'E2E');
    await page.fill('input[placeholder="Apellido"]', 'Test');
    await page.fill('input[placeholder="correo@ejemplo.com"]', email);
    await page.fill('input[placeholder="Ej: 3001234567"]', '3001234567');
    await page.fill('input[placeholder="Calle, Carrera, Barrio"]', 'Calle E2E');
    await page.fill('input[placeholder="Mínimo 8 caracteres"]', 'E2ETest123');
    await page.fill('input[placeholder="Repite tu contraseña"]', 'E2ETest123');
    await page.check('#terms-modal');
    await page.check('#privacidad-modal');
    await page.check('#devoluciones-modal');
    await page.click('button:has-text("CREAR CUENTA")');
    
    // Verificar código de verificación
    await expect(page.locator('text=VERIFICAR CÓDIGO')).toBeVisible({ timeout: 10000 });
    // Nota: En test real se necesitaría el código real
    
    // 3. Login con cuenta existente
    await page.goto('/');
    await page.click('text=INICIAR SESIÓN');
    await page.fill('#email-modal', 'yeison');
    await page.fill('#password-modal', 'Losquiero7');
    await page.click('button:has-text("ENTRAR")');
    await expect(page.locator('text=Yeison')).toBeVisible({ timeout: 10000 });
    
    // 4. Comprar
    await page.click('text=CATÁLOGO');
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 10000 });
    await page.locator('.product-card').first().click();
    await page.waitForSelector('text=AGREGAR AL CARRITO', { timeout: 5000 });
    await page.click('text=AGREGAR AL CARRITO');
    
    await page.click('.floating-cart, [class*="cart"]');
    await page.click('text=Comprar, text=Finalizar compra, text=Checkout');
    
    // Verificar que llegó al checkout
    await expect(page.locator('text=Resumen de compra, text=Finalizar compra')).toBeVisible({ timeout: 10000 });
  });

  test('Flujo admin: Login -> Dashboard -> Gestión', async ({ page }) => {
    await page.goto('/');
    await page.click('text=INICIAR SESIÓN');
    await page.fill('#email-modal', 'yeison');
    await page.fill('#password-modal', 'Losquiero7');
    await page.click('button:has-text("ENTRAR")');
    await expect(page.locator('text=Yeison')).toBeVisible({ timeout: 10000 });
    
    // Ir a admin
    await page.click('text=ADMIN, text=Panel admin');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('text=Dashboard, text=Panel de control')).toBeVisible({ timeout: 5000 });
    
    // Verificar KPIs
    await expect(page.locator('text=Ingresos, text=Pedidos, text=Clientes')).toBeVisible({ timeout: 5000 });
    
    // Ir a productos
    await page.click('text=Productos, text=Gestionar productos');
    await expect(page.locator('text=Productos')).toBeVisible({ timeout: 5000 });
  });

  test('Flujo vendedor: Login -> Panel -> Productos', async ({ page }) => {
    await page.goto('/');
    await page.click('text=INICIAR SESIÓN');
    await page.fill('#email-modal', 'prueba.vendedor@test.com');
    await page.fill('#password-modal', 'Prueba123');
    await page.click('button:has-text("ENTRAR")');
    await expect(page.locator('text=Pepe')).toBeVisible({ timeout: 10000 });
    
    // Ir a panel vendedor
    await page.click('text=Mi tienda, text=Panel vendedor');
    await expect(page).toHaveURL(/\/vendedor/);
    await expect(page.locator('text=Mi tienda')).toBeVisible({ timeout: 5000 });
    
    // Ver productos
    await page.click('text=Mis productos, text=Productos');
    await expect(page.locator('text=Mis productos')).toBeVisible({ timeout: 5000 });
  });
});