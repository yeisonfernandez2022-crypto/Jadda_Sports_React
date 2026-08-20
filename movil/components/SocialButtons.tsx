import { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import {
  LoginManager,
  AccessToken,
} from "react-native-fbsdk-next";
import api from "../constants/api";
import { useAuth } from "../context/AuthContext";

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";

GoogleSignin.configure({
  webClientId: GOOGLE_CLIENT_ID,
});

export default function SocialButtons({ disabled }: { disabled?: boolean }) {
  const { login } = useAuth();
  const [loading, setLoading] = useState<"google" | "facebook" | null>(null);

  async function socialLogin(provider: string, accessToken: string) {
    try {
      const response = await api.post("/api/auth/social-login", {
        provider,
        accessToken,
      });
      login(response.data.usuario);
      router.replace("/(tabs)");
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          `Error al iniciar sesión con ${provider}`
      );
    }
  }

  async function iniciarGoogle() {
    try {
      setLoading("google");
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (response.type === "cancelled") return;
      const idToken = response.data?.idToken;
      if (!idToken) {
        throw new Error("No se obtuvo el token de Google");
      }
      await socialLogin("google", idToken);
    } catch (error: any) {
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) return;
      const msg =
        error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE
          ? "Google Play Services no está disponible en este dispositivo"
          : error?.message || "Error al iniciar sesión con Google";
      Alert.alert("Error", msg);
    } finally {
      setLoading(null);
    }
  }

  async function iniciarFacebook() {
    try {
      setLoading("facebook");
      const result = await LoginManager.logInWithPermissions([
        "public_profile",
        "email",
      ]);
      if (result.isCancelled) return;
      const token = await AccessToken.getCurrentAccessToken();
      if (!token) {
        throw new Error("No se obtuvo el token de Facebook");
      }
      await socialLogin("facebook", token.accessToken);
    } catch (error: any) {
      Alert.alert(
        "Error",
        error?.response?.data?.message ||
          error?.message ||
          "Error al iniciar sesión con Facebook"
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.btn, styles.google, disabled && styles.disabled]}
        onPress={iniciarGoogle}
        disabled={disabled || loading !== null}
      >
        {loading === "google" ? (
          <ActivityIndicator color="#4285F4" />
        ) : (
          <Ionicons name="logo-google" size={20} color="#4285F4" />
        )}
        <Text style={[styles.txt, styles.googleTxt]}>
          Continuar con Google
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, styles.facebook, disabled && styles.disabled]}
        onPress={iniciarFacebook}
        disabled={disabled || loading !== null}
      >
        {loading === "facebook" ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Ionicons name="logo-facebook" size={20} color="#fff" />
        )}
        <Text style={[styles.txt, styles.facebookTxt]}>
          Continuar con Facebook
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 12,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.6,
  },
  google: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  googleTxt: {
    color: "#333",
  },
  facebook: {
    backgroundColor: "#1877F2",
  },
  facebookTxt: {
    color: "#fff",
  },
  txt: {
    fontSize: 15,
    fontWeight: "600",
  },
});
