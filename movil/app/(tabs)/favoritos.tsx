import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from "react-native";
import { useFavoritos } from "../../context/FavoritosContext";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { resolverImagen } from "../../constants/api";
import { useAuth } from "../../context/AuthContext";
import { useCallback, useState } from "react";

export default function Favoritos() {
  const { favoritos, loadingFavoritos, toggleFavorito, fetchFavoritos } = useFavoritos();
  const { estaLogueado } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFavoritos({ silencioso: true });
    setRefreshing(false);
  }, [fetchFavoritos]);

  if (!estaLogueado) {
    return (
      <View style={styles.centered}>
        <Ionicons name="heart-outline" size={70} color="#ccc" />
        <Text style={styles.centeredTitle}>Mis favoritos</Text>
        <Text style={styles.centeredText}>Inicia sesión para ver tus productos favoritos.</Text>
        <TouchableOpacity style={styles.btnRojo} onPress={() => router.push("/login")}>
          <Text style={styles.btnRojoText}>INICIAR SESIÓN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadingFavoritos) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e73737" />
      </View>
    );
  }

  if (favoritos.length === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="heart-outline" size={70} color="#ccc" />
        <Text style={styles.centeredTitle}>No tienes favoritos</Text>
        <Text style={styles.centeredText}>
          Toca el corazón en cualquier producto para guardarlo aquí.
        </Text>
        <TouchableOpacity style={styles.btnRojo} onPress={() => router.push("/(tabs)/catalogo")}>
          <Text style={styles.btnRojoText}>VER CATÁLOGO</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={favoritos}
      keyExtractor={(item) => String(item.ID_FAVORITO)}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#e73737"]}
          tintColor="#e73737"
        />
      }
      ListHeaderComponent={<Text style={styles.title}>MIS FAVORITOS ({favoritos.length})</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardBody} onPress={() => router.push(`/producto/${item.ID}`)}>
            <Image source={{ uri: resolverImagen(item.IMAGEN) || undefined }} style={styles.img} resizeMode="contain" />
            <View style={styles.info}>
              <Text numberOfLines={2} style={styles.nombre}>{item.NOMBRE}</Text>
              {item.MARCA ? <Text style={styles.marca}>{item.MARCA}</Text> : null}
              <Text style={styles.precio}>${Number(item.PRECIO).toLocaleString("es-CO")}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.favBtn}
            onPress={() => {
              Alert.alert("Quitar de favoritos", `¿Quitar "${item.NOMBRE}" de tus favoritos?`, [
                { text: "Cancelar", style: "cancel" },
                { text: "Quitar", style: "destructive", onPress: () => toggleFavorito(item.ID) },
              ]);
            }}
          >
            <Ionicons name="heart" size={22} color="#e73737" />
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 30,
    backgroundColor: "#f5f5f5",
  },
  centeredTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    marginTop: 15,
    marginBottom: 8,
  },
  centeredText: {
    color: "#666",
    textAlign: "center",
    marginBottom: 25,
    lineHeight: 20,
  },
  btnRojo: {
    backgroundColor: "#e73737",
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 10,
  },
  btnRojoText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
  list: {
    padding: 15,
    backgroundColor: "#f5f5f5",
    flexGrow: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 15,
  },
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 3,
    alignItems: "center",
  },
  cardBody: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
  },
  img: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  nombre: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#111",
  },
  marca: {
    color: "#888",
    fontSize: 12,
    marginTop: 3,
  },
  precio: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 16,
    marginTop: 6,
  },
  favBtn: {
    padding: 8,
    marginLeft: 8,
  },
});
