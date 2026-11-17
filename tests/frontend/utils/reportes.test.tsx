import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  fechaHoy, fechaHaceDias, formatearFecha, muestrear,
  descargarReporte, TarjetaMasVendidos, type MasVendido,
} from '../../../frontend/src/utils/reportes';

/**
 * reportes: helpers compartidos por AdminReportes y VendedorReportes.
 * Fechas con reloj fijo, muestreo de barras, descarga blob con Swal y la
 * tarjeta de ranking (estado vacío, stock y fallback de imagen).
 */

const { fireMock } = vi.hoisted(() => ({ fireMock: vi.fn().mockResolvedValue({ isConfirmed: true }) }));
vi.mock('sweetalert2', () => ({ default: { fire: fireMock } }));

const descargando: Array<"excel" | "pdf" | null> = [];
const setDescargando = (v: "excel" | "pdf" | null) => { descargando.push(v); };

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:reporte'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  fireMock.mockResolvedValue({ isConfirmed: true });
  descargando.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('reportes — fechas', () => {
  it('fechaHoy y fechaHaceDias dan ISO del día con reloj fijo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-16T15:30:00Z'));
    expect(fechaHoy()).toBe('2026-11-16');
    expect(fechaHaceDias(7)).toBe('2026-11-09');
  });

  it('formatearFecha: año completo se devuelve tal cual', () => {
    expect(formatearFecha('2026')).toBe('2026');
  });

  it('formatearFecha: mes YYYY-MM se formatea corto es-CO', () => {
    const r = formatearFecha('2026-11');
    expect(r).toMatch(/nov/i);
    expect(r).toContain('26');
  });

  it('formatearFecha: mes imposible devuelve el sufijo original', () => {
    expect(formatearFecha('2026-99')).toBe('99');
  });

  it('formatearFecha: día con hora (T) usa solo la fecha', () => {
    const r = formatearFecha('2026-11-15T14:30:00Z');
    expect(r).toMatch(/15/);
    expect(r).toMatch(/nov/i);
  });

  it('formatearFecha: día imposible devuelve el sufijo (slice 5)', () => {
    expect(formatearFecha('no-es-fecha')).toBe('-fecha');
  });
});

describe('reportes — muestrear', () => {
  it('serie corta (<= 12) se devuelve completa', () => {
    const serie = Array.from({ length: 12 }, (_, i) => i);
    expect(muestrear(serie)).toEqual(serie);
  });

  it('serie larga: intervalo uniforme y SIEMPRE incluye la última muestra', () => {
    const serie = Array.from({ length: 30 }, (_, i) => i);
    const muestra = muestrear(serie);
    expect(muestra.length).toBeLessThanOrEqual(12);
    expect(muestra[muestra.length - 1]).toBe(29);
    expect(muestra[0]).toBe(0);
  });

  it('max personalizado: intervalo uniforme y SIEMPRE incluye la última muestra', () => {
    const serie = Array.from({ length: 10 }, (_, i) => i);
    // step = ceil(10/5) = 2 → 5 muestras pares + la última (siempre incluida).
    expect(muestrear(serie, 5)).toEqual([0, 2, 4, 6, 8, 9]);
  });
});

describe('reportes — descargarReporte', () => {
  it('excel: blob + anchor temporal + Swal de éxito y setDescargando en null', async () => {
    const blobMock = new Blob(['xlsx'], { type: 'application/vnd.ms-excel' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blobMock) }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    await descargarReporte({ formato: 'excel', url: '/api/reportes/ventas', desde: '2026-11-01', hasta: '2026-11-16', prefijoArchivo: 'ventas', setDescargando });

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:reporte');
    await waitFor(() => expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success', title: 'Excel descargado', text: 'Reporte del 2026-11-01 al 2026-11-16',
    })));
    expect(descargando[0]).toBe('excel');
    expect(descargando[descargando.length - 1]).toBeNull();
    clickSpy.mockRestore();
  });

  it('pdf: título "PDF descargado" y nombre de archivo con rango', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(new Blob(['pdf'])) }));
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    // El anchor se elimina tras el click: se captura en el appendChild.
    const cap = { anchor: null as HTMLAnchorElement | null };
    const original = document.body.appendChild.bind(document.body);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
      cap.anchor = node as HTMLAnchorElement;
      return original(node);
    });

    await descargarReporte({ formato: 'pdf', url: '/api/reportes/ventas', desde: '2026-11-01', hasta: '2026-11-16', prefijoArchivo: 'ventas', setDescargando });

    expect(cap.anchor?.download).toBe('ventas_2026-11-01_a_2026-11-16.pdf');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'PDF descargado' })));
    clickSpy.mockRestore();
    appendSpy.mockRestore();
  });

  it('respuesta !ok → Swal de error y setDescargando en null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));

    await descargarReporte({ formato: 'excel', url: '/api/reportes/x', desde: 'a', hasta: 'b', prefijoArchivo: 'x', setDescargando });

    await waitFor(() => expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'No se pudo descargar', text: 'Intenta de nuevo en unos segundos.',
    })));
    expect(descargando[descargando.length - 1]).toBeNull();
  });

  it('fallo de red cae en el mismo error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('red caída')));

    await descargarReporte({ formato: 'pdf', url: '/api/reportes/x', desde: 'a', hasta: 'b', prefijoArchivo: 'x', setDescargando });

    await waitFor(() => expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error' })));
  });
});

describe('reportes — TarjetaMasVendidos', () => {
  const item = (over: Partial<MasVendido>): MasVendido => ({
    ID: 1, NOMBRE: 'Producto Reporte-Test', IMAGEN: 'https://test.local/p.png',
    unidades: 10, ingresos: 250000, stock: 20, ...over,
  });

  it('lista vacía muestra el aviso del rango', () => {
    render(<TarjetaMasVendidos titulo="Más vendidos" items={[]} onAbrirEdicion={vi.fn()} anchos={['10%', '40%', '15%', '20%', '15%']} />);

    expect(screen.getByText('Más vendidos')).toBeInTheDocument();
    expect(screen.getByText(/Ranking por unidades facturadas/)).toBeInTheDocument();
    expect(screen.getByText('Sin ventas en el rango seleccionado')).toBeInTheDocument();
  });

  it('filas con ranking, ingresos formateados y estados de stock', () => {
    const onAbrirEdicion = vi.fn();
    render(
      <TarjetaMasVendidos
        titulo="Ranking"
        items={[
          item({ ID: 1, NOMBRE: 'Con Stock Reporte-Test' }),
          item({ ID: 2, NOMBRE: 'Stock Bajo Reporte-Test', stock: 8, unidades: 5, ingresos: 90000 }),
          item({ ID: 3, NOMBRE: 'Sin Stock Reporte-Test', stock: 0, unidades: 2, ingresos: 10000 }),
        ]}
        onAbrirEdicion={onAbrirEdicion}
        anchos={['10%', '40%', '15%', '20%', '15%']}
      />,
    );

    const filas = document.querySelectorAll('.ap-tabla tbody tr');
    expect(filas).toHaveLength(3);
    // Ranking 1..3 en la primera columna.
    expect(document.querySelector('.ap-id')?.textContent).toBe('1');
    expect(screen.getByText('Sin Stock Reporte-Test')).toBeInTheDocument();
    // Ingresos formateados es-CO.
    expect(screen.getByText('$90.000')).toBeInTheDocument();
    // Estados de stock con su clase y texto.
    const stocks = Array.from(document.querySelectorAll('.ap-stock'));
    expect(stocks[0].textContent).toBe('20 uds');
    expect(stocks[0].className).toContain('ok');
    expect(stocks[1].textContent).toBe('¡Solo quedan 8!');
    expect(stocks[1].className).toContain('bajo');
    expect(stocks[2].textContent).toBe('Agotado');
    expect(stocks[2].className).toContain('agotado');
    // Click en la fila abre la edición del producto.
    fireEvent.click(filas[1]);
    expect(onAbrirEdicion).toHaveBeenCalledWith(2);
  });

  it('imagen rota cae al placeholder de JADDA', () => {
    render(
      <TarjetaMasVendidos
        titulo="Ranking"
        items={[item({ IMAGEN: '' })]}
        onAbrirEdicion={vi.fn()}
        anchos={['10%', '40%', '15%', '20%', '15%']}
      />,
    );
    const img = document.querySelector('.ap-img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://placehold.co/400x400?text=JADDA');

    fireEvent.error(img);
    expect(img.getAttribute('src')).toBe('https://placehold.co/400x400?text=JADDA');
  });
});
