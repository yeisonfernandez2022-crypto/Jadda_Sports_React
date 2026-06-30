import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import * as Google from "expo-auth-session/providers/google";
import * as Facebook from "expo-auth-session/providers/facebook";
import * as WebBrowser from "expo-web-browser";
import api from "../constants/api";

WebBrowser.maybeCompleteAuthSession();

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
  const FACEBOOK_CLIENT_ID = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_ID || "";

  const [googleRequest, googleResponse, googlePrompt] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
  });

  const [fbRequest, fbResponse, fbPrompt] = Facebook.useAuthRequest({
    clientId: FACEBOOK_CLIENT_ID,
  });

  useEffect(() => {
    if (googleResponse?.type === "success") {
      const idToken = googleResponse.params.id_token;
      socialLogin("google", idToken);
    }
  }, [googleResponse]);

  useEffect(() => {
    if (fbResponse?.type === "success") {
      const accessToken = fbResponse.params.access_token;
      socialLogin("facebook", accessToken);
    }
  }, [fbResponse]);

  async function socialLogin(provider: string, accessToken: string) {
    try {
      setLoading(true);
      const response = await api.post("/api/auth/social-login", { provider, accessToken });
      login(response.data.usuario);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Error", error?.response?.data?.message || `Error al iniciar sesión con ${provider}`);
    } finally {
      setLoading(false);
    }
  }

  async function iniciarSesion() {
    try {
      setLoading(true);
      const response = await api.post("/api/auth/login", { email, password });
      login({
        ID_USUARIO: response.data.usuario.ID_USUARIO,
        NOMBRE_USUARIO: response.data.usuario.NOMBRE_USUARIO,
        foto_url: response.data.usuario.foto_url,
      });
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert("Error", error?.response?.data?.message || "Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>JADDA SPORTS</Text>
      <Text style={styles.title}>Iniciar Sesión</Text>

      <TextInput
        placeholder="Correo"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        autoCapitalize="none"
      />
      <TextInput
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.input}
      />

      <TouchableOpacity style={styles.button} onPress={iniciarSesion} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Ingresando..." : "ENTRAR"}</Text>
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.orText}>O</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity
        style={styles.socialBtn}
        onPress={() => googlePrompt()}
        disabled={!googleRequest || loading}
      >
        <Text style={styles.socialBtnText}>Iniciar sesión con Google</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.socialBtn, { backgroundColor: "#1877F2" }]}
        onPress={() => fbPrompt()}
        disabled={!fbRequest || loading}
      >
        <Text style={styles.socialBtnText}>Iniciar sesión con Facebook</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/recuperar")}>
        <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/registro")}>
        <Text style={styles.link}>¿No tienes cuenta? Regístrate</Text>
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
    marginBottom: 20,
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 25,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  orText: {
    marginHorizontal: 15,
    color: "#999",
    fontWeight: "600",
  },
  socialBtn: {
    backgroundColor: "#333",
    padding: 15,
    borderRadius: 10,
    marginBottom: 12,
  },
  socialBtnText: {
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
