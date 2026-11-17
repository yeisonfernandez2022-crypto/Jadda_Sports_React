import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersCaracteristicasAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminProductoCaracteristicas from '../../../frontend/src/admin/AdminProductoCaracteristicas.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Gestión de características de un producto contra su código REAL. El panel
 * lee useParams (ruta real: /admin/caracteristicas/:idProducto), así que se
 * monta dentro de una Route con el mismo patrón de App.tsx.
 */

const montar = () =>
  renderAdmin(
    <Routes>
      <Route path="/admin/caracteristicas/:idProducto" element={<AdminProductoCaracteristicas />} />
    </Routes>,
    { ruta: '/admin/caracteristicas/9' },
  );

let api: ApiAdmin;
let handlers: RequestHandler[];

beforeEach(() => {
  ({ api, handlers } = handlersCaracteristicasAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminProductoCaracteristicas', () => {
  it('carga la lista de características del producto de la ruta', async () => {
    montar();

    expect(await screen.findByText('Gestionar Características')).toBeInTheDocument();
    // Timeout holgado: es el primer test del archivo (arranque frío de MSW).
    expect(await screen.findByText('Material:', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Cuero sintético')).toBeInTheDocument();
    expect(screen.getByText('Suela:')).toBeInTheDocument();
    expect(screen.getByText('TPU')).toBeInTheDocument();
  });

  it('agrega una característica: POST con el cuerpo y recarga con la fila nueva', async () => {
    montar();
    await screen.findByText('Material:');

    fireEvent.change(screen.getByPlaceholderText('Ej: Material'), { target: { value: 'Costura' } });
    fireEvent.change(screen.getByPlaceholderText('Ej: Algodón'), { target: { value: 'Reforzada ADMIN-TEST' } });
    fireEvent.click(screen.getByRole('button', { name: '+' }));

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST',
      cuerpo: { NOMBRE_ATRIBUTO: 'Costura', VALOR_ATRIBUTO: 'Reforzada ADMIN-TEST' },
    })));
    expect(Swal.fire).toHaveBeenCalledWith('Éxito', 'Característica añadida', 'success');
    expect(await screen.findByText('Costura:')).toBeInTheDocument();
    expect(screen.getByText('Reforzada ADMIN-TEST')).toBeInTheDocument();
  });

  it('campos vacíos: sin POST y sin Swal', async () => {
    montar();
    await screen.findByText('Material:');

    fireEvent.click(screen.getByRole('button', { name: '+' }));

    expect(api.peticiones.some((p) => p.metodo === 'POST')).toBe(false);
    expect(Swal.fire).not.toHaveBeenCalled();
    // La lista no cambió.
    expect(screen.getByText('Suela:')).toBeInTheDocument();
  });

  it('elimina una característica tras confirmar: DELETE y fila fuera', async () => {
    montar();
    const fila = await screen.findByText('Material:');
    const item = fila.closest('li') as HTMLElement;

    fireEvent.click(within(item).getByRole('button', { name: 'X' }));

    await waitFor(() => expect(api.peticiones.some((p) => p.metodo === 'DELETE' && p.ruta === '/api/caracteristicas/21')).toBe(true));
    await waitFor(() => expect(screen.queryByText('Cuero sintético')).not.toBeInTheDocument());
    expect(screen.getByText('Suela:')).toBeInTheDocument();
  });

  it('error 500 al agregar: sin éxito y lista intacta', async () => {
    server.use(
      http.post('*/api/productos/:id/caracteristicas', () =>
        HttpResponse.json({ ok: false }, { status: 500 })),
    );
    montar();
    await screen.findByText('Material:');

    fireEvent.change(screen.getByPlaceholderText('Ej: Material'), { target: { value: 'Costura' } });
    fireEvent.click(screen.getByRole('button', { name: '+' }));

    // El panel solo reacciona a res.ok: con 500 no muestra Swal ni recarga.
    expect(Swal.fire).not.toHaveBeenCalled();
    expect(screen.queryByText('Costura:')).not.toBeInTheDocument();
    expect(screen.getByText('Suela:')).toBeInTheDocument();
  });
});
