import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
  Switch,
  TextInput,
  ScrollView,
} from "react-native";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import api, { resolverImagen } from "../../constants/api";
import ProductoItem, { type Producto } from "../../components/ProductoItem";

const POR_PAGINA = 12;

const OPCIONES_ORDEN = [
  { id: "", label: "Relevancia" },
  { id: "menor", label: "Precio: menor a mayor" },
  { id: "mayor", label: "Precio: mayor a menor" },
  { id: "az", label: "Nombre: A-Z" },
  { id: "za", label: "Nombre: Z-A" },
];

interface Filtros {
  categoria: string;
  precioMin: string;
  precioMax: string;
  soloOfertas: boolean;
  orden: string;
}

const FILTROS_INICIALES: Filtros = {
  categoria: "",
  precioMin: "",
  precioMax: "",
  soloOfertas: false,
  orden: "",
};

export default function Catalogo() {
  const { cat, search, descuento } = useLocalSearchParams<{
    cat?: string;
    search?: string;
    descuento?: string;
  }>();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});
  const [categorias, setCategorias] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [busqueda, setBusqueda] = useState(search || "");
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [pagina, setPagina] = useState(1);

  const [modalFiltros, setModalFiltros] = useState(false);
  const [draft, setDraft] = useState<Filtros>(FILTROS_INICIALES);

  const videoUrl = resolverImagen("/videos/catalogo-movil.mp4");
  const player = useVideoPlayer({ uri: videoUrl }, (player) => {
    player.loop = true;
    player.muted = true;
    player.play();
  });

  useEffect(() => {
    cargarProductos();
    api
      .get("/api/productos/categorias")
      .then((res) => {
        const cats = (res.data || []).map(
          (c: { NOMBRE_CATEGORIA: string }) => c.NOMBRE_CATEGORIA
        );
        setCategorias(cats);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (cat !== undefined) setFiltros((f) => ({ ...f, categoria: cat || "" }));
    if (search !== undefined) setBusqueda(search || "");
    if (descuento !== undefined) setFiltros((f) => ({ ...f, soloOfertas: descuento === "true" }));
  }, [cat, search, descuento]);

  useEffect(() => {
    setPagina(1);
  }, [filtros, busqueda]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await cargarProductos();
    setRefreshing(false);
  }, [cargarProductos]);

  async function cargarProductos() {
    try {
      setError("");
      const response = await api.get("/api/productos");
      setProductos(response.data);
      const dctsRes = await api.get("/api/productos/descuentos");
      const map: Record<number, number> = {};
      dctsRes.data.forEach((d: { ID_DESCUENTO: number; PORCENTAJE: number }) => {
        map[d.ID_DESCUENTO] = d.PORCENTAJE;
      });
      setDescuentosMap(map);
    } catch (error) {
      console.log("Error cargando productos:", error);
      setError("No se pudieron cargar los productos. Verifica tu conexión e intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const productosFiltrados = useMemo(() => {
    let lista = [...productos];
    const q = busqueda.trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (p) =>
          p.NOMBRE.toLowerCase().includes(q) ||
          (p.MARCA || "").toLowerCase().includes(q) ||
          (p.CATEGORIA || "").toLowerCase().includes(q)
      );
    }
    if (filtros.categoria) {
      lista = lista.filter((p) => p.CATEGORIA === filtros.categoria);
    }
    if (filtros.soloOfertas) {
      lista = lista.filter((p) => p.ID_DESCUENTO != null);
    }
    if (filtros.precioMin) {
      const min = Number(filtros.precioMin);
      if (!isNaN(min)) lista = lista.filter((p) => Number(p.PRECIO) >= min);
    }
    if (filtros.precioMax) {
      const max = Number(filtros.precioMax);
      if (!isNaN(max)) lista = lista.filter((p) => Number(p.PRECIO) <= max);
    }
    if (filtros.orden === "menor") {
      lista.sort((a, b) => Number(a.PRECIO) - Number(b.PRECIO));
    }
    if (filtros.orden === "mayor") {
      lista.sort((a, b) => Number(b.PRECIO) - Number(a.PRECIO));
    }
    if (filtros.orden === "az") {
      lista.sort((a, b) => a.NOMBRE.localeCompare(b.NOMBRE));
    }
    if (filtros.orden === "za") {
      lista.sort((a, b) => b.NOMBRE.localeCompare(a.NOMBRE));
    }
    return lista;
  }, [productos, filtros, busqueda]);

  const recomendados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return [];
    return productos
      .filter(
        (p) =>
          !p.NOMBRE.toLowerCase().includes(q) &&
          !(p.MARCA || "").toLowerCase().includes(q) &&
          !(p.CATEGORIA || "").toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [productos, busqueda]);

  const visibles = productosFiltrados.slice(0, pagina * POR_PAGINA);
  const hayMas = visibles.length < productosFiltrados.length;

  const filtrosActivos =
    (filtros.categoria ? 1 : 0) +
    (filtros.soloOfertas ? 1 : 0) +
    (filtros.orden ? 1 : 0) +
    (filtros.precioMin || filtros.precioMax ? 1 : 0);

  const abrirFiltros = () => {
    setDraft({ ...filtros });
    setModalFiltros(true);
  };

  const aplicarFiltros = () => {
    setFiltros({ ...draft });
    setModalFiltros(false);
  };

  const limpiarFiltros = () => {
    setFiltros(FILTROS_INICIALES);
    setDraft(FILTROS_INICIALES);
    setModalFiltros(false);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#e73737" />
        <Text style={{ marginTop: 15 }}>Cargando productos...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loading}>
        <Ionicons name="cloud-offline-outline" size={60} color="#e73737" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            setLoading(true);
            cargarProductos();
          }}
        >
          <Text style={styles.retryBtnText}>REINTENTAR</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <FlatList
        data={visibles}
        keyExtractor={(item) => item.ID.toString()}
        numColumns={2}
        columnWrapperStyle={{
          justifyContent: "space-between",
          paddingHorizontal: 10,
        }}
        windowSize={5}
        maxToRenderPerBatch={10}
        initialNumToRender={6}
        removeClippedSubviews={true}
        ListHeaderComponent={
          <>
            <View style={styles.banner}>
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                nativeControls={false}
                surfaceType="textureView"
              />
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerTitle}>NUESTRO CATÁLOGO</Text>
                <Text style={styles.bannerSubtitle}>Equipamiento de alto rendimiento</Text>
              </View>
            </View>

            <View style={styles.toolbar}>
              <Text style={styles.toolbarCount}>
                {productosFiltrados.length}{" "}
                {productosFiltrados.length === 1 ? "producto" : "productos"}
              </Text>
              <TouchableOpacity
                style={[styles.filtroBtn, filtrosActivos > 0 && styles.filtroBtnActivo]}
                onPress={abrirFiltros}
              >
                <Ionicons name="options-outline" size={15} color="#fff" />
                <Text style={styles.filtroBtnText}>FILTRO</Text>
                {filtrosActivos > 0 && (
                  <View style={styles.filtroBadge}>
                    <Text style={styles.filtroBadgeText}>{filtrosActivos}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>PRODUCTOS</Text>
          </>
        }
        ListEmptyComponent={
          busqueda.trim() ? (
            <View style={styles.vacio}>
              <Ionicons name="search-outline" size={48} color="#bbb" />
              <Text style={styles.vacioText}>
                "{busqueda.trim()}" no está en el catálogo, pero te recomendamos esto:
              </Text>
              <View style={styles.recomWrap}>
                {recomendados.map((p) => (
                  <ProductoItem
                    key={p.ID}
                    item={p}
                    descuentoPorcentaje={p.ID_DESCUENTO != null ? descuentosMap[p.ID_DESCUENTO] : 0}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.vacio}>
              <Ionicons name="search-outline" size={48} color="#bbb" />
              <Text style={styles.vacioText}>
                No encontramos productos con esos filtros.
              </Text>
              <TouchableOpacity style={styles.vacioBtn} onPress={limpiarFiltros}>
                <Text style={styles.vacioBtnText}>LIMPIAR FILTROS</Text>
              </TouchableOpacity>
            </View>
          )
        }
        ListFooterComponent={
          productosFiltrados.length === 0 ? null : hayMas ? (
            <TouchableOpacity
              style={styles.cargarMas}
              onPress={() => setPagina((p) => p + 1)}
            >
              <Text style={styles.cargarMasText}>
                CARGAR MÁS ({productosFiltrados.length - visibles.length} restantes)
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.finLista}>
              — Has visto los {visibles.length} productos —
            </Text>
          )
        }
        renderItem={({ item }) => (
          <ProductoItem
            item={item}
            descuentoPorcentaje={item.ID_DESCUENTO != null ? descuentosMap[item.ID_DESCUENTO] : 0}
          />
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#e73737"]}
            tintColor="#e73737"
          />
        }
      />

      {/* MODAL FILTROS */}
      <Modal
        visible={modalFiltros}
        transparent
        animationType="slide"
        onRequestClose={() => setModalFiltros(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalFiltros(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Filtrar productos</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalFiltros(false)}>
              <Ionicons name="close" size={22} color="#111" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.seccion}>
            <Text style={styles.seccionTitle}>Ordenar por</Text>
            <View style={styles.chips}>
              {OPCIONES_ORDEN.map((op) => (
                <TouchableOpacity
                  key={op.id}
                  style={[styles.chip, draft.orden === op.id && styles.chipSelected]}
                  onPress={() => setDraft((d) => ({ ...d, orden: op.id }))}
                >
                  <Text
                    style={[styles.chipText, draft.orden === op.id && styles.chipTextSelected]}
                  >
                    {op.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.seccion}>
            <Text style={styles.seccionTitle}>Categoría</Text>
            <View style={styles.chips}>
              {categorias.map((catNombre) => (
                <TouchableOpacity
                  key={catNombre}
                  style={[
                    styles.chip,
                    draft.categoria === catNombre && styles.chipSelected,
                  ]}
                  onPress={() =>
                    setDraft((d) => ({
                      ...d,
                      categoria: d.categoria === catNombre ? "" : catNombre,
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      draft.categoria === catNombre && styles.chipTextSelected,
                    ]}
                  >
                    {catNombre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.seccion}>
            <Text style={styles.seccionTitle}>Precio</Text>
            <View style={styles.precioRow}>
              <View style={styles.precioInputWrap}>
                <Text style={styles.precioSimbolo}>$</Text>
                <TextInput
                  style={styles.precioInput}
                  placeholder="Mínimo"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={draft.precioMin}
                  onChangeText={(t) => setDraft((d) => ({ ...d, precioMin: t.replace(/[^0-9]/g, "") }))}
                />
              </View>
              <Text style={styles.precioGuion}>—</Text>
              <View style={styles.precioInputWrap}>
                <Text style={styles.precioSimbolo}>$</Text>
                <TextInput
                  style={styles.precioInput}
                  placeholder="Máximo"
                  placeholderTextColor="#999"
                  keyboardType="numeric"
                  value={draft.precioMax}
                  onChangeText={(t) => setDraft((d) => ({ ...d, precioMax: t.replace(/[^0-9]/g, "") }))}
                />
              </View>
            </View>
          </View>

          <View style={styles.ofertasRow}>
            <View>
              <Text style={styles.ofertasTitle}>Solo ofertas</Text>
              <Text style={styles.ofertasSub}>Productos con descuento activo</Text>
            </View>
            <Switch
              value={draft.soloOfertas}
              onValueChange={(v) => setDraft((d) => ({ ...d, soloOfertas: v }))}
              trackColor={{ false: "#d1d5db", true: "#fca5a5" }}
              thumbColor={draft.soloOfertas ? "#e73737" : "#f4f3f4"}
            />
          </View>
          </ScrollView>

          <View style={styles.sheetAcciones}>
            <TouchableOpacity style={styles.limpiarBtn} onPress={limpiarFiltros}>
              <Text style={styles.limpiarBtnText}>LIMPIAR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.aplicarBtn} onPress={aplicarFiltros}>
              <Text style={styles.aplicarBtnText}>APLICAR FILTROS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#555",
    textAlign: "center",
    fontSize: 14,
    marginTop: 12,
    paddingHorizontal: 30,
  },
  retryBtn: {
    backgroundColor: "#e73737",
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 18,
  },
  retryBtnText: {
    color: "#fff",
    fontWeight: "bold",
  },
  banner: {
    height: 190,
    marginBottom: 16,
    backgroundColor: "#111",
    overflow: "hidden",
  },
  bannerOverlay: {
    position: "absolute",
    bottom: 16,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    padding: 12,
    paddingHorizontal: 16,
    borderLeftWidth: 5,
    borderLeftColor: "#e73737",
  },
  bannerTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
  },
  bannerSubtitle: {
    color: "#fff",
    marginTop: 4,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    marginBottom: 14,
  },
  toolbarCount: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
  },
  filtroBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e73737",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  filtroBtnActivo: {
    backgroundColor: "#b32a2a",
  },
  filtroBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
  filtroBadge: {
    backgroundColor: "#fff",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filtroBadgeText: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 11,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 12,
    paddingHorizontal: 15,
  },
  vacio: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  recomWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 18,
    width: "100%",
  },
  vacioText: {
    color: "#777",
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
  },
  vacioBtn: {
    backgroundColor: "#e73737",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginTop: 16,
  },
  vacioBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  cargarMas: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 15,
    marginTop: 6,
    alignItems: "center",
  },
  cargarMasText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
    letterSpacing: 0.5,
  },
  finLista: {
    textAlign: "center",
    color: "#999",
    fontSize: 12,
    marginTop: 14,
  },
  // --- Modal filtros ---
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 34,
    maxHeight: "85%",
  },
  sheetScroll: {
    flexShrink: 1,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeBtn: {
    padding: 6,
  },
  seccion: {
    marginBottom: 16,
  },
  seccionTitle: {
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 8,
    color: "#333",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  chipSelected: {
    borderColor: "#e73737",
    backgroundColor: "#fdeaea",
  },
  chipText: {
    color: "#444",
    fontSize: 13,
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#e73737",
    fontWeight: "bold",
  },
  precioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  precioInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f4f5",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  precioSimbolo: {
    color: "#666",
    fontWeight: "bold",
    marginRight: 4,
  },
  precioInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 15,
  },
  precioGuion: {
    color: "#999",
    fontSize: 15,
  },
  ofertasRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8f8f9",
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  ofertasTitle: {
    fontWeight: "700",
    fontSize: 14,
    color: "#333",
  },
  ofertasSub: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  sheetAcciones: {
    flexDirection: "row",
    gap: 10,
  },
  limpiarBtn: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  limpiarBtnText: {
    color: "#555",
    fontWeight: "bold",
    fontSize: 13,
  },
  aplicarBtn: {
    flex: 2,
    backgroundColor: "#e73737",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  aplicarBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
    letterSpacing: 0.5,
  },
});