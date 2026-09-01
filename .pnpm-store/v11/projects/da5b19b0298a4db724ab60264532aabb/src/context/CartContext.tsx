import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import axios from "axios";
import { useAuth } from "./AuthContext";
import Swal from "sweetalert2";

export interface CartItem {
  ID_CARRITO: number;
  CANTIDAD: number;
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  IMAGEN: string;
  MARCA?: string;
  STOCK: number;
  COLOR?: string;     
  ATRIBUTO?: string;
  ID_DESCUENTO?: number | null;
}

interface CartContextType {
  cart: CartItem[];
  loadingCart: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  fetchCart: () => void;
  addToCart: (idProducto: number, idVariante: number, cantidad?: number) => Promise<boolean>;
  updateQuantity: (idCarrito: number, nuevaCantidad: number) => Promise<void>;
  removeFromCart: (idCarrito: number) => Promise<void>;
  clearCart: () => void;
  decreaseQuantity: (idCarrito: number) => Promise<void>;
  increaseQuantity: (idCarrito: number) => Promise<void>;
  totalProductos: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingCart, setLoadingCart] = useState(false);
  const [isOpen, setInternalOpen] = useState(false);
  const setIsOpen = useCallback((open: boolean) => setInternalOpen(open), []);
  const { usuarioLogueado, esVendedor } = useAuth();

  const totalProductos = useMemo(() => cart.reduce((total, item) => total + item.CANTIDAD, 0), [cart]);

  const fetchCart = useCallback(async () => {
    if (!usuarioLogueado) return;
    setLoadingCart(true);
    try {
      const res = await axios.get("/api/carrito", {
        withCredentials: true,
      });
      setCart(res.data);
    } catch (err) {
      console.error("Error al obtener el carrito:", err);
    } finally {
      setLoadingCart(false);
    }
  }, [usuarioLogueado]);

  useEffect(() => {
    if (usuarioLogueado) fetchCart();
    else setCart([]);
  }, [usuarioLogueado]);

  const addToCart = useCallback(async (idProducto: number, idVariante: number, cantidad = 1): Promise<boolean> => {
  // 0. Los vendedores no pueden comprar en la tienda
  if (esVendedor) {
    Swal.fire({
      icon: "info",
      title: "Cuenta de vendedor",
      text: "Los vendedores no pueden comprar en la tienda. Usa una cuenta de cliente para realizar compras.",
      background: "#1a1a1a",
      color: "#fff",
      confirmButtonColor: "#e63946",
    });
    return false;
  }

  // 1. Restauramos la alerta de inicio de sesión
  if (!usuarioLogueado) {
    Swal.fire({
      title: "¡Inicia Sesión!",
      text: "Para añadir productos al carrito necesitas iniciar sesión.",
      icon: "info",
      background: "#1a1a1a",
      color: "#fff",
      confirmButtonColor: "#e63946",
    });
    return false;
  }

  // 2. Lógica de agregar
  try {
    const res = await axios.post(
      "/api/carrito/agregar",
      { id_producto: idProducto, id_variante: idVariante, cantidad },
      { withCredentials: true }
    );

    if (res.data.ok) {
      fetchCart();
      setIsOpen(true);
      return true;
    }
    return false;
  } catch (err: any) {
    // 3. Alerta de Stock insuficiente desde el backend
    if (err.response && err.response.status === 400) {
      Swal.fire({
        icon: "warning",
        title: "Stock limitado",
        text: err.response.data.msg,
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    } else {
      console.error("Error al agregar al carrito", err);
    }
    return false;
  }
}, [usuarioLogueado, esVendedor, fetchCart, setIsOpen]);

  const removeFromCart = useCallback(async (idCarrito: number) => {
    try {
      const res = await axios.delete(
        `/api/carrito/eliminar/${idCarrito}`,
        { withCredentials: true }
      );

      if (res.data.ok) {
        setCart((prev) => prev.filter((item) => item.ID_CARRITO !== idCarrito));
      } else {
        console.warn("Eliminación sin ok:", res.data);
        fetchCart();
      }
    } catch (err: any) {
      console.error("Error al eliminar del carrito", err);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: err.response?.data?.msg || "No se pudo eliminar el producto",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    }
  }, [fetchCart]);

  const clearCart = useCallback(() => setCart([]), []);

const decreaseQuantity = useCallback(async (idCarrito: number) => {
    const item = cart.find((i) => i.ID_CARRITO === idCarrito);
    if (!item) return;

    if (item.CANTIDAD <= 1) {
      const result = await Swal.fire({
        icon: "question",
        title: "¿Eliminar producto?",
        text: `¿Estás seguro de eliminar "${item.NOMBRE}" del carrito?`,
        showCancelButton: true,
        confirmButtonText: "Sí, eliminar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#e63946",
        reverseButtons: true,
        background: "#1a1a1a",
        color: "#fff",
      });
      if (result.isConfirmed) {
        await removeFromCart(idCarrito);
      }
    } else {
        try {
            await axios.put(`/api/carrito/actualizar/${idCarrito}`, 
                { cantidad: item.CANTIDAD - 1 }, { withCredentials: true });
            fetchCart();
        } catch (err) { console.error(err); }
    }
  }, [cart, removeFromCart, fetchCart]);

  const increaseQuantity = useCallback(async (idCarrito: number) => {
    const item = cart.find((i) => i.ID_CARRITO === idCarrito);
    if (!item) return;

    if (item.CANTIDAD >= item.STOCK) {
        Swal.fire({
          icon: "warning",
          title: "Stock limitado",
          text: `No hay más unidades disponibles. Solo quedan ${item.STOCK} de "${item.NOMBRE}".`,
          background: "#1a1a1a",
          color: "#fff",
          confirmButtonColor: "#e63946"
        });
        return;
    }

    try {
        await axios.put(`/api/carrito/actualizar/${idCarrito}`,
            { cantidad: item.CANTIDAD + 1 }, { withCredentials: true });
        fetchCart();
    } catch (err: any) {
        if (err.response?.status === 400) {
          Swal.fire({
            icon: "warning",
            title: "Stock limitado",
            text: err.response.data.msg || `No hay más unidades. Solo hay ${item.STOCK} disponibles.`,
            background: "#1a1a1a",
            color: "#fff",
            confirmButtonColor: "#e63946"
          });
          fetchCart();
        } else console.error(err);
    }
  }, [cart, fetchCart]);

  const updateQuantity = useCallback(async (idCarrito: number, nuevaCantidad: number) => {
    if (nuevaCantidad < 1) return;
    const item = cart.find((i) => i.ID_CARRITO === idCarrito);
    if (!item) return;
    if (nuevaCantidad > item.STOCK) {
      Swal.fire({
        icon: "warning",
        title: "Stock limitado",
        text: `Solo hay ${item.STOCK} unidades disponibles de "${item.NOMBRE}".`,
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946"
      });
      return;
    }
    try {
      await axios.put(`/api/carrito/actualizar/${idCarrito}`, { cantidad: nuevaCantidad }, { withCredentials: true });
      fetchCart();
    } catch (err: any) {
      if (err.response?.status === 400) {
        Swal.fire({
          icon: "warning",
          title: "Stock limitado",
          text: err.response.data.msg || `Solo hay ${item.STOCK} unidades disponibles.`,
          background: "#1a1a1a",
          color: "#fff",
          confirmButtonColor: "#e63946"
        });
        fetchCart();
      } else console.error(err);
    }
  }, [cart, fetchCart]);

  const value = useMemo(() => ({
    cart,
    loadingCart,
    isOpen,
    setIsOpen,
    fetchCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    decreaseQuantity,
    increaseQuantity,
    totalProductos,
  }), [cart, loadingCart, isOpen, setIsOpen, fetchCart, addToCart, updateQuantity, removeFromCart, clearCart, decreaseQuantity, increaseQuantity, totalProductos]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
};