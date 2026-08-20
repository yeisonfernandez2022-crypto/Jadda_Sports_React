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
import BackButton from "../components/BackButton";

export default function VerificarCodigo() {
  const { email } = useLocalSearchParams();

  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] =
    useState(false);

  async function verificar() {
    if (!codigo.trim()) {
      return Alert.alert(
        "Error",
        "Ingresa el código"
      );
    }

    try {
      setLoading(true);

      const response = await api.post(
        "/api/auth/confirmar",
        {
          email,
          codigo,
        }
      );

      Alert.alert(
        "Cuenta activada",
        response.data.message,
        [
          {
            text: "Iniciar sesión",
            onPress: () =>
              router.replace("/login"),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          "No fue posible verificar la cuenta"
      );
    } finally {
      setLoading(false);
    }
  }

  async function reenviarCodigo() {
    try {
      await api.post(
        "/api/auth/reenviar-codigo",
        {
          email,
        }
      );

      Alert.alert(
        "Listo",
        "Se envió un nuevo código a tu correo"
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          "No se pudo reenviar el código"
      );
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.backWrap}>
        <BackButton />
      </View>
      <Text style={styles.logo}>
        JADDA SPORTS
      </Text>

      <Text style={styles.title}>
        Verificar Cuenta
      </Text>

      <Text style={styles.subtitle}>
        Hemos enviado un código de 6
        dígitos a:
      </Text>

      <Text style={styles.email}>
        {email}
      </Text>

      <TextInput
        placeholder="Código"
        value={codigo}
        onChangeText={setCodigo}
        keyboardType="number-pad"
        maxLength={6}
        style={styles.input}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={verificar}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator
            color="#fff"
          />
        ) : (
          <Text
            style={styles.buttonText}
          >
            VERIFICAR
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={reenviarCodigo}
      >
        <Text style={styles.link}>
          Reenviar código
        </Text>
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
  backWrap: {
    position: "absolute",
    top: 0,
    left: 0,
  },

  logo: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#e73737",
    textAlign: "center",
    marginBottom: 30,
  },

  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },

  subtitle: {
    textAlign: "center",
    color: "#666",
  },

  email: {
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 25,
    marginTop: 5,
  },

  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 15,
    textAlign: "center",
    fontSize: 22,
    letterSpacing: 8,
    marginBottom: 20,
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
    fontWeight: "600",
  },
});