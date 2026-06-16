import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import Principal from "./pages/Principal"; 
import Login from "./pages/Login";
import Register from "./pages/Register";
import Recuperar from "./pages/Recuperar";
import ResetPassword from "./pages/ResetPassword";
import Catalogo from "./pages/Catalogo";
import Categorias from "./pages/Categorias";
import VerificarCodigo from "./pages/VerificarCodigo";
import AdminDashboard from "./admin/AdminDashboard";
import AdminProductoCaracteristicas from "./admin/AdminProductoCaracteristicas";
import ProductDetailPage from "./pages/ProductDetailPage"; 
import SobreNosotros from "./pages/SobreNosotros"; 
import EditarProductoAdmin from "./admin/EditarProductoAdmin";
import PerfilEditar from "./pages/PerfilEditar";
import { FloatingCart } from './components/FloatingCart';
import { MiniCartMenu } from './components/MiniCartMenu';
import { CartProvider } from './context/CartContext';
import Perfil from "./pages/Perfil";
import Navbar from './components/Navbar';

// Este componente gestiona la lógica de qué mostrar según la ruta
function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  
  // 1. Lista de rutas fijas de autenticación
  const rutasSinInterfaz = [
    "/login", 
    "/registro", 
    "/recuperar", 
    "/verificar-codigo", 
    "/reset-password"
  ];
  
  const esPaginaAuth = rutasSinInterfaz.includes(location.pathname);

  // 2. NUEVA REGLA: Detecta de forma dinámica si la ruta actual es del panel de administración
  const esPaginaAdmin = location.pathname.startsWith("/admin");

  // Si es página de Auth O es de Admin, ocultamos el menú global y el carrito de la tienda
  const ocultarElementosTienda = esPaginaAuth || esPaginaAdmin;

  return (
    <>
      {/* Navbar solo se muestra si NO es auth ni admin */}
      {!ocultarElementosTienda && <Navbar />}
      
      {/* Contenido de la página actual */}
      {children}
      
      {/* Elementos flotantes del carrito solo se muestran en rutas principales de la tienda */}
      {!ocultarElementosTienda && (
        <>
          <FloatingCart />
          <MiniCartMenu />
        </>
      )}
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      {/* CartProvider envuelve toda la aplicación para persistir el estado */}
      <CartProvider>
        
        <AppLayout>
          <Routes>
            <Route path="/" element={<Principal />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/producto/:id" element={<ProductDetailPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/registro" element={<Register />} />
            <Route path="/recuperar" element={<Recuperar />} />
            <Route path="/verificar-codigo" element={<VerificarCodigo />} />
            <Route path="/sobre-nosotros" element={<SobreNosotros />} />
            <Route path="/perfil" element={<Perfil />} />
            <Route path="/PerfilEditar" element={<PerfilEditar />} />
            <Route path="/categorias" element={<Categorias />} />
            {/* Rutas Admin (Ahora se limpian automáticamente de la interfaz del cliente) */}
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/caracteristicas/:idProducto" element={<AdminProductoCaracteristicas />} />
            <Route path="/admin/editar/:id" element={<EditarProductoAdmin />} />
            
            {/* Ruta comodín para redirigir al inicio */}
            <Route path="*" element={<Principal />} />
          </Routes>
        </AppLayout>

      </CartProvider>
    </BrowserRouter>
  );
}

export default App;