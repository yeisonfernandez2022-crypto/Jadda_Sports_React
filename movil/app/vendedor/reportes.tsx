import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import api, { resolverImagen } from "../../constants/api";
import BackButton from "../../components/BackButton";
import { Image } from "react-native";

export default function VendedorReportesMovil() {
  const insets = useSafeAreaInsets();
  const [desde, setDesde] = useState(() => new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10));
  const [hasta, setHasta] = useState(() => new Date().toISOString().slice(0, 10));
  const [gran, setGran] = useState<"dia" | "semana" | "mes" | "anio">("dia");
  const [tab, setTab] = useState<"ingresos" | "ordenes" | "unidades">("ingresos");
  const [data, setData] = useState<any>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = () => {
    setCargando(true);
    api.get(`/api/vendedor/reportes?desde=${desde}&hasta=${hasta}&granularidad=${gran}`)
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, [desde, hasta, gran]);

  if (cargando) return <View style={styles.centered}><ActivityIndicator size="large" color="#1aa084" /></View>;
  if (!data) return <View style={styles.centered}><Text style={styles.vacio}>No se pudo cargar</Text></View>;

  const maxIng = Math.max(...(data.serie || []).map((s: any) => s.ingresos), 1);
  const maxPed = Math.max(...(data.serie || []).map((s: any) => s.pedidos), 1);
  const maxUnd = Math.max(...(data.serie || []).map((s: any) => s.unidades), 1);

  const kpis = [
    { l: "Ingresos", v: `$${Number(data.totalIngresos).toLocaleString("es-CO")}`, sub: `${data.totalOrdenes} pedidos`, c: "#6f42c1" },
    { l: "Pedidos", v: `${data.totalOrdenes}`, sub: `$${Number(data.ticketPromedio).toLocaleString("es-CO")} ticket`, c: "#0d6efd" },
    { l: "Ticket", v: `$${Number(data.ticketPromedio).toLocaleString("es-CO")}`, sub: `${data.totalUnidades} uds`, c: "#198754" },
    { l: "Unidades", v: `${data.totalUnidades}`, sub: `${data.totalOrdenes} ped.`, c: "#e73737" },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton texto="Reportes" />
      <Text style={styles.h1}>Mis reportes</Text>
      <Text style={styles.sub}>Igual que en web · {desde} â†’ {hasta} · por {gran}</Text>

      <View style={styles.filtros}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            { k: "dia", l: "Día" },
            { k: "semana", l: "Semana" },
            { k: "mes", l: "Mes" },
            { k: "anio", l: "Año" },
          ].map((x) => (
            <TouchableOpacity key={x.k} style={[styles.filtro, gran === x.k && styles.filtroActive]} onPress={() => setGran(x.k as any)}>
              <Text style={[styles.filtroText, gran === x.k && styles.filtroTextActive]}>{x.l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      <View style={styles.presets}>
        {[
          { d: 6, l: "7d" },
          { d: 29, l: "30d" },
          { d: 89, l: "90d" },
        ].map((p) => (
          <TouchableOpacity
            key={p.d}
            style={styles.presetBtn}
            onPress={() => {
              const d = new Date(Date.now() - p.d * 86400000).toISOString().slice(0, 10);
              const h = new Date().toISOString().slice(0, 10);
              setDesde(d);
              setHasta(h);
            }}
          >
            <Text style={styles.presetText}>{p.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.kpiGrid}>
        {kpis.map((k) => (
          <View key={k.l} style={[styles.kpi, { borderLeftColor: k.c, borderLeftWidth: 4 }]}>
            <Text style={[styles.kpiLabel, { color: k.c }]}>{k.l}</Text>
            <Text style={styles.kpiVal}>{k.v}</Text>
            <Text style={styles.kpiSub}>{k.sub}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.tabs}>
          {[
            { k: "ingresos", l: "Ganancias", c: "#6f42c1" },
            { k: "ordenes", l: "Pedidos", c: "#0d6efd" },
            { k: "unidades", l: "Unidades", c: "#e73737" },
          ].map((t) => (
            <TouchableOpacity key={t.k} style={[styles.tab, tab === t.k && { backgroundColor: t.c }]} onPress={() => setTab(t.k as any)}>
              <Text style={[styles.tabText, tab === t.k && { color: "#fff" }]}>{t.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.bars}>
          {(data.serie || [])
            .filter((s: any) => (tab === "ingresos" ? s.ingresos : tab === "ordenes" ? s.pedidos : s.unidades) > 0)
            .slice(-12)
            .map((s: any, i: number) => {
              const v = tab === "ingresos" ? s.ingresos : tab === "ordenes" ? s.pedidos : s.unidades;
              const max = tab === "ingresos" ? maxIng : tab === "ordenes" ? maxPed : maxUnd;
              const h = Math.max((v / max) * 90, 4);
              const col = tab === "ingresos" ? "#6f42c1" : tab === "ordenes" ? "#0d6efd" : "#e73737";
              return (
                <View key={i} style={styles.barCol}>
                  <View style={[styles.bar, { height: h, backgroundColor: col }]} />
                  <Text style={styles.barLabel}>{String(s.dia).slice(5)}</Text>
                </View>
              );
            })}
        </View>
        <View style={styles.legend}>
          <Text style={styles.legendText}>Ingresos: ${Number(data.totalIngresos).toLocaleString("es-CO")} · Pedidos: {data.totalOrdenes} · Unidades: {data.totalUnidades}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Más vendidos</Text>
        {(data.masVendidos || []).length === 0 ? (
          <Text style={styles.vacio}>Sin ventas en el rango</Text>
        ) : (
          data.masVendidos.map((p: any, i: number) => (
            <View key={p.ID} style={styles.prodRow}>
              <Text style={styles.rank}>{i + 1}</Text>
              <Image source={{ uri: resolverImagen(p.IMAGEN) || "https://placehold.co/100x100?text=JADDA" }} style={styles.prodImg} />
              <View style={{ flex: 1 }}>
                <Text style={styles.prodNombre} numberOfLines={1}>{p.NOMBRE}</Text>
                <Text style={styles.prodMeta}>{p.unidades} uds · ${Number(p.ingresos).toLocaleString("es-CO")}</Text>
              </View>
              <View style={[styles.stockBadge, { backgroundColor: Number(p.stock) === 0 ? "#fee2e2" : Number(p.stock) <= 10 ? "#fef3c7" : "#dcfce7" }]}>
                <Text style={styles.stockText}>{Number(p.stock) === 0 ? "Agotado" : `${p.stock} uds`}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  container: { padding: 16, backgroundColor: "#f8fafc", flexGrow: 1, paddingBottom: 32 },
  h1: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  sub: { fontSize: 11, color: "#64748b", marginBottom: 12 },
  filtros: { marginBottom: 8 },
  filtro: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  filtroActive: { backgroundColor: "#0f172a", borderColor: "#0f172a" },
  filtroText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  filtroTextActive: { color: "#fff" },
  presets: { flexDirection: "row", gap: 8, marginBottom: 12 },
  presetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e2e8f0" },
  presetText: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  kpi: { flex: 1, minWidth: "46%", backgroundColor: "#fff", borderRadius: 12, padding: 12, elevation: 1 },
  kpiLabel: { fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  kpiVal: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginTop: 4 },
  kpiSub: { fontSize: 10, color: "#64748b" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 14, elevation: 1 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: "#f1f5f9", alignItems: "center" },
  tabText: { fontSize: 11, fontWeight: "800", color: "#334155" },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 120, paddingTop: 8 },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  bar: { width: "100%", borderRadius: 6, maxWidth: 24 },
  barLabel: { fontSize: 8, color: "#64748b" },
  legend: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#f1f5f9" },
  legendText: { fontSize: 10, color: "#64748b", textAlign: "center" },
  cardTitle: { fontSize: 15, fontWeight: "800", color: "#0f172a", marginBottom: 10 },
  prodRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f8fafc" },
  rank: { width: 22, height: 22, borderRadius: 6, backgroundColor: "#f1f5f9", textAlign: "center", lineHeight: 22, fontSize: 11, fontWeight: "800", color: "#64748b", overflow: "hidden" },
  prodImg: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#f1f5f9" },
  prodNombre: { fontSize: 12, fontWeight: "700", color: "#0f172a" },
  prodMeta: { fontSize: 11, color: "#64748b" },
  stockBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  stockText: { fontSize: 10, fontWeight: "800" },
  vacio: { color: "#94a3b8", textAlign: "center", paddingVertical: 12 },
});

