import { Stack, Redirect, usePathname } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { View, ActivityIndicator, Text, TouchableOpacity, StyleSheet, ScrollView, Modal } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function VendedorLayout() {
  const { esVendedor, estaLogueado, cargando, usuario } = useAuth();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);

  const tabs = [
    { label: "Inicio", icon: "home" as const, ruta: "/vendedor" },
    { label: "Mi tienda", icon: "storefront" as const, ruta: "/vendedor/tienda" },
    { label: "Mis productos", icon: "cube" as const, ruta: "/vendedor/productos" },
    { label: "Publicar", icon: "add-circle" as const, ruta: "/vendedor/nuevo" },
    { label: "Órdenes", icon: "receipt" as const, ruta: "/vendedor/ordenes" },
    { label: "Ventas", icon: "cash" as const, ruta: "/vendedor/ventas" },
    { label: "Devoluciones", icon: "return-up-back" as const, ruta: "/vendedor/devoluciones" },
    { label: "Chats", icon: "chatbubbles" as const, ruta: "/vendedor/chats" },
    { label: "Reportes", icon: "bar-chart" as const, ruta: "/vendedor/reportes" },
  ];

  if (cargando) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" }}>
        <ActivityIndicator size="large" color="#1aa084" />
      </View>
    );
  }

  if (!estaLogueado || !esVendedor) {
    return <Redirect href="/login" />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* HEADER VENDEDOR con hamburguesa 3 rayitas */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.hamburger} onPress={() => setMenuAbierto(true)}>
            <Ionicons name="menu" size={24} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>JADDA VENDEDOR</Text>
            <Text style={styles.headerSub}>{usuario?.NOMBRE_USUARIO || "Panel"}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerAction} onPress={() => (router.push as any)("/vendedor")}>
          <Ionicons name="storefront" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* DRAWER */}
      <Modal visible={menuAbierto} transparent animationType="fade" onRequestClose={() => setMenuAbierto(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setMenuAbierto(false)}>
          <View style={styles.drawer}>
            <View style={styles.drawerHead}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.drawerIcon}>
                  <Ionicons name="storefront" size={20} color="#1aa084" />
                </View>
                <View>
                  <Text style={styles.drawerTitle}>Panel vendedor</Text>
                  <Text style={styles.drawerSub}>{usuario?.NOMBRE_USUARIO} · JADDA</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setMenuAbierto(false)} style={styles.drawerClose}>
                <Ionicons name="close" size={20} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
              {tabs.map((t) => {
                const activo = pathname === t.ruta;
                return (
                  <TouchableOpacity
                    key={t.ruta}
                    style={[styles.item, activo && styles.itemActive]}
                    onPress={() => {
                      setMenuAbierto(false);
                      (router.push as any)(t.ruta);
                    }}
                  >
                    <Ionicons name={t.icon} size={20} color={activo ? "#1aa084" : "#64748b"} style={{ width: 24 }} />
                    <Text style={[styles.itemText, activo && styles.itemTextActive]}>{t.label}</Text>
                    <Ionicons name="chevron-forward" size={14} color="#cbd5e1" />
                  </TouchableOpacity>
                );
              })}
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.item}
                onPress={() => {
                  setMenuAbierto(false);
                  (router.push as any)("/vendedor/tienda");
                }}
              >
                <Ionicons name="settings" size={20} color="#64748b" style={{ width: 24 }} />
                <Text style={styles.itemText}>Configuración</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.item} onPress={() => { setMenuAbierto(false); (router.push as any)("/(tabs)"); }}>
                <Ionicons name="eye" size={20} color="#1aa084" style={{ width: 24 }} />
                <Text style={[styles.itemText, { color: "#1aa084" }]}>Ver tienda</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.item, { backgroundColor: "#fff5f5", marginTop: 8, borderRadius: 10 }]}
                onPress={() => {
                  setMenuAbierto(false);
                  // logout se maneja via AuthContext, pero aquí solo cerramos y vamos a login
                  (router.replace as any)("/login");
                }}
              >
                <Ionicons name="log-out" size={20} color="#e73737" style={{ width: 24 }} />
                <Text style={[styles.itemText, { color: "#e73737" }]}>Cerrar sesión</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: "#0f172a",
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  hamburger: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { color: "#fff", fontWeight: "900", fontSize: 14, letterSpacing: 0.8 },
  headerSub: { color: "#a7f3d0", fontSize: 11, fontWeight: "700" },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: { flex: 1, backgroundColor: "rgba(2,12,20,0.48)", flexDirection: "row" },
  drawer: {
    width: 310,
    maxWidth: "84%",
    backgroundColor: "#f8fafc",
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
  },
  drawerHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  drawerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#ecfdf5", justifyContent: "center", alignItems: "center" },
  drawerTitle: { fontWeight: "900", color: "#0f172a", fontSize: 14 },
  drawerSub: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  drawerClose: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#f1f5f9", justifyContent: "center", alignItems: "center" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  itemActive: { backgroundColor: "#ecfdf5" },
  itemText: { flex: 1, fontWeight: "700", color: "#0f172a", fontSize: 14 },
  itemTextActive: { color: "#0f766e" },
  divider: { height: 1, backgroundColor: "#e2e8f0", marginVertical: 10 },
});
