import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../constants/api";
import BackButton from "../../components/BackButton";

export default function VendedorTienda() {
  const insets = useSafeAreaInsets();
  const [vendedor, setVendedor] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api
      .get("/api/vendedor/mi-tienda")
      .then((r) => setVendedor(r.data.vendedor))
      .catch(() => setVendedor(null))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1aa084" />
      </View>
    );
  }
  if (!vendedor) {
    return (
      <View style={styles.centered}>
        <Text style={styles.vacio}>No pudimos cargar tu tienda.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton texto="Mi tienda" />
      <Text style={styles.h1}>
        <Ionicons name="storefront" size={20} color="#1aa084" /> Mi tienda
      </Text>
      <Text style={styles.sub}>Información de tu tienda en JADDA SPORTS</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Empresa</Text>
          <Text style={styles.value}>
            <Ionicons name="business" size={14} color="#1aa084" /> {vendedor.NOMBRE_EMPRESA || "Vendedor informal"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>NIT</Text>
          <Text style={styles.value}>{vendedor.NIT || "— (vendedor informal)"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Correo empresa</Text>
          <Text style={styles.value}>
            <Ionicons name="mail" size={14} color="#1aa084" /> {vendedor.EMAIL_VENDEDOR}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Categorías</Text>
          <Text style={styles.value}>{vendedor.CATEGORIAS || "—"}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Teléfono</Text>
          <Text style={styles.value}>
            <Ionicons name="call" size={14} color="#1aa084" /> {vendedor.TELEFONO || "—"}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Ciudad / Departamento</Text>
          <Text style={styles.value}>
            {vendedor.CIUDAD ? `${vendedor.CIUDAD}, ${vendedor.DEPARTAMENTO}` : vendedor.DEPARTAMENTO || "—"}
          </Text>
        </View>
        {vendedor.DIRECCION ? (
          <View style={[styles.row, { flexDirection: "column", alignItems: "flex-start" }]}>
            <Text style={styles.label}>Dirección</Text>
            <Text style={styles.value}>{vendedor.DIRECCION}</Text>
          </View>
        ) : null}
        <View style={[styles.row, styles.estadoRow]}>
          <Text style={[styles.label, { color: "#065f46" }]}>Estado</Text>
          <Text style={[styles.value, { color: "#065f46", fontWeight: "800" }]}>
            {vendedor.ESTADO || "ACTIVO"} · {vendedor.FECHA_REGISTRO ? new Date(vendedor.FECHA_REGISTRO).toLocaleDateString("es-CO") : "—"}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => (router.push as any)("/vendedor")}>
        <Text style={styles.btnText}>Ir a Inicio</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={() => (router.push as any)("/vendedor/productos")}>
        <Text style={[styles.btnText, { color: "#1aa084" }]}>Gestionar mis productos</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#f8fafc" },
  container: { padding: 16, backgroundColor: "#f8fafc", flexGrow: 1, paddingBottom: 32 },
  h1: { fontSize: 20, fontWeight: "800", color: "#0f172a", marginTop: 8 },
  sub: { fontSize: 12, color: "#64748b", marginBottom: 16 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 1, gap: 12 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  label: { fontSize: 11, color: "#64748b", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: 13, color: "#0f172a", fontWeight: "600", flex: 1, textAlign: "right" },
  estadoRow: { backgroundColor: "#f0fdfa", borderWidth: 1, borderColor: "#a7f3d0", borderRadius: 10, padding: 12, marginTop: 4 },
  vacio: { color: "#94a3b8" },
  btn: {
    backgroundColor: "#1aa084",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  btnOutline: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#1aa084" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});

