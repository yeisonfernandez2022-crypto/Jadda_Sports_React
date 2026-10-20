import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductCard from '../components/ProductCard.tsx';

// Estado mutable del mock de auth (para probar admin/vendedor)
const authState = vi.hoisted(() => ({ esAdmin: false, esVendedor: false }));

// Mock del hook useAuth directamente
vi.mock('../context/AuthContext.tsx', () => ({
  useAuth: () => ({
    esAdmin: authState.esAdmin,
    esVendedor: authState.esVendedor,
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
    authState.esAdmin = false;
    authState.esVendedor = false;
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

  it('muestra precio original tachado y precio final con descuento', () => {
    render(<ProductCard producto={productoMock} descuentoPorcentaje={20} onVerDetalle={vi.fn()} />);
    expect(screen.getByText('$350.000')).toBeInTheDocument();
    expect(screen.getByText('$280.000')).toBeInTheDocument();
  });

  it('renderiza estrellas y promedio cuando hay reseñas', () => {
    render(<ProductCard producto={{ ...productoMock, RATING: 3.2 }} onVerDetalle={vi.fn()} />);
    expect(screen.getByText(/\(10\)/)).toBeInTheDocument();
    const estrellas = Array.from(document.querySelectorAll('i.fa-star'));
    expect(estrellas.filter((e) => e.classList.contains('fas'))).toHaveLength(3);
    expect(estrellas.filter((e) => e.classList.contains('far'))).toHaveLength(2);
  });

  it('no renderiza estrellas cuando RESENA_COUNT es 0', () => {
    render(<ProductCard producto={{ ...productoMock, RESENA_COUNT: 0 }} onVerDetalle={vi.fn()} />);
    expect(document.querySelectorAll('i.fa-star')).toHaveLength(0);
  });

  it('muestra el corazón lleno si es favorito y avisa al hacer click', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <ProductCard producto={productoMock} onVerDetalle={vi.fn()} onToggleFavorito={onToggle} esFavorito />
    );
    const corazon = container.querySelector('i.fa-heart');
    expect(corazon?.classList.contains('fas')).toBe(true);
    fireEvent.click(corazon!.parentElement!);
    expect(onToggle).toHaveBeenCalledWith(productoMock.ID);
  });

  it('muestra el corazón vacío si no es favorito', () => {
    const { container } = render(
      <ProductCard producto={productoMock} onVerDetalle={vi.fn()} onToggleFavorito={vi.fn()} />
    );
    expect(container.querySelector('i.fa-heart')?.classList.contains('far')).toBe(true);
  });

  it('llama onAgregarCarrito al hacer click en el carrito', () => {
    const onAgregar = vi.fn();
    const { container } = render(
      <ProductCard producto={productoMock} onVerDetalle={vi.fn()} onAgregarCarrito={onAgregar} />
    );
    const boton = container.querySelector('i.fa-shopping-cart')?.closest('button') as HTMLButtonElement;
    expect(boton).toBeTruthy();
    fireEvent.click(boton);
    expect(onAgregar).toHaveBeenCalledWith(productoMock.ID);
  });

  it('deshabilita el carrito y avisa cuando está agotado', () => {
    const { container } = render(
      <ProductCard producto={{ ...productoMock, STOCK: 0 }} onVerDetalle={vi.fn()} onAgregarCarrito={vi.fn()} />
    );
    const boton = container.querySelector('i.fa-shopping-cart')?.closest('button') as HTMLButtonElement;
    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute('title', 'Producto agotado');
  });

  it('atenúa y explica el carrito para vendedores', () => {
    authState.esVendedor = true;
    const { container } = render(
      <ProductCard producto={productoMock} onVerDetalle={vi.fn()} onAgregarCarrito={vi.fn()} />
    );
    const boton = container.querySelector('i.fa-shopping-cart')?.closest('button') as HTMLButtonElement;
    expect(boton).not.toBeDisabled();
    expect(boton).toHaveStyle({ opacity: '0.5', cursor: 'not-allowed' });
    expect(boton).toHaveAttribute('title', 'Los vendedores no pueden comprar en la tienda');
  });

  it('oculta favorito y carrito para administradores', () => {
    authState.esAdmin = true;
    const { container } = render(
      <ProductCard producto={productoMock} onVerDetalle={vi.fn()} onToggleFavorito={vi.fn()} onAgregarCarrito={vi.fn()} />
    );
    expect(container.querySelector('i.fa-heart')).toBeNull();
    expect(container.querySelector('i.fa-shopping-cart')).toBeNull();
  });

  it('abre el detalle desde la tarjeta y desde VER DETALLES', () => {
    const onVer = vi.fn();
    const { container } = render(<ProductCard producto={productoMock} onVerDetalle={onVer} />);
    fireEvent.click(container.querySelector('.img-container-custom')!);
    expect(onVer).toHaveBeenCalledWith(productoMock.ID);
    fireEvent.click(screen.getByRole('button', { name: /ver detalles/i }));
    expect(onVer).toHaveBeenCalledTimes(2);
  });

  it('reemplaza la imagen por un placeholder si falla la carga', () => {
    render(<ProductCard producto={productoMock} onVerDetalle={vi.fn()} />);
    const img = screen.getByAltText('Guayos Profesionales');
    fireEvent.error(img);
    expect(img.getAttribute('src')).toContain('placehold.co');
  });
});