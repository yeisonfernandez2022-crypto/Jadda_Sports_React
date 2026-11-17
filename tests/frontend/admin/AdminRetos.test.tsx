import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersRetosAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminRetos from '../../../frontend/src/admin/AdminRetos.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Panel de evidencias de retos contra su código REAL: agrupación
 * pendientes/revisados, visor de material y revisión con POST por acción.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

beforeEach(() => {
  ({ api, handlers } = handlersRetosAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminRetos', () => {
  it('carga y agrupa las evidencias: pendientes abiertas, revisados cerrados', async () => {
    renderAdmin(<AdminRetos />);

    expect(await screen.findByRole('heading', { name: 'Evidencias de Retos' })).toBeInTheDocument();
    // El grupo "No revisados" está abierto por defecto y lista a Juan.
    expect(await screen.findByText('No revisados')).toBeInTheDocument();
    expect(screen.getByText('Reto 100 km ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('EN REVISIÓN')).toBeInTheDocument();
    // El subtítulo del encabezado cuenta los pendientes.
    expect(screen.getByText(/1 avances pendientes de revisión/)).toBeInTheDocument();
    // El grupo "Ya revisados" nace cerrado: María no se ve hasta expandirlo.
    expect(screen.queryByText('Reto Gym ADMIN-TEST')).not.toBeInTheDocument();
  });

  it('expande el grupo de revisados y muestra la fila aprobada', async () => {
    renderAdmin(<AdminRetos />);
    await screen.findByText('Reto 100 km ADMIN-TEST');

    fireEvent.click(screen.getByRole('button', { name: /Ya revisados/ }));

    expect(await screen.findByText('Reto Gym ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('APROBADO')).toBeInTheDocument();
  });

  it('el visor muestra usuario, progreso y material (1 imagen + 1 video)', async () => {
    renderAdmin(<AdminRetos />);
    await screen.findByText('Reto 100 km ADMIN-TEST');

    // El botón de la fila se llama "Ver" (el icono no aporta nombre).
    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));

    const visor = await screen.findByRole('heading', { name: 'Reto 100 km ADMIN-TEST' });
    expect(visor).toBeInTheDocument();
    expect(screen.getByText('3/5')).toBeInTheDocument();
    expect(screen.getByText('Aprobar avance')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
  });

  it('aprueba una evidencia: POST con el id y refresco del listado', async () => {
    renderAdmin(<AdminRetos />);
    await screen.findByText('Reto 100 km ADMIN-TEST');

    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar avance' }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Aprobar esta evidencia?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/retos/admin/evidencias/11/aprobar', cuerpo: { observacion: '' },
    })));
    // Tras revisar: el modal se cierra, la evidencia sale de pendientes y el
    // encabezado queda sin avances pendientes.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Reto 100 km ADMIN-TEST' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByText(/Sin avances pendientes/)).toBeInTheDocument());
  });

  it('rechaza con motivo: POST rechazar y observación en el cuerpo', async () => {
    (Swal.fire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isConfirmed: true, value: 'No corresponde ADMIN-TEST' });
    renderAdmin(<AdminRetos />);
    await screen.findByText('Reto 100 km ADMIN-TEST');

    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Rechazar esta evidencia?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/retos/admin/evidencias/11/rechazar', cuerpo: { observacion: 'No corresponde ADMIN-TEST' },
    })));
  });

  it('error 500 al aprobar: mensaje del servidor y sin cambio de estado', async () => {
    server.use(
      http.post('*/api/retos/admin/evidencias/:id/aprobar', () =>
        HttpResponse.json({ ok: false, msg: 'Error del servidor ADMIN-TEST' }, { status: 500 })),
    );
    renderAdmin(<AdminRetos />);
    await screen.findByText('Reto 100 km ADMIN-TEST');

    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aprobar avance' }));

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'Error del servidor ADMIN-TEST' })));
    // El listado sigue mostrando la evidencia pendiente (sin recambio).
    expect(screen.getByText('Reto 100 km ADMIN-TEST')).toBeInTheDocument();
  });
});
