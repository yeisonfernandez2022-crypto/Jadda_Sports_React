import { View, Text, StyleSheet } from "react-native";

export default function Footer() {
  return (
    <View style={styles.footer}>
      <Text style={styles.text}>
        © 2026 JADDA SPORTS
      </Text>

      <Text style={styles.text}>
        Pasión por el Deporte
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: "#002244",
    paddingVertical: 25,
    alignItems: "center",
    marginTop: 20,
  },

  text: {
    color: "#fff",
    fontSize: 14,
  },
});