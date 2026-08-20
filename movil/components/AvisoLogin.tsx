import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAvisoLogin } from "../context/AvisoLoginContext";

export default function AvisoLogin() {
  const { aviso, ocultarAvisoLogin } = useAvisoLogin();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (aviso) {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
  }, [aviso, opacity]);

  if (!aviso) return null;

  const irLogin = () => {
    ocultarAvisoLogin();
    router.push("/login");
  };

  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 90 }]} pointerEvents="box-none">
      <Animated.View style={[styles.toast, { opacity }]}>
        <Ionicons name="person-circle-outline" size={24} color="#ffd166" />
        <Text style={styles.texto}>{aviso.mensaje}</Text>
        <TouchableOpacity style={styles.btn} onPress={irLogin} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
          <Text style={styles.btnText}>INICIAR SESIÓN</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 14,
    right: 14,
    alignItems: "center",
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 14,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 10,
    maxWidth: "100%",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  },
  texto: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  btn: {
    backgroundColor: "#e73737",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
});
