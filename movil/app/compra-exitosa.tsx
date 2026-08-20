import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import BackButton from "../components/BackButton";

export default function CompraExitosa() {
  const { ventaId, referencia, total } = useLocalSearchParams<{
    ventaId?: string;
    referencia?: string;
    total?: string;
  }>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <BackButton texto="Volver al catálogo" onPress={() => router.replace("/(tabs)/catalogo")} />

      <View style={styles.iconCircle}>
        <Ionicons name="checkmark" size={50} color="#fff" />
      </View>

      <Text style={styles.title}>¡COMPRA EXITOSA!</Text>
      <Text style={styles.subtitle}>
        ¡Gracias por tu compra! Tu pedido ha sido registrado correctamente.
      </Text>

      <View style={styles.card}>
        {ventaId ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Pedido N°</Text>
            <Text style={styles.rowValue}>#{ventaId}</Text>
          </View>
        ) : null}
        {referencia ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Referencia</Text>
            <Text style={styles.rowValue}>{referencia}</Text>
          </View>
        ) : null}
        {total ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Total</Text>
            <Text style={[styles.rowValue, { color: "#e73737" }]}>
              ${Number(total).toLocaleString("es-CO")}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.nota}>
        Te enviamos un correo con los detalles de tu compra y la factura. Recibirás
        tu pedido en la dirección que registraste.
      </Text>

      <TouchableOpacity style={styles.btnOscuro} onPress={() => router.replace("/(tabs)")}>
        <Text style={styles.btnOscuroText}>SEGUIR COMPRANDO</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btnOutline} onPress={() => router.replace("/(tabs)/perfil")}>
        <Text style={styles.btnOutlineText}>VER MI PERFIL</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    padding: 25,
    alignItems: "center",
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "#22c55e",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    marginBottom: 25,
  },
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 18,
    marginBottom: 20,
    elevation: 3,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  rowLabel: {
    color: "#666",
    fontSize: 15,
  },
  rowValue: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#111",
  },
  nota: {
    color: "#777",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 20,
  },
  btnOscuro: {
    width: "100%",
    backgroundColor: "#002244",
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
  },
  btnOscuroText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  btnOutline: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#002244",
    padding: 16,
    borderRadius: 10,
  },
  btnOutlineText: {
    color: "#002244",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
});
