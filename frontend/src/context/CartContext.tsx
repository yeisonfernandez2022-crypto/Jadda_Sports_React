import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext"; 
import Swal from 'sweetalert2';

export interface CartItem {
  ID_CARRITO: number;
  CANTIDAD: number;
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  IMAGEN: string;
  MARCA?: string;
  STOCK: number;
}

interface CartContextType {
  cart: CartItem[];
  loadingCart: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  fetchCart: () => void;
  addToCart: (idProducto: number, cantidad?: number) => Promise<boolean>;
  updateQuantity: (idCarrito: number, nuevaCantidad: number) => Promise<void>;
  removeFromCart: (idCarrito: number) => Promise<void>;
  decreaseQuantity: ( idCarrito: number,cantidadActual: number) => Promise<void>;
  totalProductos: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingCart, setLoadingCart] = useState(false);
  const [isOpen, setIsOpen] = useState(false); // Controla si el sidebar está abierto
  const { usuarioLogueado } = useAuth(); // Valida si hay sesión activa
  const totalProductos = cart.reduce((total, item) => total + item.CANTIDAD, 0);

  const fetchCart = async () => {
    if (!usuarioLogueado) return;
    setLoadingCart(true);
    try {
      const res = await axios.get("http://localhost:5000/api/carrito", { withCredentials: true });
      setCart(res.data); // Tu backend envía el array directo
    } catch (err) {
      console.error("Error al obtener el carrito:", err);
    } finally {
      setLoadingCart(false);
    }
};

  useEffect(() => {
    if (usuarioLogueado) fetchCart();
    else setCart([]);
  }, [usuarioLogueado]);

  const addToCart = async (
  idProducto: number,
  cantidad = 1
): Promise<boolean> => {
  if (!usuarioLogueado) { 
    // 👇 Alerta premium en lugar del alert() nativo
    Swal.fire({
      title: '¡Inicia Sesión!',
      text: 'Para añadir productos al carrito y gestionar tus compras, necesitas ingresar a tu cuenta.',
      icon: 'info',
      background: '#1a1a1a', // Fondo oscuro a juego con JADDA
      color: '#ffffff',
      confirmButtonColor: '#e63946', // Rojo deportivo de tu marca
      confirmButtonText: 'Entendido',
      customClass: {
        popup: 'border-red-jadda' // Por si quieres meterle estilos CSS luego
      }
    });
    return false;
  }
  
  try {
    const res = await axios.post(
      "http://localhost:5000/api/carrito/agregar",
      { id_producto: idProducto, cantidad },
      { withCredentials: true }
    );
    if (res.data.ok) {
  fetchCart();
  setIsOpen(true);

  return true;
}

return false;
  } catch (err) {
  console.error("Error al agregar al carrito", err);
  return false;
}
};

  const updateQuantity = async (idCarrito: number, nuevaCantidad: number) => {
    if (nuevaCantidad < 1) return;
    // Opcional: Aquí puedes meter lógica de actualización por API, o actualizar localmente y sincronizar
    setCart(prev => prev.map(item => item.ID_CARRITO === idCarrito ? { ...item, CANTIDAD: nuevaCantidad } : item));
  };

  const removeFromCart = async (idCarrito: number) => {
    try {
      const res = await axios.delete(`http://localhost:5000/api/carrito/eliminar/${idCarrito}`, { withCredentials: true });
      if (res.data.ok) fetchCart();
    } catch (err) {
      console.error("Error al eliminar del carrito", err);
    }
  };

  const decreaseQuantity = async (
  idCarrito: number,
  cantidadActual: number
) => {

  // Si solo queda 1, elimina el producto
  if (cantidadActual <= 1) {
    await removeFromCart(idCarrito);
    return;
  }

  // Si hay más de 1, resta 1
  setCart((prev) =>
    prev.map((item) =>
      item.ID_CARRITO === idCarrito
        ? {
            ...item,
            CANTIDAD: item.CANTIDAD - 1,
          }
        : item
    )
  );
};


  return (
    <CartContext.Provider value={{ cart, loadingCart, isOpen, setIsOpen, fetchCart, addToCart, updateQuantity, removeFromCart, totalProductos, decreaseQuantity }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de un CartProvider");
  return context;
};