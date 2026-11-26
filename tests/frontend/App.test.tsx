import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../frontend/src/App';

/**
 * App: composición de la SPA.
 *
 * Se mockean contextos y piezas de layout para aislar la lógica propia de
 * App.tsx: guards de ruta (ProtectedRoute, AdminRoute, VendedorRoute),
 * visibilidad de la interfaz de tienda por ruta y montaje del carrito
 * flotante según rol y productos.
 */

const { auth, carrito } = vi.hoisted(() => ({
  auth: {
    usuarioLogueado: false,
    loadingAuth: false,
    esAdmin: false,
    esVendedor: false,
  },
  carrito: { totalProductos: 0 },
}));

vi.mock('../../frontend/src/context/AuthContext', () => ({
  useAuth: () => auth,
}));

vi.mock('../../frontend/src/context/CartContext', () => ({
  CartProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCart: () => carrito,
}));

vi.mock('../../frontend/src/context/ChatWidgetContext', () => ({
  ChatWidgetProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../frontend/src/context/AuthModalContext', () => ({
  AuthModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('../../frontend/src/components/Navbar', () => ({
  default: () => <nav data-testid="navbar" />,
}));
vi.mock('../../frontend/src/components/Footer', () => ({
  default: () => <footer data-testid="footer" />,
}));
vi.mock('../../frontend/src/components/AvisoCookies', () => ({
  default: () => <div data-testid="aviso-cookies" />,
}));
vi.mock('../../frontend/src/components/FlechaScroll', () => ({
  default: () => <div data-testid="flecha-scroll" />,
}));
vi.mock('../../frontend/src/components/FloatingCart', () => ({
  FloatingCart: () => <div data-testid="floating-cart" />,
}));
vi.mock('../../frontend/src/components/MiniCartMenu', () => ({
  MiniCartMenu: () => <div data-testid="mini-cart" />,
}));
vi.mock('../../frontend/src/components/FloatingChat', () => ({
  FloatingChat: () => <div data-testid="floating-chat" />,
}));
vi.mock('../../frontend/src/components/ChatWidget', () => ({
  ChatWidget: () => <div data-testid="chat-widget" />,
}));

// Páginas visitadas por las rutas de esta suite (se aíslan para no cargar
// los módulos reales ni disparar sus peticiones).
vi.mock('../../frontend/src/pages/Principal', () => ({
  default: () => <div data-testid="pagina-principal" />,
}));
vi.mock('../../frontend/src/pages/Catalogo', () => ({
  default: () => <div data-testid="pagina-catalogo" />,
}));
vi.mock('../../frontend/src/pages/Perfil', () => ({
  default: () => <div data-testid="pagina-perfil" />,
}));
vi.mock('../../frontend/src/pages/ResetPassword', () => ({
  default: () => <div data-testid="pagina-reset" />,
}));
vi.mock('../../frontend/src/pages/OAuthPopupCallback', () => ({
  default: () => <div data-testid="pagina-oauth" />,
}));
vi.mock('../../frontend/src/pages/ResumenCompra', () => ({
  default: () => <div data-testid="pagina-resumen" />,
}));
vi.mock('../../frontend/src/pages/CompraExitosa', () => ({
  default: () => <div data-testid="pagina-exitosa" />,
}));
vi.mock('../../frontend/src/pages/Chats', () => ({
  default: () => <div data-testid="pagina-chats" />,
}));
vi.mock('../../frontend/src/pages/NotFound', () => ({
  default: () => <div data-testid="pagina-404" />,
}));
vi.mock('../../frontend/src/admin/AdminDashboard', () => ({
  default: () => <div data-testid="pagina-admin" />,
}));
vi.mock('../../frontend/src/vendedor/VendedorDashboard', () => ({
  default: () => <div data-testid="pagina-vendedor" />,
}));

const renderizarEn = (ruta: string) => {
  window.history.pushState({}, '', ruta);
  return render(<App />);
};

beforeEach(() => {
  auth.usuarioLogueado = false;
  auth.loadingAuth = false;
  auth.esAdmin = false;
  auth.esVendedor = false;
  carrito.totalProductos = 0;
  window.history.pushState({}, '', '/');
});

describe('App — interfaz de tienda', () => {
  it('monta navbar, avisos, footer y chat en la portada sin productos', async () => {
    renderizarEn('/');

    expect(await screen.findByTestId('pagina-principal')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('aviso-cookies')).toBeInTheDocument();
    expect(screen.getByTestId('flecha-scroll')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByTestId('floating-chat')).toBeInTheDocument();
    expect(screen.getByTestId('chat-widget')).toBeInTheDocument();
    expect(screen.queryByTestId('floating-cart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mini-cart')).not.toBeInTheDocument();
  });

  it('muestra carrito flotante y mini carrito cuando hay productos', async () => {
    carrito.totalProductos = 2;
    renderizarEn('/catalogo');

    expect(await screen.findByTestId('pagina-catalogo')).toBeInTheDocument();
    expect(screen.getByTestId('floating-cart')).toBeInTheDocument();
    expect(screen.getByTestId('mini-cart')).toBeInTheDocument();
  });

  it('oculta el carrito flotante a los administradores aunque tengan productos', async () => {
    auth.esAdmin = true;
    carrito.totalProductos = 2;
    renderizarEn('/');

    expect(await screen.findByTestId('pagina-principal')).toBeInTheDocument();
    expect(screen.queryByTestId('floating-cart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mini-cart')).not.toBeInTheDocument();
  });

  it('oculta el carrito flotante en el perfil y conserva la tienda', async () => {
    auth.usuarioLogueado = true;
    carrito.totalProductos = 2;
    renderizarEn('/perfil');

    expect(await screen.findByTestId('pagina-perfil')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.queryByTestId('floating-cart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('mini-cart')).not.toBeInTheDocument();
    expect(screen.getByTestId('floating-chat')).toBeInTheDocument();
  });

  it('oculta el widget de chat en la página de chats pero mantiene navbar y footer', async () => {
    auth.usuarioLogueado = true;
    renderizarEn('/chats');

    expect(await screen.findByTestId('pagina-chats')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.queryByTestId('floating-chat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-widget')).not.toBeInTheDocument();
  });

  it('muestra 404 dentro del layout de tienda', async () => {
    renderizarEn('/ruta-que-no-existe');

    expect(await screen.findByTestId('pagina-404')).toBeInTheDocument();
    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });
});

describe('App — rutas sin interfaz de tienda', () => {
  it('oculta navbar, footer y chats en el panel admin', async () => {
    auth.esAdmin = true;
    renderizarEn('/admin');

    expect(await screen.findByTestId('pagina-admin')).toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('aviso-cookies')).not.toBeInTheDocument();
    expect(screen.queryByTestId('flecha-scroll')).not.toBeInTheDocument();
    // El chat sigue disponible para administradores.
    expect(screen.getByTestId('floating-chat')).toBeInTheDocument();
    expect(screen.getByTestId('chat-widget')).toBeInTheDocument();
  });

  it('oculta toda la interfaz y el chat en el resumen de compra', async () => {
    auth.usuarioLogueado = true;
    renderizarEn('/resumencompra');

    expect(await screen.findByTestId('pagina-resumen')).toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('floating-chat')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-widget')).not.toBeInTheDocument();
  });

  it('oculta la interfaz de tienda en la compra exitosa', async () => {
    auth.usuarioLogueado = true;
    renderizarEn('/compra-exitosa/99');

    expect(await screen.findByTestId('pagina-exitosa')).toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('floating-chat')).not.toBeInTheDocument();
  });

  it('oculta la interfaz en reset-password y en el callback OAuth', async () => {
    const { unmount } = renderizarEn('/reset-password/token-123');

    expect(await screen.findByTestId('pagina-reset')).toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('floating-chat')).not.toBeInTheDocument();
    unmount();

    renderizarEn('/oauth-popup-callback');
    expect(await screen.findByTestId('pagina-oauth')).toBeInTheDocument();
    expect(screen.queryByTestId('navbar')).not.toBeInTheDocument();
  });
});

describe('App — guards de acceso', () => {
  it('no renderiza la ruta protegida mientras carga la sesión', async () => {
    auth.loadingAuth = true;
    renderizarEn('/perfil');

    expect(screen.getByTestId('navbar')).toBeInTheDocument();
    expect(screen.queryByTestId('pagina-perfil')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pagina-principal')).not.toBeInTheDocument();
  });

  it('redirige al inicio cuando la ruta protegida no tiene sesión', async () => {
    renderizarEn('/perfil');

    expect(await screen.findByTestId('pagina-principal')).toBeInTheDocument();
    expect(screen.queryByTestId('pagina-perfil')).not.toBeInTheDocument();
  });

  it('permite la ruta protegida con sesión iniciada', async () => {
    auth.usuarioLogueado = true;
    renderizarEn('/perfil');

    expect(await screen.findByTestId('pagina-perfil')).toBeInTheDocument();
  });

  it('redirige al inicio a quien no es administrador', async () => {
    renderizarEn('/admin');

    expect(await screen.findByTestId('pagina-principal')).toBeInTheDocument();
    expect(screen.queryByTestId('pagina-admin')).not.toBeInTheDocument();
  });

  it('redirige al inicio a quien no es vendedor y permite al vendedor', async () => {
    const { unmount } = renderizarEn('/vendedor');
    expect(await screen.findByTestId('pagina-principal')).toBeInTheDocument();
    expect(screen.queryByTestId('pagina-vendedor')).not.toBeInTheDocument();
    unmount();

    auth.esVendedor = true;
    renderizarEn('/vendedor');
    expect(await screen.findByTestId('pagina-vendedor')).toBeInTheDocument();
  });
});
