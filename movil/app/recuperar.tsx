import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { volverAtras } from "../utils/navegacion";
import api from "../constants/api";

export default function Recuperar() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function enviarCodigo() {
    if (!email.trim()) {
      return Alert.alert("Error", "Ingresa tu correo electrónico");
    }
    try {
      setLoading(true);
      await api.post("/api/auth/recuperar-password", { email });
      Alert.alert("Código enviado", "Revisa tu correo para el código de recuperación", [
        { text: "Continuar", onPress: () => router.push({ pathname: "/restablecer", params: { email } }) },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error?.response?.data?.message || "No se pudo enviar el código");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>JADDA SPORTS</Text>
      <Text style={styles.title}>Recuperar Contraseña</Text>
      <Text style={styles.subtitle}>Ingresa tu correo y te enviaremos un código de verificación</Text>

      <TextInput
        placeholder="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={enviarCodigo} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>ENVIAR CÓDIGO</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={volverAtras}>
        <Text style={styles.link}>Volver</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 25,
    backgroundColor: "#fff",
  },
  logo: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#e73737",
    textAlign: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    color: "#666",
    marginBottom: 25,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  button: {
    backgroundColor: "#e73737",
    padding: 15,
    borderRadius: 10,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  link: {
    textAlign: "center",
    marginTop: 20,
    color: "#e73737",
  },
});
