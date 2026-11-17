import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersDashboardAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminDashboard from '../../../frontend/src/admin/AdminDashboard.tsx';

/**
 * Panel de control contra su código REAL: KPIs, pendientes, serie de ventas,
 * top vendidos, órdenes/usuarios recientes y granularidad del gráfico.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

beforeEach(() => {
  ({ api, handlers } = handlersDashboardAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminDashboard', () => {
  it('renderiza los KPI, pendientes y listados con los datos del handler', async () => {
    renderAdmin(<AdminDashboard />);

    expect(await screen.findByRole('heading', { name: 'Panel de Control' })).toBeInTheDocument();
    // KPIs formateados en COP (es-CO: separador de miles con puntos).
    await waitFor(() => expect(screen.getByText('Ingresos (30 días)')).toBeInTheDocument());
    expect(screen.getByText('$1.200.000')).toBeInTheDocument();
    expect(screen.getByText('Pedidos (30 días)')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    // Bloque "Hoy" con variación vs ayer.
    expect(screen.getByText(/12.5% vs ayer/)).toBeInTheDocument();
    // Pendientes del bloque "Por revisar" con su conteo.
    const filaEvidencias = screen.getByText('Evidencias de retos por revisar').closest('.adm-pendiente-row');
    expect(filaEvidencias?.textContent).toContain('2');
    // Top vendido, órdenes recientes y usuarios recientes del handler.
    expect(screen.getByText('Balón Pro ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Ana Martínez')).toBeInTheDocument();
    expect(screen.getByText('Nico Ruiz')).toBeInTheDocument();
    expect(screen.getByText('COMPLETADA')).toBeInTheDocument();
  });

  it('cambiar la granularidad re-pide el dashboard con el nuevo rango', async () => {
    renderAdmin(<AdminDashboard />);
    await screen.findByText('Balón Pro ADMIN-TEST');

    fireEvent.change(screen.getByDisplayValue('Día'), { target: { value: 'mes' } });

    await waitFor(() => expect(api.peticiones.some((p) => p.ruta.includes('granularidad=mes'))).toBe(true));
    await waitFor(() => expect(screen.getByText(/últimos 12 meses/)).toBeInTheDocument());
    expect(screen.getByText(/mensuales/)).toBeInTheDocument();
  });

  it('error 500 en el dashboard: carga terminada y vacíos por defecto (sin spinner infinito)', async () => {
    server.use(
      http.get('*/api/admin/dashboard', () => HttpResponse.json({ ok: false }, { status: 500 })),
    );
    renderAdmin(<AdminDashboard />);

    // El panel traga el error (res.ok false) y renderiza los ceros/valores por defecto.
    expect(await screen.findByText('Sin ventas en el rango seleccionado')).toBeInTheDocument();
    expect(screen.getByText('Aún no hay ventas')).toBeInTheDocument();
    expect(screen.getByText('Sin órdenes todavía')).toBeInTheDocument();
    expect(screen.queryByText('Cargando datos del panel...')).not.toBeInTheDocument();
  });
});
