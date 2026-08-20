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
import { useState } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { volverAtras } from "../utils/navegacion";
import { Ionicons } from "@expo/vector-icons";
import api from "../constants/api";

const ASUNTOS = [
  "Consulta general",
  "Pedidos y envíos",
  "Productos y tallas",
  "Devoluciones y garantías",
  "Sugerencias",
  "Otro",
];

export default function Contacto() {
  const insets = useSafeAreaInsets();
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [asunto, setAsunto] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [asuntoOpen, setAsuntoOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);

  async function enviar() {
    try {
      if (!nombre.trim() || !email.trim() || !asunto || !mensaje.trim()) {
        Alert.alert("ERROR", "Completa todos los campos.");
        return;
      }
      setEnviando(true);
      const res = await api.post("/api/contacto", {
        nombre: nombre.trim(),
        email: email.trim(),
        asunto,
        mensaje: mensaje.trim(),
      });
      if (res.data?.message) {
        setExito(true);
      } else {
        Alert.alert("ERROR", "Error al enviar el mensaje.");
      }
    } catch (e: any) {
      Alert.alert("ERROR", e?.response?.data?.message || "Error al enviar el mensaje.");
    } finally {
      setEnviando(false);
    }
  }

  if (exito) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="checkmark-circle" size={64} color="#10b981" />
          <Text style={styles.exitoTitle}>¡Mensaje enviado!</Text>
          <Text style={styles.exitoSub}>Gracias por contactarnos. Te responderemos pronto.</Text>
          <TouchableOpacity style={styles.button} onPress={volverAtras}>
            <Text style={styles.buttonText}>VOLVER</Text>
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
        <Text style={styles.title}>CONTÁCTANOS</Text>
        <Text style={styles.subtitle}>ESCRÍBENOS Y TE RESPONDEREMOS</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>NOMBRE</Text>
        <TextInput style={styles.input} placeholder="Tu nombre" value={nombre} onChangeText={setNombre} />

        <Text style={styles.label}>CORREO ELECTRÓNICO</Text>
        <TextInput style={styles.input} placeholder="tu@correo.com" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>ASUNTO</Text>
        <TouchableOpacity style={styles.select} onPress={() => setAsuntoOpen(!asuntoOpen)}>
          <Text style={asunto ? styles.selectText : styles.selectPlaceholder}>
            {asunto || "Selecciona un asunto"}
          </Text>
          <Ionicons name={asuntoOpen ? "chevron-up" : "chevron-down"} size={16} color="#888" />
        </TouchableOpacity>
        {asuntoOpen && (
          <View style={styles.options}>
            {ASUNTOS.map((a) => (
              <TouchableOpacity
                key={a}
                style={[styles.option, asunto === a && styles.optionActive]}
                onPress={() => {
                  setAsunto(a);
                  setAsuntoOpen(false);
                }}
              >
                <Text style={[styles.optionText, asunto === a && styles.optionTextActive]}>{a}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>MENSAJE</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          placeholder="Escribe tu mensaje aquí..."
          value={mensaje}
          onChangeText={setMensaje}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        <TouchableOpacity style={styles.button} onPress={enviar} disabled={enviando}>
          <Text style={styles.buttonText}>{enviando ? "ENVIANDO..." : "ENVIAR MENSAJE"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    letterSpacing: 1,
  },
  subtitle: {
    color: "#888",
    fontSize: 12,
    letterSpacing: 1,
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
  exitoTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 16,
  },
  exitoSub: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
});
