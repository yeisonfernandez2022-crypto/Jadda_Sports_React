import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../constants/api";
import BackButton from "../../components/BackButton";
import { numeroPedido } from "../../utils/numeroPedido";

export default function VendedorVentas() {
  const insets = useSafeAreaInsets();
  const [ventas, setVentas] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    api.get("/api/vendedor/ventas").then((r) => setVentas(r.data)).catch(() => setVentas([])).finally(() => setCargando(false));
  }, []);
  if (cargando) return <View style={styles.centered}><ActivityIndicator size="large" color="#1aa084" /></View>;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton texto="Mis ventas" />
      <Text style={styles.h1}>Mis ventas</Text>
      <Text style={styles.sub}>Ventas que incluyen tus productos · igual que en web</Text>
      {ventas.length === 0 ? (
        <View style={styles.vacio}><Ionicons name="cash-outline" size={48} color="#cbd5e1" /><Text style={styles.vacioText}>Aún no tienes ventas</Text></View>
      ) : (
        ventas.map((v) => (
          <View key={v.ID_VENTA} style={styles.card}>
            <Text style={styles.id}>{numeroPedido(v.ID_VENTA)} · {v.ESTADO}</Text>
            <Text style={styles.meta}>{v.CLIENTE} · {new Date(v.FECHA_VENTA).toLocaleDateString("es-CO")} · ${Number(v.TOTAL).toLocaleString("es-CO")}</Text>
            {v.items?.map((it: any, i: number) => (
              <Text key={i} style={styles.item}>• {it.NOMBRE} x{it.CANTIDAD} — ${Number(it.SUBTOTAL).toLocaleString("es-CO")}</Text>
            ))}
            <Text style={styles.envio}>Envío: {v.ESTADO_ENVIO || "PENDIENTE"} · {v.CIUDAD || ""} {v.DIRECCION_ENVIO || ""}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  container: { padding: 16, backgroundColor: "#f8fafc", flexGrow: 1, paddingBottom: 32 },
  h1: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  sub: { fontSize: 12, color: "#64748b", marginBottom: 16 },
  vacio: { alignItems: "center", paddingTop: 40, gap: 12 },
  vacioText: { color: "#94a3b8" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 12, elevation: 1 },
  id: { fontWeight: "800", color: "#0f172a" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  item: { fontSize: 12, color: "#334155", marginTop: 4 },
  envio: { fontSize: 11, color: "#1aa084", marginTop: 8, fontWeight: "600" },
});

