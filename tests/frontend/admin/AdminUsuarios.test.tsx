import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersUsuariosAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminUsuarios from '../../../frontend/src/admin/AdminUsuarios.tsx';

/**
 * Panel de usuarios: listado, búsqueda y navegación a la página de detalle
 * (el detalle dejó de ser un modal).
 */

let handlers: RequestHandler[];

beforeEach(() => {
  ({ handlers } = handlersUsuariosAdmin());
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

  it('Ver usuario navega a la página de detalle del usuario', async () => {
    renderAdmin(
      <Routes>
        <Route path="/admin/usuarios" element={<AdminUsuarios />} />
        <Route path="/admin/usuarios/:id" element={<p>detalle-usuario</p>} />
      </Routes>,
      { ruta: '/admin/usuarios' }
    );
    const filaAna = await screen.findByRole('row', { name: /ana@test\.local/ });

    fireEvent.click(within(filaAna).getByRole('link', { name: 'Ver usuario' }));

    expect(await screen.findByText('detalle-usuario')).toBeInTheDocument();
  });
});
