import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import Header from "../../components/Header";
import { useAuth } from "../../context/AuthContext";

export default function TabsLayout() {
  const { esVendedor } = useAuth();
  return (
    <Tabs
      screenOptions={{
        header: () => <Header />,
        tabBarActiveTintColor: "#e73737",
        tabBarInactiveTintColor: "#666",
        tabBarStyle: {
          height: 65,
          paddingBottom: 8,
          paddingTop: 5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="home"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="catalogo"
        options={{
          title: "Catálogo",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="grid"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="carrito"
        options={{
          title: "Carrito",
          href: esVendedor ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="cart"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="favoritos"
        options={{
          title: "Favoritos",
          href: esVendedor ? null : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="heart"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="perfil"
        options={{
          title: esVendedor ? "Panel" : "Perfil",
          href: esVendedor ? "/vendedor" : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name={esVendedor ? "storefront" : "person"}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}