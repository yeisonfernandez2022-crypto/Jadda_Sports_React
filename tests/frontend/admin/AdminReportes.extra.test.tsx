import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersReportesAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminReportes from '../../../frontend/src/admin/AdminReportes.tsx';

/**
 * AdminReportes — segunda capa de cobertura.
 *
 * Complementa AdminReportes.test.tsx con la compatibilidad de campos ausentes,
 * la serie vacía, el muestreo de series largas y su intervalo, los controles
 * de fecha y granularidad, los rangos rápidos y la vuelta al dashboard.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

const montar = () =>
  renderAdmin(
    <Routes>
      <Route path="/admin/reportes" element={<AdminReportes />} />
      <Route path="/admin" element={<div data-testid="sonda-admin" />} />
    </Routes>,
    { ruta: '/admin/reportes' },
  );

const servirVentas = (cuerpo: Record<string, unknown>) =>
  server.use(http.get('*/api/admin/reportes/ventas', () => HttpResponse.json(cuerpo)));

const reporteBase = {
  desde: '2026-11-01',
  hasta: '2026-11-30',
  totalOrdenes: 0,
  totalIngresos: 0,
  ticketPromedio: 0,
  totalUnidades: 0,
  serie: [] as Record<string, unknown>[],
};

const serieLarga = Array.from({ length: 15 }, (_, i) => ({
  dia: `2026-11-${String(i + 1).padStart(2, '0')}`,
  ordenes: i + 1,
  ingresos: i === 14 ? 2000000 : (i + 1) * 10000,
  unidades: i + 1,
  nuevosUsuarios: i + 1,
}));

beforeEach(() => {
  ({ api, handlers } = handlersReportesAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminReportes — datos incompletos y vacíos', () => {
  it('compatibiliza campos ausentes y muestra los vacíos de cada métrica', async () => {
    servirVentas({
      ...reporteBase,
      serie: [{ dia: '2026-11-01' }],
    });
    server.use(http.get('*/api/admin/analytics/mas-vendidos', () => HttpResponse.json([])));
    montar();

    expect(await screen.findByText('Sin datos para esta métrica en el rango')).toBeInTheDocument();
    expect(screen.getByText('Sin ingresos en el rango')).toBeInTheDocument();
    expect(screen.getByText('Sin ventas en el rango')).toBeInTheDocument();
    expect(screen.getByText('Sin usuarios nuevos en el rango')).toBeInTheDocument();
    expect(screen.getByText('0 pedidos · 0 unidades · 0 uds/pedido')).toBeInTheDocument();
    expect(screen.getByText('Sin ventas en el rango seleccionado')).toBeInTheDocument();

    const cardGraficas = screen.getByRole('heading', { name: /Gráficas del rango/ }).closest('div.bg-white') as HTMLElement;
    fireEvent.click(within(cardGraficas).getByRole('button', { name: /Ventas/ }));
    expect(await screen.findByText('Sin datos para esta métrica en el rango')).toBeInTheDocument();
    fireEvent.click(within(cardGraficas).getByRole('button', { name: /Unidades/ }));
    expect(await screen.findByText('Sin datos para esta métrica en el rango')).toBeInTheDocument();
    fireEvent.click(within(cardGraficas).getByRole('button', { name: /Usuarios/ }));
    expect(await screen.findByText('Sin datos para esta métrica en el rango')).toBeInTheDocument();
  });

  it('una respuesta sin serie muestra el vacío global del rango', async () => {
    const sinSerie: Record<string, unknown> = { ...reporteBase };
    delete sinSerie.serie;
    servirVentas(sinSerie);
    montar();

    expect(await screen.findByText('Sin datos en el rango seleccionado')).toBeInTheDocument();
    expect(screen.getAllByText('Sin ingresos en el rango').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sin ventas en el rango').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sin usuarios nuevos en el rango').length).toBeGreaterThanOrEqual(1);
  });
});

describe('AdminReportes — series largas', () => {
  it('muestrea las barras, informa el intervalo y usa un decimal para millones', async () => {
    servirVentas({
      ...reporteBase,
      totalOrdenes: 120,
      totalIngresos: 5000000,
      ticketPromedio: 41666,
      totalUnidades: 300,
      totalUsuarios: 45,
      serie: serieLarga,
    });
    montar();

    expect(await screen.findByText('Mostrando 8 de 15 · intervalo cada 2 días')).toBeInTheDocument();
    expect(screen.getByText('$2000.0k')).toBeInTheDocument();
    expect(screen.getAllByText('Mostrando 8 de 15 · intervalo').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText(/2\.5 uds\/pedido/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Ver por'), { target: { value: 'semana' } });
    expect(await screen.findByText('Mostrando 8 de 15 · intervalo cada 1 semana')).toBeInTheDocument();
  });
});

describe('AdminReportes — controles y navegación', () => {
  it('cambia Hasta y la granularidad con sus etiquetas', async () => {
    montar();
    await screen.findByText('Ticket promedio');
    const inicial = api.peticiones.length;

    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-20' } });
    await waitFor(() => expect(api.peticiones.length).toBe(inicial + 1));
    expect(api.peticiones.at(-1)?.cuerpo).toMatchObject({ hasta: '2026-11-20' });

    fireEvent.change(screen.getByLabelText('Ver por'), { target: { value: 'semana' } });
    await waitFor(() => expect(screen.getByText(/por semana \(lunes\)/)).toBeInTheDocument());
    expect(api.peticiones.at(-1)?.cuerpo).toMatchObject({ granularidad: 'semana' });

    fireEvent.change(screen.getByLabelText('Ver por'), { target: { value: 'mes' } });
    await waitFor(() => expect(screen.getAllByText(/por mes$/).length).toBeGreaterThanOrEqual(1));
    expect(api.peticiones.at(-1)?.cuerpo).toMatchObject({ granularidad: 'mes' });

    fireEvent.change(screen.getByLabelText('Ver por'), { target: { value: 'anio' } });
    await waitFor(() => expect(screen.getAllByText(/por año$/).length).toBeGreaterThanOrEqual(1));
    expect(api.peticiones.at(-1)?.cuerpo).toMatchObject({ granularidad: 'anio' });
  });

  it('los rangos rápidos de 7 y 90 días recargan con sus fechas', async () => {
    montar();
    await screen.findByText('Ticket promedio');
    const inicial = api.peticiones.length;

    fireEvent.click(screen.getByRole('button', { name: '7 días' }));
    await waitFor(() => expect(api.peticiones.length).toBeGreaterThan(inicial));
    const siete = api.peticiones.at(-1)?.cuerpo as { desde: string; hasta: string };
    const hoy = new Date().toISOString().slice(0, 10);
    const hace6 = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    expect(siete).toMatchObject({ desde: hace6, hasta: hoy });

    const despues7 = api.peticiones.length;
    fireEvent.click(screen.getByRole('button', { name: '90 días' }));
    await waitFor(() => expect(api.peticiones.length).toBeGreaterThan(despues7));
    const noventa = api.peticiones.at(-1)?.cuerpo as { desde: string; hasta: string };
    const hace89 = new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
    expect(noventa).toMatchObject({ desde: hace89, hasta: hoy });
  });

  it('Volver al inicio navega al dashboard', async () => {
    montar();
    await screen.findByText('Ticket promedio');

    fireEvent.click(screen.getByRole('button', { name: /Volver al inicio/ }));

    expect(await screen.findByTestId('sonda-admin')).toBeInTheDocument();
  });
});
