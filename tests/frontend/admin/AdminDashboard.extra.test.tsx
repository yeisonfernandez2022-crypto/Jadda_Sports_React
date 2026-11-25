import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersDashboardAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminDashboard from '../../../frontend/src/admin/AdminDashboard.tsx';

/**
 * AdminDashboard — segunda capa de cobertura.
 *
 * Complementa AdminDashboard.test.tsx con la navegación de todos los accesos
 * (encabezado, KPIs, pendientes, listados) tanto por clic como por teclado,
 * las cuatro granularidades del gráfico, las variaciones positiva, neutra y
 * negativa frente a ayer, los datos incompletos y el fallo de red.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

const montar = () =>
  renderAdmin(
    <Routes>
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/reportes" element={<div data-testid="sonda-reportes" />} />
      <Route path="/admin/ordenes" element={<div data-testid="sonda-ordenes" />} />
      <Route path="/admin/usuarios" element={<div data-testid="sonda-usuarios" />} />
      <Route path="/admin/productos" element={<div data-testid="sonda-productos" />} />
      <Route path="/admin/retos" element={<div data-testid="sonda-retos" />} />
      <Route path="/admin/devoluciones" element={<div data-testid="sonda-devoluciones" />} />
      <Route path="/admin/editar/:id" element={<div data-testid="sonda-editar" />} />
      <Route path="/" element={<div data-testid="sonda-tienda" />} />
    </Routes>,
    { ruta: '/admin' },
  );

const esperarPanel = async () => {
  await screen.findByRole('heading', { name: 'Panel de Control' });
  await screen.findByText('Ingresos (30 días)');
};

const servirDashboard = (extra: Record<string, unknown>) =>
  server.use(http.get('*/api/admin/dashboard', () => HttpResponse.json({
    stats: {}, hoy: {}, pendientes: {}, serie: [], masVendidos: [],
    ordenesRecientes: [], usuariosRecientes: [], ...extra,
  })));

beforeEach(() => {
  ({ api, handlers } = handlersDashboardAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminDashboard — navegación', () => {
  it('el encabezado lleva a reportes y a la tienda', async () => {
    const primera = montar();
    await screen.findByRole('heading', { name: 'Panel de Control' });

    fireEvent.click(within(document.querySelector('.adm-header-actions') as HTMLElement)
      .getByRole('button', { name: /Reportes/ }));
    expect(await screen.findByTestId('sonda-reportes')).toBeInTheDocument();
    primera.unmount();

    montar();
    await screen.findByRole('heading', { name: 'Panel de Control' });
    fireEvent.click(within(document.querySelector('.adm-header-actions') as HTMLElement)
      .getByRole('button', { name: 'Ver tienda' }));
    expect(await screen.findByTestId('sonda-tienda')).toBeInTheDocument();
  });

  it('las tarjetas KPI navegan con clic, Enter y Espacio', async () => {
    const primera = montar();
    await esperarPanel();

    const ingresos = screen.getByText('Ingresos (30 días)').closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(ingresos, { key: 'x' });
    expect(screen.queryByTestId('sonda-reportes')).not.toBeInTheDocument();
    fireEvent.keyDown(ingresos, { key: 'Enter' });
    expect(await screen.findByTestId('sonda-reportes')).toBeInTheDocument();
    primera.unmount();

    montar();
    await esperarPanel();
    const pedidos = screen.getByText('Pedidos (30 días)').closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(pedidos, { key: ' ' });
    expect(await screen.findByTestId('sonda-ordenes')).toBeInTheDocument();
  });

  it('los pendientes navegan por clic y teclado a su sección', async () => {
    const primera = montar();
    await esperarPanel();

    fireEvent.click(within(document.querySelector('.adm-pendientes-card') as HTMLElement)
      .getByText('Evidencias de retos por revisar'));
    expect(await screen.findByTestId('sonda-retos')).toBeInTheDocument();
    primera.unmount();

    montar();
    await esperarPanel();
    const devoluciones = within(document.querySelector('.adm-pendientes-card') as HTMLElement)
      .getByText('Devoluciones y reembolsos').closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(devoluciones, { key: 'Enter' });
    expect(await screen.findByTestId('sonda-devoluciones')).toBeInTheDocument();
  });

  it('los listados navegan a reportes, edición, órdenes y usuarios', async () => {
    const primera = montar();
    await esperarPanel();

    fireEvent.click(screen.getByText(/Ver reportes/));
    expect(await screen.findByTestId('sonda-reportes')).toBeInTheDocument();
    primera.unmount();

    const segunda = montar();
    await esperarPanel();
    fireEvent.click(screen.getByText('Balón Pro ADMIN-TEST'));
    expect(await screen.findByTestId('sonda-editar')).toBeInTheDocument();
    segunda.unmount();

    const tercera = montar();
    await esperarPanel();
    fireEvent.click(screen.getByText(/Ver todas/));
    expect(await screen.findByTestId('sonda-ordenes')).toBeInTheDocument();
    tercera.unmount();

    const cuarta = montar();
    await esperarPanel();
    fireEvent.click(screen.getByText('Ana Martínez'));
    expect(await screen.findByTestId('sonda-ordenes')).toBeInTheDocument();
    cuarta.unmount();

    montar();
    await esperarPanel();
    fireEvent.click(screen.getByText(/Ver todos/));
    expect(await screen.findByTestId('sonda-usuarios')).toBeInTheDocument();
  });

  it('todos los accesos de los listados responden a Enter y Espacio', async () => {
    const casos = [
      { texto: /Ver reportes/, sonda: 'sonda-reportes' },
      { texto: 'Balón Pro ADMIN-TEST', sonda: 'sonda-editar' },
      { texto: /Ver todas/, sonda: 'sonda-ordenes' },
      { texto: 'Ana Martínez', sonda: 'sonda-ordenes' },
      { texto: /Ver todos/, sonda: 'sonda-usuarios' },
      { texto: 'Evidencias de retos por revisar', sonda: 'sonda-retos' },
    ];

    for (const caso of casos) {
      for (const tecla of ['Enter', ' ']) {
        const vista = montar();
        await esperarPanel();
        const acceso = screen.getByText(caso.texto).closest('[role="button"]') as HTMLElement;
        fireEvent.keyDown(acceso, { key: tecla });
        expect(await screen.findByTestId(caso.sonda)).toBeInTheDocument();
        vista.unmount();
      }
    }
  });
});

describe('AdminDashboard — granularidad y variaciones', () => {
  it('cambia las etiquetas del gráfico para semana y año', async () => {
    montar();
    await esperarPanel();

    fireEvent.change(screen.getByDisplayValue('Día'), { target: { value: 'semana' } });
    await waitFor(() => expect(screen.getByText(/últimas 12 semanas/)).toBeInTheDocument());
    expect(screen.getByText(/semanales/)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Semana'), { target: { value: 'anio' } });
    await waitFor(() => expect(screen.getByText(/últimos 5 años/)).toBeInTheDocument());
    expect(screen.getByText(/anuales/)).toBeInTheDocument();
  });

  it('pinta la variación neutra y la negativa frente a ayer', async () => {
    servirDashboard({ hoy: { pctVsAyer: 0, ingresosHoy: 0, ordenesHoy: 0 } });
    const primera = montar();
    await esperarPanel();

    const neutra = screen.getByText('0% vs ayer');
    expect(neutra.className).toContain('adm-hoy-pct');
    expect(neutra.className).not.toContain('up');
    expect(neutra.className).not.toContain('down');
    primera.unmount();

    servirDashboard({ hoy: { pctVsAyer: -7.5 } });
    montar();
    await esperarPanel();
    const negativa = screen.getByText('7.5% vs ayer');
    expect(negativa.className).toContain('down');
  });

  it('tolera órdenes sin estado ni cliente y usuarios sin nombre', async () => {
    servirDashboard({
      ordenesRecientes: [{
        ID_VENTA: 777, NOMBRE_USUARIO: null, APELLIDO_USUARIO: null, ESTADO: null, TOTAL: '1234',
      }],
      usuariosRecientes: [{ ID_USUARIO: 3, NOMBRE_USUARIO: null, FECHA_REGISTRO: '2026-11-02T10:00:00.000Z' }],
    });
    const { container } = montar();
    await esperarPanel();

    expect(screen.getByText('$1.234')).toBeInTheDocument();
    expect(container.querySelector('.adm-estado')).toHaveTextContent('');
    expect(container.querySelector('.adm-user-avatar')).toHaveTextContent('?');
    expect(screen.getByText('Sin ventas en el rango seleccionado')).toBeInTheDocument();
    expect(screen.getByText('Aún no hay ventas')).toBeInTheDocument();
  });

  it('registra en consola el fallo de red y deja el panel vacío', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get('*/api/admin/dashboard', () => HttpResponse.error()));
    montar();

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Error al cargar dashboard'));
    expect(await screen.findByText('Sin ventas en el rango seleccionado')).toBeInTheDocument();
    expect(screen.queryByText('Cargando datos del panel...')).not.toBeInTheDocument();
  });
});
