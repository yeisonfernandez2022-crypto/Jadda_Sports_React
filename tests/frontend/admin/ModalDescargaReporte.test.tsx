import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { handlersReportesAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import ModalDescargaReporte from '../../../frontend/src/admin/ModalDescargaReporte.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Modal de descarga de reportes contra su código REAL: alcance (todo/JADDA/
 * tienda), resumen debounced con su rango, validación de fechas, descarga por
 * blob y cierre condicionado (nunca mientras genera el archivo).
 */

let api: ApiAdmin;
let handlers: RequestHandler[];
let onCerrar: () => void;

beforeAll(() => {
  // jsdom no implementa URLs de objeto: la descarga real usa blob + <a>.
  URL.createObjectURL = vi.fn(() => 'blob:modal-reporte');
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  ({ api, handlers } = handlersReportesAdmin());
  server.use(...handlers);
  onCerrar = vi.fn();
});

const montar = (formato: 'excel' | 'pdf' = 'excel') =>
  render(
    <MemoryRouter>
      <ModalDescargaReporte
        formato={formato}
        desdeInicial="2026-11-01"
        hastaInicial="2026-11-16"
        onCerrar={onCerrar}
      />
    </MemoryRouter>,
  );

const paramsDe = (ruta: string) => new URL(ruta, 'http://test.local').searchParams;

describe('ModalDescargaReporte', () => {
  it('carga tiendas, resumen del alcance y descarga el Excel de JADDA', async () => {
    montar();
    const dialogo = await screen.findByRole('dialog', { name: /Descargar reporte en Excel/ });
    await waitFor(() => expect(dialogo).toHaveFocus());

    // Tiendas disponibles y alcance por defecto (todo el catálogo).
    expect(await screen.findByRole('option', { name: 'DeporteX ADMIN-TEST (ACTIVO)' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tienda')).toBeEnabled();
    expect(screen.getByLabelText('Todo el catálogo')).toBeChecked();
    expect(await screen.findByText(/Se incluirán: 6 órdenes · 12 unidades/)).toBeInTheDocument();
    expect(screen.getByText(/Se incluirán: 6 órdenes · 12 unidades · \$900\.000/)).toBeInTheDocument();
    const resumenInicial = api.peticiones.find((p) => p.ruta.startsWith('/api/admin/reportes/resumen?'));
    expect(paramsDe(resumenInicial!.ruta).get('alcance')).toBe('todo');

    // Cambiar a solo JADDA consulta el resumen acotado.
    fireEvent.click(screen.getByLabelText('Solo JADDA'));
    expect(await screen.findByText(/Se incluirán: 4 órdenes · 7 unidades/)).toBeInTheDocument();

    // Descarga: nombre con sufijo, petición con alcance y cierre por éxito.
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const cap = { anchor: null as HTMLAnchorElement | null };
    const original = document.body.appendChild.bind(document.body);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLAnchorElement) cap.anchor = node;
      return original(node);
    });

    fireEvent.click(screen.getByRole('button', { name: /descargar excel/i }));

    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(1));
    expect(cap.anchor?.download).toBe('reporte-jadda_2026-11-01_a_2026-11-16_jadda.xlsx');
    const descarga = api.peticiones.find((p) => p.ruta.startsWith('/api/admin/reportes/excel?'));
    expect(paramsDe(descarga!.ruta).get('alcance')).toBe('jadda');
    expect(paramsDe(descarga!.ruta).get('desde')).toBe('2026-11-01');
    expect(paramsDe(descarga!.ruta).get('hasta')).toBe('2026-11-16');
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success', title: 'Excel descargado', text: 'Reporte del 2026-11-01 al 2026-11-16 · Solo JADDA',
    })));
    clickSpy.mockRestore();
    appendSpy.mockRestore();
  });

  it('seleccionar una tienda consulta el resumen con alcance=tienda y tienda=1', async () => {
    montar();
    await screen.findByRole('dialog');
    await screen.findByText(/Se incluirán: 6 órdenes · 12 unidades/);

    fireEvent.click(screen.getByLabelText('Una tienda'));
    const selector = screen.getByLabelText('Tienda');
    fireEvent.change(selector, { target: { value: '1' } });

    expect(await screen.findByText(/Se incluirán: 2 órdenes · 5 unidades/)).toBeInTheDocument();
    const solicitudes = api.peticiones.filter((p) => p.ruta.startsWith('/api/admin/reportes/resumen?'));
    const ultima = paramsDe(solicitudes.at(-1)!.ruta);
    expect(ultima.get('alcance')).toBe('tienda');
    expect(ultima.get('tienda')).toBe('1');
  });

  it('sin tiendas el select queda deshabilitado y no consulta el resumen de tienda', async () => {
    server.use(http.get('*/api/admin/reportes/tiendas', () => HttpResponse.json([])));
    montar();
    await screen.findByRole('dialog');
    await screen.findByText(/Se incluirán: 6 órdenes · 12 unidades/);

    fireEvent.click(screen.getByLabelText('Una tienda'));

    expect(screen.getByLabelText('Tienda')).toBeDisabled();
    expect(screen.getByText('Selecciona una tienda para ver el resumen.')).toBeInTheDocument();
    // Dar tiempo al debounce: el resumen de tienda no debe consultarse.
    await new Promise((resolve) => setTimeout(resolve, 350));
    const deTienda = api.peticiones.filter((p) => {
      if (!p.ruta.startsWith('/api/admin/reportes/resumen?')) return false;
      return paramsDe(p.ruta).get('alcance') === 'tienda';
    });
    expect(deTienda).toHaveLength(0);
  });

  it('valida que la fecha inicial no supere la final y bloquea la descarga', async () => {
    montar();
    const dialogo = await screen.findByRole('dialog');
    await screen.findByText(/Se incluirán: 6 órdenes · 12 unidades/);

    fireEvent.change(within(dialogo).getByLabelText('Desde'), { target: { value: '2026-11-20' } });

    expect(await screen.findByText('La fecha inicial no puede ser posterior a la fecha final.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar excel/i })).toBeDisabled();
    expect(api.peticiones.some((p) => p.ruta.startsWith('/api/admin/reportes/excel?'))).toBe(false);
  });

  it('Escape y overlay cierran, pero no mientras se genera el archivo', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    let liberar!: () => void;
    const bloqueo = new Promise<void>((resolve) => { liberar = resolve; });
    server.use(
      http.get('*/api/admin/reportes/excel', async () => {
        await bloqueo;
        return new HttpResponse('datos-excel-ADMIN-TEST', { headers: { 'Content-Type': 'application/vnd.ms-excel' } });
      }),
    );
    montar();
    await screen.findByRole('dialog');
    await screen.findByText(/Se incluirán: 6 órdenes · 12 unidades/);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(onCerrar).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole('button', { name: /descargar excel/i }));
    const generando = await screen.findByRole('button', { name: /generando/i });
    expect(generando).toBeDisabled();

    // Durante la descarga, Escape, overlay y cancelar no cierran.
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByTestId('modal-overlay'));
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(onCerrar).toHaveBeenCalledTimes(2);

    liberar();
    await waitFor(() => expect(onCerrar).toHaveBeenCalledTimes(3));
    clickSpy.mockRestore();
  });

  it('si la descarga falla, avisa y deja el modal abierto', async () => {
    server.use(
      http.get('*/api/admin/reportes/excel', () => HttpResponse.json({ ok: false }, { status: 500 })),
    );
    montar();
    await screen.findByRole('dialog');
    await screen.findByText(/Se incluirán: 6 órdenes · 12 unidades/);

    fireEvent.click(screen.getByRole('button', { name: /descargar excel/i }));

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'No se pudo descargar',
    })));
    expect(onCerrar).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /Descargar reporte en Excel/ })).toBeInTheDocument();
  });

  it('el formato PDF ajusta título y botón de descarga', async () => {
    montar('pdf');
    expect(await screen.findByRole('dialog', { name: /Descargar reporte en PDF/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /descargar pdf/i })).toBeInTheDocument();
  });
});
