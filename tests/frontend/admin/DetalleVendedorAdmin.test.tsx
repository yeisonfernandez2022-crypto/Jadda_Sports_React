import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { server } from '../setup';
import { DETALLE_VENDEDOR_APROBADO_ADMIN, HANDLERS_ADMIN, handlersVendedoresAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import DetalleVendedorAdmin from '../../../frontend/src/admin/DetalleVendedorAdmin.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Página de detalle de una solicitud de vendedor: encabezado claro, KPIs de
 * desempeño, catálogo, ventas recientes y acciones de aprobar/rechazar.
 * Consume GET /api/vendedor/admin/:id y POST .../procesar.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

const renderDetalle = (ruta = '/admin/vendedores/33') =>
  renderAdmin(
    <Routes>
      <Route path="/admin/vendedores/:id" element={<DetalleVendedorAdmin />} />
      <Route path="/admin/vendedores" element={<p>lista-vendedores</p>} />
      <Route path="/admin/usuarios/:id" element={<p>detalle-usuario</p>} />
    </Routes>,
    { ruta }
  );

beforeEach(() => {
  ({ api, handlers } = handlersVendedoresAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('DetalleVendedorAdmin', () => {
  it('muestra el encabezado, los KPIs, el catálogo y las ventas de la tienda aprobada', async () => {
    renderDetalle();

    expect(await screen.findByRole('heading', { level: 1, name: /Deportes Andinos ADMIN-TEST/i })).toBeInTheDocument();
    expect(screen.getByText(/@laura · laura@andes\.test/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a vendedores/i })).toHaveAttribute('href', '/admin/vendedores');
    expect(screen.getByRole('link', { name: /ver usuario/i })).toHaveAttribute('href', '/admin/usuarios/62');

    const kpiUnidades = screen.getByText('Unidades vendidas').closest('.adp-kpi') as HTMLElement;
    expect(within(kpiUnidades).getByText('7')).toBeInTheDocument();

    const kpiIngresos = screen.getByText('Ingresos').closest('.adp-kpi') as HTMLElement;
    expect(within(kpiIngresos).getByText(/\$ 210\.000/)).toBeInTheDocument();

    expect(screen.getByText('Guayos ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Camiseta Vendedor ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText(/Cliente Reciente/)).toBeInTheDocument();

    // Una solicitud aprobada ya no ofrece acciones de aprobar o rechazar.
    expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rechazar/i })).not.toBeInTheDocument();
  });

  it('sin ID_USUARIO no muestra el enlace ni deja escapar el 0 en las acciones', async () => {
    server.use(
      http.get('*/api/vendedor/admin/:id', () => HttpResponse.json({
        ...DETALLE_VENDEDOR_APROBADO_ADMIN,
        solicitud: { ...DETALLE_VENDEDOR_APROBADO_ADMIN.solicitud, ID_USUARIO: 0 },
      })),
    );
    renderDetalle();

    expect(await screen.findByRole('heading', { level: 1, name: /Deportes Andinos ADMIN-TEST/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /ver usuario/i })).not.toBeInTheDocument();
    const acciones = document.querySelector('.adp-header-actions') as HTMLElement;
    expect(acciones.textContent).toBe('');
  });

  it('una solicitud pendiente sin tienda muestra el aviso y las acciones', async () => {
    renderDetalle('/admin/vendedores/34');

    expect(await screen.findByText('Solicitud pendiente: todavía no tiene tienda aprobada')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Tienda Pendiente ADMIN-TEST/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aprobar y enviar credenciales/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver usuario/i })).toHaveAttribute('href', '/admin/usuarios/63');
  });

  it('aprobar confirma, hace POST y recarga el detalle', async () => {
    renderDetalle('/admin/vendedores/34');
    await screen.findByText('Solicitud pendiente: todavía no tiene tienda aprobada');

    fireEvent.click(screen.getByRole('button', { name: /aprobar y enviar credenciales/i }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Aprobar solicitud?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST',
      ruta: '/api/vendedor/admin/34/procesar',
      cuerpo: { estado: 'APROBADA' },
    })));
    await waitFor(() => {
      const lecturas = api.peticiones.filter((p) => p.metodo === 'GET' && p.ruta === '/api/vendedor/admin/34');
      expect(lecturas).toHaveLength(2);
    });
    // Tras el refresco la solicitud deja de estar pendiente y oculta las acciones.
    await waitFor(() => expect(screen.queryByRole('button', { name: /aprobar/i })).not.toBeInTheDocument());
  });

  it('rechazar exige observación y la envía en el POST', async () => {
    (Swal.fire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isConfirmed: true, value: 'Motivo ADMIN-TEST' });
    renderDetalle('/admin/vendedores/34');
    await screen.findByText('Solicitud pendiente: todavía no tiene tienda aprobada');

    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ input: 'textarea' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST',
      ruta: '/api/vendedor/admin/34/procesar',
      cuerpo: { estado: 'RECHAZADA', observacion: 'Motivo ADMIN-TEST' },
    })));
  });

  it('si se cancela el motivo del rechazo no se hace POST', async () => {
    (Swal.fire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isConfirmed: false });
    renderDetalle('/admin/vendedores/34');
    await screen.findByText('Solicitud pendiente: todavía no tiene tienda aprobada');

    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ input: 'textarea' })));
    expect(api.peticiones.filter((p) => p.metodo === 'POST')).toHaveLength(0);
  });

  it('un error del servidor al procesar muestra la advertencia', async () => {
    server.use(
      http.post('*/api/vendedor/admin/:id/procesar', () =>
        HttpResponse.json({ ok: false, msg: 'Error del servidor ADMIN-TEST' }, { status: 500 })),
    );
    renderDetalle('/admin/vendedores/34');
    await screen.findByText('Solicitud pendiente: todavía no tiene tienda aprobada');

    fireEvent.click(screen.getByRole('button', { name: /aprobar y enviar credenciales/i }));

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      title: 'Error del servidor ADMIN-TEST',
    })));
  });

  it('una solicitud inexistente muestra el error y el enlace de vuelta', async () => {
    renderDetalle('/admin/vendedores/999');

    expect(await screen.findByText(/Solicitud no encontrada/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a vendedores/i })).toHaveAttribute('href', '/admin/vendedores');
  });
});
