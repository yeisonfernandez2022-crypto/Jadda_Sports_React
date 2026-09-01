import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import { Alert } from "react-native";
import api from "../constants/api";
import { useAuth } from "./AuthContext";
import { useAvisoLogin } from "./AvisoLoginContext";

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
  fetchCart: (opts?: { silencioso?: boolean }) => void;
  addToCart: (idProducto: number, idVariante: number, cantidad?: number) => Promise<boolean>;
  removeFromCart: (idCarrito: number) => Promise<void>;
  clearCart: () => void;
  decreaseQuantity: (idCarrito: number) => Promise<void>;
  increaseQuantity: (idCarrito: number) => Promise<void>;
  totalProductos: number;
  toastCarrito: { mensaje: string; tipo?: "ok" | "error" } | null;
  mostrarToastCarrito: (mensaje: string, tipo?: "ok" | "error") => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loadingCart, setLoadingCart] = useState(false);
  const [toastCarrito, setToastCarrito] = useState<{ mensaje: string; tipo?: "ok" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { estaLogueado, usuario } = useAuth();
  const { mostrarAvisoLogin } = useAvisoLogin();

  const mostrarToastCarrito = useCallback((mensaje: string, tipo?: "ok" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastCarrito({ mensaje, tipo });
    toastTimer.current = setTimeout(() => setToastCarrito(null), 2500);
  }, []);

  const totalProductos = useMemo(() => cart.reduce((total, item) => total + item.CANTIDAD, 0), [cart]);

  const fetchCart = useCallback(async (opts?: { silencioso?: boolean }) => {
    if (!estaLogueado) {
      setCart([]);
      return;
    }
    if (!opts?.silencioso) setLoadingCart(true);
    try {
      const res = await api.get("/api/carrito");
      setCart(res.data);
    } catch (err: any) {
      const status = err?.response?.status;
      const isNetwork = !err?.response && (err?.message === "Network Error" || err?.code === "ERR_NETWORK" || err?.code === "ECONNABORTED");
      if (status === 401) {
        return;
      }
      if (isNetwork) {
        console.log("[Cart] sin red, mantengo cache");
        return;
      }
      console.error("Error al obtener el carrito:", err);
    } finally {
      if (!opts?.silencioso) setLoadingCart(false);
    }
  }, [estaLogueado]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const addToCart = useCallback(async (idProducto: number, idVariante: number, cantidad = 1): Promise<boolean> => {
    // Los vendedores no pueden comprar en la tienda
    if (usuario?.ID_ROL === 6) {
      Alert.alert(
        "Cuenta de vendedor",
        "Los vendedores no pueden comprar en la tienda. Usa una cuenta de cliente para realizar compras."
      );
      return false;
    }
    if (!estaLogueado) {
      mostrarAvisoLogin("Para añadir productos al carrito necesitas iniciar sesión.");
      return false;
    }

    try {
      const res = await api.post("/api/carrito/agregar", {
        id_producto: idProducto,
        id_variante: idVariante,
        cantidad,
      });

      if (res.data.ok) {
        fetchCart();
        return true;
      }
      return false;
    } catch (err: any) {
      if (err.response && err.response.status === 400) {
        Alert.alert("Stock limitado", err.response.data.msg);
      } else if (err.response && err.response.status === 404) {
        Alert.alert("Error", err.response.data.msg || "Variante no existe");
      } else {
        console.error("Error al agregar al carrito", err);
      }
      return false;
    }
  }, [estaLogueado, usuario, fetchCart, mostrarAvisoLogin]);

  const removeFromCart = useCallback(async (idCarrito: number) => {
    try {
      const res = await api.delete(`/api/carrito/eliminar/${idCarrito}`);
      if (res.data.ok) {
        setCart((prev) => prev.filter((item) => item.ID_CARRITO !== idCarrito));
      } else {
        fetchCart();
      }
    } catch (err: any) {
      console.error("Error al eliminar del carrito", err);
      Alert.alert("Error", err.response?.data?.msg || "No se pudo eliminar el producto");
    }
  }, [fetchCart]);

  const clearCart = useCallback(() => setCart([]), []);

  const decreaseQuantity = useCallback(
    async (idCarrito: number) => {
      const item = cart.find((i) => i.ID_CARRITO === idCarrito);
      if (!item) return;

      if (item.CANTIDAD <= 1) {
        Alert.alert("¿Eliminar producto?", `¿Estás seguro de eliminar "${item.NOMBRE}" del carrito?`, [
          { text: "Cancelar", style: "cancel" },
          { text: "Sí, eliminar", style: "destructive", onPress: () => removeFromCart(idCarrito) },
        ]);
      } else {
        try {
          await api.put(`/api/carrito/actualizar/${idCarrito}`, { cantidad: item.CANTIDAD - 1 });
          fetchCart();
        } catch (err) {
          console.error(err);
        }
      }
    },
    [cart, removeFromCart, fetchCart]
  );

  const increaseQuantity = useCallback(
    async (idCarrito: number) => {
      const item = cart.find((i) => i.ID_CARRITO === idCarrito);
      if (!item) return;

      if (item.CANTIDAD >= item.STOCK) {
        const variante = [item.COLOR, item.ATRIBUTO].filter(Boolean).join(" ");
        mostrarToastCarrito(
          variante
            ? `No hay más productos de ${variante} en stock.`
            : "No hay más unidades de este producto en stock.",
          "error"
        );
        return;
      }

      try {
        await api.put(`/api/carrito/actualizar/${idCarrito}`, { cantidad: item.CANTIDAD + 1 });
        fetchCart();
      } catch (err) {
        console.error(err);
      }
    },
    [cart, fetchCart, mostrarToastCarrito]
  );

  const value = useMemo(
    () => ({
      cart,
      loadingCart,
      fetchCart,
      addToCart,
      removeFromCart,
      clearCart,
      decreaseQuantity,
      increaseQuantity,
      totalProductos,
      toastCarrito,
      mostrarToastCarrito,
    }),
    [cart, loadingCart, fetchCart, addToCart, removeFromCart, clearCart, decreaseQuantity, increaseQuantity, totalProductos, toastCarrito, mostrarToastCarrito]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
};
