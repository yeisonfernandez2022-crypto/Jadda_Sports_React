import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";

import { useState } from "react";
import { router } from "expo-router";

import api from "../constants/api";

export default function Registro() {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] =
    useState("");

  const [email, setEmail] = useState("");
  const [telefono, setTelefono] =
    useState("");

  const [direccion, setDireccion] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmar, setConfirmar] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  function validarPassword() {
    const tieneMayuscula =
      /[A-Z]/.test(password);

    const tieneNumero =
      /[0-9]/.test(password);

    const largo =
      password.length >= 8;

    return (
      tieneMayuscula &&
      tieneNumero &&
      largo
    );
  }

  async function registrar() {
    if (
      !nombre ||
      !apellido ||
      !email ||
      !telefono ||
      !direccion ||
      !password ||
      !confirmar
    ) {
      return Alert.alert(
        "Error",
        "Completa todos los campos"
      );
    }

    if (!validarPassword()) {
      return Alert.alert(
        "Contraseña inválida",
        "Debe tener mínimo 8 caracteres, una mayúscula y un número"
      );
    }

    if (password !== confirmar) {
      return Alert.alert(
        "Error",
        "Las contraseñas no coinciden"
      );
    }

    try {
      setLoading(true);

      const response = await api.post(
        "/api/auth/registro",
        {
          nombre,
          apellido,
          email,
          telefono,
          direccion,
          password,
        }
      );

      Alert.alert(
        "Registro exitoso",
        response.data.message,
        [
          {
            text: "Continuar",
            onPress: () =>
              router.push({
                pathname:
                  "/verificar-codigo",
                params: { email },
              }),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          "Error al registrar usuario"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={
        styles.container
      }
      showsVerticalScrollIndicator={
        false
      }
    >
      <Text style={styles.logo}>
        JADDA SPORTS
      </Text>

      <Text style={styles.title}>
        Crear Cuenta
      </Text>

      <TextInput
        placeholder="Nombre"
        value={nombre}
        onChangeText={setNombre}
        style={styles.input}
      />

      <TextInput
        placeholder="Apellido"
        value={apellido}
        onChangeText={setApellido}
        style={styles.input}
      />

      <TextInput
        placeholder="Correo"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        style={styles.input}
      />

      <TextInput
        placeholder="Teléfono"
        value={telefono}
        onChangeText={setTelefono}
        keyboardType="phone-pad"
        style={styles.input}
      />

      <TextInput
        placeholder="Dirección"
        value={direccion}
        onChangeText={setDireccion}
        style={styles.input}
      />

      <TextInput
        placeholder="Contraseña"
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
        <Text style={styles.rule}>
          • Mínimo 8 caracteres
        </Text>

        <Text style={styles.rule}>
          • Una letra mayúscula
        </Text>

        <Text style={styles.rule}>
          • Un número
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={registrar}
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
            CREAR CUENTA
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() =>
          router.push("/login")
        }
      >
        <Text style={styles.link}>
          ¿Ya tienes cuenta?
          Inicia sesión
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
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
    fontSize: 16,
  },

  link: {
    textAlign: "center",
    marginTop: 20,
    color: "#e73737",
    fontWeight: "600",
  },
});