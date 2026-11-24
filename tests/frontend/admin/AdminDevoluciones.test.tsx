import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersDevolucionesAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminDevoluciones from '../../../frontend/src/admin/AdminDevoluciones.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Panel de devoluciones y reembolsos (RF-033) contra su código REAL: listado
 * con filtros tipo/estado/búsqueda, modal de gestión con encabezado compacto,
 * las cuatro decisiones (devolver, reembolsar, pedir más pruebas, rechazar) y
 * el historial cerrado en solo lectura.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

beforeEach(() => {
  ({ api, handlers } = handlersDevolucionesAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminDevoluciones', () => {
  it('carga el listado con pendientes, tipo por solicitud, nota de tiendas y filas aprobadas', async () => {
    renderAdmin(<AdminDevoluciones />);

    expect(await screen.findByRole('heading', { name: 'Devoluciones y reembolsos' })).toBeInTheDocument();
    // Subtítulo: 3 solicitudes en estados de revisión (2 SOLICITADA + 1 ESCALADA).
    await waitFor(() => expect(screen.getByText(/3 solicitud\(es\) pendientes de revisión/)).toBeInTheDocument());
    // Badges de tipo según TIPO/MOTIVO (esReembolso).
    expect(screen.getAllByText('Devolución').length).toBe(4);
    expect(screen.getAllByText('Reembolso').length).toBe(1);
    // Estados y pedido visible.
    expect(screen.getAllByText('En revisión').length).toBe(2);
    expect(screen.getAllByText('Aprobada').length).toBe(2);
    expect(screen.getByText('Escalada — decide JADDA')).toBeInTheDocument();
    expect(screen.getByText('Guayos Dev ADMIN-TEST')).toBeInTheDocument();
    // Las devoluciones de tienda solo llegan al panel al escalarse o cerrarse.
    expect(screen.getByText('Las devoluciones de tiendas aparecen cuando el vendedor las escala o las cierra.')).toBeInTheDocument();
  });

  it('los filtros de tipo dejan solo las filas correspondientes', async () => {
    renderAdmin(<AdminDevoluciones />);
    await screen.findByText('Guayos Dev ADMIN-TEST');

    fireEvent.click(screen.getByRole('button', { name: 'Reembolsos (1)' }));
    await waitFor(() => expect(screen.queryByText('Guayos Dev ADMIN-TEST')).not.toBeInTheDocument());
    expect(screen.getByText('Balón Dev ADMIN-TEST')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Devoluciones (4)' }));
    await waitFor(() => expect(screen.queryByText('Balón Dev ADMIN-TEST')).not.toBeInTheDocument());
    expect(screen.getByText('Guayos Dev ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Camiseta Dev ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Zapatillas Escalada ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Casco Tienda ADMIN-TEST')).toBeInTheDocument();
  });

  it('el buscador filtra por producto y el estado por botón', async () => {
    renderAdmin(<AdminDevoluciones />);
    await screen.findByText('Guayos Dev ADMIN-TEST');

    fireEvent.change(screen.getByPlaceholderText('Buscar por cliente, correo, pedido o producto...'), { target: { value: 'Balón' } });
    await waitFor(() => expect(screen.queryByText('Guayos Dev ADMIN-TEST')).not.toBeInTheDocument());
    expect(screen.getByText('Balón Dev ADMIN-TEST')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por cliente, correo, pedido o producto...'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Aprobada \(2\)/ }));
    await waitFor(() => expect(screen.queryByText('Guayos Dev ADMIN-TEST')).not.toBeInTheDocument());
    expect(screen.getByText('Camiseta Dev ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Casco Tienda ADMIN-TEST')).toBeInTheDocument();
  });

  it('gestionar una devolución JADDA: encabezado compacto, datos, evidencias y botones de decisión', async () => {
    renderAdmin(<AdminDevoluciones />);
    const fila = await screen.findByRole('row', { name: /Guayos Dev ADMIN-TEST/ });
    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));

    expect(await screen.findByRole('heading', { name: 'Carla' })).toBeInTheDocument();
    expect(screen.getByText(/@carla · carla@test\.local/)).toBeInTheDocument();
    const modal = screen.getByRole('heading', { name: 'Carla' }).closest('.au-modal') as HTMLElement;
    // El hero azul se reemplazó por la cabecera clara compartida.
    expect(modal.querySelector('.adp-header--compacto')).not.toBeNull();
    expect(modal.querySelector('.au-modal-hero')).toBeNull();
    expect(within(modal).getByText('JADDA')).toBeInTheDocument();
    // El motivo también se ve en la tabla: las aserciones de texto van en el modal.
    expect(within(modal).getByText(/Talla incorrecta/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Evidencias del cliente \(2\)/ })).toBeInTheDocument();
    expect(screen.getByAltText('Evidencia 1')).toBeInTheDocument();
    expect(screen.getByAltText('Evidencia 2')).toBeInTheDocument();
    // Una devolución NO reembolso ofrece aceptar devolución y reembolsar sin devolver.
    expect(screen.getByRole('button', { name: 'Aceptar devolución' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reembolsar sin devolver' })).toBeInTheDocument();
    // Siempre disponibles: más pruebas y rechazar.
    expect(screen.getByRole('button', { name: 'Pedir más pruebas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
  });

  it('un reembolso muestra el botón dedicado y la nota de no reingreso de stock', async () => {
    renderAdmin(<AdminDevoluciones />);
    const fila = await screen.findByRole('row', { name: /Balón Dev ADMIN-TEST/ });
    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));

    expect(await screen.findByRole('heading', { name: 'Carla' })).toBeInTheDocument();
    const modal = screen.getByRole('heading', { name: 'Carla' }).closest('.au-modal') as HTMLElement;
    expect(within(modal).getByText('Reembolso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar reembolso' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar devolución' })).not.toBeInTheDocument();
  });

  it('una devolución escalada por la tienda muestra badge y origen del vendedor', async () => {
    renderAdmin(<AdminDevoluciones />);
    const fila = await screen.findByRole('row', { name: /Zapatillas Escalada ADMIN-TEST/ });
    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));

    expect(await screen.findByRole('heading', { name: 'Carla' })).toBeInTheDocument();
    const modal = screen.getByRole('heading', { name: 'Carla' }).closest('.au-modal') as HTMLElement;
    expect(modal.querySelector('.adp-header--compacto')).not.toBeNull();
    expect(within(modal).getByText('Escalada a JADDA')).toBeInTheDocument();
    expect(within(modal).getByText('Tienda: DeporteX ADMIN-TEST')).toBeInTheDocument();
    // Sigue siendo gestionable mientras no esté cerrada.
    expect(screen.getByRole('button', { name: 'Pedir más pruebas' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
  });

  it('una devolución cerrada muestra el historial de solo lectura y no ofrece acciones', async () => {
    renderAdmin(<AdminDevoluciones />);
    const fila = await screen.findByRole('row', { name: /Casco Tienda ADMIN-TEST/ });
    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));

    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent(/Historial de solo lectura/);
    expect(banner).toHaveTextContent(/Procesada el/);
    expect(banner).toHaveTextContent(/Observación: Devolución aceptada ADMIN-TEST/);

    const modal = screen.getByRole('heading', { name: 'Carla' }).closest('.au-modal') as HTMLElement;
    expect(within(modal).queryByRole('button', { name: /Aprobar/i })).not.toBeInTheDocument();
    expect(within(modal).queryByRole('button', { name: /Rechazar/i })).not.toBeInTheDocument();
    expect(within(modal).queryByRole('button', { name: /Pedir más pruebas/i })).not.toBeInTheDocument();
    expect(modal.querySelector('.evidencia-modal-footer')).toBeNull();
  });

  it('aceptar la devolución: POST con decision devolver y fila pasa a Aprobada', async () => {
    renderAdmin(<AdminDevoluciones />);
    const fila = await screen.findByRole('row', { name: /Guayos Dev ADMIN-TEST/ });
    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar devolución' }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Aceptar esta devolución?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/devoluciones/admin/81/procesar', cuerpo: { decision: 'devolver', observacion: undefined },
    })));
    // El modal se cierra y el listado refrescado marca la fila como aprobada.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Carla' })).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText('Aprobada').length).toBe(3));
  });

  it('pedir más pruebas con observación: POST con el textarea del Swal', async () => {
    (Swal.fire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isConfirmed: true, value: 'Fotos del empaque ADMIN-TEST' });
    renderAdmin(<AdminDevoluciones />);
    const fila = await screen.findByRole('row', { name: /Guayos Dev ADMIN-TEST/ });
    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Pedir más pruebas' }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Pedir más pruebas?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/devoluciones/admin/81/procesar',
      cuerpo: { decision: 'mas_pruebas', observacion: 'Fotos del empaque ADMIN-TEST' },
    })));
  });

  it('rechazar sin observación: SIN POST (el panel exige value en el Swal)', async () => {
    (Swal.fire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isConfirmed: true, value: '' });
    renderAdmin(<AdminDevoluciones />);
    const fila = await screen.findByRole('row', { name: /Guayos Dev ADMIN-TEST/ });
    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Rechazar' }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Rechazar esta solicitud?' }));
    // El panel hace `if (!value) return` → no hay petición y el modal queda
    // abierto para reintentar.
    await waitFor(() => expect(api.peticiones.some((p) => p.metodo === 'POST')).toBe(false));
    expect(screen.getByRole('heading', { name: 'Carla' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
  });

  it('error del servidor al procesar: advertencia con el mensaje del backend', async () => {
    server.use(
      http.post('*/api/devoluciones/admin/:id/procesar', () =>
        HttpResponse.json({ ok: false, msg: 'Error del servidor ADMIN-TEST' }, { status: 500 })),
    );
    renderAdmin(<AdminDevoluciones />);
    const fila = await screen.findByRole('row', { name: /Guayos Dev ADMIN-TEST/ });
    fireEvent.click(within(fila).getByRole('button', { name: 'Gestionar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar devolución' }));

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'Error del servidor ADMIN-TEST' })));
  });
});
