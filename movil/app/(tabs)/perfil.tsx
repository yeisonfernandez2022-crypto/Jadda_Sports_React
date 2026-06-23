import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import api from "../../constants/api";

export default function PerfilScreen() {
  const { usuario, logout, estaLogueado, cargando } = useAuth();
  const [perfil, setPerfil] = useState<any>(null);
  const [loadingPerfil, setLoadingPerfil] = useState(true);

  useEffect(() => {
    if (estaLogueado) {
      api.get("/api/auth/perfil")
        .then((res) => setPerfil(res.data))
        .catch(() => {})
        .finally(() => setLoadingPerfil(false));
    } else {
      setLoadingPerfil(false);
    }
  }, [estaLogueado]);

  function cerrarSesion() {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: () => {
          logout();
          router.replace("/login");
        },
      },
    ]);
  }

  if (cargando || loadingPerfil) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e73737" />
      </View>
    );
  }

  if (!estaLogueado) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Perfil</Text>
        <Text style={styles.subtitle}>Inicia sesión para acceder a tu perfil</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkBtn} onPress={() => router.push("/registro")}>
          <Text style={styles.linkText}>Crear cuenta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {usuario?.NOMBRE_USUARIO?.charAt(0).toUpperCase() || "?"}
        </Text>
      </View>

      <Text style={styles.nombre}>{perfil?.NOMBRE_USUARIO || usuario?.NOMBRE_USUARIO}</Text>
      <Text style={styles.email}>{perfil?.EMAIL || ""}</Text>
      <Text style={styles.miembro}>
        Miembro desde {perfil?.FECHA_REGISTRO ? new Date(perfil.FECHA_REGISTRO).toLocaleDateString("es-CO") : ""}
      </Text>

      <TouchableOpacity style={styles.logoutBtn} onPress={cerrarSesion}>
        <Text style={styles.logoutText}>CERRAR SESIÓN</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
    backgroundColor: "#fff",
  },
  container: {
    padding: 25,
    backgroundColor: "#fff",
    flexGrow: 1,
    alignItems: "center",
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#e73737",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 30,
    marginBottom: 20,
  },
  avatarText: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "bold",
  },
  nombre: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  email: {
    color: "#666",
    fontSize: 16,
    marginBottom: 5,
  },
  miembro: {
    color: "#999",
    fontSize: 13,
    marginBottom: 40,
  },
  button: {
    backgroundColor: "#e73737",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    marginBottom: 10,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  linkBtn: {
    padding: 15,
  },
  linkText: {
    color: "#e73737",
    textAlign: "center",
    fontWeight: "600",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  subtitle: {
    color: "#666",
    marginBottom: 25,
    textAlign: "center",
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: "#e73737",
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderRadius: 10,
  },
  logoutText: {
    color: "#e73737",
    fontWeight: "bold",
  },
});
