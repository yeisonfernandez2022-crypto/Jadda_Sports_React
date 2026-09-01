import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api, { resolverImagen } from "../../constants/api";
import BackButton from "../../components/BackButton";
import { Image } from "react-native";

export default function VendedorDevoluciones() {
  const insets = useSafeAreaInsets();
  const [lista, setLista] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const cargar = () => {
    setCargando(true);
    api.get("/api/vendedor/devoluciones").then((r) => setLista(r.data)).catch(() => setLista([])).finally(() => setCargando(false));
  };
  useEffect(cargar, []);
  const procesar = (id: number, decision: string) => {
    const necesitaObs = decision === "rechazar" || decision === "mas_pruebas";
    const obsPrompt = () => {
      Alert.prompt("Observación", "Escribe el motivo", async (obs) => {
        if (necesitaObs && !obs?.trim()) return Alert.alert("Falta motivo", "Debes indicar el motivo");
        try {
          await api.post(`/api/vendedor/devoluciones/${id}/procesar`, { decision, observacion: obs });
          Alert.alert("Actualizado", `Solicitud ${decision}`);
          cargar();
        } catch (e: any) { Alert.alert("Error", e?.response?.data?.msg || "No se pudo procesar"); }
      });
    };
    if (necesitaObs) obsPrompt();
    else
      Alert.alert("Confirmar", `¿${decision}?`, [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Confirmar",
          onPress: async () => {
            try {
              await api.post(`/api/vendedor/devoluciones/${id}/procesar`, { decision });
              Alert.alert("Actualizado", `Solicitud ${decision}`);
              cargar();
            } catch (e: any) { Alert.alert("Error", e?.response?.data?.msg || "Error"); }
          },
        },
      ]);
  };
  if (cargando) return <View style={styles.centered}><ActivityIndicator size="large" color="#1aa084" /></View>;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton texto="Devoluciones" />
      <Text style={styles.h1}>Devoluciones</Text>
      <Text style={styles.sub}>Gestiona devoluciones de tus productos · igual que en web</Text>
      {lista.length === 0 ? (
        <View style={styles.vacio}><Ionicons name="return-up-back" size={48} color="#cbd5e1" /><Text style={styles.vacioText}>No tienes devoluciones</Text></View>
      ) : (
        lista.map((d) => (
          <View key={d.ID_DEVOLUCION} style={styles.card}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Image source={{ uri: resolverImagen(d.IMAGEN) || "https://placehold.co/100x100?text=JADDA" }} style={styles.img} />
              <View style={{ flex: 1 }}>
                <Text style={styles.prod}>{d.PRODUCTO_NOMBRE} x{d.CANTIDAD}</Text>
                <Text style={styles.meta}>{d.NOMBRE_USUARIO} · {d.EMAIL}</Text>
                <View style={[styles.badge, { backgroundColor: d.ESTADO === "SOLICITADA" ? "#fef3c7" : d.ESTADO === "APROBADA" ? "#dcfce7" : d.ESTADO === "RECHAZADA" ? "#fee2e2" : "#dbeafe" }]}>
                  <Text style={styles.badgeText}>{d.ESTADO}</Text>
                </View>
                <Text style={styles.motivo}>{d.MOTIVO} — {d.DESCRIPCION || ""}</Text>
              </View>
            </View>
            {["SOLICITADA", "MAS_PRUEBAS"].includes(d.ESTADO) && (
              <View style={styles.actions}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: "#dcfce7" }]} onPress={() => procesar(d.ID_DEVOLUCION, "devolver")}><Text style={[styles.btnText, { color: "#166534" }]}>Devolver</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: "#dbeafe" }]} onPress={() => procesar(d.ID_DEVOLUCION, "reembolsar")}><Text style={[styles.btnText, { color: "#1e40af" }]}>Reembolsar</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: "#fef3c7" }]} onPress={() => procesar(d.ID_DEVOLUCION, "mas_pruebas")}><Text style={[styles.btnText, { color: "#92400e" }]}>Más pruebas</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: "#fee2e2" }]} onPress={() => procesar(d.ID_DEVOLUCION, "rechazar")}><Text style={[styles.btnText, { color: "#991b1b" }]}>Rechazar</Text></TouchableOpacity>
              </View>
            )}
            {d.ESTADO === "ESCALADA" && <Text style={styles.escalada}>Escalada al equipo JADDA — ellos deciden</Text>}
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
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 12, elevation: 1 },
  img: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#f1f5f9" },
  prod: { fontWeight: "800", color: "#0f172a", fontSize: 13 },
  meta: { fontSize: 11, color: "#64748b", marginTop: 2 },
  badge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 6 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  motivo: { fontSize: 12, color: "#334155", marginTop: 6 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  btn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnText: { fontSize: 11, fontWeight: "800" },
  escalada: { fontSize: 11, color: "#7c3aed", fontWeight: "700", marginTop: 8 },
});

