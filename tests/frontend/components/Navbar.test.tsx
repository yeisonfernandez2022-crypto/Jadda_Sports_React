import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import Navbar from '../../../frontend/src/components/Navbar';

/**
 * Navbar contra su código REAL: mega-menú por categorías, ofertas con
 * descuentos, búsqueda en vivo (misma lógica del catálogo), sesión con menú
 * por rol, badge de chats sin leer, hamburguesa móvil y cierre por click afuera.
 *
 * El estado de auth se controla mutando `estadoAuth` (mock del contexto) y
 * las navegaciones se verifican con una sonda de ubicación en la ruta comodín.
 */

const estadoAuth = {
  usuario: null as null | { NOMBRE_USUARIO: string; foto_url: string | null },
  usuarioLogueado: false,
  esAdmin: false,
  esVendedor: false,
  logoutGlobal: vi.fn().mockResolvedValue(undefined),
};

const openLogin = vi.fn();
const openRegister = vi.fn();

vi.mock('../../../frontend/src/context/AuthContext.tsx', () => ({
  useAuth: () => estadoAuth,
}));

vi.mock('../../../frontend/src/context/AuthModalContext.tsx', () => ({
  useAuthModal: () => ({ openLogin, openRegister, openForgot: vi.fn() }),
}));

vi.mock('../../../frontend/src/components/BellNotificaciones', () => ({
  default: () => <div data-testid="bell-mock" />,
}));

const categorias = [
  { ID_CATEGORIA: 1, NOMBRE_CATEGORIA: 'Fútbol NAV-TEST' },
  { ID_CATEGORIA: 2, NOMBRE_CATEGORIA: 'Running NAV-TEST' },
];
const productos = [
  { ID: 10, NOMBRE: 'Balón Nav-Test', PRECIO: 50000, CATEGORIA: 'Fútbol NAV-TEST', ID_DESCUENTO: null, IMAGEN: 'https://test.local/balon.png' },
  { ID: 11, NOMBRE: 'Camiseta Nav-Test', PRECIO: 80000, CATEGORIA: 'Fútbol NAV-TEST', ID_DESCUENTO: 9, IMAGEN: null },
  { ID: 12, NOMBRE: 'Guante Nav-Test', PRECIO: 30000, CATEGORIA: 'Fútbol NAV-TEST', ID_DESCUENTO: null, IMAGEN: null },
  { ID: 13, NOMBRE: 'Taco Nav-Test', PRECIO: 40000, CATEGORIA: 'Fútbol NAV-TEST', ID_DESCUENTO: null, IMAGEN: null },
  { ID: 14, NOMBRE: 'Botín Nav-Test', PRECIO: 60000, CATEGORIA: 'Fútbol NAV-TEST', ID_DESCUENTO: null, IMAGEN: null },
  { ID: 20, NOMBRE: 'Zapatilla Nav-Test', PRECIO: 90000, CATEGORIA: 'Running NAV-TEST', ID_DESCUENTO: 9, IMAGEN: null },
];
const descuentos = [{ ID_DESCUENTO: 9, PORCENTAJE: 20 }];

const handlersNavbar = () => [
  http.get('*/api/productos', () => HttpResponse.json(productos)),
  http.get('*/api/productos/categorias', () => HttpResponse.json(categorias)),
  http.get('*/api/productos/descuentos', () => HttpResponse.json(descuentos)),
  http.get('*/api/chat/no-leidos', () => HttpResponse.json({ total: 3 })),
];

/** Sonda de navegación: muestra pathname + query en la ruta comodín. */
const Sonda = () => {
  const loc = useLocation();
  return <div data-testid="sonda">{loc.pathname}{loc.search}</div>;
};

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Navbar />} />
        <Route path="*" element={<Sonda />} />
      </Routes>
    </MemoryRouter>,
  );

const liDe = (texto: string) => screen.getByText(texto).closest('li') as HTMLElement;

/**
 * Abre el mega-menú y espera el GET del catálogo: "Explora por categoría"
 * solo se renderiza con showMegaMenu && categoriasMenu.length > 0, así que
 * verlo garantiza los datos cargados.
 */
const abrirCatalogo = async () => {
  fireEvent.mouseEnter(liDe('CATÁLOGO'));
  await screen.findByText('Explora por categoría', {}, { timeout: 3000 });
};

beforeEach(() => {
  vi.clearAllMocks();
  estadoAuth.usuario = null;
  estadoAuth.usuarioLogueado = false;
  estadoAuth.esAdmin = false;
  estadoAuth.esVendedor = false;
  estadoAuth.logoutGlobal = vi.fn().mockResolvedValue(undefined);
  server.use(...handlersNavbar());
});

describe('Navbar — invitado', () => {
  it('muestra botones de sesión, el link VENDER y no renderiza la campana', () => {
    const { container } = montar();

    expect(screen.getByRole('button', { name: 'INICIAR SESIÓN' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'REGISTRO' })).toBeInTheDocument();
    expect(screen.getByText('VENDER')).toBeInTheDocument();
    expect(screen.queryByTestId('bell-mock')).not.toBeInTheDocument();
    expect(container.querySelector('.nav-hamburguesa')).toBeInTheDocument();
  });

  it('los botones de sesión abren el modal de login/registro', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'INICIAR SESIÓN' }));
    expect(openLogin).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'REGISTRO' }));
    expect(openRegister).toHaveBeenCalledTimes(1);
  });
});

describe('Navbar — mega-menú de catálogo', () => {
  it('al pasar el mouse muestra categorías y el panel vacío de productos', async () => {
    const { container } = montar();
    await abrirCatalogo();

    expect(screen.getByText('Fútbol NAV-TEST')).toBeInTheDocument();
    expect(screen.getByText('Running NAV-TEST')).toBeInTheDocument();
    expect(screen.getByText('Pasa el mouse sobre una categoría para ver sus productos.')).toBeInTheDocument();
    expect(container.querySelector('.mega-menu')).not.toBeNull();
  });

  it('cada categoría activa lista sus productos (máximo 4) con precio', async () => {
    montar();
    await abrirCatalogo();

    fireEvent.mouseEnter(screen.getByText('Fútbol NAV-TEST'));

    await screen.findByText('Balón Nav-Test');
    expect(screen.getByText('Guante Nav-Test')).toBeInTheDocument();
    // Locale variable en jsdom → regex para el precio formateado.
    expect(screen.getByText(/^\$50[.,]000$/)).toBeInTheDocument();
    // slice(0, 4): el quinto producto de la categoría no entra.
    expect(screen.queryByText('Botín Nav-Test')).not.toBeInTheDocument();
    expect(screen.queryByText('Zapatilla Nav-Test')).not.toBeInTheDocument();
  });

  it('click en categoría navega al catálogo filtrado', async () => {
    montar();
    await abrirCatalogo();

    fireEvent.click(screen.getByText('Running NAV-TEST'));

    await waitFor(() => expect(screen.getByTestId('sonda')).toHaveTextContent('/catalogo?cat=Running%20NAV-TEST'));
  });

  it('click en un producto del mega-menú navega a su ficha', async () => {
    montar();
    await abrirCatalogo();
    fireEvent.mouseEnter(screen.getByText('Fútbol NAV-TEST'));
    await screen.findByText('Balón Nav-Test');

    fireEvent.click(screen.getByText('Balón Nav-Test'));

    await waitFor(() => expect(screen.getByTestId('sonda')).toHaveTextContent('/producto/10'));
  });

  it('Ver todo el catálogo navega a /catalogo', async () => {
    montar();
    await abrirCatalogo();

    fireEvent.click(screen.getByText('Ver todo el catálogo →'));

    await waitFor(() => expect(screen.getByTestId('sonda')).toHaveTextContent('/catalogo'));
  });
});

describe('Navbar — menú de ofertas', () => {
  it('lista los productos con descuento y el porcentaje del mapa', async () => {
    montar();
    fireEvent.mouseEnter(liDe('OFERTAS'));

    expect(await screen.findByText('Camiseta Nav-Test', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('🔥 Ofertas destacadas')).toBeInTheDocument();
    expect(screen.getAllByText('-20%')).toHaveLength(2);
    expect(screen.queryByText('Balón Nav-Test')).not.toBeInTheDocument();
  });

  it('sin descuentos muestra el aviso de ofertas vacías', async () => {
    server.use(http.get('*/api/productos', () => HttpResponse.json(
      productos.map((p) => ({ ...p, ID_DESCUENTO: null })),
    )));
    montar();
    fireEvent.mouseEnter(liDe('OFERTAS'));

    expect(await screen.findByText('No hay ofertas disponibles por el momento.', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('Ver todas las ofertas navega con el filtro de descuento', async () => {
    montar();
    fireEvent.mouseEnter(liDe('OFERTAS'));

    fireEvent.click(screen.getByText('Ver todas las ofertas →'));

    await waitFor(() => expect(screen.getByTestId('sonda')).toHaveTextContent('/catalogo?descuento=true'));
  });
});

describe('Navbar — buscador en vivo', () => {
  it('sugiere por consulta con tildes y navega al producto elegido', async () => {
    montar();
    const input = screen.getByPlaceholderText('BUSCAR PRODUCTO...');

    fireEvent.change(input, { target: { value: 'balón' } });

    // Dropdown con la sugerencia (debounce de 300 ms + carga del menú).
    const sugerencia = await screen.findByText('Balón Nav-Test', {}, { timeout: 3000 });
    expect(sugerencia.closest('.search-dropdown')).not.toBeNull();

    fireEvent.click(sugerencia);
    await waitFor(() => expect(screen.getByTestId('sonda')).toHaveTextContent('/producto/10'));
  });

  it('consulta sin coincidencias muestra "No se encontraron productos"', async () => {
    montar();
    const input = screen.getByPlaceholderText('BUSCAR PRODUCTO...');

    fireEvent.change(input, { target: { value: 'zzz-nada' } });

    expect(await screen.findByText('No se encontraron productos', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('Enter navega al catálogo con la búsqueda y limpia el input', async () => {
    montar();
    const input = screen.getByPlaceholderText('BUSCAR PRODUCTO...');

    fireEvent.change(input, { target: { value: 'guante' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(screen.getByTestId('sonda')).toHaveTextContent('/catalogo?search=guante'));
  });

  it('el ícono de búsqueda también navega y el Enter sin texto no navega', async () => {
    const { container } = montar();
    const input = screen.getByPlaceholderText('BUSCAR PRODUCTO...');

    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => expect(screen.queryByTestId('sonda')).not.toBeInTheDocument());
    fireEvent.click(container.querySelector('.search-icon') as HTMLElement);
    await waitFor(() => expect(screen.queryByTestId('sonda')).not.toBeInTheDocument());

    fireEvent.change(input, { target: { value: 'camiseta' } });
    fireEvent.click(container.querySelector('.search-icon') as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('sonda')).toHaveTextContent('/catalogo?search=camiseta'));
  });
});

describe('Navbar — sesión activa por rol', () => {
  const loginCliente = () => {
    estadoAuth.usuario = { NOMBRE_USUARIO: 'yeison prueba', foto_url: null };
    estadoAuth.usuarioLogueado = true;
  };

  it('saludo con primer nombre, campana visible y menú de cliente con badge de chats', async () => {
    loginCliente();
    const { container } = montar();

    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });
    expect(screen.getByText('HOLA,')).toBeInTheDocument();
    expect(screen.getByText('YEISON')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN')).not.toBeInTheDocument();

    fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
    await screen.findByText('Mis Pedidos');

    const menu = container.querySelector('.profile-dropdown-menu') as HTMLElement;
    expect(within(menu).getByText('Favoritos')).toBeInTheDocument();
    expect(within(menu).getByText('Planes')).toBeInTheDocument();
    // Badge de /api/chat/no-leidos (total: 3).
    expect(within(menu).getByText('3')).toBeInTheDocument();
    expect(within(menu).getByText('Vender')).toBeInTheDocument();
    expect(within(menu).getByText('Ayuda y Soporte')).toBeInTheDocument();
  });

  it('CERRAR SESIÓN llama a logoutGlobal y más de 99 chats se abrevian a 99+', async () => {
    server.use(http.get('*/api/chat/no-leidos', () => HttpResponse.json({ total: 150 })));
    loginCliente();
    const { container } = montar();

    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });
    fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);

    expect(await screen.findByText('99+')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'CERRAR SESIÓN' })[0]);
    await waitFor(() => expect(estadoAuth.logoutGlobal).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container.querySelector('.profile-dropdown-menu')).toBeNull());
  });

  it('mousedown afuera cierra el menú del perfil', async () => {
    loginCliente();
    const { container } = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });
    fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
    await screen.findByText('Mis Pedidos');

    fireEvent.mouseDown(document.body);

    await waitFor(() => expect(container.querySelector('.profile-dropdown-menu')).toBeNull());
  });

  it('el vendedor ve su tienda y el admin el panel administrativo', async () => {
    estadoAuth.usuarioLogueado = true;
    estadoAuth.usuario = { NOMBRE_USUARIO: 'pepe vendedor', foto_url: null };
    estadoAuth.esVendedor = true;
    const { container, unmount } = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });

    fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
    expect(await screen.findByText('Mi tienda')).toBeInTheDocument();
    expect(screen.getByText('Panel de vendedor')).toBeInTheDocument();
    expect(screen.getByText('Mis productos')).toBeInTheDocument();
    expect(screen.queryByText('Mis Pedidos')).not.toBeInTheDocument();
    unmount();

    estadoAuth.esVendedor = false;
    estadoAuth.esAdmin = true;
    const segundo = montar();
    await segundo.findByTestId('bell-mock', {}, { timeout: 3000 });
    expect(segundo.container.querySelector('.admin-badge')?.textContent).toBe('ADMIN');
    fireEvent.click(segundo.container.querySelector('.user-profile-trigger') as HTMLElement);
    expect(await segundo.findByText('Panel Admin')).toBeInTheDocument();
    expect(segundo.getByText('Dashboard')).toBeInTheDocument();
    expect(segundo.getByText('Órdenes')).toBeInTheDocument();
    expect(segundo.getByText('Usuarios')).toBeInTheDocument();
    expect(segundo.queryByText('Mis Pedidos')).not.toBeInTheDocument();
  });
});

describe('Navbar — menú móvil', () => {
  it('la hamburguesa abre el panel y el link cierra; invitado ve botones de sesión', () => {
    const { container } = montar();

    fireEvent.click(container.querySelector('.nav-hamburguesa') as HTMLElement);
    const panel = container.querySelector('.nav-movil-panel') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(within(panel).getByText('Cuenta')).toBeInTheDocument();
    const botonesSesion = within(panel).getAllByRole('button', { name: 'INICIAR SESIÓN' });
    expect(botonesSesion).toHaveLength(1);
    fireEvent.click(botonesSesion[0]);
    expect(openLogin).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.nav-movil-panel')).toBeNull();
  });

  it('el cliente ve su cuenta y el admin su panel en el móvil', async () => {
    estadoAuth.usuarioLogueado = true;
    estadoAuth.usuario = { NOMBRE_USUARIO: 'yeison prueba', foto_url: null };
    const { container, unmount } = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });
    fireEvent.click(container.querySelector('.nav-hamburguesa') as HTMLElement);

    const panel = container.querySelector('.nav-movil-panel') as HTMLElement;
    expect(within(panel).getByText('Mi cuenta')).toBeInTheDocument();
    expect(within(panel).getByText('Mi perfil')).toBeInTheDocument();
    expect(within(panel).getByText('Ayuda y Soporte')).toBeInTheDocument();
    fireEvent.click(within(panel).getByText('INICIO'));
    expect(container.querySelector('.nav-movil-panel')).toBeNull();
    unmount();

    estadoAuth.esAdmin = true;
    const segundo = montar();
    await segundo.findByTestId('bell-mock', {}, { timeout: 3000 });
    fireEvent.click(segundo.container.querySelector('.nav-hamburguesa') as HTMLElement);
    const panelAdmin = segundo.container.querySelector('.nav-movil-panel') as HTMLElement;
    expect(within(panelAdmin).getByText('Panel Admin')).toBeInTheDocument();
    expect(within(panelAdmin).getByText('Dashboard')).toBeInTheDocument();
  });
});
