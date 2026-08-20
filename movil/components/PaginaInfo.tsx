import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { volverAtras } from "../utils/navegacion";

interface Seccion {
  titulo?: string;
  parrafos?: string[];
  items?: string[];
  extra?: string;
}

interface Props {
  titulo: string;
  subtitulo?: string;
  secciones: Seccion[];
}

export default function PaginaInfo({ titulo, subtitulo, secciones }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <TouchableOpacity style={[styles.back, { paddingTop: insets.top + 14 }]} onPress={volverAtras}>
        <Ionicons name="arrow-back" size={20} color="#111" />
        <Text style={styles.backText}> Volver</Text>
      </TouchableOpacity>

      <Text style={styles.titulo}>{titulo}</Text>
      {subtitulo ? <Text style={styles.subtitulo}>{subtitulo}</Text> : null}

      {secciones.map((s, i) => (
        <View key={i} style={styles.card}>
          {s.titulo ? <Text style={styles.seccionTitulo}>{s.titulo}</Text> : null}
          {s.parrafos?.map((p, j) => (
            <Text key={j} style={styles.parrafo}>{p}</Text>
          ))}
          {s.items?.map((item, k) => (
            <View key={k} style={styles.itemRow}>
              <Ionicons name="ellipse" size={7} color="#e73737" />
              <Text style={styles.item}>{item}</Text>
            </View>
          ))}
          {s.extra ? <Text style={styles.parrafo}>{s.extra}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f5f7",
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  backText: {
    color: "#111",
    fontWeight: "600",
  },
  titulo: {
    color: "#002244",
    fontWeight: "bold",
    fontSize: 24,
    textAlign: "center",
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  subtitulo: {
    color: "#6c757d",
    fontSize: 13,
    textAlign: "center",
    marginBottom: 18,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    elevation: 1,
  },
  seccionTitulo: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 15,
    marginBottom: 8,
  },
  parrafo: {
    color: "#555",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  item: {
    color: "#555",
    fontSize: 13,
    lineHeight: 19,
    flex: 1,
  },
});
