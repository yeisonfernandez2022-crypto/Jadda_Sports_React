import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../../constants/api";
import BackButton from "../../components/BackButton";

export default function VendedorInicio() {
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    api
      .get("/api/vendedor/mi-tienda")
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1aa084" />
        <Text style={{ marginTop: 12, color: "#64748b" }}>Cargando tu tienda…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <Ionicons name="storefront-outline" size={48} color="#ccc" />
        <Text style={styles.vacio}>No pudimos cargar tu tienda. Intenta de nuevo.</Text>
        <TouchableOpacity style={styles.btnPrimario} onPress={() => (router.replace as any)("/vendedor")}>
          <Text style={styles.btnPrimarioText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { vendedor, stats, ultimasVentas, stockBajo } = data;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroBadge}>
            <Ionicons name="storefront" size={12} color="#6ee7b7" />
            <Text style={styles.heroBadgeText}>Panel vendedor</Text>
          </View>
          <TouchableOpacity style={styles.heroBtn} onPress={() => (router.push as any)("/vendedor/nuevo")}>
            <Ionicons name="add-circle" size={16} color="#fff" />
            <Text style={styles.heroBtnText}>Publicar</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.heroTitle}>Hola, {String(vendedor.NOMBRE_EMPRESA || "vendedor").split(" ")[0]} 👋</Text>
        <Text style={styles.heroSub}>{vendedor.NOMBRE_EMPRESA} · {vendedor.CIUDAD}, {vendedor.DEPARTAMENTO}</Text>
      </View>

      {Number(stats.productosPendientes) > 0 && (
        <View style={styles.aviso}>
          <Ionicons name="time-outline" size={18} color="#b45309" />
          <Text style={styles.avisoText}>
            Tienes {stats.productosPendientes} producto(s) en revisión. El equipo de JADDA los revisa en menos de 48h.
          </Text>
        </View>
      )}

      <View style={styles.kpis}>
        <View style={styles.kpi}>
          <View style={[styles.kpiIcon, { backgroundColor: "#dcfce7" }]}>
            <Ionicons name="cube" size={18} color="#15803d" />
          </View>
          <Text style={styles.kpiVal}>{stats.productosPublicados}</Text>
          <Text style={styles.kpiLab}>Productos</Text>
        </View>
        <View style={styles.kpi}>
          <View style={[styles.kpiIcon, { backgroundColor: "#dbeafe" }]}>
            <Ionicons name="layers" size={18} color="#2563eb" />
          </View>
          <Text style={styles.kpiVal}>{stats.unidadesVendidas}</Text>
          <Text style={styles.kpiLab}>Unidades</Text>
        </View>
        <View style={styles.kpi}>
          <View style={[styles.kpiIcon, { backgroundColor: "#fee2e2" }]}>
            <Ionicons name="cart" size={18} color="#dc2626" />
          </View>
          <Text style={styles.kpiVal}>{stats.totalVentas}</Text>
          <Text style={styles.kpiLab}>Ventas</Text>
        </View>
        <View style={styles.kpi}>
          <View style={[styles.kpiIcon, { backgroundColor: "#fef3c7" }]}>
            <Ionicons name="cash" size={18} color="#b45309" />
          </View>
          <Text style={styles.kpiVal}>${Number(stats.totalIngresos || 0).toLocaleString("es-CO")}</Text>
          <Text style={styles.kpiLab}>Ingresos</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="cart" size={18} color="#1aa084" />
          <Text style={styles.cardTitle}>Últimas ventas</Text>
        </View>
        {ultimasVentas.length === 0 ? (
          <Text style={styles.vacioSmall}>Aún no tienes ventas. Publica tus productos para empezar.</Text>
        ) : (
          ultimasVentas.map((v: any) => (
            <View key={v.ID_VENTA} style={styles.ventaItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ventaId}>Pedido #{v.ID_VENTA}</Text>
                <Text style={styles.ventaMeta}>
                  {v.CLIENTE || "Cliente"} · {new Date(v.FECHA_VENTA).toLocaleDateString("es-CO")} · {v.ARTICULOS} art.
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <View style={[styles.badge, { backgroundColor: v.ESTADO === "CANCELADA" ? "#fee2e2" : v.ESTADO === "COMPLETADA" ? "#dcfce7" : "#fef3c7" }]}>
                  <Text style={[styles.badgeText, { color: v.ESTADO === "CANCELADA" ? "#991b1b" : v.ESTADO === "COMPLETADA" ? "#166534" : "#92400e" }]}>
                    {v.ESTADO}
                  </Text>
                </View>
                <Text style={styles.ventaTotal}>${Number(v.TOTAL).toLocaleString("es-CO")}</Text>
              </View>
            </View>
          ))
        )}
        {ultimasVentas.length > 0 && (
          <TouchableOpacity style={styles.linkBtn} onPress={() => (router.push as any)("/vendedor/ventas")}>
            <Text style={styles.linkBtnText}>Ver todas mis ventas →</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="warning" size={18} color="#f59e0b" />
          <Text style={styles.cardTitle}>Stock bajo (≤ 10)</Text>
        </View>
        {stockBajo.length === 0 ? (
          <Text style={styles.vacioSmall}>No hay variantes con stock bajo.</Text>
        ) : (
          stockBajo.map((s: any, i: number) => (
            <View key={i} style={styles.stockItem}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>
                  {s.NOMBRE_ATRIBUTO}: {s.ATRIBUTO}
                </Text>
              </View>
              <Text style={styles.stockNombre} numberOfLines={1}>
                {s.NOMBRE}
              </Text>
              <View style={[styles.stockBadge, { backgroundColor: Number(s.STOCK) === 0 ? "#fee2e2" : "#fef3c7" }]}>
                <Text style={[styles.stockBadgeText, { color: Number(s.STOCK) === 0 ? "#991b1b" : "#92400e" }]}>
                  {Number(s.STOCK) === 0 ? "Agotado" : `${s.STOCK} uds`}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.btnSecundario} onPress={() => (router.push as any)("/vendedor/productos")}>
        <Ionicons name="cube" size={18} color="#1aa084" />
        <Text style={styles.btnSecundarioText}>Gestionar mis productos</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#f1f5f9" },
  container: { padding: 14, backgroundColor: "#f1f5f9", flexGrow: 1, paddingBottom: 32 },
  hero: {
    backgroundColor: "#0f172a",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(16,185,129,0.16)",
    borderWidth: 1,
    borderColor: "rgba(110,231,183,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  heroBadgeText: { color: "#6ee7b7", fontSize: 11, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: -0.3 },
  heroSub: { color: "#a7f3d0", fontSize: 12, fontWeight: "600", marginTop: 4 },
  heroBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#10b981",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  aviso: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  avisoText: { flex: 1, fontSize: 12, color: "#92400e", fontWeight: "700" },
  kpis: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  kpi: {
    flex: 1,
    minWidth: "46%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e6eef7",
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  kpiIcon: { width: 46, height: 46, borderRadius: 14, justifyContent: "center", alignItems: "center", marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.8)" },
  kpiVal: { fontSize: 19, fontWeight: "900", color: "#0f172a", letterSpacing: -0.3 },
  kpiLab: { fontSize: 10, color: "#64748b", fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#e6eef7", shadowColor: "#0f172a", shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  ventaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 10,
  },
  ventaId: { fontWeight: "800", color: "#0f172a", fontSize: 13 },
  ventaMeta: { fontSize: 11, color: "#64748b", marginTop: 2 },
  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginTop: 4 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  ventaTotal: { fontWeight: "800", color: "#1aa084", fontSize: 13, marginTop: 4 },
  linkBtn: { marginTop: 12, alignItems: "center", paddingVertical: 10, backgroundColor: "#f0fdfa", borderRadius: 10 },
  linkBtnText: { color: "#1aa084", fontWeight: "700", fontSize: 13 },
  stockItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#f8fafc" },
  chip: { backgroundColor: "#f1f5f9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  chipText: { fontSize: 11, color: "#334155", fontWeight: "600" },
  stockNombre: { flex: 1, fontSize: 12, color: "#334155" },
  stockBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  stockBadgeText: { fontSize: 11, fontWeight: "800" },
  vacio: { color: "#94a3b8", textAlign: "center", marginTop: 8 },
  vacioSmall: { color: "#94a3b8", fontSize: 12, textAlign: "center", paddingVertical: 12 },
  btnSecundario: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#1aa084",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  btnSecundarioText: { color: "#1aa084", fontWeight: "800", fontSize: 14 },
  vacioText: { color: "#94a3b8", textAlign: "center", marginTop: 8 } as any,
  btnPrimario: { backgroundColor: "#1aa084", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 10, marginTop: 12 },
  btnPrimarioText: { color: "#fff", fontWeight: "800" },
});
