import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersVendedoresAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminVendedores from '../../../frontend/src/admin/AdminVendedores.tsx';

/**
 * Solicitudes de vendedor contra su código REAL: listado, filtros por estado y
 * navegación al detalle. La ficha ya no descarga el catálogo completo en el
 * listado: eso vive en GET /api/vendedor/admin/:id.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

const renderListado = () =>
  renderAdmin(
    <Routes>
      <Route path="/admin/vendedores" element={<AdminVendedores />} />
      <Route path="/admin/vendedores/:id" element={<p>detalle-vendedor</p>} />
    </Routes>,
    { ruta: '/admin/vendedores' }
  );

beforeEach(() => {
  ({ api, handlers } = handlersVendedoresAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminVendedores', () => {
  it('carga el listado con el contador de pendientes', async () => {
    renderListado();

    expect(await screen.findByRole('heading', { name: /Vendedores/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/1 pendiente\(s\)/)).toBeInTheDocument());
    expect(screen.getByRole('row', { name: /Deportes Andes ADMIN-TEST/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Ciclistas Valle ADMIN-TEST/ })).toBeInTheDocument();
    expect(screen.getByText(/2 solicitudes$/)).toBeInTheDocument();
  });

  it('el filtro por estado deja solo la fila correspondiente', async () => {
    renderListado();
    await screen.findByRole('row', { name: /Deportes Andes ADMIN-TEST/ });

    fireEvent.click(screen.getByRole('button', { name: 'Aprobadas' }));

    await waitFor(() => expect(screen.queryByRole('row', { name: /Deportes Andes ADMIN-TEST/ })).not.toBeInTheDocument());
    expect(screen.getByRole('row', { name: /Ciclistas Valle ADMIN-TEST/ })).toBeInTheDocument();
    expect(screen.getByText(/1 solicitud$/)).toBeInTheDocument();
  });

  it('gestionar navega al detalle sin descargar el catálogo completo', async () => {
    renderListado();
    const fila = await screen.findByRole('row', { name: /Deportes Andes ADMIN-TEST/ });

    const gestionar = within(fila).getByRole('link', { name: 'Gestionar' });
    expect(gestionar).toHaveAttribute('href', '/admin/vendedores/31');

    fireEvent.click(gestionar);

    expect(await screen.findByText('detalle-vendedor')).toBeInTheDocument();
    expect(api.peticiones).not.toContainEqual(expect.objectContaining({
      metodo: 'GET',
      ruta: '/api/admin/productos',
    }));
  });

  it('una solicitud aprobada enlaza a su ficha con "Ver detalle"', async () => {
    renderListado();
    const fila = await screen.findByRole('row', { name: /Ciclistas Valle ADMIN-TEST/ });

    expect(within(fila).getByRole('link', { name: /ver detalle/i })).toHaveAttribute('href', '/admin/vendedores/32');
  });
});
