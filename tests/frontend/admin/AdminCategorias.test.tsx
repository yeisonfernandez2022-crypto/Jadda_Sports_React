import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import {
  HANDLERS_ADMIN, handlersCategoriasAdmin, type ApiAdmin, type RequestHandler,
} from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminCategorias from '../../../frontend/src/admin/AdminCategorias.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Panel de categorías (RF-027) contra su código REAL: listado, búsqueda,
 * alta por modal, eliminación con guardia de productos y rutas de error.
 * Caracterización: los handlers MSW replican el contrato del backend.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

beforeEach(() => {
  ({ api, handlers } = handlersCategoriasAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminCategorias', () => {
  it('carga el listado con encabezados, contador y filas del catálogo', async () => {
    renderAdmin(<AdminCategorias />);

    expect(await screen.findByRole('heading', { name: 'Categorías' })).toBeInTheDocument();
    // Ancla al DATO del GET (no al subtítulo, que existe siempre). Timeout
    // holgado: es el primer test del archivo (arranque frío de MSW).
    expect(await screen.findByRole('cell', { name: 'Fútbol ADMIN-TEST' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/— crea, edita o elimina las categorías/)).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Running ADMIN-TEST' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Gimnasio ADMIN-TEST' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Buscar categoría/)).toBeInTheDocument();
  });

  it('el buscador filtra por nombre y actualiza el contador', async () => {
    renderAdmin(<AdminCategorias />);
    await screen.findByRole('cell', { name: 'Fútbol ADMIN-TEST' });

    fireEvent.change(screen.getByPlaceholderText(/Buscar categoría/), { target: { value: 'running' } });

    await waitFor(() => expect(screen.queryByRole('cell', { name: 'Fútbol ADMIN-TEST' })).not.toBeInTheDocument());
    expect(screen.getByRole('cell', { name: 'Running ADMIN-TEST' })).toBeInTheDocument();
    expect(screen.getByText(/1 categoría$/)).toBeInTheDocument();
  });

  it('crea una categoría desde el modal: POST emitido y fila nueva en la lista', async () => {
    renderAdmin(<AdminCategorias />);
    await screen.findByRole('cell', { name: 'Fútbol ADMIN-TEST' });

    fireEvent.click(screen.getByRole('button', { name: /Nueva categoría/ }));
    expect(await screen.findByRole('heading', { name: 'Nueva categoría' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Padel ADMIN-TEST' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() => expect(api.peticiones.some((p) => p.metodo === 'POST' && p.ruta === '/api/productos/categorias')).toBe(true));
    expect(api.peticiones.find((p) => p.metodo === 'POST')?.cuerpo).toMatchObject({ name: 'Padel ADMIN-TEST' });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
    // Tras el POST el panel recarga y la fila nueva aparece en la tabla.
    expect(await screen.findByRole('cell', { name: 'Padel ADMIN-TEST' })).toBeInTheDocument();
  });

  it('nombre corto: advertencia de campo obligatorio y SIN petición', async () => {
    renderAdmin(<AdminCategorias />);
    await screen.findByRole('cell', { name: 'Fútbol ADMIN-TEST' });

    fireEvent.click(screen.getByRole('button', { name: /Nueva categoría/ }));
    fireEvent.change(await screen.findByLabelText('Nombre *'), { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear categoría' }));

    expect(Swal.fire).toHaveBeenCalledWith('Campo obligatorio', 'El nombre debe tener al menos 3 caracteres', 'warning');
    expect(api.peticiones.some((p) => p.metodo === 'POST')).toBe(false);
  });

  it('elimina una categoría sin productos tras confirmar: DELETE y fila fuera', async () => {
    renderAdmin(<AdminCategorias />);
    const fila = await screen.findByRole('row', { name: /Fútbol ADMIN-TEST/ });

    fireEvent.click(within(fila).getByTitle('Eliminar'));

    await waitFor(() => expect(api.peticiones.some((p) => p.metodo === 'DELETE' && p.ruta === '/api/productos/categorias/1')).toBe(true));
    await waitFor(() => expect(screen.queryByRole('cell', { name: 'Fútbol ADMIN-TEST' })).not.toBeInTheDocument());
  });

  it('NO permite eliminar una categoría con productos: advertencia y sin DELETE', async () => {
    renderAdmin(<AdminCategorias />);
    const fila = await screen.findByRole('row', { name: /Running ADMIN-TEST/ });

    fireEvent.click(within(fila).getByTitle('Eliminar'));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'No se puede eliminar' }));
    expect(api.peticiones.some((p) => p.metodo === 'DELETE')).toBe(false);
    // La fila sigue en la tabla.
    expect(screen.getByRole('cell', { name: 'Running ADMIN-TEST' })).toBeInTheDocument();
  });

  it('error 500 al guardar: mensaje del servidor, modal abierto y lista intacta', async () => {
    server.use(
      http.post('*/api/productos/categorias', () =>
        HttpResponse.json({ ok: false, msg: 'Error del servidor ADMIN-TEST' }, { status: 500 })),
    );
    renderAdmin(<AdminCategorias />);
    await screen.findByRole('cell', { name: 'Fútbol ADMIN-TEST' });

    fireEvent.click(screen.getByRole('button', { name: /Nueva categoría/ }));
    fireEvent.change(await screen.findByLabelText('Nombre *'), { target: { value: 'Padel ADMIN-TEST' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'Error del servidor ADMIN-TEST' })));
    // El modal sigue abierto para reintentar y el listado no cambió.
    expect(screen.getByRole('heading', { name: 'Nueva categoría' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Gimnasio ADMIN-TEST' })).toBeInTheDocument();
  });
});
