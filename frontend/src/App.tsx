import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { CartProvider } from './context/CartContext';
import { useAuth } from "./context/AuthContext";
import { AuthModalProvider } from "./context/AuthModalContext";
import ScrollToTop from "./components/ScrollToTop";
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import { FloatingCart } from './components/FloatingCart';
import { MiniCartMenu } from './components/MiniCartMenu';
import { useCart } from './context/CartContext';
import ErrorBoundary from "./components/ErrorBoundary";
import LoadingPage from "./components/LoadingPage";

const Principal = lazy(() => import("./pages/Principal"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Catalogo = lazy(() => import("./pages/Catalogo"));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard"));
const AdminProductos = lazy(() => import("./admin/AdminProductos"));
const AdminOrdenes = lazy(() => import("./admin/AdminOrdenes"));
const AdminUsuarios = lazy(() => import("./admin/AdminUsuarios"));
const AdminProductoCaracteristicas = lazy(() => import("./admin/AdminProductoCaracteristicas"));
const AdminRetos = lazy(() => import("./admin/AdminRetos"));
const AdminReportes = lazy(() => import("./admin/AdminReportes"));
const AdminDevoluciones = lazy(() => import("./admin/AdminDevoluciones"));
const AdminVendedores = lazy(() => import("./admin/AdminVendedores"));
const AdminCategorias = lazy(() => import("./admin/AdminCategorias"));
const AdminConfiguracion = lazy(() => import("./admin/AdminConfiguracion"));
const VendedorDashboard = lazy(() => import("./vendedor/VendedorDashboard"));
const VendedorProductos = lazy(() => import("./vendedor/VendedorProductos"));
const VendedorProductoForm = lazy(() => import("./vendedor/VendedorProductoForm"));
const VendedorVentas = lazy(() => import("./vendedor/VendedorVentas"));
const VendedorEmpresa = lazy(() => import("./vendedor/VendedorEmpresa"));
const VendedorDevoluciones = lazy(() => import("./vendedor/VendedorDevoluciones"));
const VendedorReportes = lazy(() => import("./vendedor/VendedorReportes"));
const Chats = lazy(() => import("./pages/Chats"));
const ProductDetailPage = lazy(() => import("./pages/ProductDetailPage"));
const SobreNosotros = lazy(() => import("./pages/SobreNosotros"));
const EditarProductoAdmin = lazy(() => import("./admin/EditarProductoAdmin"));
const PerfilEditar = lazy(() => import("./pages/PerfilEditar"));
const Perfil = lazy(() => import("./pages/Perfil"));
const ResumenCompra = lazy(() => import("./pages/ResumenCompra"));
const Seguridad = lazy(() => import("./pages/Seguridad"));
const DireccionesPerfil = lazy(() => import("./pages/DireccionesPerfil"));
const Favoritos = lazy(() => import("./pages/Favoritos"));
const MisCompras = lazy(() => import("./pages/MisCompras"));
const ReembolsoDetalle = lazy(() => import("./pages/ReembolsoDetalle"));
const DevolverPedido = lazy(() => import("./pages/DevolverPedido"));
const DevolucionEstado = lazy(() => import("./pages/DevolucionEstado"));
const DetalleCompra = lazy(() => import("./pages/DetalleCompra"));
const PerfilMetodosPago = lazy(() => import("./pages/PerfilMetodosPago"));
const CompraExitosa = lazy(() => import("./pages/CompraExitosa"));
const Historial = lazy(() => import("./pages/Historial"));
const AyudaSoporte = lazy(() => import("./pages/AyudaSoporte"));
const Pqr = lazy(() => import("./pages/Pqr"));
const Retos = lazy(() => import("./pages/Retos"));
const MisRetos = lazy(() => import("./pages/MisRetos"));
const Planes = lazy(() => import("./pages/Planes"));
const PreguntasFrecuentes = lazy(() => import("./pages/PreguntasFrecuentes"));
const Contacto = lazy(() => import("./pages/Contacto"));
const PoliticasDevolucion = lazy(() => import("./pages/PoliticasDevolucion"));
const TerminosCondiciones = lazy(() => import("./pages/TerminosCondiciones"));
const PoliticaPrivacidad = lazy(() => import("./pages/PoliticaPrivacidad"));
const OAuthPopupCallback = lazy(() => import("./pages/OAuthPopupCallback"));
const SerVendedor = lazy(() => import("./pages/SerVendedor"));
const NotFound = lazy(() => import("./pages/NotFound"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { usuarioLogueado, loadingAuth } = useAuth();
  if (loadingAuth) return null;
  if (!usuarioLogueado) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Solo el usuario con rol administrador (ID_ROL = 1) puede entrar al panel
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { esAdmin } = useAuth();
  if (!esAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Solo el usuario con rol vendedor (ID_ROL = 6) puede entrar al panel de vendedor
function VendedorRoute({ children }: { children: React.ReactNode }) {
  const { esVendedor } = useAuth();
  if (!esVendedor) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Este componente gestiona la lÃ³gica de quÃ© mostrar segÃºn la ruta
function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { totalProductos } = useCart();
  const { esAdmin } = useAuth();
  
  // 1. Lista de rutas fijas de autenticaciÃ³n
  const rutasSinInterfaz = [
    "/reset-password",
    "/oauth-popup-callback"
  ];
  
  const esPaginaAuth = rutasSinInterfaz.includes(location.pathname);

  // Detecta de forma dinÃ¡mica si la ruta actual es del panel de administraciÃ³n
  const esPaginaAdmin = location.pathname.startsWith("/admin");
  const esPaginaVendedor = location.pathname.startsWith("/vendedor");
  
  const esPaginaResumen = location.pathname === "/resumencompra";
  const esPaginaExitosa = location.pathname.startsWith("/compra-exitosa");
  const esPaginaPerfil = location.pathname.startsWith("/perfil") || location.pathname === "/PerfilEditar";
  // Si es pÃ¡gina de Auth O es de Admin, ocultamos el menÃº global y el carrito de la tienda
  const ocultarElementosTienda = esPaginaAuth || esPaginaAdmin || esPaginaVendedor || esPaginaResumen || esPaginaExitosa;

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Navbar solo se muestra si NO es auth ni admin */}
      {!ocultarElementosTienda && <Navbar />}
      
      <div className="flex-grow-1 d-flex flex-column">
        {children}
      </div>
      
      {/* Footer global */}
{!ocultarElementosTienda && <Footer />}

      {/* Elementos flotantes del carrito solo se muestran en rutas principales con productos y para usuarios que compran */}
      {!ocultarElementosTienda && !esPaginaPerfil && totalProductos > 0 && !esAdmin && (
        <>
          <FloatingCart />
          <MiniCartMenu />
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      {/* CartProvider envuelve toda la aplicaciÃ³n para persistir el estado */}
      <ScrollToTop />
      <CartProvider>
        
        <AuthModalProvider>
        <AppLayout>
          <ErrorBoundary>
          <Suspense fallback={<LoadingPage />}>
          <Routes>
            <Route path="/" element={<Principal />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/producto/:id" element={<ProductDetailPage />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/sobre-nosotros" element={<SobreNosotros />} />
            <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
            <Route path="/perfil/seguridad" element={<ProtectedRoute><Seguridad /></ProtectedRoute>} />
            <Route path="/perfil/direcciones" element={<ProtectedRoute><DireccionesPerfil /></ProtectedRoute>} />
            <Route path="/perfil/compras" element={<ProtectedRoute><MisCompras /></ProtectedRoute>} />
            <Route path="/perfil/reembolso/:id" element={<ProtectedRoute><ReembolsoDetalle /></ProtectedRoute>} />
            <Route path="/perfil/devolver/:idVenta" element={<ProtectedRoute><DevolverPedido /></ProtectedRoute>} />
            <Route path="/perfil/devolucion/:idVenta" element={<ProtectedRoute><DevolucionEstado /></ProtectedRoute>} />
            <Route path="/perfil/compra/:id" element={<ProtectedRoute><DetalleCompra /></ProtectedRoute>} />
            <Route path="/perfil/metodos-pago" element={<ProtectedRoute><PerfilMetodosPago /></ProtectedRoute>} />
            <Route path="/favoritos" element={<ProtectedRoute><Favoritos /></ProtectedRoute>} />
            <Route path="/PerfilEditar" element={<ProtectedRoute><PerfilEditar /></ProtectedRoute>} />
            <Route path="/resumencompra" element={<ProtectedRoute><ResumenCompra /></ProtectedRoute>} />
            <Route path="/compra-exitosa/:id" element={<ProtectedRoute><CompraExitosa /></ProtectedRoute>} />
            <Route path="/ayuda_soporte" element={<AyudaSoporte />} />
            <Route path="/historial" element={<ProtectedRoute><Historial /></ProtectedRoute>} />
            <Route path="/pqr" element={<Pqr />} />
            <Route path="/preguntas-frecuentes" element={<PreguntasFrecuentes />} />
            <Route path="/contacto" element={<Contacto />} />
            <Route path="/politicas-devolucion" element={<PoliticasDevolucion />} />
            <Route path="/terminos-condiciones" element={<TerminosCondiciones />} />
            <Route path="/politica-privacidad" element={<PoliticaPrivacidad />} />
            <Route path="/oauth-popup-callback" element={<OAuthPopupCallback />} />
            <Route path="/retos" element={<ProtectedRoute><Retos /></ProtectedRoute>} />
<Route path="/mis-retos" element={<ProtectedRoute><MisRetos /></ProtectedRoute>} />
            <Route path="/mis-planes" element={<ProtectedRoute><Planes /></ProtectedRoute>} />
            <Route path="/ser-vendedor" element={<SerVendedor />} />

            {/* Rutas Admin â€” solo para administradores */}
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/productos" element={<AdminRoute><AdminProductos /></AdminRoute>} />
            <Route path="/admin/ordenes" element={<AdminRoute><AdminOrdenes /></AdminRoute>} />
            <Route path="/admin/usuarios" element={<AdminRoute><AdminUsuarios /></AdminRoute>} />
            <Route path="/admin/retos" element={<AdminRoute><AdminRetos /></AdminRoute>} />
            <Route path="/admin/devoluciones" element={<AdminRoute><AdminDevoluciones /></AdminRoute>} />
            <Route path="/admin/vendedores" element={<AdminRoute><AdminVendedores /></AdminRoute>} />
            <Route path="/admin/categorias" element={<AdminRoute><AdminCategorias /></AdminRoute>} />
            <Route path="/admin/reportes" element={<AdminRoute><AdminReportes /></AdminRoute>} />
            <Route path="/admin/configuracion" element={<AdminRoute><AdminConfiguracion /></AdminRoute>} />
            <Route path="/admin/caracteristicas/:idProducto" element={<AdminRoute><AdminProductoCaracteristicas /></AdminRoute>} />
            <Route path="/admin/editar/:id" element={<AdminRoute><EditarProductoAdmin /></AdminRoute>} />

            {/* Rutas Vendedor â€” solo para vendedores (rol 6) */}
            <Route path="/vendedor" element={<VendedorRoute><VendedorDashboard /></VendedorRoute>} />
            <Route path="/vendedor/productos" element={<VendedorRoute><VendedorProductos /></VendedorRoute>} />
            <Route path="/vendedor/productos/nuevo" element={<VendedorRoute><VendedorProductoForm /></VendedorRoute>} />
            <Route path="/vendedor/productos/editar/:id" element={<VendedorRoute><VendedorProductoForm /></VendedorRoute>} />
            <Route path="/vendedor/ventas" element={<VendedorRoute><VendedorVentas /></VendedorRoute>} />
            <Route path="/vendedor/empresa" element={<VendedorRoute><VendedorEmpresa /></VendedorRoute>} />
                                    <Route path="/vendedor/reportes" element={<VendedorRoute><VendedorReportes /></VendedorRoute>} />
            <Route path="/vendedor/devoluciones" element={<VendedorRoute><VendedorDevoluciones /></VendedorRoute>} />
            <Route path="/vendedor/chats" element={<VendedorRoute><Chats /></VendedorRoute>} />
            <Route path="/admin/chats" element={<AdminRoute><Chats /></AdminRoute>} />
            <Route path="/chats" element={<ProtectedRoute><Chats /></ProtectedRoute>} />
            <Route path="/vendedor/configuracion" element={<VendedorRoute><AdminConfiguracion /></VendedorRoute>} />

            {/* Ruta comodÃ­n - PÃ¡gina 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
        </AppLayout>
        </AuthModalProvider>

      </CartProvider>
    </BrowserRouter>
  );
}

export default App;

