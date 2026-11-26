import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import Navbar from '../../../frontend/src/components/Navbar';

/**
 * Segunda capa de Navbar contra su código REAL: teclado de los menús,
 * temporizadores de hover, imágenes rotas, todos los enlaces del menú de
 * perfil y del panel móvil, ramas de búsqueda y polling de chats.
 *
 * La ruta comodín renderiza Navbar + sonda: a diferencia de la suite base,
 * aquí el Navbar no se desmonta al navegar y se pueden recorrer todos los
 * enlaces de cada rol en una sola montura.
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
  { ID_CATEGORIA: 1, NOMBRE_CATEGORIA: 'Fútbol NAVX-TEST' },
  { ID_CATEGORIA: 2, NOMBRE_CATEGORIA: 'Running NAVX-TEST' },
];
const productos = [
  { ID: 10, NOMBRE: 'Balón Navx-Test', PRECIO: 50000, CATEGORIA: 'Fútbol NAVX-TEST', ID_DESCUENTO: null, IMAGEN: 'https://test.local/balon.png' },
  { ID: 11, NOMBRE: 'Camiseta Navx-Test', PRECIO: 80000, CATEGORIA: 'Fútbol NAVX-TEST', ID_DESCUENTO: 9, IMAGEN: null },
  { ID: 12, NOMBRE: 'Guante Navx-Test', PRECIO: 30000, CATEGORIA: 'Fútbol NAVX-TEST', ID_DESCUENTO: null, IMAGEN: null },
  { ID: 13, NOMBRE: 'Taco Navx-Test', PRECIO: 40000, CATEGORIA: 'Fútbol NAVX-TEST', ID_DESCUENTO: null, IMAGEN: null },
  { ID: 14, NOMBRE: 'Botín Navx-Test', PRECIO: 60000, CATEGORIA: 'Fútbol NAVX-TEST', ID_DESCUENTO: null, IMAGEN: null },
  { ID: 20, NOMBRE: 'Zapatilla Navx-Test', PRECIO: 90000, CATEGORIA: 'Running NAVX-TEST', ID_DESCUENTO: 9, IMAGEN: null },
];
const descuentos = [{ ID_DESCUENTO: 9, PORCENTAJE: 20 }];

const handlersNavbar = () => [
  http.get('*/api/productos', () => HttpResponse.json(productos)),
  http.get('*/api/productos/categorias', () => HttpResponse.json(categorias)),
  http.get('*/api/productos/descuentos', () => HttpResponse.json(descuentos)),
  http.get('*/api/chat/no-leidos', () => HttpResponse.json({ total: 3 })),
];

/** Sonda de navegación: muestra pathname + query de la ruta actual. */
const Sonda = () => {
  const loc = useLocation();
  return <div data-testid="sonda">{loc.pathname}{loc.search}</div>;
};

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="*" element={<><Navbar /><Sonda /></>} />
      </Routes>
    </MemoryRouter>,
  );

const liDe = (texto: string) => screen.getByText(texto).closest('li') as HTMLElement;

const abrirCatalogo = async () => {
  fireEvent.mouseEnter(liDe('CATÁLOGO'));
  await screen.findByText('Explora por categoría', {}, { timeout: 3000 });
};

const esperarRuta = (ruta: string) =>
  waitFor(() => expect(screen.getByTestId('sonda').textContent).toBe(ruta), { timeout: 3000 });

const iniciarSesion = (
  nombre: string,
  rol: { admin?: boolean; vendedor?: boolean } = {},
) => {
  estadoAuth.usuario = { NOMBRE_USUARIO: nombre, foto_url: null };
  estadoAuth.usuarioLogueado = true;
  estadoAuth.esAdmin = rol.admin ?? false;
  estadoAuth.esVendedor = rol.vendedor ?? false;
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

describe('Navbar.extra — teclado', () => {
  it('categoría, producto y "Ver todo el catálogo" responden al teclado', async () => {
    const { container } = montar();
    await abrirCatalogo();

    const categoria = screen.getByText('Fútbol NAVX-TEST').closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(categoria, { key: 'Tab' });
    fireEvent.keyDown(categoria, { key: 'Enter' });
    await esperarRuta('/catalogo?cat=F%C3%BAtbol%20NAVX-TEST');

    await abrirCatalogo();
    fireEvent.mouseEnter(screen.getByText('Fútbol NAVX-TEST'));
    const producto = (await screen.findByText('Balón Navx-Test')).closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(producto, { key: 'Tab' });
    fireEvent.keyDown(producto, { key: 'Enter' });
    await esperarRuta('/producto/10');

    await abrirCatalogo();
    const verTodo = screen.getByText('Ver todo el catálogo →');
    fireEvent.keyDown(verTodo, { key: 'Tab' });
    fireEvent.keyDown(verTodo, { key: ' ' });
    await esperarRuta('/catalogo');

    expect(container.querySelector('.mega-menu')).toBeNull();
  });

  it('producto en oferta y "Ver todas las ofertas" responden al teclado', async () => {
    montar();
    fireEvent.mouseEnter(liDe('OFERTAS'));

    const oferta = (await screen.findByText('Camiseta Navx-Test', {}, { timeout: 3000 })).closest('[role="button"]') as HTMLElement;
    fireEvent.keyDown(oferta, { key: 'Tab' });
    fireEvent.keyDown(oferta, { key: 'Enter' });
    await esperarRuta('/producto/11');

    fireEvent.mouseEnter(liDe('OFERTAS'));
    const verTodas = await screen.findByText('Ver todas las ofertas →', {}, { timeout: 3000 });
    fireEvent.keyDown(verTodas, { key: 'Tab' });
    fireEvent.keyDown(verTodas, { key: ' ' });
    await esperarRuta('/catalogo?descuento=true');
  });

  it('el disparador del perfil abre con Enter y cierra con Espacio', async () => {
    iniciarSesion('yeison teclado');
    const { container } = montar();
    const trigger = container.querySelector('.user-profile-trigger') as HTMLElement;

    fireEvent.keyDown(trigger, { key: 'Tab' });
    expect(container.querySelector('.profile-dropdown-menu')).toBeNull();
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(await screen.findByText('Mis Pedidos')).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: ' ' });
    await waitFor(() => expect(container.querySelector('.profile-dropdown-menu')).toBeNull());
  });
});

describe('Navbar.extra — temporizadores de hover', () => {
  it('abre, cancela cierres pendientes y cierra catálogo y ofertas tras 200 ms', async () => {
    const { container } = montar();

    // Ofertas: el cierre pendiente se cancela al volver a entrar.
    fireEvent.mouseEnter(liDe('OFERTAS'));
    await screen.findByText('🔥 Ofertas destacadas', {}, { timeout: 3000 });
    fireEvent.mouseLeave(liDe('OFERTAS'));
    fireEvent.mouseEnter(liDe('OFERTAS'));
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByText('🔥 Ofertas destacadas')).toBeInTheDocument();

    // Entrar al catálogo cierra ofertas y cancela su temporizador.
    await abrirCatalogo();
    expect(screen.queryByText('🔥 Ofertas destacadas')).not.toBeInTheDocument();

    // Reentrar al catálogo cancela el cierre pendiente del propio mega-menú.
    fireEvent.mouseLeave(liDe('CATÁLOGO'));
    fireEvent.mouseEnter(liDe('CATÁLOGO'));
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByText('Explora por categoría')).toBeInTheDocument();

    // Entrar al panel flotante también cancela el cierre del li.
    fireEvent.mouseLeave(liDe('CATÁLOGO'));
    fireEvent.mouseEnter(container.querySelector('.mega-menu') as HTMLElement);
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByText('Explora por categoría')).toBeInTheDocument();
    fireEvent.mouseLeave(container.querySelector('.mega-menu') as HTMLElement);
    await waitFor(() => expect(screen.queryByText('Explora por categoría')).not.toBeInTheDocument());

    // Ofertas cancela el cierre pendiente del catálogo al entrar.
    fireEvent.mouseLeave(liDe('CATÁLOGO'));
    fireEvent.mouseEnter(liDe('OFERTAS'));
    await screen.findByText('🔥 Ofertas destacadas', {}, { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText('Explora por categoría')).not.toBeInTheDocument();

    // Reentrar a ofertas y a su panel cancela los cierres pendientes.
    fireEvent.mouseLeave(liDe('OFERTAS'));
    fireEvent.mouseEnter(liDe('OFERTAS'));
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByText('🔥 Ofertas destacadas')).toBeInTheDocument();
    fireEvent.mouseLeave(liDe('OFERTAS'));
    fireEvent.mouseEnter(container.querySelector('.mega-menu-ofertas') as HTMLElement);
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.getByText('🔥 Ofertas destacadas')).toBeInTheDocument();

    // Salir del panel dispara el cierre diferido.
    fireEvent.mouseLeave(container.querySelector('.mega-menu-ofertas') as HTMLElement);
    await waitFor(() => expect(screen.queryByText('🔥 Ofertas destacadas')).not.toBeInTheDocument());
  });

  it('entrar al panel de ofertas sin cierre pendiente no cancela nada', async () => {
    const { container } = montar();
    fireEvent.mouseEnter(liDe('OFERTAS'));
    await screen.findByText('🔥 Ofertas destacadas', {}, { timeout: 3000 });

    fireEvent.mouseEnter(container.querySelector('.mega-menu-ofertas') as HTMLElement);
    fireEvent.mouseLeave(container.querySelector('.mega-menu-ofertas') as HTMLElement);
    await waitFor(() => expect(screen.queryByText('🔥 Ofertas destacadas')).not.toBeInTheDocument());
  });
});

describe('Navbar.extra — imágenes y datos de menús', () => {
  it('las imágenes rotas del perfil y del desplegable caen al avatar generado', async () => {
    iniciarSesion('yeison roto');
    const { container, unmount } = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });

    const avatar = container.querySelector('.profile-avatar img') as HTMLImageElement;
    fireEvent.error(avatar);
    expect(avatar.src).toContain('ui-avatars.com');
    expect(avatar.src).toContain('yeison%20roto');

    fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
    const avatarMenu = (await screen.findByText('Mis Pedidos')).closest('.profile-dropdown-menu')
      ?.querySelector('.dropdown-header-avatar') as HTMLImageElement;
    fireEvent.error(avatarMenu);
    expect(avatarMenu.src).toContain('ui-avatars.com');
    unmount();

    iniciarSesion('vendedor roto', { vendedor: true });
    const segundo = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });
    fireEvent.click(segundo.container.querySelector('.user-profile-trigger') as HTMLElement);
    const avatarVendedor = (await screen.findByText('Mi tienda')).closest('.profile-dropdown-menu')
      ?.querySelector('.dropdown-header-avatar') as HTMLImageElement;
    fireEvent.error(avatarVendedor);
    expect(avatarVendedor.src).toContain('ui-avatars.com');
  });

  it('la imagen rota de una sugerencia usa el placeholder', async () => {
    const { container } = montar();
    const input = screen.getByPlaceholderText('BUSCAR PRODUCTO...');

    fireEvent.change(input, { target: { value: 'balón' } });
    const sugerencia = await screen.findByText('Balón Navx-Test', {}, { timeout: 3000 });
    const img = sugerencia.closest('li')?.querySelector('.dropdown-img') as HTMLImageElement;
    expect(img.src).toBe('https://test.local/balon.png');
    fireEvent.error(img);
    expect(img.src).toContain('placehold.co');

    expect(container.querySelector('.search-dropdown')).not.toBeNull();
  });

  it('sin porcentaje en el mapa, la oferta muestra el precio formateado', async () => {
    server.use(http.get('*/api/productos', () => HttpResponse.json([
      { ID: 30, NOMBRE: 'Oferta Sin Mapa NAVX', PRECIO: 12000, CATEGORIA: 'Fútbol NAVX-TEST', ID_DESCUENTO: 77, IMAGEN: null },
    ])));
    montar();

    fireEvent.mouseEnter(liDe('OFERTAS'));

    expect(await screen.findByText('Oferta Sin Mapa NAVX', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/^\$12[.,]000$/)).toBeInTheDocument();
  });
});

describe('Navbar.extra — enlaces del menú de perfil', () => {
  it('el cliente navega por todos sus enlaces y cierra el menú', async () => {
    iniciarSesion('yeison enlaces');
    const { container } = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });

    const enlaces: Array<[string, string]> = [
      ['Mis Pedidos', '/perfil/compras'],
      ['Favoritos', '/favoritos'],
      ['Retos', '/retos'],
      ['Planes', '/mis-planes'],
      ['Mis chats', '/chats'],
      ['Vender', '/ser-vendedor'],
      ['Ayuda y Soporte', '/ayuda_soporte'],
    ];

    for (const [texto, ruta] of enlaces) {
      fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
      fireEvent.click(screen.getByText(texto));
      await esperarRuta(ruta);
      expect(container.querySelector('.profile-dropdown-menu')).toBeNull();
    }

    fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
    fireEvent.click(container.querySelector('.dropdown-header-link') as HTMLElement);
    await esperarRuta('/perfil');
  });

  it('el vendedor navega por su tienda y cierra sesión desde el desplegable', async () => {
    iniciarSesion('pepe enlaces', { vendedor: true });
    const { container } = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });

    fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
    fireEvent.click(screen.getByText('Panel de vendedor'));
    await esperarRuta('/vendedor');

    fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
    fireEvent.click(screen.getByText('Mis productos'));
    await esperarRuta('/vendedor/productos');

    fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
    fireEvent.click(await screen.findByRole('button', { name: /CERRAR SESIÓN/ }));
    await waitFor(() => expect(estadoAuth.logoutGlobal).toHaveBeenCalledTimes(1));
    expect(container.querySelector('.profile-dropdown-menu')).toBeNull();
  });

  it('el admin navega por su panel y por el encabezado de perfil', async () => {
    iniciarSesion('ana enlaces', { admin: true });
    const { container } = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });

    const enlaces: Array<[string, string]> = [
      ['Dashboard', '/admin'],
      ['Productos', '/admin/productos'],
      ['Órdenes', '/admin/ordenes'],
      ['Usuarios', '/admin/usuarios'],
      ['Retos', '/admin/retos'],
    ];

    for (const [texto, ruta] of enlaces) {
      fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
      fireEvent.click(screen.getByText(texto));
      await esperarRuta(ruta);
    }

    fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
    fireEvent.click(container.querySelector('.dropdown-header-link') as HTMLElement);
    await esperarRuta('/perfil');
  });

  it('un nombre vacío muestra USUARIO y el mousedown dentro no cierra el menú', async () => {
    iniciarSesion('');
    const { container } = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });

    expect(screen.getByText('USUARIO')).toBeInTheDocument();
    fireEvent.click(container.querySelector('.user-profile-trigger') as HTMLElement);
    const menu = await screen.findByText('Mis Pedidos');
    fireEvent.mouseDown(menu);
    expect(container.querySelector('.profile-dropdown-menu')).not.toBeNull();
  });
});

describe('Navbar.extra — panel móvil', () => {
  it('el invitado navega por sus enlaces y el botón REGISTRO abre el modal', async () => {
    const { container } = montar();

    const enlaces: Array<[string, string]> = [
      ['CATÁLOGO', '/catalogo'],
      ['OFERTAS', '/catalogo?descuento=true'],
      ['VENDER', '/ser-vendedor'],
    ];
    for (const [texto, ruta] of enlaces) {
      fireEvent.click(container.querySelector('.nav-hamburguesa') as HTMLElement);
      const panel = container.querySelector('.nav-movil-panel') as HTMLElement;
      fireEvent.click(within(panel).getByText(texto));
      await esperarRuta(ruta);
      expect(container.querySelector('.nav-movil-panel')).toBeNull();
    }

    fireEvent.click(container.querySelector('.nav-hamburguesa') as HTMLElement);
    const panel = container.querySelector('.nav-movil-panel') as HTMLElement;
    fireEvent.click(within(panel).getByRole('button', { name: 'REGISTRO' }));
    expect(openRegister).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.nav-movil-panel')).toBeNull();
  });

  it('el cliente recorre sus enlaces, ve el badge 99+ y cierra sesión', async () => {
    server.use(http.get('*/api/chat/no-leidos', () => HttpResponse.json({ total: 150 })));
    iniciarSesion('yeison movil');
    const { container } = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });

    fireEvent.click(container.querySelector('.nav-hamburguesa') as HTMLElement);
    const panelInicial = container.querySelector('.nav-movil-panel') as HTMLElement;
    expect(await within(panelInicial).findByText('99+')).toBeInTheDocument();
    fireEvent.click(container.querySelector('.nav-hamburguesa') as HTMLElement);
    expect(container.querySelector('.nav-movil-panel')).toBeNull();

    const enlaces: Array<[string, string]> = [
      ['Mi perfil', '/perfil'],
      ['Mis pedidos', '/perfil/compras'],
      ['Favoritos', '/favoritos'],
      ['Retos', '/retos'],
      ['Planes', '/mis-planes'],
      ['Mis chats', '/chats'],
      ['Vender', '/ser-vendedor'],
      ['Ayuda y Soporte', '/ayuda_soporte'],
    ];
    for (const [texto, ruta] of enlaces) {
      fireEvent.click(container.querySelector('.nav-hamburguesa') as HTMLElement);
      const panel = container.querySelector('.nav-movil-panel') as HTMLElement;
      fireEvent.click(within(panel).getByText(texto));
      await esperarRuta(ruta);
      expect(container.querySelector('.nav-movil-panel')).toBeNull();
    }

    fireEvent.click(container.querySelector('.nav-hamburguesa') as HTMLElement);
    const panelFinal = container.querySelector('.nav-movil-panel') as HTMLElement;
    fireEvent.click(panelFinal.querySelector('.nav-movil-logout') as HTMLElement);
    await waitFor(() => expect(estadoAuth.logoutGlobal).toHaveBeenCalledTimes(1));
    expect(container.querySelector('.nav-movil-panel')).toBeNull();
  });

  it('el vendedor ve y usa los enlaces de su tienda en el móvil', async () => {
    iniciarSesion('pepe movil', { vendedor: true });
    const { container } = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });

    for (const [texto, ruta] of [['Panel de vendedor', '/vendedor'], ['Mis productos', '/vendedor/productos']] as const) {
      fireEvent.click(container.querySelector('.nav-hamburguesa') as HTMLElement);
      const panel = container.querySelector('.nav-movil-panel') as HTMLElement;
      expect(within(panel).getByText('Mi tienda')).toBeInTheDocument();
      fireEvent.click(within(panel).getByText(texto));
      await esperarRuta(ruta);
    }
  });

  it('el admin recorre los enlaces de su panel en el móvil', async () => {
    iniciarSesion('ana movil', { admin: true });
    const { container } = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });

    const enlaces: Array<[string, string]> = [
      ['Dashboard', '/admin'],
      ['Productos', '/admin/productos'],
      ['Órdenes', '/admin/ordenes'],
      ['Usuarios', '/admin/usuarios'],
      ['Retos', '/admin/retos'],
    ];
    for (const [texto, ruta] of enlaces) {
      fireEvent.click(container.querySelector('.nav-hamburguesa') as HTMLElement);
      const panel = container.querySelector('.nav-movil-panel') as HTMLElement;
      expect(within(panel).getByText('Panel Admin')).toBeInTheDocument();
      fireEvent.click(within(panel).getByText(texto));
      await esperarRuta(ruta);
    }
  });
});

describe('Navbar.extra — búsqueda y polling de chats', () => {
  it('una tecla distinta a Enter no navega y una sola letra no abre el dropdown', async () => {
    const { container } = montar();
    const input = screen.getByPlaceholderText('BUSCAR PRODUCTO...');

    fireEvent.change(input, { target: { value: 'guante' } });
    fireEvent.keyDown(input, { key: 'a' });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('sonda')?.textContent).toBe('/');

    fireEvent.change(input, { target: { value: 'g' } });
    await new Promise((r) => setTimeout(r, 450));
    expect(container.querySelector('.search-dropdown')).toBeNull();
  });

  it('un fallo del polling no rompe el Navbar y un total 0 no pinta badge', async () => {
    server.use(http.get('*/api/chat/no-leidos', () => HttpResponse.error()));
    iniciarSesion('yeison polling');
    const primero = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 100));

    fireEvent.click(primero.container.querySelector('.user-profile-trigger') as HTMLElement);
    await screen.findByText('Mis Pedidos');
    expect(primero.container.querySelector('.nav-chat-badge')).toBeNull();
    primero.unmount();

    server.use(http.get('*/api/chat/no-leidos', () => HttpResponse.json({ total: 0 })));
    const segundo = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 100));
    fireEvent.click(segundo.container.querySelector('.user-profile-trigger') as HTMLElement);
    await screen.findByText('Mis Pedidos');
    expect(segundo.container.querySelector('.nav-chat-badge')).toBeNull();
    segundo.unmount();

    // Respuesta no-OK: el body no se usa y el badge queda en cero.
    server.use(http.get('*/api/chat/no-leidos', () => HttpResponse.json({ error: 'sin sesión' }, { status: 500 })));
    const tercero = montar();
    await screen.findByTestId('bell-mock', {}, { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 100));
    fireEvent.click(tercero.container.querySelector('.user-profile-trigger') as HTMLElement);
    await screen.findByText('Mis Pedidos');
    expect(tercero.container.querySelector('.nav-chat-badge')).toBeNull();
  });
});
