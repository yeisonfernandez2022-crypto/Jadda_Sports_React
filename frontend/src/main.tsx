import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css'; 
import './css/principal.css'; 
import axios from 'axios';
import './css/navbar.css'; 

// 1. IMPORTAR LOS PROVIDERS GLOBALES
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext'; 

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Envolvemos la app con la sesión primero, y luego el carrito */}
    <AuthProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </AuthProvider>
  </React.StrictMode>,
);

axios.defaults.withCredentials = true;