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
import { router, useLocalSearchParams } from "expo-router";
import api from "../constants/api";

export default function Restablecer() {
  const { email } = useLocalSearchParams();
  const [codigo, setCodigo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);

  function validarPassword() {
    return /[A-Z]/.test(password) && /[0-9]/.test(password) && password.length >= 8;
  }

  async function actualizar() {
    if (!codigo.trim()) {
      return Alert.alert("Error", "Ingresa el código de verificación");
    }
    if (!password) {
      return Alert.alert("Error", "Ingresa una nueva contraseña");
    }
    if (!validarPassword()) {
      return Alert.alert("Contraseña inválida", "Debe tener mínimo 8 caracteres, una mayúscula y un número");
    }
    if (password !== confirmar) {
      return Alert.alert("Error", "Las contraseñas no coinciden");
    }

    try {
      setLoading(true);
      await api.post("/api/auth/update-password", { email, codigo, password });
      Alert.alert("Contraseña actualizada", "Ya puedes iniciar sesión con tu nueva contraseña", [
        { text: "Iniciar sesión", onPress: () => router.replace("/login") },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error?.response?.data?.message || "No se pudo restablecer la contraseña");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>JADDA SPORTS</Text>
      <Text style={styles.title}>Nueva Contraseña</Text>
      <Text style={styles.subtitle}>Ingresa el código que enviamos a {email} y tu nueva contraseña</Text>

      <TextInput
        placeholder="Código de verificación"
        value={codigo}
        onChangeText={setCodigo}
        keyboardType="number-pad"
        style={styles.input}
      />
      <TextInput
        placeholder="Nueva contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />
      <TextInput
        placeholder="Confirmar contraseña"
        value={confirmar}
        onChangeText={setConfirmar}
        secureTextEntry
        style={styles.input}
      />

      <View style={styles.rules}>
        <Text style={styles.rule}>• Mínimo 8 caracteres</Text>
        <Text style={styles.rule}>• Una letra mayúscula</Text>
        <Text style={styles.rule}>• Un número</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={actualizar} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>RESTABLECER</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/login")}>
        <Text style={styles.link}>Volver al inicio de sesión</Text>
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
  rules: {
    marginBottom: 20,
  },
  rule: {
    color: "#666",
    marginBottom: 5,
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
