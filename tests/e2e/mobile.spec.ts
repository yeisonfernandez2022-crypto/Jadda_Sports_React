import { test, expect, devices } from '@playwright/test';

test.describe('Responsive - Mobile', () => {
  test.use({ ...devices['iPhone 12'] });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Menú hamburguesa en mobile', async ({ page }) => {
    // Verificar que el botón hamburguesa está visible
    await expect(page.locator('.nav-hamburguesa, button[aria-label*="menú" i], button[class*="hamburger"]')).toBeVisible({ timeout: 5000 });
    
    // Click en hamburguesa
    await page.click('.nav-hamburguesa, button[aria-label*="menú" i], button[class*="hamburger"]');
    
    // Verificar que se abre el panel
    await expect(page.locator('.nav-movil-panel, .mobile-menu, [class*="mobile"][class*="menu"]')).toBeVisible({ timeout: 5000 });
    
    // Verificar enlaces del menú
    await expect(page.locator('text=INICIO, text=CATÁLOGO, text=OFERTAS')).toBeVisible({ timeout: 5000 });
  });

  test('Catálogo responsive en mobile', async ({ page }) => {
    await page.click('text=CATÁLOGO, text=Catálogo');
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 10000 });
    
    // Verificar que las cards se ven bien en mobile
    const cards = page.locator('.product-card');
    if (await cards.count() > 0) {
      const box = await cards.first().boundingBox();
      expect(box?.width).toBeLessThanOrEqual(375); // iPhone 12 width
    }
  });

  test('Detalle de producto en mobile', async ({ page }) => {
    await page.click('text=CATÁLOGO');
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 10000 });
    await page.locator('.product-card').first().click();
    
    // Verificar elementos del detalle
    await expect(page.locator('text=AGREGAR AL CARRITO')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.image-zoom, [class*="zoom"], img')).toBeVisible({ timeout: 5000 });
  });

  test('Carrito en mobile', async ({ page }) => {
    await page.click('text=CATÁLOGO');
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 10000 });
    await page.locator('.product-card').first().click();
    await page.waitForSelector('text=AGREGAR AL CARRITO', { timeout: 5000 });
    await page.click('text=AGREGAR AL CARRITO');
    
    // Verificar carrito flotante
    await expect(page.locator('.floating-cart, [class*="cart"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Login en mobile', async ({ page }) => {
    await page.click('text=INICIAR SESIÓN, text=Iniciar sesión');
    await expect(page.locator('text=Iniciar Sesión')).toBeVisible({ timeout: 5000 });
    
    await page.fill('#email-modal, input[name="email"]', 'yeison');
    await page.fill('#password-modal, input[name="password"]', 'Losquiero7');
    await page.click('button:has-text("ENTRAR"), button[type="submit"]');
    
    await expect(page.locator('text=Yeison')).toBeVisible({ timeout: 10000 });
  });
});