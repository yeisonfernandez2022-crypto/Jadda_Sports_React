import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersVendedoresAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminVendedores from '../../../frontend/src/admin/AdminVendedores.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Solicitudes de vendedor contra su código REAL: listado, filtros por estado,
 * gestión de la pendiente (aprobar/rechazar con POST) y productos del vendedor.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

beforeEach(() => {
  ({ api, handlers } = handlersVendedoresAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminVendedores', () => {
  it('carga el listado con el contador de pendientes', async () => {
    renderAdmin(<AdminVendedores />);

    expect(await screen.findByRole('heading', { name: /Vendedores/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/1 pendiente\(s\)/)).toBeInTheDocument());
    expect(screen.getByRole('row', { name: /Deportes Andes ADMIN-TEST/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Ciclistas Valle ADMIN-TEST/ })).toBeInTheDocument();
    expect(screen.getByText(/2 solicitudes$/)).toBeInTheDocument();
  });

  it('el filtro por estado deja solo la fila correspondiente', async () => {
    renderAdmin(<AdminVendedores />);
    await screen.findByRole('row', { name: /Deportes Andes ADMIN-TEST/ });

    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }));

    await waitFor(() => expect(screen.queryByRole('row', { name: /Deportes Andes ADMIN-TEST/ })).not.toBeInTheDocument());
    expect(screen.getByRole('row', { name: /Ciclistas Valle ADMIN-TEST/ })).toBeInTheDocument();
    expect(screen.getByText(/1 solicitud$/)).toBeInTheDocument();
  });

  it('gestionar la pendiente: modal con datos, motivo de rechazo y productos del vendedor', async () => {
    renderAdmin(<AdminVendedores />);
    const fila = await screen.findByRole('row', { name: /Deportes Andes ADMIN-TEST/ });

    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));

    expect(await screen.findByRole('heading', { name: 'Deportes Andes ADMIN-TEST' })).toBeInTheDocument();
    // El modal duplica datos de la tabla: las aserciones de texto van dentro.
    const modal = screen.getByRole('heading', { name: 'Deportes Andes ADMIN-TEST' }).closest('.au-modal') as HTMLElement;
    expect(screen.getByText('EN REVISIÓN')).toBeInTheDocument();
    expect(within(modal).getByText('laura@andes.test')).toBeInTheDocument();
    // Productos filtrados por ID_VENDEDOR 66 (los de otro vendedor quedan fuera).
    expect(await screen.findByText('Camiseta Vendedor ADMIN-TEST')).toBeInTheDocument();
    expect(screen.queryByText('Casco Otro ADMIN-TEST')).not.toBeInTheDocument();
    // La pendiente ofrece aprobar y rechazar.
    expect(screen.getByRole('button', { name: 'Aprobar y enviar credenciales' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
  });

  it('aprobar la solicitud: POST con estado APROBADA y refresco', async () => {
    renderAdmin(<AdminVendedores />);
    const fila = await screen.findByRole('row', { name: /Deportes Andes ADMIN-TEST/ });
    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));
    await screen.findByText('EN REVISIÓN');

    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y enviar credenciales' }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Aprobar solicitud?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/vendedor/admin/31/procesar', cuerpo: { estado: 'APROBADA' },
    })));
    // Tras el POST, la solicitud deja de estar pendiente.
    await waitFor(() => expect(screen.getByText(/0 pendiente\(s\)/)).toBeInTheDocument());
  });

  it('rechazar la solicitud: POST con estado y observación del motivo', async () => {
    (Swal.fire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isConfirmed: true, value: 'Motivo ADMIN-TEST' });
    renderAdmin(<AdminVendedores />);
    const fila = await screen.findByRole('row', { name: /Deportes Andes ADMIN-TEST/ });
    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));
    await screen.findByText('EN REVISIÓN');

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/vendedor/admin/31/procesar',
      cuerpo: { estado: 'RECHAZADA', observacion: 'Motivo ADMIN-TEST' },
    })));
  });

  it('error del servidor al procesar: mensaje de advertencia', async () => {
    server.use(
      http.post('*/api/vendedor/admin/:id/procesar', () =>
        HttpResponse.json({ ok: false, msg: 'Error del servidor ADMIN-TEST' }, { status: 500 })),
    );
    renderAdmin(<AdminVendedores />);
    const fila = await screen.findByRole('row', { name: /Deportes Andes ADMIN-TEST/ });
    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));
    await screen.findByText('EN REVISIÓN');

    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y enviar credenciales' }));

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'Error del servidor ADMIN-TEST' })));
  });
});
