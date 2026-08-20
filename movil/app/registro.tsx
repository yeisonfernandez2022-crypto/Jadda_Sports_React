import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "../constants/api";
import { resolverImagen } from "../constants/api";
import BackButton from "../components/BackButton";
import AuthField from "../components/AuthField";
import SocialButtons from "../components/SocialButtons";

export default function Registro() {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [loading, setLoading] = useState(false);

  const reglas = [
    { texto: "Mínimo 8 caracteres", ok: password.length >= 8 },
    { texto: "Una letra mayúscula", ok: /[A-Z]/.test(password) },
    { texto: "Un número", ok: /[0-9]/.test(password) },
  ];

  function validarPassword() {
    return reglas.every((r) => r.ok);
  }

  async function registrar() {
    if (!nombre || !apellido || !email || !telefono || !direccion || !password || !confirmar) {
      return Alert.alert("Error", "Completa todos los campos");
    }

    if (!validarPassword()) {
      return Alert.alert(
        "Contraseña inválida",
        "Debe tener mínimo 8 caracteres, una mayúscula y un número"
      );
    }

    if (password !== confirmar) {
      return Alert.alert("Error", "Las contraseñas no coinciden");
    }

    try {
      setLoading(true);
      const response = await api.post("/api/auth/registro", {
        nombre,
        apellido,
        email,
        telefono,
        direccion,
        password,
      });

      Alert.alert("Registro exitoso", response.data.message, [
        {
          text: "Continuar",
          onPress: () =>
            router.push({
              pathname: "/verificar-codigo",
              params: { email },
            }),
        },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error?.response?.data?.message || "Error al registrar usuario");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.backWrap}>
          <BackButton color="#111" />
        </View>

        <View style={styles.hero}>
          <Image
            source={{ uri: resolverImagen("/images/logo-jadda-transparente.png") }}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>
            JADDA <Text style={styles.brandSports}>SPORTS</Text>
          </Text>
          <Text style={styles.subtitle}>Crea tu cuenta</Text>
          <Text style={styles.hint}>
            Únete y accede a ofertas, retos y envíos gratis
          </Text>
        </View>

        <SocialButtons disabled={loading} />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.orText}>o regístrate con tu correo</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.row}>
          <View style={styles.rowItem}>
            <AuthField
              icon="person"
              placeholder="Nombre"
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
            />
          </View>
          <View style={styles.rowItem}>
            <AuthField
              icon="person"
              placeholder="Apellido"
              value={apellido}
              onChangeText={setApellido}
              autoCapitalize="words"
            />
          </View>
        </View>

        <AuthField
          icon="mail"
          placeholder="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <AuthField
          icon="call"
          placeholder="Teléfono"
          value={telefono}
          onChangeText={setTelefono}
          keyboardType="phone-pad"
        />
        <AuthField
          icon="location"
          placeholder="Dirección"
          value={direccion}
          onChangeText={setDireccion}
        />
        <AuthField
          icon="lock-closed"
          placeholder="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <AuthField
          icon="lock-closed"
          placeholder="Confirmar contraseña"
          value={confirmar}
          onChangeText={setConfirmar}
          secureTextEntry
        />

        <View style={styles.rules}>
          {reglas.map((r, i) => (
            <View key={i} style={styles.rule}>
              <Ionicons
                name={r.ok ? "checkmark-circle" : "ellipse-outline"}
                size={16}
                color={r.ok ? "#22c55e" : "#d1d5db"}
              />
              <Text style={[styles.ruleText, r.ok && styles.ruleOk]}>{r.texto}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={registrar}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>CREAR CUENTA</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push("/login")}>
            <Text style={styles.footerLink}>Inicia sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backWrap: {
    alignSelf: "flex-start",
    marginTop: 8,
  },
  hero: {
    alignItems: "center",
    marginTop: 14,
    marginBottom: 22,
  },
  logo: {
    width: 76,
    height: 76,
  },
  brand: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#111",
    marginTop: 4,
  },
  brandSports: {
    color: "#e73737",
  },
  subtitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    marginTop: 12,
  },
  hint: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 6,
    textAlign: "center",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 22,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#e4e4e7",
  },
  orText: {
    marginHorizontal: 12,
    color: "#9aa0a6",
    fontWeight: "600",
    fontSize: 12,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowItem: {
    flex: 1,
  },
  rules: {
    marginBottom: 18,
    gap: 6,
  },
  rule: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ruleText: {
    color: "#9aa0a6",
    fontSize: 13,
  },
  ruleOk: {
    color: "#16a34a",
    fontWeight: "600",
  },
  button: {
    backgroundColor: "#e73737",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#e73737",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
  },
  footerText: {
    color: "#6b7280",
    fontSize: 14,
  },
  footerLink: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 14,
  },
});