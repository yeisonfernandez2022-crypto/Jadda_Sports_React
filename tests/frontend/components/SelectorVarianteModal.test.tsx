import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import SelectorVarianteModal from '../../../frontend/src/components/SelectorVarianteModal.tsx';
import { server } from '../setup.ts';

/**
 * SelectorVarianteModal: carga de variantes (MSW), colores/atributos únicos,
 * selección color→atributo con stock, stepper con techo, bloqueo sin
 * variante completa y confirm con el ID de variante correcto.
 */

const variantesMock = [
  { ID_VARIANTE: 11, ID_PRODUCTO: 33, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '40', STOCK: 5 },
  { ID_VARIANTE: 12, ID_PRODUCTO: 33, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '42', STOCK: 2 },
  { ID_VARIANTE: 13, ID_PRODUCTO: 33, COLOR: 'Blanco', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '42', STOCK: 0 },
];

const producto = {
  ID: 33,
  NOMBRE: 'Guayos Prueba',
  PRECIO: 350000,
  IMAGEN: '/images/x.jpg',
  ID_VARIANTE_POR_DEFECTO: 11,
};

const montar = (onAgregar = vi.fn()) => {
  ultimoOnAgregar = onAgregar;
  render(
    <SelectorVarianteModal
      producto={producto}
      onCerrar={vi.fn()}
      onAgregar={onAgregar}
    />,
  );
  return onAgregar;
};
let ultimoOnAgregar: ReturnType<typeof vi.fn>;
const onAgregarRef = () => ultimoOnAgregar;

beforeEach(() => {
  vi.clearAllMocks();
  server.use(http.get('*/api/productos/33/variantes', () => HttpResponse.json(variantesMock)));
});

afterEach(() => {
  server.resetHandlers();
});

describe('SelectorVarianteModal', () => {
  it('carga variantes, lista colores únicos y atributos del color elegido', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Negro')).toBeTruthy());
    // atributos SIN color: todos (40, 42)
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('sin variantes (red caída): modal estable sin variantes', async () => {
    server.use(http.get('*/api/productos/33/variantes', () => HttpResponse.error()));
    montar();
    await waitFor(() => expect(screen.queryByText('Negro')).toBeNull());
  });

  it('seleccion color + atributo habilita el stepper con el stock de ESA variante', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Negro')).toBeTruthy());
    fireEvent.click(screen.getByText('Negro'));
    fireEvent.click(screen.getByText('42'));

    // stepper de la variante 12 (STOCK 2): sube hasta el techo y no pasa de ahí
    const botones = screen.getAllByRole('button').filter((b): b is HTMLButtonElement => b.tagName === 'BUTTON');
    const plus = botones.find((b) => (b.textContent ?? '').trim() === '+');
    const minus = botones.find((b) => (b.textContent ?? '').trim() === '-');
    expect(plus).toBeTruthy();
    if (!plus) throw new Error('no plus');
    await act(async () => { if (minus) fireEvent.click(minus); }); // no baja de 1
    await act(async () => { fireEvent.click(plus); });
    await act(async () => { fireEvent.click(plus); });
    await waitFor(() => expect(Number((document.querySelector('.modal-contenido input[type=number]') as HTMLInputElement).value)).toBe(2));
    // techo: un + extra NO supera el STOCK de la variante (2)
    await act(async () => { fireEvent.click(plus); });
    expect(Number((document.querySelector('.modal-contenido input[type=number]') as HTMLInputElement).value)).toBe(2);
  });

  it('confirm sin variante completa no llama onAgregar', async () => {
    const onAgregar = montar();
    await waitFor(() => expect(screen.getByText('Negro')).toBeTruthy());
    const botones = screen.getAllByRole('button');
    const agregar = botones.find((b) => (b.textContent ?? '').toLowerCase().includes('agregar') || (b.textContent ?? '').toLowerCase().includes('añadir'));
    if (agregar) {
      await act(async () => { fireEvent.click(agregar); });
      expect(onAgregar).not.toHaveBeenCalled();
    }
  });

  it('confirm completo: onAgregar con el ID de variante correcto y la cantidad', async () => {
    const onAgregar = montar();
    await waitFor(() => expect(screen.getByText('Negro')).toBeTruthy());
    fireEvent.click(screen.getByText('Negro'));
    fireEvent.click(screen.getByText('42'));

    const botones = screen.getAllByRole('button').filter((b): b is HTMLButtonElement => b.tagName === 'BUTTON');
    // OJO: los chips SELECCIONADOS también llevan btn-danger — el confirm es el de w-100 con 'Agregar al carrito'
    const agregar = botones.find((b) => (b.textContent ?? '').includes('Agregar al carrito'));
    expect(agregar).toBeTruthy();
    if (!agregar) throw new Error('no agregar');
    await act(async () => { fireEvent.click(agregar); });
    expect(onAgregar).toHaveBeenCalledWith(12, 1);
  });

  it('agotada: variante con STOCK 0 → confirm bloqueado (disabled) y sin llamada', async () => {
    montar();
    await waitFor(() => expect(screen.getByText('Blanco')).toBeTruthy());
    fireEvent.click(screen.getByText('Blanco'));
    fireEvent.click(screen.getByText('42'));
    const agregar = screen.getAllByRole('button').filter((b): b is HTMLButtonElement => b.tagName === 'BUTTON').find((b) => (b.textContent ?? '').includes('Agregar al carrito'));
    expect(agregar).toBeTruthy();
    if (!agregar) throw new Error('no agregar');
    expect(agregar.disabled).toBe(true); // STOCK 0 → disabled
    expect(onAgregarRef()).not.toHaveBeenCalled();
  });

  it('esAdmin: el modal se muestra (el admin no compra, la regla vive en el contexto)', async () => {
    render(
      <SelectorVarianteModal producto={producto} esAdmin onCerrar={vi.fn()} onAgregar={vi.fn()} />,
    );
    await waitFor(() => expect(screen.getByText('Negro')).toBeTruthy());
  });
});
