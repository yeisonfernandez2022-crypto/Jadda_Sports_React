import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MiniCartMenu } from '../../../frontend/src/components/MiniCartMenu';

/**
 * MiniCartMenu: panel flotante del carrito con línea por producto, controles
 * de cantidad (delegan en InputCantidadStock), borrado con confirmación
 * SweetAlert y acceso a la compra. CartContext se mockea con un objeto
 * mutable; BarraEnvioGratis e InputCantidadStock se aíslan como stubs.
 */

const navegarMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navegarMock };
});

vi.mock('../../../frontend/src/components/BarraEnvioGratis', () => ({
  default: (props: { subtotal: number }) => <div data-testid="barra-envio" data-subtotal={props.subtotal} />,
}));

vi.mock('../../../frontend/src/components/InputCantidadStock', () => ({
  default: (props: { idCarrito: number; stock: number; cantidad: number; nombre: string }) => (
    <div data-testid={`input-cantidad-${props.idCarrito}`} data-stock={props.stock} data-cantidad={props.cantidad} />
  ),
}));

type Item = {
  ID_CARRITO: number;
  NOMBRE: string;
  PRECIO: number;
  CANTIDAD: number;
  STOCK: number;
  IMAGEN: string;
  COLOR: string | null;
  ATRIBUTO: string | null;
};

const item = (sobre: Partial<Item> & { ID_CARRITO: number }): Item => ({
  NOMBRE: `Producto ${sobre.ID_CARRITO}`,
  PRECIO: 50000,
  CANTIDAD: 1,
  STOCK: 20,
  IMAGEN: 'https://test.local/img.png',
  COLOR: null,
  ATRIBUTO: null,
  ...sobre,
});

const mocksCart = () => ({
  isOpen: true,
  setIsOpen: vi.fn(),
  cart: [] as Item[],
  removeFromCart: vi.fn().mockResolvedValue(undefined),
  decreaseQuantity: vi.fn().mockResolvedValue(undefined),
  increaseQuantity: vi.fn().mockResolvedValue(undefined),
  updateQuantity: vi.fn().mockResolvedValue(undefined),
});

const ctx = { ...mocksCart(), fireResolver: null as null | (() => { isConfirmed: boolean }) };

vi.mock('../../../frontend/src/context/CartContext', () => ({
  useCart: () => ctx,
}));

const fireMock = vi.fn();
vi.mock('sweetalert2', () => ({
  default: {
    fire: (...a: unknown[]) => {
      const resultado = ctx.fireResolver?.() ?? { isConfirmed: true };
      fireMock(...a);
      return Promise.resolve(resultado);
    },
  },
}));

const montar = () =>
  render(
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<div data-testid="sonda" />} />
      </Routes>
      <MiniCartMenu />
    </BrowserRouter>,
  );

beforeEach(() => {
  Object.assign(ctx, mocksCart());
  ctx.fireResolver = null;
  fireMock.mockClear();
});

describe('MiniCartMenu — visibilidad', () => {
  it('cerrado no renderiza nada', () => {
    ctx.isOpen = false;
    montar();

    expect(screen.queryByText('Tu Carrito')).not.toBeInTheDocument();
  });
});

describe('MiniCartMenu — contenido del carrito', () => {
  it('lista los productos con precio, color, atributo y subtotal', () => {
    ctx.cart = [
      item({ ID_CARRITO: 1, PRECIO: 50000, CANTIDAD: 2, COLOR: 'Rojo', ATRIBUTO: 'Talla M' }),
      item({ ID_CARRITO: 2, PRECIO: 30000, CANTIDAD: 1, NOMBRE: 'Guante Mini-Test' }),
    ];
    montar();

    expect(screen.getByText('Tu Carrito')).toBeInTheDocument();
    expect(screen.getByText('Producto 1')).toBeInTheDocument();
    expect(screen.getByText('Guante Mini-Test')).toBeInTheDocument();
    // Precio formateado con locale es-CO (regex por el separador variable).
    expect(screen.getByText(/^\$50[.,]000$/)).toBeInTheDocument();
    expect(screen.getByText(/Color: Rojo/)).toBeInTheDocument();
    expect(screen.getByText(/Talla M/)).toBeInTheDocument();
    expect(screen.getByTestId('barra-envio')).toHaveAttribute('data-subtotal', '130000');
    expect(screen.getByRole('button', { name: 'Comprar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeInTheDocument();
    // El input de cantidad aislado recibe el stock y la cantidad.
    expect(screen.getByTestId('input-cantidad-1')).toHaveAttribute('data-cantidad', '2');
    expect(screen.getByTestId('input-cantidad-2')).toHaveAttribute('data-stock', '20');
  });

  it('carrito vacío muestra el aviso y no hay pie de compra', () => {
    ctx.cart = [];
    montar();

    expect(screen.getByText('El carrito está vacío')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Comprar' })).not.toBeInTheDocument();
    expect(screen.queryByTestId('barra-envio')).not.toBeInTheDocument();
  });

  it('anuncia el stock bajo (1 a 10) y lo oculta fuera de rango', () => {
    ctx.cart = [
      item({ ID_CARRITO: 1, STOCK: 3, NOMBRE: 'Stock bajo' }),
      item({ ID_CARRITO: 2, STOCK: 0, NOMBRE: 'Sin stock' }),
      item({ ID_CARRITO: 3, STOCK: 15, NOMBRE: 'Stock alto' }),
    ];
    montar();

    expect(screen.getByText('Solo quedan 3 disponibles')).toBeInTheDocument();
    expect(screen.queryByText('Solo quedan 0 disponibles')).not.toBeInTheDocument();
    expect(screen.queryByText('Solo quedan 15 disponibles')).not.toBeInTheDocument();
  });
});

describe('MiniCartMenu — controles de cantidad', () => {
  it('"-" con más de una unidad llama decreaseQuantity', () => {
    ctx.cart = [item({ ID_CARRITO: 1, CANTIDAD: 3 })];
    montar();

    fireEvent.click(screen.getByText('-', { selector: 'button' }));
    expect(ctx.decreaseQuantity).toHaveBeenCalledWith(1);
    expect(fireMock).not.toHaveBeenCalled();
  });

  it('"-" con una unidad pide confirmación y elimina al aceptar', async () => {
    ctx.cart = [item({ ID_CARRITO: 1, CANTIDAD: 1 })];
    ctx.fireResolver = () => ({ isConfirmed: true });
    montar();

    fireEvent.click(screen.getByText('-', { selector: 'button' }));

    await waitFor(() => expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Eliminar producto',
      text: 'Este es el último producto. ¿Deseas eliminarlo del carrito?',
    })));
    await waitFor(() => expect(ctx.removeFromCart).toHaveBeenCalledWith(1));
  });

  it('"-" con una unidad y confirmación negada no elimina', async () => {
    ctx.cart = [item({ ID_CARRITO: 1, CANTIDAD: 1 })];
    ctx.fireResolver = () => ({ isConfirmed: false });
    montar();

    fireEvent.click(screen.getByText('-', { selector: 'button' }));

    await waitFor(() => expect(fireMock).toHaveBeenCalled());
    expect(ctx.removeFromCart).not.toHaveBeenCalled();
  });

  it('"+" llama increaseQuantity', () => {
    ctx.cart = [item({ ID_CARRITO: 1 })];
    montar();

    fireEvent.click(screen.getByText('+', { selector: 'button' }));
    expect(ctx.increaseQuantity).toHaveBeenCalledWith(1);
  });

  it('el botón de basura elimina todo el producto con confirmación', async () => {
    ctx.cart = [item({ ID_CARRITO: 1, CANTIDAD: 4 })];
    ctx.fireResolver = () => ({ isConfirmed: true });
    montar();

    fireEvent.click(document.querySelector('button[style*="font-size: 16px"]') as HTMLElement);

    await waitFor(() => expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      text: 'Tienes 4 unidades. ¿Deseas eliminar todo este producto del carrito?',
      confirmButtonText: 'Sí, eliminar todo',
    })));
    await waitFor(() => expect(ctx.removeFromCart).toHaveBeenCalledWith(1));
  });

  it('cancelar la confirmación de la basura no elimina', async () => {
    ctx.cart = [item({ ID_CARRITO: 1, CANTIDAD: 4 })];
    ctx.fireResolver = () => ({ isConfirmed: false });
    montar();

    fireEvent.click(document.querySelector('button[style*="font-size: 16px"]') as HTMLElement);

    await waitFor(() => expect(fireMock).toHaveBeenCalled());
    expect(ctx.removeFromCart).not.toHaveBeenCalled();
  });
});

describe('MiniCartMenu — navegación y cierre', () => {
  it('Cerrar y el botón × cierran el menú', () => {
    ctx.cart = [item({ ID_CARRITO: 1 })];
    montar();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(ctx.setIsOpen).toHaveBeenCalledWith(false);

    fireEvent.click(document.querySelector('button[style*="font-size: 18px"]') as HTMLElement);
    expect(ctx.setIsOpen).toHaveBeenCalledWith(false);
  });

  it('Comprar cierra y navega a /resumencompra', () => {
    ctx.cart = [item({ ID_CARRITO: 1 })];
    montar();

    fireEvent.click(screen.getByRole('button', { name: 'Comprar' }));

    expect(ctx.setIsOpen).toHaveBeenCalledWith(false);
    expect(navegarMock).toHaveBeenCalledWith('/resumencompra');
  });

  it('mousedown fuera del menú lo cierra', () => {
    ctx.cart = [item({ ID_CARRITO: 1 })];
    montar();

    fireEvent.mouseDown(document.body);
    expect(ctx.setIsOpen).toHaveBeenCalledWith(false);
  });

  it('mousedown dentro del menú no lo cierra', () => {
    ctx.cart = [item({ ID_CARRITO: 1 })];
    montar();

    fireEvent.mouseDown(screen.getByText('Tu Carrito'));
    expect(ctx.setIsOpen).not.toHaveBeenCalled();
  });
});
