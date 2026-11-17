import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import InputCantidadStock from '../../../frontend/src/components/InputCantidadStock';

/**
 * InputCantidadStock: input de cantidad con tope de stock. Delega en
 * onActualizar(id, valor) después de validar (vacío, NaN, <1, >stock) y
 * avisa con SweetAlert cuando el stock limita.
 */

const { mockFire } = vi.hoisted(() => ({ mockFire: vi.fn() }));
vi.mock('sweetalert2', () => ({ default: { fire: mockFire } }));

const montar = (props: { stock?: number; cantidad?: number; fontSize?: string } = {}) => {
  const onActualizar = vi.fn();
  render(
    <InputCantidadStock
      idCarrito={5}
      stock={props.stock ?? 10}
      cantidad={props.cantidad ?? 3}
      nombre="Balón Stock-Test"
      onActualizar={onActualizar}
      fontSize={props.fontSize}
    />,
  );
  return onActualizar;
};

const input = () => screen.getByRole('spinbutton') as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InputCantidadStock — render', () => {
  it('usa el fontSize por defecto (14px) y refleja la cantidad', () => {
    montar();

    expect(input()).toHaveValue(3);
    expect(input().style.fontSize).toBe('14px');
  });

  it('respeta un fontSize personalizado', () => {
    montar({ fontSize: '13px' });

    expect(input().style.fontSize).toBe('13px');
  });
});

describe('InputCantidadStock — onChange', () => {
  it('valor válido delega en onActualizar', () => {
    const onActualizar = montar();

    fireEvent.change(input(), { target: { value: '7' } });
    expect(onActualizar).toHaveBeenCalledWith(5, 7);
  });

  it('cadena vacía no llama a onActualizar', () => {
    const onActualizar = montar();

    fireEvent.change(input(), { target: { value: '' } });
    expect(onActualizar).not.toHaveBeenCalled();
  });

  it('texto no numérico (NaN) no llama a onActualizar', () => {
    const onActualizar = montar();

    fireEvent.change(input(), { target: { value: 'abc' } });
    expect(onActualizar).not.toHaveBeenCalled();
  });

  it('valor menor a 1 se corrige a 1', () => {
    const onActualizar = montar();

    fireEvent.change(input(), { target: { value: '0' } });
    expect(onActualizar).toHaveBeenCalledWith(5, 1);
    expect(mockFire).not.toHaveBeenCalled();
  });

  it('valor mayor al stock avisa con Swal y aplica el stock', async () => {
    const onActualizar = montar({ stock: 4 });

    fireEvent.change(input(), { target: { value: '9' } });

    await waitFor(() => expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      title: 'Stock limitado',
      text: 'Solo hay 4 unidades disponibles de "Balón Stock-Test".',
    })));
    expect(onActualizar).toHaveBeenCalledWith(5, 4);
  });
});

describe('InputCantidadStock — onBlur', () => {
  it('vacío al salir corrige a 1', () => {
    const onActualizar = montar();

    fireEvent.blur(input(), { target: { value: '' } });
    expect(onActualizar).toHaveBeenCalledWith(5, 1);
  });

  it('por encima del stock al salir corrige al máximo sin Swal', () => {
    const onActualizar = montar({ stock: 4 });

    fireEvent.blur(input(), { target: { value: '20' } });
    expect(onActualizar).toHaveBeenCalledWith(5, 4);
    expect(mockFire).not.toHaveBeenCalled();
  });

  it('valor válido al salir NO dispara onActualizar (solo corrige)', () => {
    const onActualizar = montar();

    fireEvent.blur(input(), { target: { value: '5' } });
    expect(onActualizar).not.toHaveBeenCalled();
  });
});
