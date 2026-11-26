import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../frontend/src/App';

/**
 * Segunda capa de App: recorre TODAS las rutas diferidas con páginas stub
 * para ejecutar cada fábrica de React.lazy (la suite base solo visita una
 * parte). Los guards ya se prueban en App.test.tsx.
 */

const { auth, carrito } = vi.hoisted(() => ({
  auth: {
    usuarioLogueado: true,
    loadingAuth: false,
    esAdmin: true,
    esVendedor: true,
  },
  carrito: { totalProductos: 0 },
}));

vi.mock('../../frontend/src/context/AuthContext', () => ({ useAuth: () => auth }));
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

vi.mock('../../frontend/src/components/Navbar', () => ({ default: () => <nav data-testid="navbar" /> }));
vi.mock('../../frontend/src/components/Footer', () => ({ default: () => <footer data-testid="footer" /> }));
vi.mock('../../frontend/src/components/AvisoCookies', () => ({ default: () => null }));
vi.mock('../../frontend/src/components/FlechaScroll', () => ({ default: () => null }));
vi.mock('../../frontend/src/components/FloatingCart', () => ({ FloatingCart: () => null }));
vi.mock('../../frontend/src/components/MiniCartMenu', () => ({ MiniCartMenu: () => null }));
vi.mock('../../frontend/src/components/FloatingChat', () => ({ FloatingChat: () => null }));
vi.mock('../../frontend/src/components/ChatWidget', () => ({ ChatWidget: () => null }));

vi.mock('../../frontend/src/pages/Principal', () => ({ default: () => <div data-testid="p-principal" /> }));
vi.mock('../../frontend/src/pages/ResetPassword', () => ({ default: () => <div data-testid="p-reset" /> }));
vi.mock('../../frontend/src/pages/Catalogo', () => ({ default: () => <div data-testid="p-catalogo" /> }));
vi.mock('../../frontend/src/pages/ProductDetailPage', () => ({ default: () => <div data-testid="p-producto" /> }));
vi.mock('../../frontend/src/pages/SobreNosotros', () => ({ default: () => <div data-testid="p-nosotros" /> }));
vi.mock('../../frontend/src/pages/PerfilEditar', () => ({ default: () => <div data-testid="p-perfil-editar" /> }));
vi.mock('../../frontend/src/pages/Perfil', () => ({ default: () => <div data-testid="p-perfil" /> }));
vi.mock('../../frontend/src/pages/ResumenCompra', () => ({ default: () => <div data-testid="p-resumen" /> }));
vi.mock('../../frontend/src/pages/Seguridad', () => ({ default: () => <div data-testid="p-seguridad" /> }));
vi.mock('../../frontend/src/pages/DireccionesPerfil', () => ({ default: () => <div data-testid="p-direcciones" /> }));
vi.mock('../../frontend/src/pages/Favoritos', () => ({ default: () => <div data-testid="p-favoritos" /> }));
vi.mock('../../frontend/src/pages/MisCompras', () => ({ default: () => <div data-testid="p-mis-compras" /> }));
vi.mock('../../frontend/src/pages/ReembolsoDetalle', () => ({ default: () => <div data-testid="p-reembolso" /> }));
vi.mock('../../frontend/src/pages/DevolverPedido', () => ({ default: () => <div data-testid="p-devolver" /> }));
vi.mock('../../frontend/src/pages/DevolucionEstado', () => ({ default: () => <div data-testid="p-devolucion-estado" /> }));
vi.mock('../../frontend/src/pages/DetalleCompra', () => ({ default: () => <div data-testid="p-detalle-compra" /> }));
vi.mock('../../frontend/src/pages/Chats', () => ({ default: () => <div data-testid="p-chats" /> }));
vi.mock('../../frontend/src/pages/PerfilMetodosPago', () => ({ default: () => <div data-testid="p-metodos-pago" /> }));
vi.mock('../../frontend/src/pages/Privacidad', () => ({ default: () => <div data-testid="p-privacidad" /> }));
vi.mock('../../frontend/src/pages/CompraExitosa', () => ({ default: () => <div data-testid="p-compra-exitosa" /> }));
vi.mock('../../frontend/src/pages/Historial', () => ({ default: () => <div data-testid="p-historial" /> }));
vi.mock('../../frontend/src/pages/AyudaSoporte', () => ({ default: () => <div data-testid="p-ayuda" /> }));
vi.mock('../../frontend/src/pages/Pqr', () => ({ default: () => <div data-testid="p-pqr" /> }));
vi.mock('../../frontend/src/pages/Retos', () => ({ default: () => <div data-testid="p-retos" /> }));
vi.mock('../../frontend/src/pages/MisRetos', () => ({ default: () => <div data-testid="p-mis-retos" /> }));
vi.mock('../../frontend/src/pages/Planes', () => ({ default: () => <div data-testid="p-planes" /> }));
vi.mock('../../frontend/src/pages/PreguntasFrecuentes', () => ({ default: () => <div data-testid="p-faq" /> }));
vi.mock('../../frontend/src/pages/Contacto', () => ({ default: () => <div data-testid="p-contacto" /> }));
vi.mock('../../frontend/src/pages/PoliticasDevolucion', () => ({ default: () => <div data-testid="p-politicas" /> }));
vi.mock('../../frontend/src/pages/TerminosCondiciones', () => ({ default: () => <div data-testid="p-terminos" /> }));
vi.mock('../../frontend/src/pages/PoliticaPrivacidad', () => ({ default: () => <div data-testid="p-politica-privacidad" /> }));
vi.mock('../../frontend/src/pages/OAuthPopupCallback', () => ({ default: () => <div data-testid="p-oauth" /> }));
vi.mock('../../frontend/src/pages/SerVendedor', () => ({ default: () => <div data-testid="p-ser-vendedor" /> }));
vi.mock('../../frontend/src/pages/NotFound', () => ({ default: () => <div data-testid="p-404" /> }));

vi.mock('../../frontend/src/admin/AdminDashboard', () => ({ default: () => <div data-testid="a-dashboard" /> }));
vi.mock('../../frontend/src/admin/AdminProductos', () => ({ default: () => <div data-testid="a-productos" /> }));
vi.mock('../../frontend/src/admin/AdminOrdenes', () => ({ default: () => <div data-testid="a-ordenes" /> }));
vi.mock('../../frontend/src/admin/AdminUsuarios', () => ({ default: () => <div data-testid="a-usuarios" /> }));
vi.mock('../../frontend/src/admin/DetalleUsuarioAdmin', () => ({ default: () => <div data-testid="a-usuario" /> }));
vi.mock('../../frontend/src/admin/AdminProductoCaracteristicas', () => ({ default: () => <div data-testid="a-caracteristicas" /> }));
vi.mock('../../frontend/src/admin/AdminRetos', () => ({ default: () => <div data-testid="a-retos" /> }));
vi.mock('../../frontend/src/admin/DetalleEvidenciaAdmin', () => ({ default: () => <div data-testid="a-evidencia" /> }));
vi.mock('../../frontend/src/admin/AdminReportes', () => ({ default: () => <div data-testid="a-reportes" /> }));
vi.mock('../../frontend/src/admin/AdminDevoluciones', () => ({ default: () => <div data-testid="a-devoluciones" /> }));
vi.mock('../../frontend/src/admin/AdminVendedores', () => ({ default: () => <div data-testid="a-vendedores" /> }));
vi.mock('../../frontend/src/admin/DetalleVendedorAdmin', () => ({ default: () => <div data-testid="a-vendedor" /> }));
vi.mock('../../frontend/src/admin/AdminCategorias', () => ({ default: () => <div data-testid="a-categorias" /> }));
vi.mock('../../frontend/src/admin/AdminConfiguracion', () => ({ default: () => <div data-testid="a-configuracion" /> }));
vi.mock('../../frontend/src/admin/EditarProductoAdmin', () => ({ default: () => <div data-testid="a-editar" /> }));

vi.mock('../../frontend/src/vendedor/VendedorDashboard', () => ({ default: () => <div data-testid="v-dashboard" /> }));
vi.mock('../../frontend/src/vendedor/VendedorProductos', () => ({ default: () => <div data-testid="v-productos" /> }));
vi.mock('../../frontend/src/vendedor/VendedorProductoForm', () => ({ default: () => <div data-testid="v-form" /> }));
vi.mock('../../frontend/src/vendedor/VendedorVentas', () => ({ default: () => <div data-testid="v-ventas" /> }));
vi.mock('../../frontend/src/vendedor/VendedorDevoluciones', () => ({ default: () => <div data-testid="v-devoluciones" /> }));
vi.mock('../../frontend/src/vendedor/VendedorReportes', () => ({ default: () => <div data-testid="v-reportes" /> }));

const renderizarEn = (ruta: string) => {
  window.history.pushState({}, '', ruta);
  return render(<App />);
};

const recorrer = async (casos: Array<[string, string]>) => {
  for (const [ruta, testid] of casos) {
    const { unmount } = renderizarEn(ruta);
    expect(await screen.findByTestId(testid, {}, { timeout: 5000 })).toBeInTheDocument();
    unmount();
  }
};

beforeEach(() => {
  carrito.totalProductos = 0;
  window.history.pushState({}, '', '/');
});

describe('App.extra — fábricas diferidas de la tienda', () => {
  it('carga todas las páginas públicas y de perfil', async () => {
    await recorrer([
      ['/', 'p-principal'],
      ['/catalogo', 'p-catalogo'],
      ['/producto/1', 'p-producto'],
      ['/reset-password/token-123', 'p-reset'],
      ['/sobre-nosotros', 'p-nosotros'],
      ['/perfil', 'p-perfil'],
      ['/perfil/seguridad', 'p-seguridad'],
      ['/perfil/direcciones', 'p-direcciones'],
      ['/perfil/compras', 'p-mis-compras'],
      ['/perfil/reembolso/1', 'p-reembolso'],
      ['/perfil/devolver/1', 'p-devolver'],
      ['/perfil/devolucion/1', 'p-devolucion-estado'],
      ['/perfil/compra/1', 'p-detalle-compra'],
      ['/perfil/metodos-pago', 'p-metodos-pago'],
      ['/favoritos', 'p-favoritos'],
      ['/PerfilEditar', 'p-perfil-editar'],
      ['/perfil/privacidad', 'p-privacidad'],
      ['/resumencompra', 'p-resumen'],
      ['/compra-exitosa/1', 'p-compra-exitosa'],
      ['/ayuda_soporte', 'p-ayuda'],
      ['/historial', 'p-historial'],
      ['/pqr', 'p-pqr'],
      ['/preguntas-frecuentes', 'p-faq'],
      ['/contacto', 'p-contacto'],
      ['/politicas-devolucion', 'p-politicas'],
      ['/terminos-condiciones', 'p-terminos'],
      ['/politica-privacidad', 'p-politica-privacidad'],
      ['/oauth-popup-callback', 'p-oauth'],
      ['/retos', 'p-retos'],
      ['/mis-retos', 'p-mis-retos'],
      ['/mis-planes', 'p-planes'],
      ['/ser-vendedor', 'p-ser-vendedor'],
      ['/chats', 'p-chats'],
      ['/ruta-inexistente', 'p-404'],
    ]);
  }, 60000);
});

describe('App.extra — fábricas diferidas del admin', () => {
  it('carga todas las pantallas administrativas', async () => {
    await recorrer([
      ['/admin', 'a-dashboard'],
      ['/admin/productos', 'a-productos'],
      ['/admin/ordenes', 'a-ordenes'],
      ['/admin/usuarios', 'a-usuarios'],
      ['/admin/usuarios/7', 'a-usuario'],
      ['/admin/caracteristicas/7', 'a-caracteristicas'],
      ['/admin/retos', 'a-retos'],
      ['/admin/retos/7', 'a-evidencia'],
      ['/admin/reportes', 'a-reportes'],
      ['/admin/devoluciones', 'a-devoluciones'],
      ['/admin/vendedores', 'a-vendedores'],
      ['/admin/vendedores/7', 'a-vendedor'],
      ['/admin/categorias', 'a-categorias'],
      ['/admin/configuracion', 'a-configuracion'],
      ['/admin/editar/7', 'a-editar'],
      ['/admin/chats', 'p-chats'],
    ]);
  }, 60000);
});

describe('App.extra — fábricas diferidas del vendedor', () => {
  it('carga todas las pantallas del vendedor', async () => {
    await recorrer([
      ['/vendedor', 'v-dashboard'],
      ['/vendedor/productos', 'v-productos'],
      ['/vendedor/productos/nuevo', 'v-form'],
      ['/vendedor/productos/editar/1', 'v-form'],
      ['/vendedor/ventas', 'v-ventas'],
      ['/vendedor/devoluciones', 'v-devoluciones'],
      ['/vendedor/reportes', 'v-reportes'],
      ['/vendedor/configuracion', 'a-configuracion'],
      ['/vendedor/chats', 'p-chats'],
    ]);
  }, 60000);
});
