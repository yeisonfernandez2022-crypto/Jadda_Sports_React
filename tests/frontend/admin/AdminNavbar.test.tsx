import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { HANDLERS_ADMIN, PENDIENTES_ADMIN, PERFIL_ADMIN } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminNavbar from '../../../frontend/src/admin/AdminNavbar.tsx';
import { PENDIENTES_ACTUALIZADOS } from '../../../frontend/src/utils/eventosAdmin.ts';

/**
 * Humo de la barra lateral del panel admin contra su código REAL:
 * AuthProvider real (sesión admin por MSW) + rutas reales de la API.
 * Caracterización: las aserciones describen el comportamiento vigente.
 */

beforeEach(() => {
  server.use(...HANDLERS_ADMIN);
});

describe('AdminNavbar (humo con sesión admin real)', () => {
  it('renderiza marca, usuario admin y todas las pestañas del panel', async () => {
    renderAdmin(<AdminNavbar />);

    expect(await screen.findByText('JADDA SPORTS')).toBeInTheDocument();
    // El nombre del perfil llega por /api/auth/perfil (handler admin) — prueba
    // de que renderAdmin provee una sesión administrador completa.
    expect(await screen.findByText(PERFIL_ADMIN.usuario.NOMBRE_USUARIO)).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();

    for (const pestaña of ['Dashboard', 'Productos', 'Órdenes', 'Usuarios', 'Retos', 'Devoluciones y reembolsos', 'Vendedores', 'Reportes']) {
      // Regex (no nombre exacto): las insignias de pendientes cambian el
      // accessible name del botón (p. ej. "Productos 4") cuando cargan.
      expect(screen.getByRole('button', { name: new RegExp(pestaña) })).toBeInTheDocument();
    }
    // Chats se atiende solo desde el widget flotante y Categorías ya no
    // se expone en la barra lateral.
    expect(screen.queryByRole('button', { name: /Chats/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Categorías/ })).not.toBeInTheDocument();
    // La sesión admin NO muestra guardia de acceso en la barra lateral.
    expect(screen.queryByText(/acceso denegado/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no autorizado/i)).not.toBeInTheDocument();
  });

  it('muestra las insignias de pendientes que reporta /api/admin/pendientes', async () => {
    renderAdmin(<AdminNavbar />);
    await screen.findByText('JADDA SPORTS');

    const botones = {
      Productos: PENDIENTES_ADMIN.productos,
      Retos: PENDIENTES_ADMIN.evidencias,
      Devoluciones: PENDIENTES_ADMIN.devoluciones,
      Vendedores: PENDIENTES_ADMIN.vendedores,
    };
    for (const [pestaña, conteo] of Object.entries(botones)) {
      const boton = await screen.findByRole('button', { name: new RegExp(pestaña) });
      await waitFor(() => expect(within(boton).getByText(String(conteo))).toBeInTheDocument());
    }
  });

  it('refresca las insignias al recibir el aviso de una acción del panel', async () => {
    let evidencias = PENDIENTES_ADMIN.evidencias;
    server.use(
      http.get('*/api/admin/pendientes', () => HttpResponse.json({ ...PENDIENTES_ADMIN, evidencias })),
    );
    renderAdmin(<AdminNavbar />);
    await screen.findByText('JADDA SPORTS');

    const retos = await screen.findByRole('button', { name: /Retos/ });
    await waitFor(() => expect(within(retos).getByText(String(PENDIENTES_ADMIN.evidencias))).toBeInTheDocument());

    evidencias = 0;
    window.dispatchEvent(new Event(PENDIENTES_ACTUALIZADOS));

    await waitFor(() => expect(within(retos).queryByText(String(PENDIENTES_ADMIN.evidencias))).not.toBeInTheDocument());
  });

  it('despliega configuración y cerrar sesión al hacer clic en el usuario', async () => {
    renderAdmin(<AdminNavbar />);
    await screen.findByText('JADDA SPORTS');

    expect(screen.queryByRole('button', { name: /Configuración/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Cerrar sesión/ })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Opciones de usuario' }));

    expect(await screen.findByRole('button', { name: /Configuración/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cerrar sesión/ })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Configuración/ })).not.toBeInTheDocument(),
    );
  });

  it('la campana no abre el menú de usuario con Enter ni con clic', async () => {
    renderAdmin(<AdminNavbar />);
    await screen.findByText('JADDA SPORTS');

    const opciones = screen.getByRole('button', { name: 'Opciones de usuario' });
    const campana = screen.getByRole('button', { name: 'Notificaciones' });
    expect(opciones).toHaveAttribute('aria-expanded', 'false');

    // El keydown de la campana burbujea al role=button padre: no debe abrir
    // el panel de usuario (antes sí lo hacía y además activaba la campana).
    campana.focus();
    fireEvent.keyDown(campana, { key: 'Enter' });
    expect(opciones).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Configuración/ })).not.toBeInTheDocument();

    // El clic en la campana tampoco debe alternar el menú de usuario.
    fireEvent.click(campana);
    expect(opciones).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /Configuración/ })).not.toBeInTheDocument();
  });

  it('marca la pestaña activa según la ruta y navega al hacer clic', async () => {
    renderAdmin(<AdminNavbar />, { ruta: '/admin' });
    await screen.findByText('JADDA SPORTS');

    const dashboard = screen.getByRole('button', { name: 'Dashboard' });
    const ordenes = screen.getByRole('button', { name: 'Órdenes' });
    expect(dashboard).toHaveClass('active');
    expect(ordenes).not.toHaveClass('active');

    fireEvent.click(ordenes);
    await waitFor(() => expect(ordenes).toHaveClass('active'));
    expect(dashboard).not.toHaveClass('active');
  });

  it('el botón de menú abre la barra lateral móvil (clase open y fondo)', async () => {
    const { container } = renderAdmin(<AdminNavbar />);
    await screen.findByText('JADDA SPORTS');

    const barra = container.querySelector('aside.admin-sidebar');
    expect(barra).not.toBeNull();
    expect(barra?.className).not.toContain('admin-sidebar-open');

    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));
    await waitFor(() => expect(barra?.className).toContain('admin-sidebar-open'));
    expect(container.querySelector('.admin-sidebar-backdrop')).not.toBeNull();
  });

  it('un 500 en pendientes degrada en silencio: sin insignias y sin caída', async () => {
    server.use(
      http.get('*/api/admin/pendientes', () => HttpResponse.json({ ok: false }, { status: 500 })),
    );
    renderAdmin(<AdminNavbar />);
    await screen.findByText('JADDA SPORTS');

    const retos = screen.getByRole('button', { name: /Retos/ });
    // El componente traga el error (catch(() => {})) y se queda en ceros.
    await waitFor(() => expect(within(retos).queryByText(String(PENDIENTES_ADMIN.evidencias))).not.toBeInTheDocument());
  });
});
