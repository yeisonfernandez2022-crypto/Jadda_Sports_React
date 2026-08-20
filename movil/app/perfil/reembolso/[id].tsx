import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { useState, useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { volverAtras } from "../../../utils/navegacion";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useAuth } from "../../../context/AuthContext";
import api, { resolverImagen, API_URL } from "../../../constants/api";
import BackButton from "../../../components/BackButton";
import { numeroPedido } from "../../../utils/numeroPedido";

interface Reembolso {
  ID_DEVOLUCION: number;
  ID_PRODUCTO: number;
  CANTIDAD: number;
  MOTIVO: string;
  ESTADO: string;
  FECHA_CREACION: string;
  NOMBRE: string;
  IMAGEN: string;
  PRECIO_UNITARIO: number;
}

interface Data {
  ID_VENTA: number;
  FECHA_VENTA: string;
  TOTAL: number;
  ESTADO: string;
  REFERENCIA_PAGO: string;
  METODO_PAGO?: string;
  totalReembolso: number;
  reembolsos: Reembolso[];
}

const BADGES: Record<string, { color: string; texto: string }> = {
  SOLICITADA: { color: "#f59e0b", texto: "EN REVISIÓN" },
  APROBADA: { color: "#22c55e", texto: "APROBADO" },
  RECHAZADA: { color: "#ef4444", texto: "RECHAZADO" },
};

export default function ReembolsoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { estaLogueado, cargando } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!estaLogueado) {
      router.replace("/login");
      return;
    }
    if (!id) return;
    api
      .get(`/api/compras/${id}/reembolso`)
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, estaLogueado]);

  async function descargarFactura() {
    try {
      const res = await fetch(API_URL + `/api/compras/${id}/factura`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("fallo");
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const uri = FileSystem.documentDirectory + `factura-${id}.pdf`;
      await FileSystem.writeAsStringAsync(uri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
      } else {
        Alert.alert("FACTURA LISTA", `Guardada en: ${uri}`);
      }
    } catch {
      Alert.alert("ERROR", "No se pudo descargar la factura.");
    }
  }

  if (cargando || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e73737" />
      </View>
    );
  }

  if (!data || data.reembolsos.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="wallet-outline" size={60} color="#ccc" />
        <Text style={styles.vacio}>No hay reembolsos para este pedido</Text>
        <TouchableOpacity style={styles.button} onPress={volverAtras}>
          <Text style={styles.buttonText}>VOLVER</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const estado = data.reembolsos[0]?.ESTADO || "SOLICITADA";
  const badge = BADGES[estado] || { color: "#888", texto: estado };
  const fechaEstimada = data.reembolsos[0]?.FECHA_CREACION
    ? new Date(new Date(data.reembolsos[0].FECHA_CREACION).getTime() + 7 * 86400000)
    : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton />

      <View style={styles.card}>
        <View style={styles.topRow}>
          <Text style={styles.title}>Reembolso del pedido {numeroPedido(data.ID_VENTA)}</Text>
          <View style={[styles.badge, { backgroundColor: badge.color }]}>
            <Text style={styles.badgeText}>{badge.texto}</Text>
          </View>
        </View>

        <Text style={styles.monto}>${data.totalReembolso.toLocaleString("es-CO")}</Text>
        <Text style={styles.montoLabel}>monto a devolver</Text>

        {estado === "SOLICITADA" && fechaEstimada && (
          <View style={styles.aviso7}>
            <Ionicons name="time" size={16} color="#f59e0b" />
            <Text style={styles.aviso7Text}>
              {" "}Tu reembolso se hará efectivo en un máximo de 7 días. Fecha estimada:{" "}
              {fechaEstimada.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" })}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progreso</Text>
        <View style={styles.timeline}>
          {[
            { t: "Solicitud recibida", on: true },
            { t: "En revisión", on: estado !== "SOLICITADA" },
            { t: "Reembolsado", on: estado === "APROBADA" },
          ].map((paso, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={[styles.timelineDot, paso.on && styles.timelineDotOn]}>
                {paso.on && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
              <Text style={[styles.timelineText, paso.on && styles.timelineTextOn]}>{paso.t}</Text>
              {i < 2 && <View style={styles.timelineLine} />}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Información del pedido</Text>
        {data.METODO_PAGO && <Text style={styles.info}>Método: {data.METODO_PAGO}</Text>}
        {data.REFERENCIA_PAGO && <Text style={styles.info}>Referencia: {data.REFERENCIA_PAGO}</Text>}
        <Text style={styles.info}>Fecha: {new Date(data.FECHA_VENTA).toLocaleDateString("es-CO")}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Productos del reembolso</Text>
        {data.reembolsos.map((r) => (
          <View key={r.ID_DEVOLUCION} style={styles.prod}>
            <Image source={{ uri: resolverImagen(r.IMAGEN) || undefined }} style={styles.prodImg} />
            <View style={styles.prodInfo}>
              <Text numberOfLines={2} style={styles.prodNombre}>{r.NOMBRE}</Text>
              <Text style={styles.prodMotivo}>{r.MOTIVO}</Text>
              <Text style={styles.prodCant}>x{r.CANTIDAD}</Text>
            </View>
            <Text style={styles.prodSubtotal}>
              ${(Number(r.PRECIO_UNITARIO) * Number(r.CANTIDAD)).toLocaleString("es-CO")}
            </Text>
          </View>
        ))}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total a reembolsar</Text>
          <Text style={styles.totalValue}>${data.totalReembolso.toLocaleString("es-CO")}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.facturaBtn} onPress={descargarFactura}>
        <Ionicons name="document-text" size={18} color="#fff" />
        <Text style={styles.facturaText}> Factura PDF</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
    backgroundColor: "#f5f5f5",
  },
  container: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    flexGrow: 1,
    paddingBottom: 40,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  backText: {
    color: "#111",
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#111",
    flex: 1,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  monto: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#e73737",
    marginTop: 14,
  },
  montoLabel: {
    color: "#888",
    fontSize: 12,
  },
  aviso7: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    padding: 10,
    marginTop: 14,
  },
  aviso7Text: {
    color: "#92400e",
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#111",
    marginBottom: 12,
  },
  timeline: {
    marginTop: 4,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  timelineDotOn: {
    backgroundColor: "#22c55e",
    borderColor: "#22c55e",
  },
  timelineText: {
    color: "#999",
    fontSize: 13,
    marginLeft: 10,
  },
  timelineTextOn: {
    color: "#111",
    fontWeight: "600",
  },
  timelineLine: {
    width: 2,
    height: 18,
    backgroundColor: "#ddd",
    marginLeft: 10,
  },
  info: {
    color: "#555",
    fontSize: 13,
    marginBottom: 6,
  },
  prod: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  prodImg: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  prodInfo: {
    flex: 1,
    marginLeft: 10,
  },
  prodNombre: {
    fontWeight: "600",
    fontSize: 13,
    color: "#111",
  },
  prodMotivo: {
    color: "#888",
    fontSize: 11,
    marginTop: 2,
  },
  prodCant: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 12,
    marginTop: 2,
  },
  prodSubtotal: {
    fontWeight: "bold",
    fontSize: 13,
    color: "#111",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 12,
  },
  totalLabel: {
    fontWeight: "bold",
    color: "#111",
  },
  totalValue: {
    fontWeight: "bold",
    color: "#e73737",
    fontSize: 16,
  },
  facturaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#002244",
    padding: 14,
    borderRadius: 10,
  },
  facturaText: {
    color: "#fff",
    fontWeight: "bold",
  },
  vacio: {
    color: "#888",
    fontSize: 16,
    marginVertical: 16,
  },
  button: {
    backgroundColor: "#e73737",
    padding: 15,
    borderRadius: 10,
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
});
