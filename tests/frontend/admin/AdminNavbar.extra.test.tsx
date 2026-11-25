import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, PENDIENTES_ADMIN, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminNavbar from '../../../frontend/src/admin/AdminNavbar.tsx';
import { setGuardiaNavegacion } from '../../../frontend/src/utils/navigationGuard.ts';

/**
 * AdminNavbar — segunda capa de cobertura.
 *
 * Complementa AdminNavbar.test.tsx con el cierre del menú por clic fuera, el
 * cierre del panel móvil por fondo y teclado, la navegación de marca y
 * configuración, el cierre de sesión, el refresco por visibilidad/foco y las
 * respuestas parciales o fallidas de pendientes.
 */

let peticiones: RequestHandler[];
let pendientesGet: number;
let logoutPost: number;

const montar = (ruta = '/admin') =>
  renderAdmin(
    <Routes>
      <Route path="/admin" element={<AdminNavbar />} />
      <Route path="/admin/configuracion" element={<div data-testid="sonda-config" />} />
      <Route path="/admin/productos/*" element={<AdminNavbar />} />
      <Route path="/" element={<div data-testid="sonda-tienda" />} />
    </Routes>,
    { ruta },
  );

const abrirMenuUsuario = async () => {
  const opciones = await screen.findByRole('button', { name: 'Opciones de usuario' });
  fireEvent.click(opciones);
  await screen.findByRole('button', { name: /Configuración/ });
  return opciones;
};

beforeEach(() => {
  pendientesGet = 0;
  logoutPost = 0;
  peticiones = [
    http.get('*/api/admin/pendientes', () => {
      pendientesGet += 1;
      return HttpResponse.json(PENDIENTES_ADMIN);
    }),
    http.post('*/api/auth/logout', () => {
      logoutPost += 1;
      return HttpResponse.json({ ok: true });
    }),
    ...HANDLERS_ADMIN,
  ];
  server.use(...peticiones);
});

describe('AdminNavbar — respuestas de pendientes', () => {
  it('una respuesta vacía deja todas las insignias en cero', async () => {
    server.use(http.get('*/api/admin/pendientes', () => HttpResponse.json({})));
    montar();
    await screen.findByText('JADDA SPORTS');

    const retos = screen.getByRole('button', { name: /Retos/ });
    const productos = screen.getByRole('button', { name: /Productos/ });
    await waitFor(() => expect(within(retos).queryByText('2')).not.toBeInTheDocument());
    expect(within(productos).queryByText(String(PENDIENTES_ADMIN.productos))).not.toBeInTheDocument();
  });

  it('un fallo de red se traga en silencio', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let intentos = 0;
    server.use(http.get('*/api/admin/pendientes', () => {
      intentos += 1;
      return HttpResponse.error();
    }));
    montar();
    await screen.findByText('JADDA SPORTS');

    await waitFor(() => expect(intentos).toBeGreaterThanOrEqual(1));
    expect(screen.getByRole('button', { name: /Retos/ })).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});

describe('AdminNavbar — menú de usuario', () => {
  it('se cierra al pulsar fuera y permanece al pulsar dentro', async () => {
    montar();
    await screen.findByText('JADDA SPORTS');
    const opciones = await abrirMenuUsuario();

    const panel = document.getElementById('admin-menu-usuario') as HTMLElement;
    fireEvent.mouseDown(panel);
    expect(opciones).toHaveAttribute('aria-expanded', 'true');

    fireEvent.mouseDown(document.body);
    await waitFor(() => expect(opciones).toHaveAttribute('aria-expanded', 'false'));
    expect(screen.queryByRole('button', { name: /Configuración/ })).not.toBeInTheDocument();
  });

  it('Configuración cierra el menú y navega a su pantalla', async () => {
    montar('/admin/productos/9');
    await screen.findByText('JADDA SPORTS');
    await abrirMenuUsuario();

    fireEvent.click(screen.getByRole('button', { name: /Configuración/ }));

    expect(await screen.findByTestId('sonda-config')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Configuración/ })).not.toBeInTheDocument();
  });

  it('Cerrar sesión hace POST y vuelve a la tienda', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    montar();
    await screen.findByText('JADDA SPORTS');
    await abrirMenuUsuario();

    fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));

    await waitFor(() => expect(logoutPost).toBe(1));
    expect(await screen.findByTestId('sonda-tienda')).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('un guardia de navegación que deniega cancela el cierre de sesión', async () => {
    setGuardiaNavegacion(async () => false);
    try {
      montar();
      await screen.findByText('JADDA SPORTS');
      await abrirMenuUsuario();

      fireEvent.click(screen.getByRole('button', { name: /Cerrar sesión/ }));

      await waitFor(() => expect(screen.queryByRole('button', { name: /Configuración/ })).not.toBeInTheDocument());
      expect(logoutPost).toBe(0);
      expect(screen.queryByTestId('sonda-tienda')).not.toBeInTheDocument();
    } finally {
      setGuardiaNavegacion(null);
    }
  });
});

describe('AdminNavbar — panel móvil y marca', () => {
  it('el fondo cierra el panel con clic, Enter y Espacio', async () => {
    const { container } = montar();
    await screen.findByText('JADDA SPORTS');

    const alternar = screen.getByRole('button', { name: 'Abrir menú' });
    const barra = container.querySelector('aside.admin-sidebar') as HTMLElement;

    fireEvent.click(alternar);
    await waitFor(() => expect(barra.className).toContain('admin-sidebar-open'));
    fireEvent.keyDown(container.querySelector('.admin-sidebar-backdrop') as Element, { key: 'x' });
    expect(barra.className).toContain('admin-sidebar-open');
    fireEvent.keyDown(container.querySelector('.admin-sidebar-backdrop') as Element, { key: 'Enter' });
    await waitFor(() => expect(barra.className).not.toContain('admin-sidebar-open'));

    fireEvent.click(alternar);
    await waitFor(() => expect(barra.className).toContain('admin-sidebar-open'));
    fireEvent.keyDown(container.querySelector('.admin-sidebar-backdrop') as Element, { key: ' ' });
    await waitFor(() => expect(barra.className).not.toContain('admin-sidebar-open'));

    fireEvent.click(alternar);
    await waitFor(() => expect(barra.className).toContain('admin-sidebar-open'));
    fireEvent.click(container.querySelector('.admin-sidebar-backdrop') as Element);
    await waitFor(() => expect(barra.className).not.toContain('admin-sidebar-open'));
  });

  it('la marca navega al dashboard con clic, Enter y Espacio', async () => {
    for (const activador of ['click', 'Enter', ' ']) {
      const { container, unmount } = montar('/admin/productos/9');
      await screen.findByText('JADDA SPORTS');

      const marca = container.querySelector('.admin-sidebar-brand') as HTMLElement;
      if (activador === 'click') fireEvent.click(marca);
      else fireEvent.keyDown(marca, { key: activador });

      await waitFor(() => expect(container.querySelector('.admin-sidebar-link.active')).toHaveTextContent('Dashboard'));
      unmount();
    }
  });

  it('una subruta conserva activa la pestaña de su sección', async () => {
    montar('/admin/productos/9');
    await screen.findByText('JADDA SPORTS');

    expect(screen.getByRole('button', { name: /Productos/ })).toHaveClass('active');
    expect(screen.getByRole('button', { name: 'Dashboard' })).not.toHaveClass('active');
  });
});

describe('AdminNavbar — sondeo', () => {
  it('refresca al recuperar el foco y al cambiar la visibilidad a visible', async () => {
    montar();
    await screen.findByText('JADDA SPORTS');
    await waitFor(() => expect(pendientesGet).toBeGreaterThanOrEqual(1));
    const inicial = pendientesGet;

    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(pendientesGet).toBe(inicial + 1));

    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(pendientesGet).toBe(inicial + 2));
  });
});
