import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from "react-native";

import { useEffect, useState } from "react";
import { router } from "expo-router";

import api from "../../constants/api";

interface Producto {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  IMAGEN: string;
  MARCA?: string;
  DESCRIPCION?: string;
  CATEGORIA?: string;
}

export default function Catalogo() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);

  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] =
    useState("");

  const [ordenPrecio, setOrdenPrecio] =
    useState("");

  useEffect(() => {
    cargarProductos();
  }, []);

  async function cargarProductos() {
    try {
      const response = await api.get(
        "/api/productos"
      );

      setProductos(response.data);
    } catch (error) {
      console.log(
        "Error cargando productos:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  const categoriasUnicas = [
    ...new Set(
      productos
        .map((p) => p.CATEGORIA)
        .filter(Boolean)
    ),
  ];

  const productosFiltrados = [...productos]

    .filter((producto) => {
      if (!busqueda) return true;

      return (
        producto.NOMBRE
          .toLowerCase()
          .includes(
            busqueda.toLowerCase()
          ) ||

        producto.MARCA
          ?.toLowerCase()
          .includes(
            busqueda.toLowerCase()
          ) ||

        producto.CATEGORIA
          ?.toLowerCase()
          .includes(
            busqueda.toLowerCase()
          )
      );
    })

    .filter((producto) => {
      if (!categoriaSeleccionada)
        return true;

      return (
        producto.CATEGORIA ===
        categoriaSeleccionada
      );
    });

  if (ordenPrecio === "menor") {
    productosFiltrados.sort(
      (a, b) =>
        Number(a.PRECIO) -
        Number(b.PRECIO)
    );
  }

  if (ordenPrecio === "mayor") {
    productosFiltrados.sort(
      (a, b) =>
        Number(b.PRECIO) -
        Number(a.PRECIO)
    );
  }

  if (ordenPrecio === "az") {
    productosFiltrados.sort((a, b) =>
      a.NOMBRE.localeCompare(
        b.NOMBRE
      )
    );
  }

  if (ordenPrecio === "za") {
    productosFiltrados.sort((a, b) =>
      b.NOMBRE.localeCompare(
        a.NOMBRE
      )
    );
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color="#e73737"
        />

        <Text
          style={{
            marginTop: 15,
          }}
        >
          Cargando productos...
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={productosFiltrados}
      keyExtractor={(item) =>
        item.ID.toString()
      }
      numColumns={2}
      columnWrapperStyle={{
        justifyContent:
          "space-between",
        paddingHorizontal: 10,
      }}
      ListHeaderComponent={
        <>
          {/* Banner */}
          <View style={styles.banner}>
            <Image
              source={{
                uri: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438",
              }}
              style={
                styles.bannerImage
              }
            />

            <View
              style={
                styles.bannerOverlay
              }
            >
              <Text
                style={
                  styles.bannerTitle
                }
              >
                NUESTRO CATÁLOGO
              </Text>

              <Text
                style={
                  styles.bannerSubtitle
                }
              >
                Equipamiento de alto
                rendimiento
              </Text>
            </View>
          </View>

          {/* FILTROS */}
          <View
            style={
              styles.filtersContainer
            }
          >
            <TextInput
              placeholder="Buscar producto..."
              value={busqueda}
              onChangeText={
                setBusqueda
              }
              style={
                styles.searchInput
              }
            />

            <Text
              style={
                styles.filterTitle
              }
            >
              Categorías
            </Text>

            <FlatList
              horizontal
              data={
                categoriasUnicas
              }
              keyExtractor={(
                item
              ) => item!}
              showsHorizontalScrollIndicator={
                false
              }
              renderItem={({
                item,
              }) => (
                <TouchableOpacity
                  style={[
                    styles.categoryButton,

                    categoriaSeleccionada ===
                      item &&
                      styles.categorySelected,
                  ]}
                  onPress={() =>
                    setCategoriaSeleccionada(
                      categoriaSeleccionada ===
                        item
                        ? ""
                        : item!
                    )
                  }
                >
                  <Text>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
            />

            <Text
              style={
                styles.filterTitle
              }
            >
              Ordenar
            </Text>

            <View
              style={
                styles.orderContainer
              }
            >
              <TouchableOpacity
                style={
                  styles.orderBtn
                }
                onPress={() =>
                  setOrdenPrecio(
                    "menor"
                  )
                }
              >
                <Text>
                  💰 Menor
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.orderBtn
                }
                onPress={() =>
                  setOrdenPrecio(
                    "mayor"
                  )
                }
              >
                <Text>
                  💎 Mayor
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.orderBtn
                }
                onPress={() =>
                  setOrdenPrecio(
                    "az"
                  )
                }
              >
                <Text>A-Z</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={
                  styles.orderBtn
                }
                onPress={() =>
                  setOrdenPrecio(
                    "za"
                  )
                }
              >
                <Text>Z-A</Text>
              </TouchableOpacity>
            </View>

            <Text
              style={
                styles.sectionTitle
              }
            >
              PRODUCTOS
            </Text>
          </View>
        </>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Image
            source={{
              uri: item.IMAGEN,
            }}
            style={styles.image}
          />

          <View
            style={styles.cardBody}
          >
            <Text
              numberOfLines={2}
              style={styles.nombre}
            >
              {item.NOMBRE}
            </Text>

            <Text
              style={styles.precio}
            >
              $
              {Number(
                item.PRECIO
              ).toLocaleString(
                "es-CO"
              )}
            </Text>

            <TouchableOpacity
              style={
                styles.detailsBtn
              }
              onPress={() =>
                router.push(
                  `/producto/${item.ID}`
                )
              }
            >
              <Text
                style={
                  styles.detailsText
                }
              >
                VER DETALLES
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      contentContainerStyle={{
        paddingBottom: 100,
      }}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  banner: {
    height: 250,
    marginBottom: 20,
  },

  bannerImage: {
    width: "100%",
    height: "100%",
  },

  bannerOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,

    backgroundColor:
      "rgba(0,0,0,0.7)",

    padding: 15,

    borderLeftWidth: 5,

    borderLeftColor:
      "#e73737",
  },

  bannerTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },

  bannerSubtitle: {
    color: "#fff",
    marginTop: 5,
  },

  filtersContainer: {
    paddingHorizontal: 15,
  },

  searchInput: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 10,
    marginBottom: 15,
  },

  filterTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },

  categoryButton: {
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    marginBottom: 15,
  },

  categorySelected: {
    backgroundColor: "#e73737",
  },

  orderContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },

  orderBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 15,
  },

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