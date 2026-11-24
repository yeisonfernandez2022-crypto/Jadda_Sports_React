import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersRetosAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminRetos from '../../../frontend/src/admin/AdminRetos.tsx';

/**
 * Panel de evidencias de retos contra su código REAL: agrupación
 * pendientes/revisados y navegación al detalle de cada avance.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

const renderListado = () =>
  renderAdmin(
    <Routes>
      <Route path="/admin/retos" element={<AdminRetos />} />
      <Route path="/admin/retos/:id" element={<p>detalle-evidencia</p>} />
    </Routes>,
    { ruta: '/admin/retos' }
  );

beforeEach(() => {
  ({ api, handlers } = handlersRetosAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminRetos', () => {
  it('carga y agrupa las evidencias: pendientes abiertas, revisados cerrados', async () => {
    renderListado();

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
    renderListado();
    await screen.findByText('Reto 100 km ADMIN-TEST');

    fireEvent.click(screen.getByRole('button', { name: /Ya revisados/ }));

    expect(await screen.findByText('Reto Gym ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('APROBADO')).toBeInTheDocument();
  });

  it('"Ver" enlaza al detalle de la evidencia pendiente', async () => {
    renderListado();
    await screen.findByText('Reto 100 km ADMIN-TEST');

    const ver = screen.getByRole('link', { name: 'Ver' });
    expect(ver).toHaveAttribute('href', '/admin/retos/11');

    fireEvent.click(ver);
    expect(await screen.findByText('detalle-evidencia')).toBeInTheDocument();
  });

  it('una evidencia revisada enlaza a su detalle', async () => {
    renderListado();
    await screen.findByText('Reto 100 km ADMIN-TEST');
    fireEvent.click(screen.getByRole('button', { name: /Ya revisados/ }));

    const fila = await screen.findByText('Reto Gym ADMIN-TEST');
    const enlace = fila.closest('tr')?.querySelector('a');
    expect(enlace).toHaveAttribute('href', '/admin/retos/12');
  });
});
