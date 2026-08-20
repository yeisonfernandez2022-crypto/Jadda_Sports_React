import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useAuth } from "../../context/AuthContext";
import api, { resolverImagen, API_URL } from "../../constants/api";
import BackButton from "../../components/BackButton";
import { numeroPedido } from "../../utils/numeroPedido";

interface ProductoCompra {
  ID: number;
  NOMBRE: string;
  CANTIDAD: number;
  PRECIO_UNITARIO: number;
  SUBTOTAL: number;
  IMAGEN: string;
  COLOR?: string | null;
  NOMBRE_ATRIBUTO?: string | null;
  ATRIBUTO?: string | null;
}

interface Compra {
  ID_VENTA: number;
  FECHA_VENTA: string;
  TOTAL: number;
  ESTADO: string;
  REFERENCIA_PAGO: string;
  METODO_PAGO?: string;
  ESTADO_ENVIO?: string;
  DIRECCION_ENVIO?: string;
  CIUDAD?: string;
  DEPARTAMENTO?: string;
  REEMBOLSO_ESTADOS?: string | null;
  productos: ProductoCompra[];
}

const ESTADOS: Record<string, { color: string; texto: string }> = {
  PENDIENTE: { color: "#f59e0b", texto: "PENDIENTE" },
  COMPLETADA: { color: "#22c55e", texto: "COMPLETADA" },
  CANCELADA: { color: "#ef4444", texto: "CANCELADA" },
  CONFIRMADA: { color: "#3b82f6", texto: "CONFIRMADA" },
};

const ESTADOS_ENVIO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  POR_EMPAQUETAR: "Por empaquetar",
  EMPACADO: "Empacado",
  EN_CAMINO: "En camino",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

export default function MisCompras() {
  const { estaLogueado, cargando } = useAuth();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [devolucion, setDevolucion] = useState<{
    compra: Compra;
    prod: ProductoCompra;
    cantidad: string;
    motivo: string;
  } | null>(null);
  const [enviandoDev, setEnviandoDev] = useState(false);

  const cargar = useCallback(() => {
    api
      .get("/api/compras")
      .then((res) => setCompras(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!estaLogueado) {
      router.replace("/login");
      return;
    }
    cargar();
  }, [estaLogueado, cargar]);

  async function descargarFactura(id: number) {
    try {
      Alert.alert("Descargando factura", "Preparando tu factura en PDF...");
      const res = await fetch(API_URL + `/api/compras/${id}/factura`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("fallo");
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const data = String(reader.result || "");
          resolve(data.split(",")[1] || "");
        };
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

  function cancelar(compra: Compra) {
    Alert.alert(
      "Cancelar pedido",
      `¿Seguro que quieres cancelar el pedido ${numeroPedido(compra.ID_VENTA)}? El stock será liberado.`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, cancelar",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.post(`/api/compras/${compra.ID_VENTA}/cancelar`);
              if (res.data.ok) {
                Alert.alert("PEDIDO CANCELADO", "Tu pedido fue cancelado y el stock liberado.");
                cargar();
              } else {
                Alert.alert("NO SE PUDO CANCELAR", res.data.msg || "Intenta de nuevo.");
              }
            } catch (error: any) {
              Alert.alert(
                "NO SE PUDO CANCELAR",
                error?.response?.data?.msg || "El pedido ya no puede cancelarse."
              );
            }
          },
        },
      ]
    );
  }

  function solicitarReembolso(compra: Compra) {
    Alert.alert(
      "Solicitar reembolso",
      `Se reembolsará $${compra.TOTAL.toLocaleString("es-CO")} en un máximo de 7 días al método de pago con el que compraste. ¿Deseas continuar?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Sí, solicitar",
          onPress: async () => {
            try {
              const res = await api.post(`/api/compras/${compra.ID_VENTA}/reembolso`);
              if (res.data.ok) {
                Alert.alert("REEMBOLSO SOLICITADO", "Tu reembolso fue solicitado correctamente.", [
                  { text: "Ver mi reembolso", onPress: () => router.push(`/perfil/reembolso/${compra.ID_VENTA}`) },
                  { text: "Cerrar" },
                ]);
                cargar();
              } else {
                Alert.alert("ERROR", res.data.msg || "No se pudo solicitar.");
              }
            } catch (error: any) {
              Alert.alert("ERROR", error?.response?.data?.msg || "No se pudo solicitar el reembolso.");
            }
          },
        },
      ]
    );
  }

  function devolverProducto(compra: Compra, prod: ProductoCompra) {
    setDevolucion({ compra, prod, cantidad: "1", motivo: "" });
  }

  async function enviarDevolucion() {
    if (!devolucion) return;
    const { compra, prod, cantidad, motivo } = devolucion;
    const cant = Math.max(1, Math.min(Number(cantidad) || 1, prod.CANTIDAD));
    setEnviandoDev(true);
    try {
      const res = await api.post("/api/devoluciones", {
        id_venta: compra.ID_VENTA,
        id_producto: prod.ID,
        cantidad: cant,
        motivo: motivo.trim() || "Devolución",
      });
      if (res.data.ok) {
        Alert.alert("DEVOLUCIÓN SOLICITADA", "Tu devolución quedó en revisión.");
        setDevolucion(null);
        cargar();
      } else {
        Alert.alert("ERROR", res.data.msg || "No se pudo solicitar.");
      }
    } catch (error: any) {
      Alert.alert("ERROR", error?.response?.data?.msg || "No se pudo solicitar.");
    } finally {
      setEnviandoDev(false);
    }
  }

  const tieneReembolso = (c: Compra) => (c.REEMBOLSO_ESTADOS || "").split(",").some((e) => e === "SOLICITADA" || e === "APROBADA" || e === "MAS_PRUEBAS");

  if (cargando || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e73737" />
      </View>
    );
  }

  if (!estaLogueado) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Inicia sesión</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>ENTRAR</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (compras.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cube-outline" size={60} color="#ccc" />
        <Text style={styles.vacio}>Aún no tienes compras</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push("/(tabs)/catalogo")}>
          <Text style={styles.buttonText}>IR AL CATÁLOGO</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton />
      <Text style={styles.title}>Mis Compras</Text>

      {compras.map((c) => {
        const estado = ESTADOS[c.ESTADO] || { color: "#888", texto: c.ESTADO };
        const abierto = expandido === c.ID_VENTA;
        return (
          <View key={c.ID_VENTA} style={styles.card}>
            <TouchableOpacity style={styles.cardHeader} onPress={() => setExpandido(abierto ? null : c.ID_VENTA)}>
              <View style={styles.headerInfo}>
                <Text style={styles.ventaId}>Pedido {numeroPedido(c.ID_VENTA)}</Text>
                <Text style={styles.fecha}>
                  {new Date(c.FECHA_VENTA).toLocaleDateString("es-CO")} · {c.productos.length} artículos
                </Text>
                <View style={styles.badges}>
                  <View style={[styles.badge, { backgroundColor: estado.color }]}>
                    <Text style={styles.badgeText}>{estado.texto}</Text>
                  </View>
                  {c.ESTADO_ENVIO && (
                    <View style={[styles.badge, { backgroundColor: "#002244" }]}>
                      <Text style={styles.badgeText}>{ESTADOS_ENVIO[c.ESTADO_ENVIO] || c.ESTADO_ENVIO}</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.totalWrap}>
                <Text style={styles.total}>${c.TOTAL.toLocaleString("es-CO")}</Text>
                <Ionicons name={abierto ? "chevron-up" : "chevron-down"} size={18} color="#888" />
              </View>
            </TouchableOpacity>

            {abierto && (
              <View style={styles.detalle}>
                {c.productos.map((p, i) => (
                  <View key={i} style={styles.producto}>
                    <Image source={{ uri: resolverImagen(p.IMAGEN) || undefined }} style={styles.prodImg} />
                    <View style={styles.prodInfo}>
                      <Text numberOfLines={2} style={styles.prodNombre}>{p.NOMBRE}</Text>
                      {p.COLOR && <Text style={styles.prodVariante}>Color: {p.COLOR}</Text>}
                      {p.NOMBRE_ATRIBUTO && p.ATRIBUTO && (
                        <Text style={styles.prodVariante}>{p.NOMBRE_ATRIBUTO}: {p.ATRIBUTO}</Text>
                      )}
                      <Text style={styles.prodCant}>x{p.CANTIDAD}</Text>
                    </View>
                    <Text style={styles.prodSubtotal}>${Number(p.SUBTOTAL).toLocaleString("es-CO")}</Text>
                  </View>
                ))}

                {c.METODO_PAGO && (
                  <Text style={styles.metodo}>Método de pago: {c.METODO_PAGO}</Text>
                )}
                {c.REFERENCIA_PAGO && (
                  <Text style={styles.metodo}>Referencia: {c.REFERENCIA_PAGO}</Text>
                )}
                {c.DIRECCION_ENVIO && (
                  <Text style={styles.metodo}>
                    Envío: {c.DIRECCION_ENVIO}, {c.CIUDAD} - {c.DEPARTAMENTO}
                  </Text>
                )}

                <View style={styles.acciones}>
                  <TouchableOpacity style={styles.btnPdf} onPress={() => descargarFactura(c.ID_VENTA)}>
                    <Ionicons name="document-text" size={16} color="#fff" />
                    <Text style={styles.btnPdfText}> Factura PDF</Text>
                  </TouchableOpacity>

                  {c.ESTADO === "COMPLETADA" && !tieneReembolso(c) && (
                    <>
                      <TouchableOpacity style={styles.btnDevolver} onPress={() => devolverProducto(c, c.productos[0])}>
                        <Ionicons name="return-down-back" size={16} color="#002244" />
                        <Text style={styles.btnDevolverText}> Devolver</Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {(c.ESTADO === "COMPLETADA" || c.ESTADO === "PENDIENTE") &&
                    (!c.ESTADO_ENVIO || ["PENDIENTE", "POR_EMPAQUETAR", "EMPACADO"].includes(c.ESTADO_ENVIO)) && (
                    <TouchableOpacity style={styles.btnCancelar} onPress={() => cancelar(c)}>
                      <Text style={styles.btnCancelarText}>CANCELAR PEDIDO</Text>
                    </TouchableOpacity>
                  )}

                  {c.ESTADO === "CANCELADA" && !tieneReembolso(c) && (
                    <TouchableOpacity style={styles.btnReembolso} onPress={() => solicitarReembolso(c)}>
                      <Ionicons name="wallet" size={16} color="#fff" />
                      <Text style={styles.btnPdfText}> Solicitar reembolso</Text>
                    </TouchableOpacity>
                  )}

                  {tieneReembolso(c) && (
                    <TouchableOpacity style={styles.btnReembolso} onPress={() => router.push(`/perfil/reembolso/${c.ID_VENTA}`)}>
                      <Ionicons name="wallet" size={16} color="#fff" />
                      <Text style={styles.btnPdfText}> Ver mi reembolso</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        );
      })}
      </ScrollView>

      <Modal
        visible={devolucion !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setDevolucion(null)}
      >
        {devolucion && (
          <View style={styles.modalBackdrop}>
            <View style={styles.modal}>
              <Text style={styles.modalTitle}>Solicitar devolución</Text>
              <Text style={styles.modalProducto}>{devolucion.prod.NOMBRE}</Text>

              <Text style={styles.label}>Cantidad (máx {devolucion.prod.CANTIDAD})</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={devolucion.cantidad}
                onChangeText={(v) => setDevolucion({ ...devolucion, cantidad: v })}
                maxLength={3}
              />

              <Text style={styles.label}>Motivo (máximo 500 caracteres)</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Cuéntanos el motivo..."
                value={devolucion.motivo}
                onChangeText={(v) => setDevolucion({ ...devolucion, motivo: v })}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.button} onPress={enviarDevolucion} disabled={enviandoDev}>
                <Text style={styles.buttonText}>
                  {enviandoDev ? "ENVIANDO..." : "ENVIAR DEVOLUCIÓN"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDevolucion(null)} disabled={enviandoDev}>
                <Text style={styles.cancelText}>CANCELAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>
    </>
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
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 16,
  },
  vacio: {
    color: "#888",
    fontSize: 16,
    marginVertical: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerInfo: {
    flex: 1,
  },
  ventaId: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#111",
  },
  fecha: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  badges: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    flexWrap: "wrap",
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  totalWrap: {
    alignItems: "flex-end",
    gap: 4,
  },
  total: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#e73737",
  },
  detalle: {
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    marginTop: 12,
    paddingTop: 12,
  },
  producto: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
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
  prodVariante: {
    color: "#777",
    fontSize: 11,
    marginTop: 1,
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
  metodo: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
  },
  acciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  btnPdf: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#002244",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  btnPdfText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  btnDevolver: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#002244",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnDevolverText: {
    color: "#002244",
    fontWeight: "bold",
    fontSize: 12,
  },
  btnCancelar: {
    borderWidth: 1,
    borderColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnCancelarText: {
    color: "#ef4444",
    fontWeight: "bold",
    fontSize: 12,
  },
  btnReembolso: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e73737",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
  },
  button: {
    backgroundColor: "#e73737",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    marginBottom: 10,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
  },
  modalProducto: {
    color: "#e73737",
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  textarea: {
    minHeight: 80,
  },
  cancelBtn: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: {
    color: "#888",
    fontWeight: "600",
  },
});
