import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { usuario, estaLogueado } =
    useAuth();

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>
          JADDA SPORTS
        </Text>

        <Text style={styles.subtitle}>
          Tu tienda deportiva de confianza
        </Text>
      </View>

      <TouchableOpacity
        onPress={() =>
          router.push(
            estaLogueado
              ? "/(tabs)/perfil"
              : "/login"
          )
        }
      >
        <View style={styles.userContainer}>
          <Ionicons
            name={
              estaLogueado
                ? "person-circle"
                : "person-circle-outline"
            }
            size={40}
            color="white"
          />

          {estaLogueado && (
            <Text style={styles.userName}>
              {usuario?.NOMBRE_USUARIO}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#002244",

    paddingTop: 55,
    paddingBottom: 15,
    paddingHorizontal: 20,

    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",

    elevation: 6,
  },

  title: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },

  subtitle: {
    color: "#d9d9d9",
    marginTop: 2,
    fontSize: 12,
  },

  userContainer: {
    alignItems: "center",
  },

  userName: {
    color: "#fff",
    fontSize: 10,
    marginTop: 2,
    maxWidth: 80,
    textAlign: "center",
  },
});