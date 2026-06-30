import { memo } from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { router } from "expo-router";

export interface Producto {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  IMAGEN: string;
  MARCA?: string;
  CATEGORIA?: string;
}

function ProductoItem({ item }: { item: Producto }) {
  return (
    <View style={styles.card}>
      <Image
        source={{ uri: item.IMAGEN }}
        style={styles.image}
      />
      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.nombre}>
          {item.NOMBRE}
        </Text>
        <Text style={styles.precio}>
          ${Number(item.PRECIO).toLocaleString("es-CO")}
        </Text>
        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={() => router.push(`/producto/${item.ID}`)}
        >
          <Text style={styles.detailsText}>VER DETALLES</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: "#fff",
    marginBottom: 15,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 5,
  },
  image: {
    width: "100%",
    height: 170,
  },
  cardBody: {
    padding: 12,
  },
  nombre: {
    fontWeight: "bold",
    fontSize: 15,
    minHeight: 40,
  },
  precio: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 18,
    marginTop: 8,
  },
  detailsBtn: {
    backgroundColor: "#111",
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
  },
  detailsText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 12,
  },
});

export default memo(ProductoItem);
