import { test, expect } from '@playwright/test';

test.describe('Autenticación - Flujos Críticos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Login exitoso con credenciales válidas', async ({ page }) => {
    await page.click('text=INICIAR SESIÓN');
    await page.fill('#email-modal', 'yeison');
    await page.fill('#password-modal', 'Losquiero7');
    await page.click('button:has-text("ENTRAR")');
    
    // Verificar que el login fue exitoso
    await expect(page.locator('text=Yeison')).toBeVisible({ timeout: 10000 });
  });

  test('Login fallido con credenciales inválidas', async ({ page }) => {
    await page.click('text=INICIAR SESIÓN');
    await page.fill('#email-modal', 'yeison');
    await page.fill('#password-modal', 'wrongpassword');
    await page.click('button:has-text("ENTRAR")');
    
    await expect(page.locator('text=Credenciales incorrectas')).toBeVisible({ timeout: 5000 });
  });

  test('Registro de nuevo usuario', async ({ page }) => {
    const email = `test${Date.now()}@test.com`;
    
    await page.click('text=CREAR CUENTA');
    await page.fill('input[placeholder="Nombre"]', 'Usuario');
    await page.fill('input[placeholder="Apellido"]', 'Test');
    await page.fill('input[placeholder="correo@ejemplo.com"]', email);
    await page.fill('input[placeholder="Ej: 3001234567"]', '3001234567');
    await page.fill('input[placeholder="Calle, Carrera, Barrio"]', 'Calle 123');
    await page.fill('input[placeholder="Mínimo 8 caracteres"]', 'Test1234');
    await page.fill('input[placeholder="Repite tu contraseña"]', 'Test1234');
    
    // Aceptar términos
    await page.check('#terms-modal');
    await page.check('#privacidad-modal');
    await page.check('#devoluciones-modal');
    
    await page.click('button:has-text("CREAR CUENTA")');
    
    // Verificar que va a verificación
    await expect(page.locator('text=VERIFICAR CÓDIGO')).toBeVisible({ timeout: 10000 });
  });

  test('Recuperación de contraseña', async ({ page }) => {
    await page.click('text=INICIAR SESIÓN');
    await page.click('text=¿Olvidaste tu contraseña?');
    
    await expect(page.locator('text=RECUPERACIÓN DE CUENTA')).toBeVisible();
    await page.fill('input[placeholder="tu@correo.com"]', 'yeison@test.com');
    await page.click('button:has-text("ENVIAR CÓDIGO")');
    
    await expect(page.locator('text=VERIFICAR CÓDIGO')).toBeVisible({ timeout: 5000 });
  });
});