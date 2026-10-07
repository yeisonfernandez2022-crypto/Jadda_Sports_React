import { test, expect } from '@playwright/test';

test.describe('Catálogo y Carrito - Flujos Críticos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Navegación a catálogo y visualización de productos', async ({ page }) => {
    await page.click('text=CATÁLOGO');
    await expect(page.locator('text=Catálogo')).toBeVisible();
    
    // Verificar que hay productos
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 10000 });
  });

  test('Búsqueda de productos', async ({ page }) => {
    await page.fill('input[placeholder*="buscar" i]', 'guayos');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('text=Guayos')).toBeVisible({ timeout: 10000 });
  });

  test('Agregar producto al carrito', async ({ page }) => {
    await page.click('text=CATÁLOGO');
    
    // Esperar a que carguen los productos
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 10000 });
    
    // Click en el primer producto
    await page.locator('.product-card').first().click();
    
    // En la página de detalle, seleccionar variante si es necesario
    await page.waitForSelector('text=AGREGAR AL CARRITO', { timeout: 5000 });
    await page.click('text=AGREGAR AL CARRITO');
    
    // Verificar que se agregó al carrito
    await expect(page.locator('.cart-count, .floating-cart .count, [class*="cart"] .count')).toContainText('1', { timeout: 5000 });
  });

  test('Ver carrito y proceder al checkout', async ({ page }) => {
    await page.click('text=CATÁLOGO');
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 10000 });
    await page.locator('.product-card').first().click();
    await page.waitForSelector('text=AGREGAR AL CARRITO', { timeout: 5000 });
    await page.click('text=AGREGAR AL CARRITO');
    
    // Abrir carrito
    await page.click('.floating-cart, [class*="cart"]');
    
    // Verificar que hay productos en el carrito
    await expect(page.locator('text=Resumen de compra, text=Carrito, text=Total')).toBeVisible({ timeout: 5000 });
    
    // Click en proceder al checkout
    await page.click('text=Comprar, text=Finalizar compra, text=Checkout');
    
    // Debe redirigir a resumen de compra o login
    await expect(page).toHaveURL(/.*(resumen|checkout|login)/, { timeout: 5000 });
  });

  test('Filtro por categoría', async ({ page }) => {
    await page.click('text=CATÁLOGO');
    
    // Seleccionar una categoría del dropdown
    await page.click('text=Fútbol, text=Running, text=Gimnasio');
    
    // Verificar que se filtran productos
    await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 5000 });
  });
});