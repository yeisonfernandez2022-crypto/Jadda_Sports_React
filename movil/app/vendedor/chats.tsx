import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../constants/api";
import BackButton from "../../components/BackButton";

export default function VendedorChats() {
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    api.get("/api/chat/conversaciones").then((r) => setChats(Array.isArray(r.data) ? r.data : [])).catch(() => setChats([])).finally(() => setCargando(false));
  }, []);
  if (cargando) return <View style={styles.centered}><ActivityIndicator size="large" color="#1aa084" /></View>;
  return (
    <View style={styles.container}>
      <BackButton texto="Chats" />
      <Text style={styles.h1}>Chats</Text>
      <Text style={styles.sub}>Tus conversaciones con clientes · igual que en web</Text>
      {chats.length === 0 ? (
        <View style={styles.vacio}><Ionicons name="chatbubbles-outline" size={48} color="#cbd5e1" /><Text style={styles.vacioText}>No tienes chats aún</Text></View>
      ) : (
        <FlatList
          data={chats}
          keyExtractor={(c) => String(c.ID_CHAT)}
          contentContainerStyle={{ paddingBottom: 24, gap: 10 }}
          renderItem={({ item: c }) => (
            <TouchableOpacity style={styles.card} onPress={() => (router.push as any)(`/chat/${c.ID_CHAT}` as any)}>
              <View style={styles.dot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tipo}>{c.TIPO} {c.ESTADO === "ESCALADA" ? "· Escalada" : ""}</Text>
                <Text style={styles.empresa} numberOfLines={1}>{c.NOMBRE_EMPRESA || c.NOMBRE_USUARIO || "Chat"}</Text>
                <Text style={styles.last} numberOfLines={1}>{c.ULTIMO_MENSAJE || "Sin mensajes"}</Text>
              </View>
              {Number(c.NO_LEIDOS) > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{c.NO_LEIDOS}</Text></View>}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  h1: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  sub: { fontSize: 12, color: "#64748b", marginBottom: 16 },
  vacio: { alignItems: "center", paddingTop: 40, gap: 12 },
  vacioText: { color: "#94a3b8" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, elevation: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#1aa084" },
  tipo: { fontSize: 10, fontWeight: "800", color: "#1aa084", textTransform: "uppercase" },
  empresa: { fontSize: 13, fontWeight: "700", color: "#0f172a" },
  last: { fontSize: 11, color: "#64748b", marginTop: 2 },
  badge: { backgroundColor: "#e73737", borderRadius: 10, minWidth: 22, height: 22, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});

