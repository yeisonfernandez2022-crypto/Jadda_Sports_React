import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api from "../../constants/api";
import BackButton from "../../components/BackButton";
import { numeroPedido } from "../../utils/numeroPedido";

export default function VendedorOrdenes() {
  const insets = useSafeAreaInsets();
  const [ordenes, setOrdenes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    setCargando(true);
    api
      .get("/api/vendedor/ventas")
      .then((r) => setOrdenes(r.data))
      .catch(() => setOrdenes([]))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, []);

  const avanzar = async (id: number, estado: string) => {
    try {
      await api.put(`/api/vendedor/ventas/${id}/estado`, { estado });
      Alert.alert("Actualizado", `Estado cambiado a ${estado}`);
      cargar();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.msg || "No se pudo actualizar");
    }
  };

  if (cargando) return <View style={styles.centered}><ActivityIndicator size="large" color="#1aa084" /></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton texto="í“rdenes" />
      <Text style={styles.h1}>í“rdenes</Text>
      <Text style={styles.sub}>Gestiona el estado de tus ventas (igual que en web)</Text>
      {ordenes.length === 0 ? (
        <View style={styles.vacio}><Ionicons name="receipt-outline" size={48} color="#cbd5e1" /><Text style={styles.vacioText}>No tienes órdenes aún</Text></View>
      ) : (
        ordenes.map((o) => (
          <View key={o.ID_VENTA} style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.id}>{numeroPedido(o.ID_VENTA)}</Text>
              <Text style={[styles.badge, { backgroundColor: o.ESTADO === "CANCELADA" ? "#fee2e2" : o.ESTADO === "COMPLETADA" ? "#dcfce7" : "#fef3c7" }]}>{o.ESTADO}</Text>
            </View>
            <Text style={styles.meta}>{o.CLIENTE || "Cliente"} · {new Date(o.FECHA_VENTA).toLocaleDateString("es-CO")} · ${Number(o.TOTAL).toLocaleString("es-CO")}</Text>
            {o.items?.slice(0, 2).map((it: any, i: number) => (
              <Text key={i} style={styles.itemText}>• {it.NOMBRE} x{it.CANTIDAD} — ${Number(it.SUBTOTAL).toLocaleString("es-CO")}</Text>
            ))}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              {["PENDIENTE", "CONFIRMADA", "ENVIADA", "COMPLETADA", "CANCELADA"].map((est) => (
                <TouchableOpacity key={est} style={[styles.estBtn, o.ESTADO === est && styles.estBtnActive]} onPress={() => avanzar(o.ID_VENTA, est)}>
                  <Text style={[styles.estText, o.ESTADO === est && styles.estTextActive]}>{est}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: "800", overflow: "hidden", color: "#334155" },
  meta: { fontSize: 12, color: "#64748b", marginTop: 4 },
  itemText: { fontSize: 12, color: "#334155", marginTop: 4 },
  estBtn: { borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: "#fff" },
  estBtnActive: { backgroundColor: "#1aa084", borderColor: "#1aa084" },
  estText: { fontSize: 10, fontWeight: "700", color: "#334155" },
  estTextActive: { color: "#fff" },
});

