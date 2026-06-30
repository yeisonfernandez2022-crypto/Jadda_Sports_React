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

const Principal = lazy(() => import("./pages/Principal"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Catalogo = lazy(() => import("./pages/Catalogo"));
const AdminDashboard = lazy(() => import("./admin/AdminDashboard"));
const AdminProductos = lazy(() => import("./admin/AdminProductos"));
const AdminOrdenes = lazy(() => import("./admin/AdminOrdenes"));
const AdminUsuarios = lazy(() => import("./admin/AdminUsuarios"));
const AdminProductoCaracteristicas = lazy(() => import("./admin/AdminProductoCaracteristicas"));
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
const CompraExitosa = lazy(() => import("./pages/CompraExitosa"));
const Historial = lazy(() => import("./pages/Historial"));
const AyudaSoporte = lazy(() => import("./pages/AyudaSoporte"));
const Pqr = lazy(() => import("./pages/Pqr"));
const Retos = lazy(() => import("./pages/Retos"));
const Planes = lazy(() => import("./pages/Planes"));
const PreguntasFrecuentes = lazy(() => import("./pages/PreguntasFrecuentes"));
const PoliticasDevolucion = lazy(() => import("./pages/PoliticasDevolucion"));
const TerminosCondiciones = lazy(() => import("./pages/TerminosCondiciones"));
const PoliticaPrivacidad = lazy(() => import("./pages/PoliticaPrivacidad"));
const OAuthPopupCallback = lazy(() => import("./pages/OAuthPopupCallback"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { usuarioLogueado, loadingAuth } = useAuth();
  if (loadingAuth) return null;
  if (!usuarioLogueado) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Este componente gestiona la lógica de qué mostrar según la ruta
function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { totalProductos } = useCart();
  
  // 1. Lista de rutas fijas de autenticación
  const rutasSinInterfaz = [
    "/reset-password",
    "/oauth-popup-callback"
  ];
  
  const esPaginaAuth = rutasSinInterfaz.includes(location.pathname);

  // Detecta de forma dinámica si la ruta actual es del panel de administración
  const esPaginaAdmin = location.pathname.startsWith("/admin");
  
  const esPaginaResumen = location.pathname === "/resumencompra";
  const esPaginaExitosa = location.pathname.startsWith("/compra-exitosa");
  const esPaginaPerfil = location.pathname.startsWith("/perfil") || location.pathname === "/PerfilEditar";
  // Si es página de Auth O es de Admin, ocultamos el menú global y el carrito de la tienda
  const ocultarElementosTienda = esPaginaAuth || esPaginaAdmin || esPaginaResumen || esPaginaExitosa;

  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Navbar solo se muestra si NO es auth ni admin */}
      {!ocultarElementosTienda && <Navbar />}
      
      <div className="flex-grow-1 d-flex flex-column">
        {children}
      </div>
      
      {/* Footer global */}
{!ocultarElementosTienda && <Footer />}

      {/* Elementos flotantes del carrito solo se muestran en rutas principales con productos */}
      {!ocultarElementosTienda && !esPaginaPerfil && totalProductos > 0 && (
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
      {/* CartProvider envuelve toda la aplicación para persistir el estado */}
      <ScrollToTop />
      <CartProvider>
        
        <AuthModalProvider>
        <AppLayout>
          <Suspense fallback={
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
              <div className="spinner-border text-danger" role="status" />
            </div>
          }>
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
            <Route path="/favoritos" element={<ProtectedRoute><Favoritos /></ProtectedRoute>} />
            <Route path="/PerfilEditar" element={<ProtectedRoute><PerfilEditar /></ProtectedRoute>} />
            <Route path="/resumencompra" element={<ProtectedRoute><ResumenCompra /></ProtectedRoute>} />
            <Route path="/compra-exitosa/:id" element={<ProtectedRoute><CompraExitosa /></ProtectedRoute>} />
            <Route path="/ayuda_soporte" element={<AyudaSoporte />} />
            <Route path="/historial" element={<ProtectedRoute><Historial /></ProtectedRoute>} />
            <Route path="/pqr" element={<Pqr />} />
            <Route path="/preguntas-frecuentes" element={<PreguntasFrecuentes />} />
            <Route path="/politicas-devolucion" element={<PoliticasDevolucion />} />
            <Route path="/terminos-condiciones" element={<TerminosCondiciones />} />
            <Route path="/politica-privacidad" element={<PoliticaPrivacidad />} />
            <Route path="/oauth-popup-callback" element={<OAuthPopupCallback />} />
            <Route path="/retos" element={<ProtectedRoute><Retos /></ProtectedRoute>} />
            <Route path="/mis-planes" element={<ProtectedRoute><Planes /></ProtectedRoute>} />

            {/* Rutas Admin */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/productos" element={<AdminProductos />} />
            <Route path="/admin/ordenes" element={<AdminOrdenes />} />
            <Route path="/admin/usuarios" element={<AdminUsuarios />} />
            <Route path="/admin/caracteristicas/:idProducto" element={<AdminProductoCaracteristicas />} />
            <Route path="/admin/editar/:id" element={<EditarProductoAdmin />} />
            
            {/* Ruta comodín */}
            <Route path="*" element={<Principal />} />
          </Routes>
          </Suspense>
        </AppLayout>
        </AuthModalProvider>

      </CartProvider>
    </BrowserRouter>
  );
}

export default App;