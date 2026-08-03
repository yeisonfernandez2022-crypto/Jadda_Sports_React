import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";

import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import api, { resolverImagen } from "../../constants/api";

interface Producto {
  ID: number;
  NOMBRE: string;
  MARCA: string;
  COLOR: string;
  TALLA: string;
  PRECIO: string;
  STOCK: number;
  DESCRIPCION: string;

  IMAGENES: {
    url: string;
    ORDEN: number;
  }[];

  CARACTERISTICAS: {
    NOMBRE_ATRIBUTO: string;
    VALOR_ATRIBUTO: string;
  }[];
}

export default function ProductoDetalle() {
  const { id } = useLocalSearchParams();

  const [producto, setProducto] =
    useState<Producto | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [imagenSeleccionada, setImagenSeleccionada] =
    useState("");

  useEffect(() => {
    cargarProducto();
  }, []);

  async function cargarProducto() {
    try {
      const response = await api.get(
        `/api/productos/${id}`
      );

      setProducto(response.data);

      if (
        response.data.IMAGENES &&
        response.data.IMAGENES.length > 0
      ) {
        setImagenSeleccionada(
          resolverImagen(
            response.data.IMAGENES[0].url
          )
        );
      }
    } catch (error) {
      console.log(
        "Error cargando producto:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator
          size="large"
          color="#e73737"
        />

        <Text style={{ marginTop: 15 }}>
          Cargando producto...
        </Text>
      </View>
    );
  }

  if (!producto) {
    return (
      <View style={styles.loading}>
        <Text>
          Producto no encontrado
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingBottom: 40,
      }}
    >
      {/* IMAGEN PRINCIPAL */}

      <Image
        source={{
          uri: imagenSeleccionada,
        }}
        style={styles.image}
      />

      {/* MINIATURAS */}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.gallery}
      >
        {producto.IMAGENES?.map(
          (img, index) => (
            <TouchableOpacity
              key={index}
              onPress={() =>
                setImagenSeleccionada(
                  resolverImagen(img.url)
                )
              }
            >
              <Image
                source={{
                  uri: resolverImagen(img.url),
                }}
                style={[
                  styles.thumbnail,

                  imagenSeleccionada ===
                    resolverImagen(img.url) && {
                    borderColor:
                      "#e73737",
                  },
                ]}
              />
            </TouchableOpacity>
          )
        )}
      </ScrollView>

      <View style={styles.content}>
        <Text style={styles.nombre}>
          {producto.NOMBRE}
        </Text>

        <Text style={styles.marca}>
          Marca: {producto.MARCA}
        </Text>

        {/* TALLA Y COLOR */}

        <View style={styles.infoRow}>
          <View style={styles.badge}>
            <Text>
              Talla: {producto.TALLA}
            </Text>
          </View>

          <View style={styles.badge}>
            <Text>
              Color: {producto.COLOR}
            </Text>
          </View>
        </View>

        <Text style={styles.precio}>
          $
          {Number(
            producto.PRECIO
          ).toLocaleString("es-CO")}
        </Text>

        <Text style={styles.stock}>
          Stock disponible:
          {" "}
          {producto.STOCK}
        </Text>

        <View style={styles.divider} />

        {/* DESCRIPCIÓN */}

        <Text style={styles.sectionTitle}>
          DESCRIPCIÓN
        </Text>

        <Text style={styles.descripcion}>
          {producto.DESCRIPCION}
        </Text>

        <View style={styles.divider} />

        {/* CARACTERÍSTICAS */}

        <Text style={styles.sectionTitle}>
          CARACTERÍSTICAS
        </Text>

        {producto.CARACTERISTICAS?.map(
          (item, index) => (
            <View
              key={index}
              style={styles.featureRow}
            >
              <Text
                style={styles.featureName}
              >
                {item.NOMBRE_ATRIBUTO}
              </Text>

              <Text>
                {item.VALOR_ATRIBUTO}
              </Text>
            </View>
          )
        )}

        {/* BOTÓN */}

        <TouchableOpacity
          style={styles.cartButton}
          onPress={() =>
            console.log(
              "Agregar al carrito"
            )
          }
        >
          <Text
            style={styles.cartButtonText}
          >
            🛒 AGREGAR AL CARRITO
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },

  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  image: {
    width: "100%",
    height: 350,
    backgroundColor: "#fff",
  },

  gallery: {
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },

  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 3,
    borderColor: "transparent",
  },

  content: {
    padding: 20,
  },

  nombre: {
    fontSize: 30,
    fontWeight: "bold",
    color: "#111",
  },

  marca: {
    marginTop: 8,
    color: "#666",
    fontSize: 16,
  },

  infoRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },

  badge: {
    backgroundColor: "#eaeaea",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },

  precio: {
    marginTop: 20,
    fontSize: 34,
    fontWeight: "bold",
    color: "#e73737",
  },

  stock: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "600",
    color: "#2e7d32",
  },

  divider: {
    height: 1,
    backgroundColor: "#ddd",
    marginVertical: 25,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },

  descripcion: {
    fontSize: 16,
    lineHeight: 24,
    color: "#444",
  },

  featureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  featureName: {
    fontWeight: "bold",
  },

  cartButton: {
    marginTop: 30,
    backgroundColor: "#002244",
    padding: 18,
    borderRadius: 12,
  },

  cartButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
});