import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "../context/AuthContext";

export default function TarjetaRetos() {
  const { estaLogueado } = useAuth();

  const irRetos = () => {
    if (!estaLogueado) {
      router.push("/login");
      return;
    }
    router.push("/(tabs)/perfil");
  };

  return (
    <TouchableOpacity style={[styles.card, styles.retosCard]} onPress={irRetos}>
      <View style={[styles.ico, styles.icoRetos]}>
        <Ionicons name="trophy" size={22} color="#fff" />
      </View>
      <View style={styles.copia}>
        <Text style={styles.titulo}>Retos con los mejores descuentos</Text>
        <Text style={styles.texto}>
          Completa retos deportivos y desbloquea descuentos exclusivos en toda la tienda.
        </Text>
      </View>
      <Text style={styles.cta}>Ver retos</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 3,
  },
  retosCard: {
    borderLeftWidth: 5,
    borderLeftColor: "#e73737",
  },
  ico: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#e73737",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  icoRetos: {
    backgroundColor: "#002244",
  },
  copia: {
    flex: 1,
  },
  titulo: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#111",
  },
  texto: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  cta: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 12,
    marginTop: 8,
  },
});
