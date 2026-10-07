import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProductCard from '../components/ProductCard.tsx';
import React from 'react';

// Mock del hook useAuth directamente
vi.mock('../context/AuthContext.tsx', () => ({
  useAuth: () => ({
    esAdmin: false,
    esVendedor: false,
    usuarioLogueado: false,
    usuario: null,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
    fetchPerfil: vi.fn(),
  }),
}));

// Mock del hook useCart
vi.mock('../context/CartContext.tsx', () => ({
  useCart: () => ({
    carrito: [],
    addToCart: vi.fn(),
    removeFromCart: vi.fn(),
    updateCantidad: vi.fn(),
    clearCart: vi.fn(),
    totalItems: 0,
    totalPrice: 0,
    cartButtonX: 0,
    cartButtonY: 0,
    setCartButtonPos: vi.fn(),
  }),
}));

const productoMock = {
  ID: 1,
  NOMBRE: 'Guayos Profesionales',
  MARCA: 'Adidas',
  PRECIO: 350000,
  IMAGEN: '/images/productos/Producto_01/img_1.jpg',
  STOCK: 10,
  ID_CATEGORIA: 1,
  ID_DESCUENTO: null,
  DESCUENTO_PORCENTAJE: null,
  ID_VARIANTE_POR_DEFECTO: 1,
  RATING: 4.5,
  RESENA_COUNT: 10,
};

describe('ProductCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza el nombre del producto', () => {
    render(<ProductCard producto={productoMock} onVerDetalle={vi.fn()} />);
    expect(screen.getByText('Guayos Profesionales')).toBeInTheDocument();
  });

  it('renderiza la marca del producto', () => {
    render(<ProductCard producto={productoMock} onVerDetalle={vi.fn()} />);
    expect(screen.getByText('Adidas')).toBeInTheDocument();
  });

  it('renderiza el precio formateado', () => {
    render(<ProductCard producto={productoMock} onVerDetalle={vi.fn()} />);
    expect(screen.getByText('$350.000')).toBeInTheDocument();
  });

  it('renderiza la imagen del producto', () => {
    render(<ProductCard producto={productoMock} onVerDetalle={vi.fn()} />);
    const img = screen.getByAltText('Guayos Profesionales');
    expect(img).toHaveAttribute('src', '/images/productos/Producto_01/img_1.jpg');
  });

  it('muestra badge de descuento cuando hay descuentoPorcentaje', () => {
    render(<ProductCard producto={productoMock} descuentoPorcentaje={20} onVerDetalle={vi.fn()} />);
    expect(screen.getByText('-20%')).toBeInTheDocument();
  });

  it('muestra "AGOTADO" cuando stock es 0', () => {
    const productoAgotado = { ...productoMock, STOCK: 0 };
    render(<ProductCard producto={productoAgotado} onVerDetalle={vi.fn()} />);
    expect(screen.getByText('AGOTADO')).toBeInTheDocument();
  });

  it('muestra "¡Solo quedan X!" cuando stock <= 10', () => {
    const productoPocoStock = { ...productoMock, STOCK: 5 };
    render(<ProductCard producto={productoPocoStock} onVerDetalle={vi.fn()} />);
    expect(screen.getByText('¡Solo quedan 5!')).toBeInTheDocument();
  });

  it('no muestra advertencia de stock cuando stock > 10', () => {
    const productoStockNormal = { ...productoMock, STOCK: 20 };
    render(<ProductCard producto={productoStockNormal} onVerDetalle={vi.fn()} />);
    expect(screen.queryByText(/Solo quedan/)).not.toBeInTheDocument();
  });
});