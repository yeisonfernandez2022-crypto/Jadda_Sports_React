import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FloatingCart } from '../../../frontend/src/components/FloatingCart';

/**
 * FloatingCart: botón flotante del carrito. CartContext se mockea con un
 * objeto mutable para verificar el badge, el color de abierto/cerrado y el
 * toggle de setIsOpen.
 */

const carrito = {
  totalProductos: 0,
  isOpen: false,
  setIsOpen: vi.fn(),
};

vi.mock('../../../frontend/src/context/CartContext', () => ({
  useCart: () => carrito,
}));

beforeEach(() => {
  carrito.totalProductos = 0;
  carrito.isOpen = false;
  carrito.setIsOpen.mockClear();
});

describe('FloatingCart', () => {
  it('abre el carrito al hacer clic cuando está cerrado', () => {
    render(<FloatingCart />);
    const boton = screen.getByRole('button');

    expect(boton).toHaveStyle({ backgroundColor: '#e63946' });
    fireEvent.click(boton);
    expect(carrito.setIsOpen).toHaveBeenCalledWith(true);
  });

  it('cierra el carrito al hacer clic cuando está abierto', () => {
    carrito.isOpen = true;
    render(<FloatingCart />);

    expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: '#c1121f' });
    fireEvent.click(screen.getByRole('button'));
    expect(carrito.setIsOpen).toHaveBeenCalledWith(false);
  });

  it('muestra el contador solo cuando hay productos', () => {
    const { unmount } = render(<FloatingCart />);
    expect(screen.queryByText('0')).not.toBeInTheDocument();

    // FloatingCart está memoizado: se remonta con el nuevo estado en vez de
    // rerenderizar con las mismas props.
    unmount();
    carrito.totalProductos = 3;
    render(<FloatingCart />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
