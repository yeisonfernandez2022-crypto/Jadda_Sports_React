import { test, expect } from '@playwright/test';

test.describe('Checkout y Compra - Flujos Críticos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Checkout completo con login previo', async ({ page }) => {
    // Login primero
    await page.click('text=INICIAR SESIÓN');
    await page.fill('#email-modal', 'yeison');
    await page.fill('#password-modal', 'Losquiero7');
    await page.click('button:has-text("ENTRAR")');
    await expect(page.locator('text=Yeison')).toBeVisible({ timeout: 10000 });

    // Agregar producto al carrito
    await page.click('text=CATÁLOGO');
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 10000 });
    await page.locator('.product-card').first().click();
    await page.waitForSelector('text=AGREGAR AL CARRITO', { timeout: 5000 });
    await page.click('text=AGREGAR AL CARRITO');

    // Proceder al checkout
    await page.click('.floating-cart, [class*="cart"]');
    await page.click('text=Comprar, text=Finalizar compra, text=Checkout');
    
    // Rellenar formulario de checkout
    await expect(page.locator('text=Resumen de compra, text=Finalizar compra')).toBeVisible({ timeout: 10000 });
    
    // Rellenar datos de envío
    await page.fill('input[placeholder*="nombre" i]', 'Yeison');
    await page.fill('input[placeholder*="correo" i]', 'yeison@test.com');
    await page.fill('input[placeholder*="teléfono" i]', '3001234567');
    await page.fill('input[placeholder*="dirección" i]', 'Calle 123');
    await page.fill('input[placeholder*="ciudad" i]', 'Bogotá');
    await page.selectOption('select[name="departamento"]', 'Cundinamarca');
    
    // Seleccionar método de pago
    await page.click('text=Nequi, text=Efecty, text=Tarjeta');
    
    // Confirmar compra
    await page.click('text=Confirmar, text=Pagar, text=Finalizar');
    
    // Verificar compra exitosa
    await expect(page.locator('text=¡Gracias, text=Compra exitosa, text=Gracias por tu compra')).toBeVisible({ timeout: 15000 });
  });

  test('Aplicar cupón de descuento', async ({ page }) => {
    await page.click('text=INICIAR SESIÓN');
    await page.fill('#email-modal', 'yeison');
    await page.fill('#password-modal', 'Losquiero7');
    await page.click('button:has-text("ENTRAR")');
    await expect(page.locator('text=Yeison')).toBeVisible({ timeout: 10000 });

    await page.click('text=CATÁLOGO');
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 10000 });
    await page.locator('.product-card').first().click();
    await page.waitForSelector('text=AGREGAR AL CARRITO', { timeout: 5000 });
    await page.click('text=AGREGAR AL CARRITO');

    await page.click('.floating-cart, [class*="cart"]');
    await page.click('text=Comprar, text=Finalizar compra, text=Checkout');

    // Aplicar cupón
    await page.fill('input[placeholder*="cupón" i], input[name="cupon"]', 'JADDA10');
    await page.click('text=Aplicar, text=Validar');
    
    // Verificar que se aplicó el descuento
    await expect(page.locator('text=10%, text=Descuento, text=-$')).toBeVisible({ timeout: 5000 });
  });
});