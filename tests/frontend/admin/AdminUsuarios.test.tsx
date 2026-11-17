import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersUsuariosAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminUsuarios from '../../../frontend/src/admin/AdminUsuarios.tsx';
import { numeroPedido } from '../../../frontend/src/utils/numeroPedido.ts';

/**
 * Panel de usuarios contra su código REAL (solo lectura: listado, búsqueda,
 * detalle compuesto con compras/retos/direcciones/métodos y sus filtros).
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

beforeEach(() => {
  ({ api, handlers } = handlersUsuariosAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminUsuarios', () => {
  it('carga el listado con nombre, correo y rol visibles', async () => {
    renderAdmin(<AdminUsuarios />);

    expect(await screen.findByRole('heading', { name: 'Usuarios' })).toBeInTheDocument();
    const filaAna = await screen.findByRole('row', { name: /ana@test\.local/ });
    expect(within(filaAna).getByText('Cliente')).toBeInTheDocument();
    expect(within(filaAna).getByText('ana@test.local')).toBeInTheDocument();
    const filaAdmin = screen.getByRole('row', { name: /admin@jadda\.test/ });
    expect(within(filaAdmin).getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByText(/2 usuarios$/)).toBeInTheDocument();
  });

  it('el buscador filtra por email y actualiza el contador', async () => {
    renderAdmin(<AdminUsuarios />);
    await screen.findByRole('row', { name: /ana@test\.local/ });

    fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre, email o usuario/), { target: { value: 'admin@' } });

    await waitFor(() => expect(screen.queryByRole('row', { name: /ana@test\.local/ })).not.toBeInTheDocument());
    expect(screen.getByRole('row', { name: /admin@jadda\.test/ })).toBeInTheDocument();
    expect(screen.getByText(/1 usuario$/)).toBeInTheDocument();
  });

  it('ver usuario: pide el detalle y muestra stats, compras y retos', async () => {
    renderAdmin(<AdminUsuarios />);
    const filaAna = await screen.findByRole('row', { name: /ana@test\.local/ });

    fireEvent.click(within(filaAna).getByRole('button', { name: 'Ver usuario' }));

    await waitFor(() => expect(api.peticiones.some((p) => p.ruta === '/api/admin/usuarios/55')).toBe(true));
    expect(await screen.findByRole('heading', { name: 'Ana Martínez' })).toBeInTheDocument();
    expect(screen.getByText('@ana')).toBeInTheDocument();
    expect(screen.getByText('Verificado')).toBeInTheDocument();
    // Stats del cliente (no vendedor).
    expect(screen.getByText('Compras')).toBeInTheDocument();
    expect(screen.getByText('Favoritos')).toBeInTheDocument();
    // Compra y reto del detalle (número de pedido público determinístico).
    expect(screen.getByText(`Pedido #${numeroPedido(501)}`)).toBeInTheDocument();
    expect(screen.getByText('Guayos ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Reto 100 km ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText(/Calle 10 #5-25/)).toBeInTheDocument();
  });

  it('filtro de compras por estado dentro del detalle', async () => {
    renderAdmin(<AdminUsuarios />);
    const filaAna = await screen.findByRole('row', { name: /ana@test\.local/ });
    fireEvent.click(within(filaAna).getByRole('button', { name: 'Ver usuario' }));
    await screen.findByText('Guayos ADMIN-TEST');

    fireEvent.change(within(screen.getByText(/Compras \(/).closest('.au-seccion') as HTMLElement).getByDisplayValue('Todos los estados'), { target: { value: 'cancelada' } });

    await waitFor(() => expect(screen.queryByText('Guayos ADMIN-TEST')).not.toBeInTheDocument());
    expect(screen.getByText('Balón ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('CANCELADA')).toBeInTheDocument();
  });

  it('error al abrir el detalle: mensaje dentro del modal', async () => {
    server.use(
      http.get('*/api/admin/usuarios/:id', () =>
        HttpResponse.json({ msg: 'Error del servidor ADMIN-TEST' }, { status: 500 })),
    );
    renderAdmin(<AdminUsuarios />);
    const filaAna = await screen.findByRole('row', { name: /ana@test\.local/ });

    fireEvent.click(within(filaAna).getByRole('button', { name: 'Ver usuario' }));

    expect(await screen.findByText('No se pudo cargar el detalle del usuario.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
  });
});
