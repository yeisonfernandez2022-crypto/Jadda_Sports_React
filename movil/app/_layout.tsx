import { Stack } from "expo-router";
import { AuthProvider } from "../context/AuthContext";
import { CartProvider } from "../context/CartContext";
import { FavoritosProvider } from "../context/FavoritosContext";
import { AvisoLoginProvider } from "../context/AvisoLoginContext";
import ForzarCambioPassword from "../components/ForzarCambioPassword";
import ToastFavorito from "../components/ToastFavorito";
import ToastCarrito from "../components/ToastCarrito";
import AvisoLogin from "../components/AvisoLogin";

export default function RootLayout() {
  return (
    <AuthProvider>
      <AvisoLoginProvider>
        <CartProvider>
          <FavoritosProvider>
            <ForzarCambioPassword />
            <ToastFavorito />
            <ToastCarrito />
            <AvisoLogin />
            <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />

            <Stack.Screen name="login" />
            <Stack.Screen name="registro" />
            <Stack.Screen name="producto/[id]" />
            <Stack.Screen name="verificar-codigo" />
            <Stack.Screen name="recuperar" />
            <Stack.Screen name="restablecer" />
            <Stack.Screen name="checkout" />
            <Stack.Screen name="compra-exitosa" />

            <Stack.Screen name="perfil/editar" />
            <Stack.Screen name="perfil/seguridad" />
            <Stack.Screen name="perfil/compras" />
            <Stack.Screen name="perfil/direcciones" />
            <Stack.Screen name="perfil/metodos-pago" />
            <Stack.Screen name="perfil/reembolso/[id]" />
<Stack.Screen name="perfil/devolucion/[idVenta]" />
<Stack.Screen name="chat/[id]" />

            <Stack.Screen name="retos" />
            <Stack.Screen name="mis-planes" />
            <Stack.Screen name="ser-vendedor" />

            <Stack.Screen name="contacto" />
            <Stack.Screen name="pqr" />
            <Stack.Screen name="sobre-nosotros" />
            <Stack.Screen name="preguntas-frecuentes" />
            <Stack.Screen name="politicas-devolucion" />
            <Stack.Screen name="terminos-condiciones" />
            <Stack.Screen name="politica-privacidad" />
            <Stack.Screen name="ayuda-soporte" />
          </Stack>
        </FavoritosProvider>
      </CartProvider>
      </AvisoLoginProvider>
    </AuthProvider>
  );
}
