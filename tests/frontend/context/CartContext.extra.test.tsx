import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { CartProvider, useCart } from '../../../frontend/src/context/CartContext.tsx';
import { server } from '../setup.ts';

/**
 * CartContext.extra: las ramas que la suite base no toca — fetchCart sin
 * sesión y con red caída, agregar ok:false y errores 500, removeFromCart
 * sin ok (fallback a refetch), cantidad de item inexistente, updateQuantity
 * con valores inválidos y el error de useCart fuera del provider.
 */

const { estado } = vi.hoisted(() => ({ estado: { usuarioLogueado: true, esVendedor: false } }));

vi.mock('../../../frontend/src/context/AuthContext.tsx', () => ({
  useAuth: () => ({ usuarioLogueado: estado.usuarioLogueado, esVendedor: estado.esVendedor, usuario: { ID_USUARIO: 7, ID_ROL: 4 } }),
}));

const { fireMock } = vi.hoisted(() => ({ fireMock: vi.fn().mockResolvedValue({ isConfirmed: true }) }));
vi.mock('sweetalert2', () => ({ default: { fire: fireMock } }));

function Sonda() {
  const { cart, fetchCart, addToCart, updateQuantity, removeFromCart, decreaseQuantity, increaseQuantity } = useCart();
  return (
    <div>
      <span data-testid="cart">{JSON.stringify(cart)}</span>
      <button data-testid="fetch" onClick={() => { void fetchCart(); }}>fetch</button>
      <button data-testid="agregar" onClick={() => { void addToCart(1, 11, 1).then((ok) => { (window as unknown as { __ok?: boolean }).__ok = ok; }); }}>agregar</button>
      <button data-testid="inc-missing" onClick={() => { void increaseQuantity(999); }}>inc-missing</button>
      <button data-testid="dec-missing" onClick={() => { void decreaseQuantity(999); }}>dec-missing</button>
      <button data-testid="qty-cero" onClick={() => { void updateQuantity(5, 0); }}>qty-cero</button>
      <button data-testid="qty-missing" onClick={() => { void updateQuantity(999, 3); }}>qty-missing</button>
      <button data-testid="qty-techo" onClick={() => { void updateQuantity(5, 99); }}>qty-techo</button>
      <button data-testid="qty-valido" onClick={() => { void updateQuantity(5, 3); }}>qty-valido</button>
      <button data-testid="dec-valido" onClick={() => { void decreaseQuantity(5); }}>dec-valido</button>
      <button data-testid="rm" onClick={() => { void removeFromCart(5); }}>rm</button>
    </div>
  );
}

const itemBase = (over = {}) => ({
  ID_CARRITO: 5,
  CANTIDAD: 1,
  ID: 1,
  NOMBRE: 'Guayos Cart-Extra',
  PRECIO: 350000,
  IMAGEN: '/images/x.jpg',
  STOCK: 4,
  COLOR: 'Negro',
  ATRIBUTO: '42',
  ...over,
});

const montar = () => render(<CartProvider><Sonda /></CartProvider>);

beforeEach(() => {
  estado.usuarioLogueado = true;
  estado.esVendedor = false;
  vi.clearAllMocks();
  fireMock.mockResolvedValue({ isConfirmed: true });
});

afterEach(() => {
  server.resetHandlers();
});

describe('CartContext.extra — fetchCart', () => {
  it('sin sesión fetchCart sale temprano (sin GET ni estado)', async () => {
    estado.usuarioLogueado = false;
    const axios = (await import('axios')).default;
    const espia = vi.spyOn(axios, 'get');
    montar();
    await act(async () => { fireEvent.click(screen.getByTestId('fetch')); });
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  it('GET del carrito caído: catch registra el error y deja el carrito vacío', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get('*/api/carrito', () => HttpResponse.error()));
    montar();
    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(JSON.parse(screen.getByTestId('cart').textContent ?? '[]')).toEqual([]);
    errorSpy.mockRestore();
  });
});

describe('CartContext.extra — addToCart', () => {
  it('respuesta ok:false devuelve false sin abrir el mini-carrito', async () => {
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { ok: false } });
    montar();
    await act(async () => { fireEvent.click(screen.getByTestId('agregar')); });
    expect((window as unknown as { __ok?: boolean }).__ok).toBe(false);
    expect(fireMock).not.toHaveBeenCalled();
  });

  it('error sin respuesta (red caída): console.error y false', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('red caída'));
    montar();
    await act(async () => { fireEvent.click(screen.getByTestId('agregar')); });
    expect((window as unknown as { __ok?: boolean }).__ok).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Error al agregar al carrito', expect.any(Error));
    expect(fireMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('400 sin msg en la respuesta muestra Swal sin texto del backend', async () => {
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'post').mockRejectedValue({ response: { status: 400, data: {} } });
    montar();
    await act(async () => { fireEvent.click(screen.getByTestId('agregar')); });
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({ title: 'Stock limitado', text: undefined }));
  });
});

describe('CartContext.extra — removeFromCart', () => {
  it('respuesta sin ok: aviso y refetch del carrito', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'delete').mockResolvedValue({ data: {} });
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase()])));
    montar();
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toContain('Guayos Cart-Extra'));
    await act(async () => { fireEvent.click(screen.getByTestId('rm')); });
    expect(warnSpy).toHaveBeenCalledWith('Eliminación sin ok');
    // El refetch mantiene el item (el servidor sigue respondiendo con él).
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toContain('Guayos Cart-Extra'));
    warnSpy.mockRestore();
  });

  it('error sin msg usa el texto genérico del Swal', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'delete').mockRejectedValue({ response: { data: {} } });
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase()])));
    montar();
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toContain('Guayos Cart-Extra'));
    await act(async () => { fireEvent.click(screen.getByTestId('rm')); });
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'Error', text: 'No se pudo eliminar el producto',
    }));
    errorSpy.mockRestore();
  });
});

describe('CartContext.extra — cantidades', () => {
  it('increase/decrease sobre un id inexistente no toca el servidor', async () => {
    const axios = (await import('axios')).default;
    const espia = vi.spyOn(axios, 'put').mockResolvedValue({ data: { ok: true } });
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase()])));
    montar();
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toContain('Guayos'));
    await act(async () => { fireEvent.click(screen.getByTestId('inc-missing')); });
    await act(async () => { fireEvent.click(screen.getByTestId('dec-missing')); });
    expect(espia).not.toHaveBeenCalled();
    expect(fireMock).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  it('updateQuantity < 1 sale sin consultar nada', async () => {
    const axios = (await import('axios')).default;
    const espia = vi.spyOn(axios, 'put').mockResolvedValue({ data: { ok: true } });
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase()])));
    montar();
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toContain('Guayos'));
    await act(async () => { fireEvent.click(screen.getByTestId('qty-cero')); });
    expect(espia).not.toHaveBeenCalled();
    expect(fireMock).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  it('updateQuantity de id inexistente sale silencioso', async () => {
    const axios = (await import('axios')).default;
    const espia = vi.spyOn(axios, 'put').mockResolvedValue({ data: { ok: true } });
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase()])));
    montar();
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toContain('Guayos'));
    await act(async () => { fireEvent.click(screen.getByTestId('qty-missing')); });
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  it('updateQuantity sobre el stock: Swal "Solo hay N unidades" sin PUT', async () => {
    const axios = (await import('axios')).default;
    const espia = vi.spyOn(axios, 'put').mockResolvedValue({ data: { ok: true } });
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase({ STOCK: 4 })])));
    montar();
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toContain('Guayos'));
    await act(async () => { fireEvent.click(screen.getByTestId('qty-techo')); });
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning', title: 'Stock limitado', text: 'Solo hay 4 unidades disponibles de "Guayos Cart-Extra".',
    }));
    expect(espia).not.toHaveBeenCalled();
    espia.mockRestore();
  });

  it('actualizarCantidad con 400 del PUT: Swal con el stock y refetch', async () => {
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'put').mockRejectedValue({ response: { status: 400, data: {} } });
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase({ CANTIDAD: 2, STOCK: 5 })])));
    montar();
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toContain('Guayos'));
    // decreaseQuantity: 2-1=1 ≤ STOCK 5 → PUT → 400 sin msg → texto de fallback.
    await act(async () => { fireEvent.click(screen.getByTestId('dec-valido')); });
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      text: 'No hay más unidades. Solo hay 5 disponibles.',
    }));
  });

  it('actualizarCantidad con error no-400: console.error y sin Swal', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'put').mockRejectedValue(new Error('red caída'));
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase({ CANTIDAD: 2, STOCK: 5 })])));
    montar();
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toContain('Guayos'));
    await act(async () => { fireEvent.click(screen.getByTestId('dec-valido')); });
    expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    expect(fireMock).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('updateQuantity con 400 del PUT sin msg: Swal de stock y refetch', async () => {
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'put').mockRejectedValue({ response: { status: 400, data: {} } });
    server.use(http.get('*/api/carrito', () => HttpResponse.json([itemBase({ CANTIDAD: 1, STOCK: 5 })])));
    montar();
    await waitFor(() => expect(screen.getByTestId('cart').textContent).toContain('Guayos'));
    await act(async () => { fireEvent.click(screen.getByTestId('qty-valido')); });
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      text: 'Solo hay 5 unidades disponibles.',
    }));
  });
});

describe('CartContext.extra — useCart fuera del provider', () => {
  it('lanza el error de contexto', () => {
    function Sola() {
      useCart();
      return null;
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Sola />)).toThrow('useCart debe usarse dentro de CartProvider');
    errorSpy.mockRestore();
  });
});
