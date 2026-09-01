import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";
import { router } from "expo-router";
import api from "../constants/api";
import { resolverImagen } from "../constants/api";
import BackButton from "../components/BackButton";
import AuthField from "../components/AuthField";
import SocialButtons from "../components/SocialButtons";

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function iniciarSesion() {
    if (!email.trim() || !password) {
      return Alert.alert("Error", "Ingresa tu correo y contraseña");
    }
    try {
      setLoading(true);
      const response = await api.post("/api/auth/login", { email, password });
      const u = response.data.usuario;
      // Bloqueo admin en móvil
      if (Number(u.ID_ROL) === 1) {
        Alert.alert(
          "Acceso denegado",
          "Señor admin, recuerde que no puede loguearse en la app móvil, intente en la web 😉",
          [{ text: "Entendido" }]
        );
        // Asegura que no quede sesión de admin en el móvil
        try { await api.post("/api/auth/logout"); } catch {}
        return;
      }
      const esVendedor = Number(u.ID_ROL) === 6;
      login({
        ID_USUARIO: u.ID_USUARIO,
        NOMBRE_USUARIO: u.NOMBRE_USUARIO,
        APELLIDO_USUARIO: u.APELLIDO_USUARIO,
        EMAIL: u.EMAIL,
        USUARIO: u.USUARIO,
        TELEFONO: u.TELEFONO,
        TIPO_DOCUMENTO: u.TIPO_DOCUMENTO,
        NUMERO_DOCUMENTO: u.NUMERO_DOCUMENTO,
        foto_url: u.FOTO_URL || u.foto_url || null,
        ID_ROL: u.ID_ROL,
        DEBE_CAMBIAR_PASSWORD: u.DEBE_CAMBIAR_PASSWORD,
      });
      if (esVendedor) {
        router.replace("/vendedor" as any);
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      Alert.alert("Error", error?.response?.data?.message || "Error de conexión con el servidor");
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
          <Text style={styles.subtitle}>¡Hola de nuevo!</Text>
          <Text style={styles.hint}>
            Inicia sesión para seguir comprando lo mejor en deportes
          </Text>
        </View>

        <View style={styles.card}>
          <AuthField
            icon="mail"
            placeholder="Correo electrónico"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <AuthField
            icon="lock-closed"
            placeholder="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.forgotWrap}
            onPress={() => router.push("/recuperar")}
          >
            <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={iniciarSesion}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.orText}>o continúa con</Text>
            <View style={styles.line} />
          </View>

          <SocialButtons disabled={loading} />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push("/registro")}>
            <Text style={styles.footerLink}>Regístrate gratis</Text>
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
    marginTop: 20,
    marginBottom: 26,
  },
  logo: {
    width: 84,
    height: 84,
  },
  brand: {
    fontSize: 24,
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
    marginTop: 14,
  },
  hint: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 6,
    textAlign: "center",
  },
  card: {
    width: "100%",
  },
  forgotWrap: {
    alignSelf: "flex-end",
    marginBottom: 18,
  },
  link: {
    color: "#e73737",
    fontWeight: "600",
    fontSize: 13,
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#e4e4e7",
  },
  orText: {
    marginHorizontal: 14,
    color: "#9aa0a6",
    fontWeight: "600",
    fontSize: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 28,
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
