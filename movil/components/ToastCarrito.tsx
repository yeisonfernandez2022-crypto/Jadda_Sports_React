import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../context/CartContext";

export default function ToastCarrito() {
  const { toastCarrito } = useCart();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (toastCarrito) {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
  }, [toastCarrito, opacity]);

  if (!toastCarrito) return null;

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.toast, { opacity }]}>
        <Ionicons
          name={toastCarrito.tipo === "error" ? "alert-circle" : "checkmark-circle"}
          size={18}
          color="#fff"
        />
        <Text style={styles.text}>{toastCarrito.mensaje}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e73737",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  text: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});