import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useState, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { volverAtras } from "../../../utils/navegacion";
import { Ionicons } from "@expo/vector-icons";
import api, { resolverImagen } from "../../../constants/api";
import BackButton from "../../../components/BackButton";
import { numeroPedido } from "../../../utils/numeroPedido";

interface Solicitud {
  ID_DEVOLUCION: number;
  ID_VENTA: number;
  CANTIDAD: number;
  MOTIVO: string | null;
  DESCRIPCION: string | null;
  TIPO: string;
  ESTADO: string;
  OBSERVACION: string | null;
  FECHA_CREACION: string;
  FECHA_PROCESADA: string | null;
  NOMBRE: string;
  IMAGEN: string | null;
  EVIDENCIAS: string | null;
  ID_CHAT?: number | null;
  PARTE_CHAT?: string | null;
}

const BADGES: Record<string, { color: string; texto: string }> = {
  SOLICITADA: { color: "#f59e0b", texto: "EN REVISIÓN" },
  MAS_PRUEBAS: { color: "#0891b2", texto: "PIDE MÁS PRUEBAS" },
  ESCALADA: { color: "#7c3aed", texto: "EN DECISIÓN DE JADDA" },
  APROBADA: { color: "#22c55e", texto: "APROBADA" },
  RECHAZADA: { color: "#ef4444", texto: "RECHAZADA" },
};

const fmtFecha = (f: string) =>
  new Date(f).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });

export default function DevolucionEstado() {
  const { idVenta } = useLocalSearchParams<{ idVenta: string }>();
  const [venta, setVenta] = useState<any>(null);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [escalarEnCurso, setEscalarEnCurso] = useState(false);

  const cargar = async () => {
    try {
      const [v, d] = await Promise.all([
        api.get(`/api/compras/${idVenta}`),
        api.get("/api/devoluciones"),
      ]);
      setVenta(v.data);
      setSolicitudes((d.data || []).filter((x: any) => String(x.ID_VENTA) === String(idVenta)));
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, [idVenta]);

  const llevarSoporte = (s: Solicitud) => {
    if (!s.ID_CHAT) return;
    Alert.alert(
      "¿Llevarlo con soporte de JADDA?",
      "El equipo JADDA revisará las evidencias y decidirá el resultado. Se abrirá un chat contigo y otro con el vendedor.",
      [
        { text: "Volver", style: "cancel" },
        {
          text: "Sí, enviar",
          style: "destructive",
          onPress: async () => {
            try {
              setEscalarEnCurso(true);
              const res = await api.post(`/api/chat/${s.ID_CHAT}/escalar`);
              Alert.alert(res.data?.ok ? "Enviado a soporte" : "No se pudo escalar", res.data?.msg || "");
              if (res.data?.ok) cargar();
            } catch (err: any) {
              Alert.alert("No se pudo escalar", err.response?.data?.msg || "Intenta de nuevo");
            } finally {
              setEscalarEnCurso(false);
            }
          },
        },
      ]
    );
  };

  const abrirChat = (s: Solicitud) => {
    if (!s.ID_CHAT) return;
    // Las rutas tipadas se regeneran con `expo start`; cast mientras tanto
    router.push((`/chat/${s.ID_CHAT}`) as any);
  };

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#e63946" />
      </View>
    );
  }

  if (error || !venta) {
    return (
      <View style={[styles.contenedor, styles.centro]}>
        <BackButton onPress={() => router.replace("/(tabs)/perfil")} />
        <Ionicons name="alert-circle-outline" size={44} color="#94a3b8" />
        <Text style={styles.vacioTitulo}>No pudimos cargar tus solicitudes</Text>
        <Text style={styles.vacioSub}>Verifica tu sesión e intenta de nuevo.</Text>
        <TouchableOpacity style={styles.btnPrimario} onPress={() => router.replace("/(tabs)/perfil")}>
          <Text style={styles.btnPrimarioTexto}>Volver al perfil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.header}>
        <BackButton onPress={() => volverAtras()} />
        <Text style={styles.headerTitulo} numberOfLines={1}>
          Devolución · Pedido {numeroPedido(Number(idVenta))}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Text style={styles.heroFecha}>
            Comprado el {fmtFecha(venta.FECHA_VENTA)}
            {venta.METODO_PAGO ? ` · ${venta.METODO_PAGO}` : ""}
          </Text>
          <Text style={styles.heroTotal}>${Number(venta.TOTAL).toLocaleString("es-CO")}</Text>
        </View>

        {solicitudes.length === 0 && (
          <View style={styles.tarjetaVacia}>
            <Ionicons name="file-tray-outline" size={36} color="#cbd5e1" />
            <Text style={styles.vacioTitulo}>Este pedido no tiene solicitudes</Text>
          </View>
        )}

        {solicitudes.map((s) => {
          const badge = BADGES[s.ESTADO] || BADGES.SOLICITADA;
          const evidencias = s.EVIDENCIAS ? s.EVIDENCIAS.split("|").filter(Boolean) : [];
          const escalada = s.PARTE_CHAT != null;
          const pasos =
            s.ESTADO === "APROBADA"
              ? [["Solicitud recibida", true], ["Revisión", true], ["Aprobada", true]]
              : s.ESTADO === "RECHAZADA"
                ? [["Solicitud recibida", true], ["Revisión", false], ["Aprobada", false]]
                : s.ESTADO === "ESCALADA"
                  ? [["Solicitud recibida", true], ["Acuerdo con vendedor", false], ["Decisión JADDA", true]]
                  : [["Solicitud recibida", true], ["Revisión", true], ["Aprobada", false]];

          return (
            <View key={s.ID_DEVOLUCION} style={styles.tarjeta}>
              <View style={styles.tarjetaHead}>
                <Image
                  source={{ uri: resolverImagen(s.IMAGEN) }}
                  style={styles.prodImg}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.prodNombre} numberOfLines={2}>{s.NOMBRE}</Text>
                  <Text style={styles.prodMeta}>x{s.CANTIDAD} · {fmtFecha(s.FECHA_CREACION)}</Text>
                </View>
              </View>

              <View style={styles.badgesFila}>
                <View style={[styles.chip, { backgroundColor: "#fee2e2" }]}>
                  <Text style={[styles.chipTexto, { color: "#b91c1c" }]}>{s.TIPO}</Text>
                </View>
                <View style={[styles.chip, { backgroundColor: badge.color }]}>
                  <Text style={[styles.chipTexto, { color: "#fff" }]}>{badge.texto}</Text>
                </View>
              </View>

              {/* Timeline */}
              <View style={styles.timeline}>
                {pasos.map(([etiqueta, hecho]: any, i: number) => (
                  <View key={i} style={styles.pasoFila}>
                    <View style={[styles.pasoCirculo, hecho ? styles.pasoHecho : styles.pasoPend]}>
                      <Text style={styles.pasoNum}>{hecho ? "✓" : i + 1}</Text>
                    </View>
                    <Text style={[styles.pasoTexto, !hecho && styles.pasoTextoPend]}>{etiqueta}</Text>
                  </View>
                ))}
              </View>

              {s.MOTIVO ? <Text style={styles.textoBloque}><Text style={styles.textoLabel}>Motivo: </Text>{s.MOTIVO}</Text> : null}
              {s.DESCRIPCION ? <Text style={styles.textoBloque}><Text style={styles.textoLabel}>Descripción: </Text>{s.DESCRIPCION}</Text> : null}
              {s.OBSERVACION ? (
                <View style={styles.observacion}>
                  <Text style={styles.obsTitulo}>Respuesta del equipo:</Text>
                  <Text style={styles.obsTexto}>{s.OBSERVACION}</Text>
                </View>
              ) : null}

              {evidencias.length > 0 && (
                <>
                  <Text style={styles.textoLabel}>Evidencias ({evidencias.length})</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                    {evidencias.map((ruta, i) => (
                      <Image key={i} source={{ uri: resolverImagen(ruta) }} style={styles.evidImg} />
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Acciones */}
              {s.ID_CHAT && s.ESTADO === "RECHAZADA" && !escalada && (
                <TouchableOpacity
                  style={[styles.btnAccion, { backgroundColor: "#7c3aed", marginTop: 12 }]}
                  disabled={escalarEnCurso}
                  onPress={() => llevarSoporte(s)}
                >
                  {escalarEnCurso ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="scale-outline" size={16} color="#fff" />
                      <Text style={styles.btnAccionTexto}>Llevarlo con soporte de JADDA</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}

              {s.ID_CHAT && (
                <TouchableOpacity style={styles.btnChat} onPress={() => abrirChat(s)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color="#002244" />
                  <Text style={styles.btnChatTexto}>
                    {escalada
                      ? "Tu conversación con el soporte JADDA"
                      : ["APROBADA", "RECHAZADA"].includes(s.ESTADO)
                        ? "Ver la conversación"
                        : "Abrir chat de la solicitud"}
                  </Text>
                  <Ionicons name="chevron-forward" size={15} color="#002244" />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const ESTILO_COMUN_BORDE = { borderWidth: 1, borderColor: "#e8edf3" };

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#f5f7fa", paddingTop: 44 },
  centro: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
  },
  headerTitulo: { fontSize: 15, fontWeight: "800", color: "#0f172a", flex: 1 },
  hero: {
    backgroundColor: "#002244",
    marginHorizontal: 14,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroFecha: { color: "#cbd5e1", fontSize: 11, flex: 1, marginRight: 8 },
  heroTotal: { color: "#fff", fontWeight: "800", fontSize: 16 },
  tarjetaVacia: { alignItems: "center", padding: 30, gap: 8 },
  vacioTitulo: { fontWeight: "700", color: "#334155", textAlign: "center" },
  vacioSub: { fontSize: 12, color: "#94a3b8", textAlign: "center" },
  btnPrimario: { backgroundColor: "#e63946", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9, marginTop: 10 },
  btnPrimarioTexto: { color: "#fff", fontWeight: "800", fontSize: 13 },
  tarjeta: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 14,
    marginTop: 12,
    ...ESTILO_COMUN_BORDE,
  },
  tarjetaHead: { flexDirection: "row", gap: 10, alignItems: "center" },
  prodImg: { width: 48, height: 48, borderRadius: 10, backgroundColor: "#f1f5f9" },
  prodNombre: { fontWeight: "800", color: "#0f172a", fontSize: 13 },
  prodMeta: { fontSize: 11, color: "#64748b", marginTop: 2 },
  badgesFila: { flexDirection: "row", gap: 6, marginTop: 10, flexWrap: "wrap" },
  chip: { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  chipTexto: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.4 },
  timeline: { marginTop: 12, gap: 7 },
  pasoFila: { flexDirection: "row", alignItems: "center", gap: 9 },
  pasoCirculo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  pasoHecho: { backgroundColor: "#22c55e" },
  pasoPend: { backgroundColor: "#e2e8f0" },
  pasoNum: { color: "#fff", fontSize: 11, fontWeight: "800" },
  pasoTexto: { fontSize: 12, color: "#334155", fontWeight: "600" },
  pasoTextoPend: { color: "#94a3b8" },
  textoBloque: { fontSize: 12, color: "#334155", marginTop: 10, lineHeight: 17 },
  textoLabel: { fontWeight: "800", color: "#0f172a" },
  observacion: {
    backgroundColor: "#fef9c3",
    borderColor: "#fde047",
    borderWidth: 1,
    borderRadius: 9,
    padding: 9,
    marginTop: 10,
  },
  obsTitulo: { fontWeight: "800", fontSize: 11, color: "#854d0e" },
  obsTexto: { fontSize: 12, color: "#713f12", marginTop: 2 },
  evidImg: { width: 74, height: 74, borderRadius: 9, marginRight: 8, backgroundColor: "#f1f5f9" },
  btnAccion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderRadius: 11,
    paddingVertical: 11,
    marginTop: 10,
  },
  btnAccionTexto: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
  btnChat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 12,
    marginTop: 8,
    backgroundColor: "#eff6ff",
  },
  btnChatTexto: { color: "#002244", fontWeight: "800", fontSize: 12.5, flex: 1 },
});
