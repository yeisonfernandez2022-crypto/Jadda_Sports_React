import { useCallback, useEffect, useRef, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api, { resolverImagen } from "../../constants/api";
import { useAuth } from "../../context/AuthContext";
import ProductoItem, { Producto } from "../../components/ProductoItem";
import TarjetaPlan from "../../components/TarjetaPlan";
import TarjetaRetos from "../../components/TarjetaRetos";
import Footer from "../../components/Footer";

const { width } = Dimensions.get("window");

interface Banner {
  src: string;
  alt: string;
}

const BANNERS: Banner[] = [
  { src: "/images/banner-principal-1.png", alt: "Lo mejor del deporte" },
  { src: "/images/banner-principal-2.png", alt: "Para cada meta, solo lo mejor" },
  { src: "/images/banner-principal-3.png", alt: "Tu tienda deportiva de confianza" },
  { src: "/images/banner-principal-4.png", alt: "Equípate con JADDA Sports" },
];

interface Categoria {
  ID_CATEGORIA: number;
  NOMBRE_CATEGORIA: string;
}

const CATEGORIA_ICONOS: Record<string, string> = {
  Fútbol: "football",
  Baloncesto: "basketball",
  Running: "footsteps",
  Gimnasio: "barbell",
  "Natación": "water",
  Ciclismo: "bicycle",
  "Deportes extremos": "flash",
  "Ropa deportiva": "shirt",
  Ropa: "shirt",
  Calzado: "football",
  Accesorios: "watch",
  Protección: "shield-checkmark",
  Cardio: "pulse",
  "Hogar fitness": "home",
  Suplementos: "fitness",
  "Tecnología deportiva": "watch",
};

export default function HomeScreen() {
  const { estaLogueado } = useAuth();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [historial, setHistorial] = useState<Producto[]>([]);
  const [recomendados, setRecomendados] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [slide, setSlide] = useState(0);
  const [bannerAlto, setBannerAlto] = useState(160);
  const carruselRef = useRef<ScrollView>(null);

  const cargarInicio = useCallback(async () => {
    try {
      const [prods, dcts, cats] = await Promise.all([
        api.get("/api/productos"),
        api.get("/api/productos/descuentos"),
        api.get("/api/productos/categorias"),
      ]);
      setProductos(prods.data);
      const map: Record<number, number> = {};
      dcts.data.forEach((d: { ID_DESCUENTO: number; PORCENTAJE: number }) => {
        map[d.ID_DESCUENTO] = d.PORCENTAJE;
      });
      setDescuentosMap(map);
      setCategorias(cats.data);
      setError("");
    } catch {
      setError("Error al cargar la página. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }, []);

  const cargarPersonalizado = useCallback(async () => {
    if (!estaLogueado) {
      setHistorial([]);
      setRecomendados([]);
      return;
    }
    api.get("/api/historial").then((res) => setHistorial(res.data)).catch(() => {});
    api
      .get("/api/productos/recomendados")
      .then((res) => {
        if (res.data && Array.isArray(res.data.productos)) setRecomendados(res.data.productos);
      })
      .catch(() => {});
  }, [estaLogueado]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargarInicio();
    await cargarPersonalizado();
    setRefreshing(false);
  }, [cargarInicio, cargarPersonalizado]);

  useEffect(() => {
    cargarInicio();
  }, [cargarInicio]);

  useEffect(() => {
    cargarPersonalizado();
  }, [cargarPersonalizado]);

  useEffect(() => {
    const t = setInterval(() => {
      setSlide((prev) => {
        const next = (prev + 1) % BANNERS.length;
        carruselRef.current?.scrollTo({ x: next * width, animated: true });
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let activo = true;
    let mayorAlto = 0;
    let pendientes = BANNERS.length;
    BANNERS.forEach((b) => {
      const uri = resolverImagen(b.src);
      if (!uri) {
        pendientes -= 1;
        return;
      }
      Image.getSize(
        uri,
        (w, h) => {
          const alto = width * (h / w);
          if (alto > mayorAlto) mayorAlto = alto;
          pendientes -= 1;
          if (activo && pendientes === 0) {
            setBannerAlto(Math.min(Math.max(Math.round(mayorAlto), 100), 340));
          }
        },
        () => {
          pendientes -= 1;
          if (activo && pendientes === 0 && mayorAlto > 0) {
            setBannerAlto(Math.min(Math.max(Math.round(mayorAlto), 100), 340));
          }
        }
      );
    });
    return () => {
      activo = false;
    };
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== slide) setSlide(idx);
  };

  const irCategoria = (nombre: string) => router.push(`/catalogo?cat=${encodeURIComponent(nombre)}`);

  const productosMostrados = productos.slice(0, 12);
  const productosOferta = productos.filter((p) => p.ID_DESCUENTO != null).slice(0, 8);
  const historialCompleto = historial
    .map((h) => productos.find((p) => p.ID === h.ID) || h)
    .filter((p) => p && p.ID)
    .slice(0, 6);
  const recomendadosMostrados = recomendados.slice(0, 6);

  const renderGrid = (items: Producto[]) => (
    <View style={styles.grid}>
      {items.map((p) => (
        <ProductoItem key={p.ID} item={p} descuentoPorcentaje={descuentosMap[p.ID_DESCUENTO ?? -1] ?? 0} />
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#e73737" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.retryText}>REINTENTAR</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#e73737"]}
          tintColor="#e73737"
        />
      }
    >
      {/* SLIDESHOW */}
      <View style={styles.sliderWrap}>
        <ScrollView
          ref={carruselRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {BANNERS.map((b, i) => (
            <Image
              key={i}
              source={{ uri: resolverImagen(b.src) || undefined }}
              style={[styles.slide, { width, height: bannerAlto }]}
              resizeMode="contain"
            />
          ))}
        </ScrollView>
        <View style={styles.dots}>
          {BANNERS.map((_, i) => (
            <View key={i} style={[styles.dot, i === slide && styles.dotActive]} />
          ))}
        </View>
      </View>

      {/* CATEGORÍAS CARRUSEL */}
      {categorias.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CATEGORÍAS</Text>
          <Text style={styles.sectionSubtitle}>Explora por tu deporte favorito</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catCarrusel}
            contentContainerStyle={{ gap: 12, paddingRight: 6 }}
          >
            {categorias.map((cat) => (
              <TouchableOpacity
                key={cat.ID_CATEGORIA}
                style={styles.catCard}
                onPress={() => irCategoria(cat.NOMBRE_CATEGORIA)}
              >
                <View style={styles.catIco}>
                  <Ionicons
                    name={(CATEGORIA_ICONOS[cat.NOMBRE_CATEGORIA] as any) || "basketball"}
                    size={24}
                    color="#e73737"
                  />
                </View>
                <Text style={styles.catName} numberOfLines={1}>
                  {cat.NOMBRE_CATEGORIA}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* PRODUCTOS */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>PRODUCTOS</Text>
        <View style={styles.sectionSubtitleWrap}>
          <Text style={styles.sectionSubtitle}>Encuentra lo que necesitas para tu deporte favorito</Text>
        </View>
        {renderGrid(productosMostrados)}
      </View>

      {/* OFERTAS */}
      {productosOferta.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitleOfertas}>🔥 OFERTAS</Text>
          {renderGrid(productosOferta)}
        </View>
      )}

      {/* PLAN + RETOS */}
      <View style={styles.promo}>
        <TarjetaPlan />
        <TarjetaRetos />
      </View>

      {/* VER TODO */}
      <TouchableOpacity style={styles.verTodo} onPress={() => router.push("/catalogo")}>
        <Text style={styles.verTodoText}>VER TODO EL CATÁLOGO</Text>
      </TouchableOpacity>

      {/* RECOMENDADOS */}
      {estaLogueado && recomendadosMostrados.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>✨ RECOMENDADOS PARA TI</Text>
          {renderGrid(recomendadosMostrados)}
        </View>
      )}

      {/* RECIENTEMENTE VISTOS */}
      {historialCompleto.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🕘 RECIENTEMENTE VISTOS</Text>
          {renderGrid(historialCompleto)}
        </View>
      )}

      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  errorText: {
    color: "#666",
    fontSize: 16,
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: "#e73737",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontWeight: "bold",
  },
  sliderWrap: {
    position: "relative",
    backgroundColor: "#002244",
  },
  slide: {
    backgroundColor: "#002244",
  },
  dots: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  dotActive: {
    backgroundColor: "#e73737",
    width: 20,
  },
  section: {
    marginTop: 22,
    paddingHorizontal: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 4,
  },
  sectionTitleOfertas: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#e73737",
    marginBottom: 4,
  },
  sectionSubtitleWrap: {
    marginBottom: 14,
  },
  sectionSubtitle: {
    color: "#888",
    fontSize: 13,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  promo: {
    paddingHorizontal: 14,
    marginTop: 22,
  },
  verTodo: {
    backgroundColor: "#002244",
    marginHorizontal: 14,
    marginTop: 10,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  verTodoText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  catCarrusel: {
    marginTop: 12,
  },
  catCard: {
    width: 100,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
    elevation: 3,
  },
  catIco: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#fdeaea",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  catName: {
    fontWeight: "600",
    fontSize: 12,
    color: "#111",
    textAlign: "center",
  },
});
