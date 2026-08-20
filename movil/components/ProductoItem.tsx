import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Modal,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { resolverImagen } from "../constants/api";
import api from "../constants/api";
import { useFavoritos } from "../context/FavoritosContext";
import { useCart } from "../context/CartContext";
import ToastCarrito from "./ToastCarrito";
import { useAuth } from "../context/AuthContext";
import { useAvisoLogin } from "../context/AvisoLoginContext";

export interface Producto {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  IMAGEN: string;
  MARCA?: string;
  CATEGORIA?: string;
  STOCK?: number;
  ID_DESCUENTO?: number | null;
  ID_VARIANTE_POR_DEFECTO?: number | null;
}

interface Variante {
  ID_VARIANTE: number;
  ID_PRODUCTO: number;
  COLOR: string | null;
  NOMBRE_ATRIBUTO: string | null;
  ATRIBUTO: string | null;
  STOCK: number;
}

function ProductoItem({ item, descuentoPorcentaje }: { item: Producto; descuentoPorcentaje?: number }) {
  const { esFavorito, toggleFavorito } = useFavoritos();
  const { addToCart, mostrarToastCarrito } = useCart();
  const { estaLogueado } = useAuth();
  const { mostrarAvisoLogin } = useAvisoLogin();
  const favorito = esFavorito(item.ID);
  const stock = Number(item.STOCK ?? 0);
  const imagenUri = resolverImagen(item.IMAGEN) || undefined;
  const pct = descuentoPorcentaje ?? 0;
  const precioFinal = pct > 0 ? Math.round(item.PRECIO * (1 - pct / 100)) : item.PRECIO;
  const idVariante = item.ID_VARIANTE_POR_DEFECTO ?? null;
  const sinStock = stock <= 0;

  // --- Modal de variantes ---
  const [modalVisible, setModalVisible] = useState(false);
  const [variantes, setVariantes] = useState<Variante[]>([]);
  const [cargandoVariantes, setCargandoVariantes] = useState(false);
  const [colorSeleccionado, setColorSeleccionado] = useState("");
  const [atributoSeleccionado, setAtributoSeleccionado] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [agregando, setAgregando] = useState(false);

  const colores = useMemo(
    () => [...new Set(variantes.filter((v) => v.COLOR).map((v) => v.COLOR as string))],
    [variantes]
  );
  const nombreAtributo = variantes[0]?.NOMBRE_ATRIBUTO || "Atributo";
  const atributosDisponibles = useMemo(() => {
    const base = colorSeleccionado ? variantes.filter((v) => v.COLOR === colorSeleccionado) : variantes;
    return [...new Set(base.filter((v) => v.ATRIBUTO).map((v) => v.ATRIBUTO as string))];
  }, [variantes, colorSeleccionado]);

  const varianteSeleccionada = variantes.find(
    (v) => v.COLOR === (colorSeleccionado || null) && v.ATRIBUTO === (atributoSeleccionado || null)
  );
  const stockActual = varianteSeleccionada?.STOCK ?? 0;

  const abrirModal = async () => {
    if (!estaLogueado) {
      mostrarAvisoLogin("Para añadir productos al carrito necesitas iniciar sesión.");
      return;
    }
    setModalVisible(true);
    setCargandoVariantes(true);
    setVariantes([]);
    setColorSeleccionado("");
    setAtributoSeleccionado("");
    setCantidad(1);
    try {
      const res = await api.get(`/api/productos/${item.ID}/variantes`);
      const data: Variante[] = res.data || [];
      setVariantes(data);
      if (data.length === 1) {
        setColorSeleccionado(data[0].COLOR || "");
        setAtributoSeleccionado(data[0].ATRIBUTO || "");
      } else if (data.length === 0 && idVariante != null) {
        setModalVisible(false);
        const ok = await addToCart(item.ID, idVariante, 1);
        if (ok) mostrarToastCarrito("Producto añadido al carrito");
      }
    } catch (err) {
      console.error("Error al cargar variantes:", err);
      setModalVisible(false);
    } finally {
      setCargandoVariantes(false);
    }
  };

  const confirmar = async () => {
    if (!varianteSeleccionada) return;
    if (stockActual <= 0) return;
    setAgregando(true);
    const ok = await addToCart(item.ID, varianteSeleccionada.ID_VARIANTE, cantidad);
    setAgregando(false);
    if (ok) {
      setModalVisible(false);
      mostrarToastCarrito("Producto añadido al carrito");
    }
  };

  const seleccionAuto = useCallback(() => {
    if (variantes.length === 1) {
      setColorSeleccionado(variantes[0].COLOR || "");
      setAtributoSeleccionado(variantes[0].ATRIBUTO || "");
    }
  }, [variantes]);

  useEffect(() => {
    if (modalVisible) seleccionAuto();
  }, [modalVisible, seleccionAuto]);

  return (
    <>
      <View style={styles.card}>
        <Pressable style={styles.pressable} onPress={() => router.push(`/producto/${item.ID}`)}>
          <View>
            <Image source={imagenUri ? { uri: imagenUri } : undefined} style={styles.image} resizeMode="contain" />
            {sinStock && (
              <View style={styles.agotadoBadge}>
                <Text style={styles.agotadoText}>AGOTADO</Text>
              </View>
            )}
            {!sinStock && stock <= 10 && (
              <View style={styles.stockBajoBadge}>
                <Text style={styles.stockBajoText}>¡Solo quedan {stock}!</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.favBtn}
              onPress={() => toggleFavorito(item.ID)}
            >
              <Ionicons
                name={favorito ? "heart" : "heart-outline"}
                size={18}
                color={favorito ? "#e73737" : "#fff"}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.cardBody}>
            <View style={styles.textBlock}>
              <Text numberOfLines={2} style={styles.nombre}>
                {item.NOMBRE}
              </Text>
              {pct > 0 ? (
                <View style={styles.precioRow}>
                  <Text style={styles.precio}>${precioFinal.toLocaleString("es-CO")}</Text>
                  <Text style={styles.precioTachado}>${Number(item.PRECIO).toLocaleString("es-CO")}</Text>
                  <View style={styles.chip}>
                    <Text style={styles.chipText}>-{pct}%</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.precio}>
                  ${Number(item.PRECIO).toLocaleString("es-CO")}
                </Text>
              )}
            </View>
            <View style={styles.acciones}>
              <TouchableOpacity
                style={[styles.addBtn, sinStock && styles.addBtnDisabled]}
                disabled={sinStock}
                onPress={abrirModal}
              >
                <Ionicons name="cart" size={16} color="#fff" />
              </TouchableOpacity>
              <View style={styles.detailsBtn}>
                <Text style={styles.detailsText}>VER DETALLES</Text>
              </View>
            </View>
          </View>
        </Pressable>
      </View>

      {/* MODAL SELECCIÓN DE VARIANTE */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Image source={imagenUri ? { uri: imagenUri } : undefined} style={styles.sheetImg} resizeMode="contain" />
            <View style={styles.sheetTitles}>
              <Text numberOfLines={2} style={styles.sheetName}>{item.NOMBRE}</Text>
              <Text style={styles.sheetPrecio}>${Number(precioFinal).toLocaleString("es-CO")}</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={22} color="#111" />
            </TouchableOpacity>
          </View>

          {cargandoVariantes ? (
            <View style={styles.cargando}>
              <ActivityIndicator color="#e73737" />
            </View>
          ) : (
            <>
              {colores.length > 0 && (
                <View style={styles.selector}>
                  <Text style={styles.selectorTitle}>Color:</Text>
                  <View style={styles.opciones}>
                    {colores.map((color) => (
                      <TouchableOpacity
                        key={color}
                        style={[styles.opcionChip, colorSeleccionado === color && styles.opcionChipSelected]}
                        onPress={() => {
                          if (colorSeleccionado === color) {
                            setColorSeleccionado("");
                            setAtributoSeleccionado("");
                            return;
                          }
                          setColorSeleccionado(color);
                          const atributosDelNuevoColor = [
                            ...new Set(
                              variantes.filter((v) => v.COLOR === color).map((v) => v.ATRIBUTO as string)
                            ),
                          ];
                          if (!atributosDelNuevoColor.includes(atributoSeleccionado)) {
                            setAtributoSeleccionado("");
                          }
                        }}
                      >
                        <Text style={[styles.opcionChipText, colorSeleccionado === color && styles.opcionChipTextSelected]}>
                          {color}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {atributosDisponibles.length > 0 && (
                <View style={styles.selector}>
                  <Text style={styles.selectorTitle}>{nombreAtributo}:</Text>
                  <View style={styles.opciones}>
                    {atributosDisponibles.map((opcion) => (
                      <TouchableOpacity
                        key={opcion}
                        style={[styles.opcionChip, atributoSeleccionado === opcion && styles.opcionChipSelected]}
                        onPress={() => setAtributoSeleccionado(atributoSeleccionado === opcion ? "" : opcion)}
                      >
                        <Text style={[styles.opcionChipText, atributoSeleccionado === opcion && styles.opcionChipTextSelected]}>
                          {opcion}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {varianteSeleccionada && (
                <View style={styles.stockBox}>
                  {stockActual > 0 ? (
                    <Text style={styles.stockOk}>Stock disponible: {stockActual} unidades</Text>
                  ) : (
                    <Text style={styles.stockAgotado}>Agotado por el momento</Text>
                  )}
                </View>
              )}

              {varianteSeleccionada && stockActual > 0 && (
                <View style={styles.cantRow}>
                  <Text style={styles.cantLabel}>Cantidad:</Text>
                  <View style={styles.cantControl}>
                    <TouchableOpacity
                      style={styles.cantBtn}
                      onPress={() => setCantidad((c) => Math.max(1, c - 1))}
                      disabled={cantidad <= 1}
                    >
                      <Ionicons name="remove" size={18} color="#e73737" />
                    </TouchableOpacity>
                    <Text style={styles.cantValue}>{cantidad}</Text>
                    <TouchableOpacity
                      style={styles.cantBtn}
                      onPress={() => {
                        if (cantidad >= stockActual || cantidad >= 99) {
                          const variante = [colorSeleccionado, atributoSeleccionado]
                            .filter(Boolean)
                            .join(" ");
                          mostrarToastCarrito(
                            variante
                              ? `No hay más productos de ${variante} en stock.`
                              : "No hay más unidades de este producto en stock.",
                            "error"
                          );
                          return;
                        }
                        setCantidad((c) => Math.min(stockActual, Math.min(99, c + 1)));
                      }}
                    >
                      <Ionicons name="add" size={18} color="#e73737" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[
                  styles.addToCartBtn,
                  (!varianteSeleccionada || stockActual <= 0) && styles.addToCartBtnDisabled,
                ]}
                disabled={!varianteSeleccionada || stockActual <= 0 || agregando}
                onPress={confirmar}
              >
                {agregando ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="cart" size={18} color="#fff" />
                    <Text style={styles.addToCartText}>AÑADIR AL CARRITO</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
        <ToastCarrito />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "48%",
    backgroundColor: "#fff",
    marginBottom: 14,
    borderRadius: 12,
    overflow: "hidden",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.09,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  pressable: {
    flex: 1,
  },
  image: {
    width: "100%",
    height: 128,
    backgroundColor: "#f0f0f0",
  },
  agotadoBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#e73737",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  agotadoText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 10,
  },
  stockBajoBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "#f59e0b",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stockBajoText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 10,
  },
  favBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 15,
    padding: 5,
  },
  cardBody: {
    flex: 1,
    padding: 10,
  },
  textBlock: {
    marginBottom: 10,
  },
  nombre: {
    fontWeight: "bold",
    fontSize: 14,
    minHeight: 38,
  },
  precio: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 16,
    marginTop: 6,
  },
  precioRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 6,
    gap: 5,
  },
  precioTachado: {
    color: "#999",
    fontSize: 11,
    textDecorationLine: "line-through",
  },
  chip: {
    backgroundColor: "#e73737",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  chipText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 10,
  },
  acciones: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: "auto",
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#e73737",
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  detailsBtn: {
    flex: 1,
    backgroundColor: "#111",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  detailsText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 11,
  },
  // --- Modal ---
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 30,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sheetImg: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },
  sheetTitles: {
    flex: 1,
  },
  sheetName: {
    fontWeight: "bold",
    fontSize: 15,
  },
  sheetPrecio: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 16,
    marginTop: 4,
  },
  closeBtn: {
    padding: 6,
  },
  cargando: {
    paddingVertical: 30,
    alignItems: "center",
  },
  selector: {
    marginBottom: 14,
  },
  selectorTitle: {
    fontWeight: "700",
    fontSize: 14,
    marginBottom: 8,
    color: "#333",
  },
  opciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  opcionChip: {
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  opcionChipSelected: {
    borderColor: "#e73737",
    backgroundColor: "#fdeaea",
  },
  opcionChipText: {
    color: "#444",
    fontSize: 14,
    fontWeight: "600",
  },
  opcionChipTextSelected: {
    color: "#e73737",
    fontWeight: "bold",
  },
  chipSelected: {
    borderColor: "#e73737",
    borderWidth: 2,
    backgroundColor: "#fdeaea",
  },
  chipTextSelected: {
    color: "#e73737",
    fontWeight: "bold",
  },
  stockBox: {
    marginBottom: 14,
  },
  stockOk: {
    color: "#16a34a",
    fontWeight: "600",
    fontSize: 13,
  },
  stockAgotado: {
    color: "#e73737",
    fontWeight: "600",
    fontSize: 13,
  },
  cantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  cantLabel: {
    fontWeight: "600",
    fontSize: 14,
    color: "#333",
  },
  cantControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  cantBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e73737",
    justifyContent: "center",
    alignItems: "center",
  },
  cantValue: {
    fontSize: 16,
    fontWeight: "bold",
    minWidth: 24,
    textAlign: "center",
  },
  addToCartBtn: {
    backgroundColor: "#e73737",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addToCartBtnDisabled: {
    opacity: 0.4,
  },
  addToCartText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
    letterSpacing: 0.5,
  },
});

export default memo(ProductoItem);