import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersCategoriasAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminCategorias from '../../../frontend/src/admin/AdminCategorias.tsx';

/**
 * AdminCategorias — segunda capa de cobertura.
 *
 * Complementa AdminCategorias.test.tsx con la búsqueda por descripción, la
 * edición con PUT, los cierres del modal por overlay, Escape, ✕ y Descartar,
 * la vuelta al dashboard, la cancelación de eliminar y los fallos de red o
 * respuestas sin mensaje en guardar y eliminar.
 */

const { swalFire } = vi.hoisted(() => ({ swalFire: vi.fn() }));

vi.mock('sweetalert2', () => ({
  default: { fire: swalFire },
}));

let api: ApiAdmin;
let handlers: RequestHandler[];

const montar = () =>
  renderAdmin(
    <Routes>
      <Route path="/admin/categorias" element={<AdminCategorias />} />
      <Route path="/admin" element={<div data-testid="sonda-admin" />} />
    </Routes>,
    { ruta: '/admin/categorias' },
  );

const overlay = () => document.querySelector('.evidencia-overlay') as HTMLElement | null;

const abrirNueva = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /Nueva categoría/ }));
  await screen.findByRole('heading', { name: 'Nueva categoría' });
};

beforeEach(() => {
  ({ api, handlers } = handlersCategoriasAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
  swalFire.mockReset().mockResolvedValue({ isConfirmed: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminCategorias — listado y búsqueda', () => {
  it('un fallo de red deja el vacío sin búsqueda y registra el error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get('*/api/productos/categorias', () => HttpResponse.error()));
    montar();

    expect(await screen.findByText('No hay categorías registradas')).toBeInTheDocument();
    expect(screen.getAllByText(/0 categorías?/).length).toBeGreaterThanOrEqual(1);
    expect(errorSpy).toHaveBeenCalledWith('Error al cargar categorías');
  });

  it('busca por descripción y muestra el vacío con el término', async () => {
    montar();
    await screen.findByRole('cell', { name: 'Fútbol ADMIN-TEST' });

    fireEvent.change(screen.getByPlaceholderText(/Buscar categoría/), { target: { value: 'entrenamiento' } });
    expect(await screen.findByRole('cell', { name: 'Running ADMIN-TEST' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Fútbol ADMIN-TEST' })).not.toBeInTheDocument();
    expect(screen.getByText(/1 categoría$/)).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Buscar categoría/), { target: { value: 'zzz' } });
    expect(await screen.findByText('Sin resultados para "zzz"')).toBeInTheDocument();
    expect(screen.getByText(/0 categorías/)).toBeInTheDocument();
  });

  it('tolera categorías sin nombre al filtrar por descripción', async () => {
    server.use(http.get('*/api/productos/categorias', () => HttpResponse.json([
      { ID_CATEGORIA: 9, NOMBRE_CATEGORIA: null, DESCRIPCION: 'Solo descripción', TOTAL_PRODUCTOS: 0 },
    ])));
    montar();

    await screen.findByRole('cell', { name: 'Solo descripción' });
    fireEvent.change(screen.getByPlaceholderText(/Buscar categoría/), { target: { value: 'solo' } });
    expect(await screen.findByRole('cell', { name: 'Solo descripción' })).toBeInTheDocument();
    expect(screen.getByText(/1 categoría$/)).toBeInTheDocument();
  });

  it('Volver al inicio navega al dashboard', async () => {
    montar();
    await screen.findByRole('cell', { name: 'Fútbol ADMIN-TEST' });

    fireEvent.click(screen.getByRole('button', { name: /Volver al inicio/ }));

    expect(await screen.findByTestId('sonda-admin')).toBeInTheDocument();
  });
});

describe('AdminCategorias — edición', () => {
  it('abre la edición precargada, guarda con PUT y cierra el modal', async () => {
    let cuerpo: Record<string, unknown> | undefined;
    server.use(http.put('*/api/productos/categorias/:id', async ({ request, params }) => {
      cuerpo = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ok: true, msg: `Actualizada ${String(params.id)} ADMIN-TEST` });
    }));
    montar();
    const fila = await screen.findByRole('row', { name: /Gimnasio ADMIN-TEST/ });

    fireEvent.click(within(fila).getByTitle('Editar'));
    expect(await screen.findByRole('heading', { name: 'Editar categoría' })).toBeInTheDocument();
    expect(screen.getByText('Gimnasio ADMIN-TEST', { selector: '.au-modal-usuario' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre *')).toHaveValue('Gimnasio ADMIN-TEST');
    expect(screen.getByLabelText('Descripción')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('Descripción'), { target: { value: 'Pesas y cardio' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(cuerpo).toEqual({ name: 'Gimnasio ADMIN-TEST', description: 'Pesas y cardio' }));
    await waitFor(() => expect(overlay()).toBeNull());
    expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
  });

  it('guarda con descripción vacía y tolera que el servidor no mande mensaje', async () => {
    let cuerpo: Record<string, unknown> | undefined;
    server.use(http.put('*/api/productos/categorias/:id', async ({ request }) => {
      cuerpo = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ ok: false });
    }));
    montar();
    const fila = await screen.findByRole('row', { name: /Fútbol ADMIN-TEST/ });

    fireEvent.click(within(fila).getByTitle('Editar'));
    fireEvent.change(await screen.findByLabelText('Descripción'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(cuerpo).toEqual({ name: 'Fútbol ADMIN-TEST', description: '' }));
    expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'No se pudo guardar' }));
    expect(overlay()).not.toBeNull();
  });

  it('un fallo de red al guardar mantiene el modal abierto', async () => {
    server.use(http.post('*/api/productos/categorias', () => HttpResponse.error()));
    montar();
    await screen.findByRole('cell', { name: 'Fútbol ADMIN-TEST' });
    await abrirNueva();

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Padel ADMIN-TEST' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear categoría' }));

    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'Error al guardar la categoría',
    })));
    expect(overlay()).not.toBeNull();
  });
});

describe('AdminCategorias — cierre del modal', () => {
  it('cierra con overlay, Escape, ✕ y Descartar', async () => {
    montar();
    await screen.findByRole('cell', { name: 'Fútbol ADMIN-TEST' });

    await abrirNueva();
    fireEvent.click(screen.getByRole('heading', { name: 'Nueva categoría' }));
    expect(overlay()).not.toBeNull();
    fireEvent.click(overlay() as Element);
    await waitFor(() => expect(overlay()).toBeNull());

    await abrirNueva();
    fireEvent.keyDown(overlay() as Element, { key: 'x' });
    expect(overlay()).not.toBeNull();
    fireEvent.keyDown(overlay() as Element, { key: 'Escape' });
    await waitFor(() => expect(overlay()).toBeNull());

    await abrirNueva();
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    await waitFor(() => expect(overlay()).toBeNull());

    await abrirNueva();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(overlay()).toBeNull());
  });
});

describe('AdminCategorias — eliminación', () => {
  it('cancelar la confirmación no emite DELETE', async () => {
    montar();
    const fila = await screen.findByRole('row', { name: /Fútbol ADMIN-TEST/ });

    swalFire.mockResolvedValueOnce({ isConfirmed: false });
    fireEvent.click(within(fila).getByTitle('Eliminar'));

    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      title: '¿Eliminar "Fútbol ADMIN-TEST"?',
    })));
    expect(api.peticiones.some((p) => p.metodo === 'DELETE')).toBe(false);
    expect(screen.getByRole('cell', { name: 'Fútbol ADMIN-TEST' })).toBeInTheDocument();
  });

  it('un rechazo sin mensaje y un fallo de red conservan la fila', async () => {
    server.use(http.delete('*/api/productos/categorias/:id', () => HttpResponse.json({ ok: false }, { status: 500 })));
    montar();
    const fila = await screen.findByRole('row', { name: /Fútbol ADMIN-TEST/ });

    fireEvent.click(within(fila).getByTitle('Eliminar'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning', title: 'No se pudo eliminar',
    })));

    server.use(http.delete('*/api/productos/categorias/:id', () => HttpResponse.error()));
    fireEvent.click(within(fila).getByTitle('Eliminar'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'Error al eliminar la categoría',
    })));
    expect(screen.getByRole('cell', { name: 'Fútbol ADMIN-TEST' })).toBeInTheDocument();
  });
});
