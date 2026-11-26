import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import React from 'react';
import SelectorVarianteModal from '../../../frontend/src/components/SelectorVarianteModal.tsx';
import { server } from '../setup.ts';

/**
 * Segunda capa del selector: teclado y cierre del overlay, imagen rota,
 * fallback de variante por defecto, deselección de chips, topes del stepper,
 * saneamiento del input cantidad y desmontaje durante la carga.
 */

const fireMock = vi.hoisted(() => vi.fn().mockResolvedValue({ isConfirmed: true }));
vi.mock('sweetalert2', () => ({ default: { fire: fireMock } }));

const variantesMock = [
  { ID_VARIANTE: 11, ID_PRODUCTO: 33, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '40', STOCK: 5 },
  { ID_VARIANTE: 12, ID_PRODUCTO: 33, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '42', STOCK: 2 },
  { ID_VARIANTE: 13, ID_PRODUCTO: 33, COLOR: 'Blanco', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '42', STOCK: 0 },
  { ID_VARIANTE: 14, ID_PRODUCTO: 33, COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '41', STOCK: 1 },
];

const producto = {
  ID: 33,
  NOMBRE: 'Guayos Extra',
  PRECIO: 350000,
  IMAGEN: '/images/rota.jpg',
  ID_VARIANTE_POR_DEFECTO: 11,
};

const renderModal = (props: Partial<React.ComponentProps<typeof SelectorVarianteModal>> = {}) => {
  const onCerrar = vi.fn();
  const onAgregar = vi.fn();
  const utils = render(
    <SelectorVarianteModal
      producto={producto}
      onCerrar={onCerrar}
      onAgregar={onAgregar}
      {...props}
    />,
  );
  return { ...utils, onCerrar, onAgregar };
};

const inputCantidad = () =>
  document.querySelector('.modal-contenido input[type=number]') as HTMLInputElement;

const boton = (texto: string) =>
  screen.getAllByRole('button').find((b) => (b.textContent ?? '').trim() === texto) as HTMLButtonElement;

const cargar = async () => {
  await screen.findByText('Negro', {}, { timeout: 3000 });
};

beforeEach(() => {
  vi.clearAllMocks();
  server.use(http.get('*/api/productos/33/variantes', () => HttpResponse.json(variantesMock)));
});

describe('SelectorVarianteModal.extra — estructura y teclado', () => {
  it('la imagen rota cae al placeholder y overlay/modal responden al teclado', async () => {
    const { onCerrar } = renderModal();
    await cargar();

    const img = document.querySelector('.modal-contenido img') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.src).toContain('placehold.co');

    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    const modal = document.querySelector('.modal-contenido') as HTMLElement;

    fireEvent.keyDown(overlay, { key: 'Tab' });
    expect(onCerrar).not.toHaveBeenCalled();
    fireEvent.keyDown(overlay, { key: 'Enter' });
    expect(onCerrar).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(overlay, { key: ' ' });
    expect(onCerrar).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(modal, { key: 'Tab' });
    fireEvent.keyDown(modal, { key: 'Enter' });
    fireEvent.keyDown(modal, { key: ' ' });
    // El keydown burbujea al overlay y dispara su cierre (comportamiento real del DOM).
    expect(onCerrar).toHaveBeenCalledTimes(4);

    fireEvent.click(overlay);
    expect(onCerrar).toHaveBeenCalledTimes(5);
    fireEvent.click(document.querySelector('.btn-close') as HTMLElement);
    expect(onCerrar).toHaveBeenCalledTimes(6);
  });

  it('sin variantes ofrece agregar la variante por defecto, salvo al admin', async () => {
    server.use(http.get('*/api/productos/33/variantes', () => HttpResponse.json([])));
    const { onAgregar, unmount } = renderModal();

    expect(await screen.findByText('Este producto no tiene variantes disponibles.', {}, { timeout: 3000 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Agregar igualmente' }));
    expect(onAgregar).toHaveBeenCalledWith(11, 1);
    unmount();

    renderModal({ esAdmin: true });
    expect(await screen.findByText('Este producto no tiene variantes disponibles.', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar igualmente' })).not.toBeInTheDocument();
  });
});

describe('SelectorVarianteModal.extra — chips de color y atributo', () => {
  it('desmarca el color repetido y conserva o limpia el atributo según el nuevo color', async () => {
    renderModal();
    await cargar();

    fireEvent.click(screen.getByText('40'));
    fireEvent.click(screen.getByText('Negro'));
    // El color Negro sí contiene la talla 40: el atributo se conserva.
    expect(screen.getByText('40').className).toContain('btn-danger');

    fireEvent.click(screen.getByText('Negro'));
    // Segundo click en el mismo color lo desmarca.
    expect(screen.getByText('Negro').className).not.toContain('btn-danger');

    fireEvent.click(screen.getByText('Negro'));
    fireEvent.click(screen.getByText('Blanco'));
    // Blanco no tiene talla 40: el atributo previo se limpia.
    expect(screen.getByText('42').className).not.toContain('btn-danger');

    fireEvent.click(screen.getByText('42'));
    expect(screen.getByText('42').className).toContain('btn-danger');
    fireEvent.click(screen.getByText('42'));
    expect(screen.getByText('42').className).not.toContain('btn-danger');
  });
});

describe('SelectorVarianteModal.extra — stepper y validación', () => {
  it('sube, baja y reajusta la cantidad al stock de la nueva variante', async () => {
    renderModal();
    await cargar();

    fireEvent.click(screen.getByText('Negro'));
    fireEvent.click(screen.getByText('42'));
    fireEvent.click(boton('+'));
    expect(inputCantidad().value).toBe('2');
    fireEvent.click(boton('-'));
    expect(inputCantidad().value).toBe('1');
    fireEvent.click(boton('-')); // ya está en el mínimo
    expect(inputCantidad().value).toBe('1');

    fireEvent.click(boton('+'));
    fireEvent.click(boton('+'));
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Stock limitado' }));
    expect(inputCantidad().value).toBe('2');

    // Cambiar a una variante con stock 1 recorta la cantidad por el efecto.
    fireEvent.click(screen.getByText('41'));
    await waitFor(() => expect(inputCantidad().value).toBe('1'));
  });

  it('sanea el input: vacío, negativos, sobre-stock, válidos y blur', async () => {
    renderModal();
    await cargar();
    fireEvent.click(screen.getByText('Negro'));
    fireEvent.click(screen.getByText('40'));

    const input = inputCantidad();
    fireEvent.focus(input); // habilitado: no muestra aviso
    expect(fireMock).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('1');

    fireEvent.change(input, { target: { value: '-3' } });
    expect(input.value).toBe('1');

    fireEvent.change(input, { target: { value: '9' } });
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Stock limitado' }));
    expect(input.value).toBe('5');

    fireEvent.change(input, { target: { value: '3' } });
    expect(input.value).toBe('3');
    fireEvent.blur(input); // valor válido: no cambia
    expect(input.value).toBe('3');

    input.value = '';
    fireEvent.blur(input);
    expect(input.value).toBe('1');

    fireEvent.change(input, { target: { value: '2' } });
    input.value = '9';
    fireEvent.blur(input);
    expect(input.value).toBe('5');
  });

  it('con la cantidad deshabilitada avisa desde -, focus, change y +', async () => {
    renderModal();
    await cargar();

    const input = inputCantidad();
    fireEvent.click(boton('-'));
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input);
    fireEvent.click(boton('+'));

    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Selecciona las opciones' }));
    // jsdom no dispara click sobre botones disabled: avisan focus y change.
    expect(fireMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(input.value).toBe('1');
    expect(boton('-').disabled).toBe(true);
    expect(boton('+').disabled).toBe(true);
  });
});

describe('SelectorVarianteModal.extra — ciclo de vida', () => {
  it('desmontar antes de resolver no actualiza estado', async () => {
    server.use(http.get('*/api/productos/33/variantes', async () => {
      await delay(100);
      return HttpResponse.json(variantesMock);
    }));

    const { unmount } = renderModal();
    unmount();
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(screen.queryByText('Negro')).not.toBeInTheDocument();
  });

  it('un rechazo posterior al desmontaje tampoco actualiza estado', async () => {
    server.use(http.get('*/api/productos/33/variantes', async () => {
      await delay(100);
      return HttpResponse.error();
    }));

    const { unmount } = renderModal();
    unmount();
    await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
    expect(screen.queryByText('Negro')).not.toBeInTheDocument();
  });
});
