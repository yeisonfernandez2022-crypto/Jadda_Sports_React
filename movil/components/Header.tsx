import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function Header() {
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
        onPress={() => router.push("/login")}
      >
        <Ionicons
          name="person-circle-outline"
          size={40}
          color="white"
        />
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
});