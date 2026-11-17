import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route, useParams } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersReportesAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminReportes from '../../../frontend/src/admin/AdminReportes.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Panel de reportes contra su código REAL: KPIs del rango, gráficas por
 * métrica (tabs), filtros de fecha con validación de rango, descarga de
 * Excel/PDF vía blob y la tarjeta de más vendidos que navega a edición.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

beforeAll(() => {
  // jsdom no implementa URLs de objeto: la descarga real usa blob + <a>.
  URL.createObjectURL = vi.fn(() => 'blob:mock-admin-test');
  URL.revokeObjectURL = vi.fn();
});

/** Sonda de navegación: la fila de más vendidos lleva a /admin/editar/:id. */
const SondaEdicion = () => {
  const { id } = useParams();
  return <div data-testid="sonda-edicion">EDITAR:{id}</div>;
};

const montar = () =>
  renderAdmin(
    <Routes>
      <Route path="/admin/reportes" element={<AdminReportes />} />
      <Route path="/admin/editar/:id" element={<SondaEdicion />} />
    </Routes>,
    { ruta: '/admin/reportes' },
  );

beforeEach(() => {
  ({ api, handlers } = handlersReportesAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminReportes', () => {
  it('carga tarjetas KPI, gráfica de ingresos, leyenda y más vendidos', async () => {
    montar();

    expect(await screen.findByRole('heading', { name: /Reportes de ventas/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Ticket promedio')).toBeInTheDocument());
    // El total de ingresos aparece en la tarjeta y en el total del tab activo.
    expect(screen.getAllByText('$1.200.000').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Usuarios nuevos')).toBeInTheDocument();
    expect(screen.getByText('Ganancias (COP)')).toBeInTheDocument();
    // Barras de ingresos con su valor en k (300000 → $300k).
    expect(screen.getByText('$300k')).toBeInTheDocument();
    expect(screen.getByText('$180k')).toBeInTheDocument();
    expect(screen.getByText('$90k')).toBeInTheDocument();
    // Leyenda del pie: el texto está partido (span + b), se comprueba por el valor.
    expect(screen.getAllByText('$26.666').length).toBeGreaterThanOrEqual(2);
    // Ranking de más vendidos con los tres estados de stock.
    expect(screen.getByRole('heading', { name: /Productos más vendidos/ })).toBeInTheDocument();
    expect(screen.getByText('Balón MásV ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.getByText('¡Solo quedan 8!')).toBeInTheDocument();
    expect(screen.getByText('30 uds')).toBeInTheDocument();
  });

  it('las pestañas cambian la métrica graficada', async () => {
    montar();
    await screen.findByText('$300k');

    // El card de gráficas contiene la barra de tabs; se acota con within
    // porque el AdminNavbar también tiene un botón "Usuarios".
    const cardGraficas = screen.getByRole('heading', { name: /Gráficas del rango/ }).closest('div.bg-white') as HTMLElement;
    // El número visible de la barra es el valor crudo; la leyenda completa
    // vive en el title de la barra (p. ej. "2026-11-01: 5 pedidos · ...").
    fireEvent.click(within(cardGraficas).getByRole('button', { name: /Ventas/ }));
    expect(await screen.findByText('Ventas (nº pedidos)')).toBeInTheDocument();
    expect(screen.getByTitle('2026-11-01: 5 pedidos · 5 órdenes · $300.000')).toBeInTheDocument();

    fireEvent.click(within(cardGraficas).getByRole('button', { name: /Unidades/ }));
    expect(await screen.findByTitle('2026-11-01: 12 uds · 5 órdenes · $300.000')).toBeInTheDocument();

    fireEvent.click(within(cardGraficas).getByRole('button', { name: /Usuarios/ }));
    expect(await screen.findByTitle('2026-11-01: 3 usuarios · 5 órdenes · $300.000')).toBeInTheDocument();
  });

  it('descarga el Excel como blob y avisa con éxito', async () => {
    montar();
    await screen.findByText('Ticket promedio');

    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));

    await waitFor(() => expect(api.peticiones.some((p) => p.ruta.startsWith('/api/admin/reportes/excel?desde=') && p.ruta.includes('hasta='))).toBe(true));
    expect(URL.createObjectURL).toHaveBeenCalled();
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: 'Excel descargado' })));
  });

  it('descarga el PDF con el rango del reporte', async () => {
    montar();
    await screen.findByText('Ticket promedio');

    fireEvent.click(screen.getByRole('button', { name: /PDF/ }));

    await waitFor(() => expect(api.peticiones.some((p) => p.ruta.startsWith('/api/admin/reportes/pdf?desde=') && p.ruta.includes('hasta='))).toBe(true));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: 'PDF descargado' })));
  });

  it('error al descargar: aviso de reintento', async () => {
    server.use(
      http.get('*/api/admin/reportes/excel', () => HttpResponse.json({ ok: false }, { status: 500 })),
    );
    montar();
    await screen.findByText('Ticket promedio');

    fireEvent.click(screen.getByRole('button', { name: /Excel/ }));

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error', title: 'No se pudo descargar' })));
  });

  it('Aplicar recarga con el rango; con rango inválido no emite petición', async () => {
    montar();
    await screen.findByText('Ticket promedio');
    expect(api.peticiones.length).toBe(1);

    // Cambiar Desde dispara el useEffect del panel (recarga sin Aplicar).
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-05' } });
    await waitFor(() => expect(api.peticiones.length).toBe(2));
    expect(api.peticiones.at(-1)?.cuerpo).toMatchObject({ desde: '2026-11-05', granularidad: 'dia' });

    // "Aplicar" vuelve a pedir el mismo rango explícitamente.
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    await waitFor(() => expect(api.peticiones.length).toBe(3));

    // Rango inválido (Desde > Hasta): el effect recarga (no valida), pero el
    // click en Aplicar NO añade una petición más.
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2030-01-01' } });
    await waitFor(() => expect(api.peticiones.length).toBe(4));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    // La petición del effect ya terminó: sin recarga adicional por Aplicar.
    expect(api.peticiones.length).toBe(4);
  });

  it('error al cargar los reportes: mensaje de alerta y sin tarjetas', async () => {
    server.use(
      http.get('*/api/admin/reportes/ventas', () => HttpResponse.json({ ok: false }, { status: 500 })),
      http.get('*/api/admin/analytics/mas-vendidos', () => HttpResponse.json({ ok: false }, { status: 500 })),
    );
    montar();

    expect(await screen.findByText('No se pudieron cargar los reportes. Intenta de nuevo.')).toBeInTheDocument();
    expect(screen.queryByText('Ticket promedio')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Productos más vendidos/ })).not.toBeInTheDocument();
  });

  it('la fila de más vendidos navega a la edición del producto', async () => {
    montar();
    await screen.findByText('Balón MásV ADMIN-TEST');

    fireEvent.click(screen.getByText('Balón MásV ADMIN-TEST'));

    await waitFor(() => expect(screen.getByTestId('sonda-edicion')).toHaveTextContent('EDITAR:5'));
  });
});
