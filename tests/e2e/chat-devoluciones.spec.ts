import { test, expect } from '@playwright/test';

test.describe('Chat y Devoluciones - Flujos Críticos', () => {
  test.describe('Chat', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      // Login como cliente
      await page.click('text=INICIAR SESIÓN');
      await page.fill('#email-modal', 'yeison');
      await page.fill('#password-modal', 'Losquiero7');
      await page.click('button:has-text("ENTRAR")');
      await expect(page.locator('text=Yeison')).toBeVisible({ timeout: 10000 });
    });

    test('Abrir chat desde producto', async ({ page }) => {
      await page.click('text=CATÁLOGO');
      await expect(page.locator('.product-card').first()).toBeVisible({ timeout: 10000 });
      await page.locator('.product-card').first().click();
      
      // Buscar botón de chat
      await page.click('text=Chatear con el vendedor, text=Chat, [class*="chat"]');
      
      // Verificar que se abre el chat
      await expect(page.locator('text=Chats, text=Conversación, [class*="chat"]')).toBeVisible({ timeout: 5000 });
    });

    test('Enviar mensaje en chat', async ({ page }) => {
      await page.goto('/chats');
      await expect(page.locator('text=Mis chats, text=Chats')).toBeVisible({ timeout: 5000 });
      
      // Si hay chats, abrir uno
      const chatItems = page.locator('.chat-item, [class*="chat-item"]');
      if (await chatItems.count() > 0) {
        await chatItems.first().click();
        
        // Enviar mensaje
        await page.fill('textarea[placeholder*="mensaje" i], input[placeholder*="mensaje" i]', 'Hola, consulta sobre el producto');
        await page.click('button:has-text("Enviar"), button[type="submit"]');
        
        // Verificar que se envió
        await expect(page.locator('text=Hola, consulta sobre el producto')).toBeVisible({ timeout: 5000 });
      }
    });

    test('Ver notificaciones de chat', async ({ page }) => {
      // Verificar badge de notificaciones
      const badge = page.locator('.notification-badge, [class*="badge"][class*="chat"], .nav-chat-badge');
      if (await badge.count() > 0) {
        await expect(badge.first()).toBeVisible();
      }
    });
  });

  test.describe('Devoluciones', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/');
      // Login como cliente
      await page.click('text=INICIAR SESIÓN');
      await page.fill('#email-modal', 'yeison');
      await page.fill('#password-modal', 'Losquiero7');
      await page.click('button:has-text("ENTRAR")');
      await expect(page.locator('text=Yeison')).toBeVisible({ timeout: 10000 });
    });

    test('Solicitar devolución', async ({ page }) => {
      await page.goto('/perfil/compras');
      await expect(page.locator('text=Mis compras, text=Compras')).toBeVisible({ timeout: 5000 });
      
      // Buscar pedido completado
      const pedidos = page.locator('.comp-card, [class*="compra"], [class*="pedido"]');
      if (await pedidos.count() > 0) {
        await pedidos.first().click();
        
        // Buscar botón de devolución
        await page.click('text=Devolver, text=Solicitar devolución, text=Reembolso');
        
        // Rellenar formulario de devolución
        await page.fill('textarea[name="motivo"], textarea[placeholder*="motivo" i]', 'Producto defectuoso');
        await page.fill('textarea[name="descripcion"], textarea[placeholder*="descripción" i]', 'El producto llegó dañado');
        
        // Enviar
        await page.click('text=Enviar, text=Solicitar, text=Confirmar');
        
        // Verificar éxito
        await expect(page.locator('text=Solicitud enviada, text=Devolución solicitada, text=Éxito')).toBeVisible({ timeout: 5000 });
      }
    });

    test('Ver estado de devolución', async ({ page }) => {
      await page.goto('/perfil/devolucion');
      await expect(page.locator('text=Mis devoluciones, text=Estado de devolución')).toBeVisible({ timeout: 5000 });
    });
  });
});