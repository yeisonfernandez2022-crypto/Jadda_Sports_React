import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, Image, Alert } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { resolverImagen } from "../../constants/api";
import BackButton from "../../components/BackButton";

const PLACEHOLDER = "https://placehold.co/400x400?text=JADDA";

export default function VendedorProductos() {
  const insets = useSafeAreaInsets();
  const [productos, setProductos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    setCargando(true);
    api
      .get("/api/vendedor/productos")
      .then((r) => setProductos(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProductos([]))
      .finally(() => setCargando(false));
  };

  useEffect(cargar, []);

  const filtrados = productos.filter((p) => {
    if (!busqueda.trim()) return true;
    const q = busqueda.toLowerCase();
    return (p.NOMBRE || "").toLowerCase().includes(q) || (p.MARCA || "").toLowerCase().includes(q) || (p.CATEGORIA || "").toLowerCase().includes(q);
  });

  const eliminar = (p: any) => {
    Alert.alert("¿Eliminar producto?", `"${p.NOMBRE}" se eliminará permanentemente.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await api.delete(`/api/vendedor/productos/${p.ID}`);
            Alert.alert("Eliminado", res.data.msg || "Producto eliminado");
            cargar();
          } catch (e: any) {
            Alert.alert("No se pudo eliminar", e?.response?.data?.msg || "Error");
          }
        },
      },
    ]);
  };

  const badge = (e: string | null) => {
    if (!e) return { text: "Publicado", color: "#15803d", bg: "#dcfce7" };
    if (e === "APROBADO") return { text: "Aprobado", color: "#15803d", bg: "#dcfce7" };
    if (e === "PENDIENTE") return { text: "En revisión", color: "#92400e", bg: "#fef3c7" };
    return { text: "Rechazado", color: "#991b1b", bg: "#fee2e2" };
  };

  if (cargando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1aa084" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton texto="Mis productos" />
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Mis productos</Text>
          <Text style={styles.sub}>{productos.length} producto(s) · en revisión se publican en tienda</Text>
        </View>
        <TouchableOpacity style={styles.btnNuevo} onPress={() => (router.push as any)("/vendedor/nuevo")}>
          <Ionicons name="add-circle" size={18} color="#fff" />
          <Text style={styles.btnNuevoText}>Publicar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#94a3b8" />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, marca o categoríaâ€¦"
          value={busqueda}
          onChangeText={setBusqueda}
          placeholderTextColor="#94a3b8"
        />
      </View>

      {filtrados.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons name="cube-outline" size={48} color="#cbd5e1" />
          <Text style={styles.vacioText}>{busqueda ? "Sin resultados para tu búsqueda." : "Aún no has publicado productos."}</Text>
        </View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={(p) => String(p.ID)}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          renderItem={({ item: p }) => {
            const b = badge(p.ESTADO_PUBLICACION);
            const stock = Number(p.STOCK);
            return (
              <View style={styles.card}>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Image source={{ uri: resolverImagen(p.IMAGEN) || PLACEHOLDER }} style={styles.img} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.nombre} numberOfLines={2}>
                      {p.NOMBRE}
                    </Text>
                    <Text style={styles.marca}>{p.MARCA}</Text>
                    <Text style={styles.categoria}>{p.CATEGORIA || "—"}</Text>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 6, alignItems: "center" }}>
                      <Text style={styles.precio}>${Number(p.PRECIO).toLocaleString("es-CO")}</Text>
                      <View style={[styles.badge, { backgroundColor: b.bg }]}>
                        <Text style={[styles.badgeText, { color: b.color }]}>{b.text}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                      <View style={[styles.stock, { backgroundColor: stock === 0 ? "#fee2e2" : stock <= 10 ? "#fef3c7" : "#dcfce7" }]}>
                        <Text style={[styles.stockText, { color: stock === 0 ? "#991b1b" : stock <= 10 ? "#92400e" : "#166534" }]}>
                          {stock === 0 ? "Agotado" : `${stock} uds`}
                        </Text>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Ionicons name="star" size={12} color="#f59e0b" />
                        <Text style={{ fontSize: 11, color: "#64748b" }}>{Number(p.RESENA_COUNT) || 0}</Text>
                      </View>
                    </View>
                  </View>
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.btnEditar} onPress={() => (router.push as any)(`/vendedor/editar/${p.ID}` as any)}>
                    <Ionicons name="create" size={16} color="#1aa084" />
                    <Text style={styles.btnEditarText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnEliminar} onPress={() => eliminar(p)}>
                    <Ionicons name="trash" size={16} color="#e73737" />
                    <Text style={styles.btnEliminarText}>Eliminar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, gap: 12 },
  h1: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  sub: { fontSize: 12, color: "#64748b", marginTop: 2 },
  btnNuevo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1aa084",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  btnNuevoText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 13, color: "#0f172a" },
  vacio: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 40, gap: 12 },
  vacioText: { color: "#94a3b8", textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 12, elevation: 1, gap: 12 },
  img: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#f1f5f9" },
  nombre: { fontWeight: "800", color: "#0f172a", fontSize: 14 },
  marca: { fontSize: 11, color: "#64748b" },
  categoria: { fontSize: 11, color: "#1aa084", fontWeight: "600" },
  precio: { fontWeight: "800", color: "#0f172a", fontSize: 13 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  stock: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  stockText: { fontSize: 11, fontWeight: "800" },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  btnEditar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#1aa084",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnEditarText: { color: "#1aa084", fontWeight: "700", fontSize: 12 },
  btnEliminar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#fee2e2",
    backgroundColor: "#fff5f5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  btnEliminarText: { color: "#e73737", fontWeight: "700", fontSize: 12 },
});

