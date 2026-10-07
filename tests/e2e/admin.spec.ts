import { test, expect } from '@playwright/test';

test.describe('Panel Admin - Flujos Críticos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login como admin
    await page.click('text=INICIAR SESIÓN');
    await page.fill('#email-modal', 'yeison');
    await page.fill('#password-modal', 'Losquiero7');
    await page.click('button:has-text("ENTRAR")');
    await expect(page.locator('text=Yeison')).toBeVisible({ timeout: 10000 });
  });

  test('Acceso al panel admin', async ({ page }) => {
    await page.click('text=ADMIN, text=Panel admin, [href*="/admin"]');
    await expect(page).toHaveURL(/\/admin/, { timeout: 5000 });
    await expect(page.locator('text=Panel de control, text=Dashboard, text=Admin')).toBeVisible({ timeout: 5000 });
  });

  test('Gestión de productos en admin', async ({ page }) => {
    await page.goto('/admin/productos');
    await expect(page.locator('text=Gestionar productos, text=Productos')).toBeVisible({ timeout: 5000 });
    
    // Verificar que hay productos en la tabla
    await expect(page.locator('table, [class*="table"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Gestión de órdenes en admin', async ({ page }) => {
    await page.goto('/admin/ordenes');
    await expect(page.locator('text=Órdenes, text=Ordenes')).toBeVisible({ timeout: 5000 });
    
    // Verificar tabla de órdenes
    await expect(page.locator('table, [class*="table"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Gestión de usuarios en admin', async ({ page }) => {
    await page.goto('/admin/usuarios');
    await expect(page.locator('text=Usuarios')).toBeVisible({ timeout: 5000 });
    
    // Verificar tabla de usuarios
    await expect(page.locator('table, [class*="table"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Reportes en admin', async ({ page }) => {
    await page.goto('/admin/reportes');
    await expect(page.locator('text=Reportes, text=Ventas')).toBeVisible({ timeout: 5000 });
    
    // Verificar KPIs
    await expect(page.locator('text=Ingresos, text=Pedidos, text=Clientes')).toBeVisible({ timeout: 5000 });
  });

  test('Gestión de vendedores en admin', async ({ page }) => {
    await page.goto('/admin/vendedores');
    await expect(page.locator('text=Vendedores')).toBeVisible({ timeout: 5000 });
    
    // Verificar tabla de vendedores
    await expect(page.locator('table, [class*="table"]').first()).toBeVisible({ timeout: 5000 });
  });
});