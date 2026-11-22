import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { server } from '../setup';
import {
  HANDLERS_ADMIN,
  USUARIO_DETALLE_ADMIN,
  handlersUsuariosAdmin,
  type RequestHandler,
} from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import DetalleUsuarioAdmin from '../../../frontend/src/admin/DetalleUsuarioAdmin.tsx';

/**
 * Página de detalle de usuario del panel admin: encabezado claro, KPIs,
 * compras colapsadas que se expanden con envío/pago/ítems, actividad de
 * vendedor y estados de error/vacío. Consume GET /api/admin/usuarios/:id.
 */

let handlers: RequestHandler[];

const renderDetalle = (ruta = '/admin/usuarios/7') =>
  renderAdmin(
    <Routes>
      <Route path="/admin/usuarios/:id" element={<DetalleUsuarioAdmin />} />
      <Route path="/admin/usuarios" element={<p>lista-usuarios</p>} />
      <Route path="/admin/vendedores/:id" element={<p>detalle-vendedor</p> } />
    </Routes>,
    { ruta }
  );

const servirDetalle = (detalle: typeof USUARIO_DETALLE_ADMIN) => {
  server.use(http.get('*/api/admin/usuarios/:id', () => HttpResponse.json(detalle)));
};

beforeEach(() => {
  ({ handlers } = handlersUsuariosAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('DetalleUsuarioAdmin', () => {
  it('muestra el encabezado y expande una compra con ítems, pago y envío', async () => {
    renderDetalle();

    expect(await screen.findByRole('heading', { level: 1, name: /Ana Compradora/i })).toBeInTheDocument();
    expect(screen.getByText(/@ana · ana@test\.local/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a usuarios/i })).toHaveAttribute('href', '/admin/usuarios');

    const toggle = screen.getByRole('button', { name: /ver detalle de la compra 9/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Guayos ADMIN-TEST')).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Guayos ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('DeporteX ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText(/Cali/)).toBeInTheDocument();
    expect(screen.getByText(/Deportes Andinos/)).toBeInTheDocument();
    expect(screen.getByText('WOMPI-ADMIN-TEST')).toBeInTheDocument();
  });

  it('un vendedor conserva sus compras y enlaza a su ficha de vendedor', async () => {
    servirDetalle({
      ...USUARIO_DETALLE_ADMIN,
      usuario: { ...USUARIO_DETALLE_ADMIN.usuario, ID_ROL: 6, NOMBRE_ROL: 'Vendedor' },
      stats: {
        ...USUARIO_DETALLE_ADMIN.stats,
        productosPublicados: 4, unidadesVendidas: 9, totalVentas: 3, totalIngresos: 500000,
      },
      vendedor: {
        ID_VENDEDOR: 33, ID_SOLICITUD: 33, NOMBRE_EMPRESA: 'Tienda Vendedor ADMIN-TEST',
        ESTADO: 'ACTIVO', NIT: '900999', CIUDAD: 'Bogotá', DEPARTAMENTO: 'Cundinamarca',
      },
    });
    renderDetalle();

    expect(await screen.findByRole('heading', { level: 1, name: /Ana Compradora/i })).toBeInTheDocument();
    expect(screen.getByText(/Actividad como vendedor/i)).toBeInTheDocument();
    expect(screen.getByText(/Tienda Vendedor ADMIN-TEST/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver ficha del vendedor/i })).toHaveAttribute('href', '/admin/vendedores/33');
    expect(screen.getByRole('button', { name: /ver detalle de la compra 9/i })).toBeInTheDocument();
  });

  it('una compra sin dirección muestra "Sin datos de envío"', async () => {
    servirDetalle({
      ...USUARIO_DETALLE_ADMIN,
      compras: [
        {
          ...USUARIO_DETALLE_ADMIN.compras[0],
          ENVIO_DIRECCION: null,
          ENVIO_CIUDAD: null,
          ENVIO_BARRIO: null,
          ENVIO_DEPARTAMENTO: null,
        },
      ],
    });
    renderDetalle();

    fireEvent.click(await screen.findByRole('button', { name: /ver detalle de la compra 9/i }));

    expect(screen.getByText('Sin datos de envío')).toBeInTheDocument();
  });

  it('filtra las compras por texto y muestra el estado sin resultados', async () => {
    renderDetalle();
    await screen.findByRole('heading', { level: 1, name: /Ana Compradora/i });

    const buscador = screen.getByPlaceholderText(/buscar por pedido, producto o método/i);
    fireEvent.change(buscador, { target: { value: 'Nequi' } });

    expect(screen.getByRole('button', { name: /ver detalle de la compra 502/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ver detalle de la compra 9/i })).not.toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: 'no-existe-ADMIN-TEST' } });
    expect(screen.getByText('Sin resultados con esos filtros')).toBeInTheDocument();
  });

  it('sin compras muestra el estado vacío', async () => {
    servirDetalle({ ...USUARIO_DETALLE_ADMIN, compras: [] });
    renderDetalle();

    expect(await screen.findByText('Sin compras registradas')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/buscar por pedido/i)).not.toBeInTheDocument();
  });

  it('error de carga: muestra el mensaje y reintenta', async () => {
    let intentos = 0;
    server.use(http.get('*/api/admin/usuarios/:id', () => {
      intentos += 1;
      return intentos === 1
        ? HttpResponse.json({ ok: false, msg: 'Error del servidor ADMIN-TEST' }, { status: 500 })
        : HttpResponse.json(USUARIO_DETALLE_ADMIN);
    }));
    renderDetalle();

    expect(await screen.findByText('Error del servidor ADMIN-TEST')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 1, name: /Ana Compradora/i })).toBeInTheDocument();
    expect(intentos).toBe(2);
  });

  it('el enlace Volver a usuarios navega al listado', async () => {
    renderDetalle();

    fireEvent.click(await screen.findByRole('link', { name: /volver a usuarios/i }));

    expect(await screen.findByText('lista-usuarios')).toBeInTheDocument();
  });

  it('los KPIs muestran compras, gasto, favoritos y retos', async () => {
    const { container } = renderDetalle();
    await screen.findByRole('heading', { level: 1, name: /Ana Compradora/i });

    const kpis = container.querySelectorAll('.adp-kpi');
    const textos = Array.from(kpis).map((k) => k.textContent || '');
    expect(textos.some((t) => /Compras/i.test(t))).toBe(true);
    expect(textos.some((t) => /Gastado/i.test(t))).toBe(true);
    expect(textos.some((t) => /Favoritos/i.test(t))).toBe(true);
    expect(textos.some((t) => /Retos/i.test(t))).toBe(true);
  });

  it('mantiene el detalle aislado por id de la URL', async () => {
    const { unmount } = renderDetalle('/admin/usuarios/7');
    await screen.findByRole('heading', { level: 1, name: /Ana Compradora/i });

    unmount();
    renderDetalle('/admin/usuarios/99');
    expect(await screen.findByRole('heading', { level: 1, name: /Ana Compradora/i })).toBeInTheDocument();
    expect(within(document.body).getByText(/@ana/)).toBeInTheDocument();
  });
});
