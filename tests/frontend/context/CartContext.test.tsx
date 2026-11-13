import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { CartProvider, useCart } from '../../../frontend/src/context/CartContext.tsx';
import { server } from '../setup.ts';

/**
 * CartContext REAL contra MSW + axios espía. Reglas cubiertas: sesión anónima
 * (carrito vacío), vendedor bloqueado de compra, agregar con fetch posterior,
 * 400 de stock → Swal, actualizar con clamp de stock, eliminar y clear.
 */
vi.mock('../../../frontend/src/context/AuthContext.tsx', () => ({
  useAuth: () => ({ usuarioLogueado: estado.usuarioLogueado, esVendedor: estado.esVendedor, usuario: { ID_USUARIO: 7, ID_ROL: 4 } }),
}));

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

const estado = { usuarioLogueado: true, esVendedor: false };

function Sonda() {
  const { cart, loadingCart, isOpen, setIsOpen, fetchCart, addToCart, updateQuantity, removeFromCart, clearCart, decreaseQuantity, increaseQuantity, totalProductos } = useCart();
  return (
    <div>
      <span data-testid="cart">{JSON.stringify(cart)}</span>
      <span data-testid="total">{totalProductos}</span>
      <span data-testid="open">{String(isOpen)}</span>
      <button data-testid="agregar" onClick={() => { void addToCart(1, 11, 2); }}>agregar</button>
      <button data-testid="qty" onClick={() => { void updateQuantity(5, 3); }}>qty</button>
      <button data-testid="inc" onClick={() => { void increaseQuantity(5); }}>inc</button>
      <button data-testid="dec" onClick={() => { void decreaseQuantity(5); }}>dec</button>
      <button data-testid="rm" onClick={() => { void removeFromCart(5); }}>rm</button>
      <button data-testid="clear" onClick={() => clearCart()}>clear</button>
      <button data-testid="toggle" onClick={() => setIsOpen(true)}>toggle</button>
      <button data-testid="fetch" onClick={() => { void fetchCart(); }}>fetch</button>
    </div>
  );
}

const itemBase = (over = {}) => ({
  ID_CARRITO: 5,
  CANTIDAD: 1,
  ID: 1,
  NOMBRE: 'Guayos Profesionales',
  PRECIO: 350000,
  IMAGEN: '/images/x.jpg',
  STOCK: 4,
  COLOR: 'Negro',
  ATRIBUTO: '42',
  ...over,
});

beforeEach(() => {
  estado.usuarioLogueado = true;
  estado.esVendedor = false;
  vi.clearAllMocks();
});

afterEach(() => {
  server.resetHandlers();
});

describe('CartContext', () => {
  it('anónimo: carrito SIEMPRE vacío aunque el servidor respondiera algo', async () => {
    estado.usuarioLogueado = false;
    render(<CartProvider><Sonda /></CartProvider>);
    await waitFor(() => expect(JSON.parse(screen.getByTestId('cart').textContent ?? '[]')).toEqual([]));
    expect(screen.getByTestId('total').textContent).toBe('0');
  });

  it('logueado: carga el carrito del servidor y suma totalProductos', async () => {
    server.use(
      http.get('*/api/carrito', () => HttpResponse.json([itemBase({ CANTIDAD: 2 }), itemBase({ ID_CARRITO: 6, CANTIDAD: 3, ID: 2 })])),
    );
    render(<CartProvider><Sonda /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('5'));
  });

  it('vendedor NO puede comprar: Swal de bloqueo y SIN petición al backend', async () => {
    estado.esVendedor = true;
    const axios = (await import('axios')).default;
    const espia = vi.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } });
    render(<CartProvider><Sonda /></CartProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('agregar')); });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cuenta de vendedor' }));
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  it('anónimo que intenta agregar: Swal "¡Inicia Sesión!" sin petición', async () => {
    estado.usuarioLogueado = false;
    const axios = (await import('axios')).default;
    const espia = vi.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } });
    render(<CartProvider><Sonda /></CartProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('agregar')); });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¡Inicia Sesión!' }));
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  it('agregar OK: POST con id_producto/id_variante/cantidad, abre el mini-carrito y refresca', async () => {
    const axios = (await import('axios')).default;
    const espia = vi.spyOn(axios, 'post').mockResolvedValue({ data: { ok: true } });
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase({ CANTIDAD: 2 })])));
    render(<CartProvider><Sonda /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('2'));
    await act(async () => { fireEvent.click(screen.getByTestId('agregar')); });
    expect(espia).toHaveBeenCalledWith('/api/carrito/agregar', { id_producto: 1, id_variante: 11, cantidad: 2 }, { withCredentials: true });
    expect(screen.getByTestId('open').textContent).toBe('true');
    espia.mockRestore();
  });

  it('400 de stock insuficiente: Swal con el mensaje del backend y false', async () => {
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'post').mockRejectedValue({
      response: { status: 400, data: { msg: 'Solo quedan 2 unidades' } },
    });
    render(<CartProvider><Sonda /></CartProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('agregar')); });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Stock limitado',
      text: 'Solo quedan 2 unidades',
    }));
  });

  it('updateQuantity y increase/decrease respetan el techo de stock (Swal, sin PUT)', async () => {
    const axios = (await import('axios')).default;
    const espia = vi.spyOn(axios, 'put').mockResolvedValue({ data: { ok: true } });
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase({ CANTIDAD: 3, STOCK: 3 })])));
    render(<CartProvider><Sonda /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('3'));

    // updateQuantity directo sobre el stock → Swal, sin PUT
    await act(async () => { fireEvent.click(screen.getByTestId('qty')); }); // updateQuantity(5, 3) — 3 ≤ 3 → PUT ok
    expect(espia).toHaveBeenCalledWith('/api/carrito/actualizar/5', { cantidad: 3 }, { withCredentials: true });

    // increaseQuantity: 3+1 = 4 > STOCK 3 → Swal y sin PUT
    espia.mockClear();
    await act(async () => { fireEvent.click(screen.getByTestId('inc')); });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Stock limitado' }));
    expect(espia).not.toHaveBeenCalled();

    // decreaseQuantity: 3-1 = 2 → PUT con la nueva cantidad
    await act(async () => { fireEvent.click(screen.getByTestId('dec')); });
    expect(espia).toHaveBeenCalledWith('/api/carrito/actualizar/5', { cantidad: 2 }, { withCredentials: true });
    espia.mockRestore();
  });

  it('decreaseQuantity hasta 0 pide confirmación (Swal confirmado → DELETE)', async () => {
    const axios = (await import('axios')).default;
    const espiaDelete = vi.spyOn(axios, 'delete').mockResolvedValue({ data: { ok: true } });
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase({ CANTIDAD: 1 })])));
    render(<CartProvider><Sonda /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('1'));
    await act(async () => { fireEvent.click(screen.getByTestId('dec')); });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Eliminar producto?' }));
    expect(espiaDelete).toHaveBeenCalledWith('/api/carrito/eliminar/5', { withCredentials: true });
    espiaDelete.mockRestore();
  });

  it('removeFromCart OK filtra localmente; fallo muestra Swal de error', async () => {
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase(), itemBase({ ID_CARRITO: 6 })])));
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'delete').mockRejectedValue({ response: { data: { msg: 'No se pudo eliminar' } } });
    render(<CartProvider><Sonda /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('2'));
    await act(async () => { fireEvent.click(screen.getByTestId('rm')); });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error' }));
  });

  it('clearCart vacía el estado sin tocar el servidor', async () => {
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase()])));
    const axios = (await import('axios')).default;
    const espiaDelete = vi.spyOn(axios, 'delete');
    render(<CartProvider><Sonda /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId('total').textContent).toBe('1'));
    await act(async () => { fireEvent.click(screen.getByTestId('clear')); });
    expect(JSON.parse(screen.getByTestId('cart').textContent ?? '[]')).toEqual([]);
    expect(espiaDelete).not.toHaveBeenCalled();
    espiaDelete.mockRestore();
  });
});
