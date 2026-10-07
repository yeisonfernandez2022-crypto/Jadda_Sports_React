import { test, expect } from '@playwright/test';

test.describe('Panel Vendedor - Flujos Críticos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login como vendedor
    await page.click('text=INICIAR SESIÓN');
    await page.fill('#email-modal', 'prueba.vendedor@test.com');
    await page.fill('#password-modal', 'Prueba123');
    await page.click('button:has-text("ENTRAR")');
    await expect(page.locator('text=Pepe')).toBeVisible({ timeout: 10000 });
  });

  test('Acceso al panel vendedor', async ({ page }) => {
    await page.click('text=Mi tienda, text=Panel vendedor, [href*="/vendedor"]');
    await expect(page).toHaveURL(/\/vendedor/, { timeout: 5000 });
    await expect(page.locator('text=Mi tienda, text=Dashboard vendedor')).toBeVisible({ timeout: 5000 });
  });

  test('Gestión de productos del vendedor', async ({ page }) => {
    await page.goto('/vendedor/productos');
    await expect(page.locator('text=Mis productos')).toBeVisible({ timeout: 5000 });
    
    // Verificar tabla de productos
    await expect(page.locator('table, [class*="table"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Crear nuevo producto como vendedor', async ({ page }) => {
    await page.goto('/vendedor/productos/nuevo');
    await expect(page.locator('text=Nuevo producto, text=Crear producto')).toBeVisible({ timeout: 5000 });
    
    // Rellenar formulario básico
    await page.fill('input[name="nombre"], input[placeholder*="nombre" i]', 'Producto Test Vendedor');
    await page.fill('input[name="precio"], input[placeholder*="precio" i]', '50000');
    await page.fill('input[name="stock"], input[placeholder*="stock" i]', '10');
    
    // Seleccionar categoría
    await page.selectOption('select[name="categoria"]', { index: 1 });
    
    // Guardar
    await page.click('text=Guardar, text=Crear, text=Publicar');
    
    // Verificar éxito
    await expect(page.locator('text=Producto creado, text=Producto guardado, text=Éxito')).toBeVisible({ timeout: 5000 });
  });

  test('Gestión de ventas del vendedor', async ({ page }) => {
    await page.goto('/vendedor/ventas');
    await expect(page.locator('text=Mis ventas, text=Ventas')).toBeVisible({ timeout: 5000 });
    
    // Verificar tabla de ventas
    await expect(page.locator('table, [class*="table"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Reportes del vendedor', async ({ page }) => {
    await page.goto('/vendedor/reportes');
    await expect(page.locator('text=Reportes, text=Ventas')).toBeVisible({ timeout: 5000 });
    
    // Verificar KPIs
    await expect(page.locator('text=Ingresos, text=Pedidos, text=Productos')).toBeVisible({ timeout: 5000 });
  });
});