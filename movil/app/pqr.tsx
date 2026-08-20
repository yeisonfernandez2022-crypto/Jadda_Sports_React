import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { volverAtras } from "../utils/navegacion";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import api from "../constants/api";

const TIPOS = ["Petición", "Queja", "Reclamo", "Sugerencia"];

export default function Pqr() {
  const insets = useSafeAreaInsets();
  const { estaLogueado, cargando } = useAuth();
  const [tipo, setTipo] = useState("");
  const [tipoOpen, setTipoOpen] = useState(false);
  const [asunto, setAsunto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    if (!cargando && !estaLogueado) {
      router.replace("/login");
    }
  }, [cargando, estaLogueado]);

  async function enviar() {
    try {
      if (!tipo || !asunto.trim() || !descripcion.trim()) {
        Alert.alert("ERROR", "Tipo, asunto y descripción son obligatorios.");
        return;
      }
      setEnviando(true);
      const res = await api.post("/api/pqr", {
        tipo,
        asunto: asunto.trim(),
        descripcion: descripcion.trim(),
        numeroPedido: numeroPedido.trim() || null,
      });
      if (res.data?.ok) {
        setExito(true);
      } else {
        Alert.alert("ERROR", "Error al enviar. Intenta de nuevo.");
      }
    } catch (e: any) {
      Alert.alert("ERROR", e?.response?.data?.error || "Error al enviar. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando) {
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

  if (exito) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.exitoIco}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>
          <Text style={styles.exitoTitle}>¡PQR enviada con éxito!</Text>
          <Text style={styles.exitoSub}>Te responderemos a la brevedad.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.buttonText}>VOLVER AL INICIO</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={[styles.back, { paddingTop: insets.top + 14 }]} onPress={volverAtras}>
        <Ionicons name="arrow-back" size={20} color="#111" />
        <Text style={styles.backText}> Volver</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Ionicons name="warning" size={36} color="#e73737" />
        <Text style={styles.title}>PQR</Text>
        <Text style={styles.subtitle}>Peticiones, Quejas, Reclamos y Sugerencias</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Tipo *</Text>
        <TouchableOpacity style={styles.select} onPress={() => setTipoOpen(!tipoOpen)}>
          <Text style={tipo ? styles.selectText : styles.selectPlaceholder}>
            {tipo || "Selecciona un tipo"}
          </Text>
          <Ionicons name={tipoOpen ? "chevron-up" : "chevron-down"} size={16} color="#888" />
        </TouchableOpacity>
        {tipoOpen && (
          <View style={styles.options}>
            {TIPOS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.option, tipo === t && styles.optionActive]}
                onPress={() => {
                  setTipo(t);
                  setTipoOpen(false);
                }}
              >
                <Text style={[styles.optionText, tipo === t && styles.optionTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Asunto *</Text>
        <TextInput style={styles.input} placeholder="Asunto" value={asunto} onChangeText={setAsunto} />

        <Text style={styles.label}>Descripción *</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Describe tu solicitud..."
          value={descripcion}
          onChangeText={setDescripcion}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <Text style={styles.label}>Número de pedido (opcional)</Text>
        <TextInput style={styles.input} placeholder="#123" value={numeroPedido} onChangeText={setNumeroPedido} />

        <TouchableOpacity style={styles.button} onPress={enviar} disabled={enviando}>
          <Text style={styles.buttonText}>{enviando ? "ENVIANDO..." : "ENVIAR PQR"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
    backgroundColor: "#f4f5f7",
  },
  container: {
    flex: 1,
    backgroundColor: "#f4f5f7",
  },
  content: {
    paddingBottom: 50,
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
  header: {
    alignItems: "center",
    marginTop: 10,
    marginBottom: 18,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#111",
    marginTop: 6,
  },
  subtitle: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    elevation: 2,
  },
  label: {
    color: "#555",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
  },
  textarea: {
    minHeight: 110,
  },
  select: {
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 13,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectText: {
    color: "#111",
    fontSize: 14,
  },
  selectPlaceholder: {
    color: "#9ca3af",
    fontSize: 14,
  },
  options: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    marginTop: 6,
    overflow: "hidden",
  },
  option: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  optionActive: {
    backgroundColor: "#fdeaea",
  },
  optionText: {
    color: "#333",
  },
  optionTextActive: {
    color: "#e73737",
    fontWeight: "bold",
  },
  button: {
    backgroundColor: "#e73737",
    padding: 15,
    borderRadius: 12,
    marginTop: 20,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 15,
  },
  exitoIco: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
  },
  exitoTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 16,
  },
  exitoSub: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 8,
    marginBottom: 20,
  },
});
