import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Modal, RefreshControl } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";
import { resolverImagen } from "../../constants/api";
import api from "../../constants/api";
import { type Producto } from "../../components/ProductoItem";

type Recomendado = Producto & { _pct?: number };

function RecomendadoCard({ p }: { p: Recomendado }) {
  const { addToCart, mostrarToastCarrito } = useCart();
  const pct = p._pct ?? 0;
  const stock = Number(p.STOCK ?? 0);
  const precioFinal = pct > 0 ? Math.round(Number(p.PRECIO) * (1 - pct / 100)) : Number(p.PRECIO);
  const idVariante = p.ID_VARIANTE_POR_DEFECTO ?? null;
  const puedeAgregar = stock > 0 && idVariante != null;

  const [modalVisible, setModalVisible] = useState(false);
  const [variantes, setVariantes] = useState<any[]>([]);
  const [cargandoVariantes, setCargandoVariantes] = useState(false);
  const [colorSel, setColorSel] = useState("");
  const [atributoSel, setAtributoSel] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [agregando, setAgregando] = useState(false);

  const abrirModal = async () => {
    if (!puedeAgregar) return;
    setModalVisible(true);
    setCargandoVariantes(true);
    setColorSel("");
    setAtributoSel("");
    setCantidad(1);
    try {
      const res = await api.get(`/api/productos/${p.ID}/variantes`);
      const data = res.data || [];
      setVariantes(data);
      if (data.length === 1) {
        setColorSel(data[0].COLOR || "");
        setAtributoSel(data[0].ATRIBUTO || "");
      }
    } catch {
      setModalVisible(false);
    } finally {
      setCargandoVariantes(false);
    }
  };

  const nombreAtributo = variantes[0]?.NOMBRE_ATRIBUTO || "Atributo";
  const colores = [...new Set(variantes.map((v) => v.COLOR))];
  const atributos = [
    ...new Set(
      variantes
        .filter((v) => (colorSel ? v.COLOR === colorSel : true))
        .map((v) => v.ATRIBUTO)
    ),
  ];
  const varianteSel = variantes.find(
    (v) => v.COLOR === colorSel && v.ATRIBUTO === atributoSel
  );
  const stockSel = Number(varianteSel?.STOCK ?? 0);

  const confirmar = async () => {
    if (!varianteSel) return;
    if (stockSel <= 0) return;
    setAgregando(true);
    const ok = await addToCart(p.ID, varianteSel.ID_VARIANTE, cantidad);
    setAgregando(false);
    if (ok) {
      setModalVisible(false);
      mostrarToastCarrito("Producto añadido al carrito");
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.recCard} activeOpacity={0.9} onPress={() => router.push(`/producto/${p.ID}`)}>
        <View style={styles.recImgWrap}>
          <Image source={{ uri: resolverImagen(p.IMAGEN) || undefined }} style={styles.recImg} resizeMode="contain" />
          {pct > 0 && (
            <View style={styles.recChip}>
              <Text style={styles.recChipText}>-{pct}%</Text>
            </View>
          )}
          {stock <= 0 && (
            <View style={styles.recAgotado}>
              <Text style={styles.recAgotadoText}>AGOTADO</Text>
            </View>
          )}
          <TouchableOpacity
            style={[styles.recAdd, !puedeAgregar && styles.recAddDisabled]}
            disabled={!puedeAgregar}
            onPress={abrirModal}
          >
            <Ionicons name="cart" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text numberOfLines={2} style={styles.recName}>
          {p.NOMBRE}
        </Text>
        <View style={styles.recPriceRow}>
          <Text style={styles.recPrice}>${precioFinal.toLocaleString("es-CO")}</Text>
          {pct > 0 && <Text style={styles.recOld}>${Number(p.PRECIO).toLocaleString("es-CO")}</Text>}
        </View>
      </TouchableOpacity>

      {/* MODAL SELECCIÓN DE VARIANTE */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.recBackdrop}>
          <View style={styles.recSheet}>
            <View style={styles.recSheetHeader}>
              <Image source={{ uri: resolverImagen(p.IMAGEN) || undefined }} style={styles.recSheetImg} resizeMode="contain" />
              <View style={styles.recSheetTitles}>
                <Text numberOfLines={2} style={styles.recSheetName}>{p.NOMBRE}</Text>
                <Text style={styles.recSheetPrecio}>${precioFinal.toLocaleString("es-CO")}</Text>
              </View>
              <TouchableOpacity style={styles.recCloseBtn} onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            {cargandoVariantes ? (
              <View style={styles.recCargando}>
                <ActivityIndicator color="#e73737" />
              </View>
            ) : (
              <>
                {colores.length > 0 && (
                  <View style={styles.recSelector}>
                    <Text style={styles.recSelectorTitle}>Color:</Text>
                    <View style={styles.recOpciones}>
                      {colores.map((color) => (
                        <TouchableOpacity
                          key={color}
                          style={[styles.recSelChip, colorSel === color && styles.recSelChipSelected]}
                          onPress={() => {
                            if (colorSel === color) {
                              setColorSel("");
                              setAtributoSel("");
                              return;
                            }
                            setColorSel(color);
                            const atributosDelNuevoColor = [
                              ...new Set(variantes.filter((v) => v.COLOR === color).map((v) => v.ATRIBUTO)),
                            ];
                            if (!atributosDelNuevoColor.includes(atributoSel)) setAtributoSel("");
                          }}
                        >
                          <Text style={[styles.recSelChipText, colorSel === color && styles.recSelChipTextSelected]}>{color}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {atributos.length > 0 && (
                  <View style={styles.recSelector}>
                    <Text style={styles.recSelectorTitle}>{nombreAtributo}:</Text>
                    <View style={styles.recOpciones}>
                      {atributos.map((opcion) => (
                        <TouchableOpacity
                          key={opcion}
                          style={[styles.recSelChip, atributoSel === opcion && styles.recSelChipSelected]}
                          onPress={() => setAtributoSel(atributoSel === opcion ? "" : opcion)}
                        >
                          <Text style={[styles.recSelChipText, atributoSel === opcion && styles.recSelChipTextSelected]}>{opcion}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {varianteSel && (
                  <View style={styles.recStockBox}>
                    {stockSel > 0 ? (
                      <Text style={styles.recStockOk}>Stock disponible: {stockSel} unidades</Text>
                    ) : (
                      <Text style={styles.recStockAgotado}>Agotado por el momento</Text>
                    )}
                  </View>
                )}

                {varianteSel && stockSel > 0 && (
                  <View style={styles.recCantRow}>
                    <Text style={styles.recCantLabel}>Cantidad:</Text>
                    <View style={styles.recCantControl}>
                      <TouchableOpacity
                        style={styles.recCantBtn}
                        onPress={() => setCantidad((c) => Math.max(1, c - 1))}
                        disabled={cantidad <= 1}
                      >
                        <Ionicons name="remove" size={18} color="#e73737" />
                      </TouchableOpacity>
                      <Text style={styles.recCantValue}>{cantidad}</Text>
                      <TouchableOpacity
                        style={styles.recCantBtn}
                        onPress={() => {
                          if (cantidad >= stockSel || cantidad >= 99) {
                            mostrarToastCarrito("No hay más unidades de este producto en stock.", "error");
                            return;
                          }
                          setCantidad((c) => Math.min(stockSel, Math.min(99, c + 1)));
                        }}
                      >
                        <Ionicons name="add" size={18} color="#e73737" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={[
                    styles.recAddBtn,
                    (!varianteSel || stockSel <= 0) && styles.recAddBtnDisabled,
                  ]}
                  disabled={!varianteSel || stockSel <= 0 || agregando}
                  onPress={confirmar}
                >
                  {agregando ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="cart" size={18} color="#fff" />
                      <Text style={styles.recAddBtnText}>AÑADIR AL CARRITO</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

export default function CarritoScreen() {
  const { cart, loadingCart, increaseQuantity, decreaseQuantity, removeFromCart, totalProductos, fetchCart } = useCart();
  const { estaLogueado } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [recomendados, setRecomendados] = useState<Recomendado[]>([]);
  const [cargandoRecomendados, setCargandoRecomendados] = useState(false);
  const [itemAEliminar, setItemAEliminar] = useState<any>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCart({ silencioso: true });
    setRefreshing(false);
  }, [fetchCart]);

  const cargarRecomendados = useCallback(async () => {
    setCargandoRecomendados(true);
    try {
      const [todosRes, favRes, recRes, dctRes] = await Promise.all([
        api.get("/api/productos"),
        api.get("/api/favoritos"),
        api.get("/api/productos/recomendados"),
        api.get("/api/productos/descuentos"),
      ]);
      const todos: Producto[] = todosRes.data || [];
      const descuentosMap: Record<number, number> = {};
      (dctRes.data || []).forEach((d: { ID_DESCUENTO: number; PORCENTAJE: number }) => {
        if (d.ID_DESCUENTO != null) descuentosMap[d.ID_DESCUENTO] = Number(d.PORCENTAJE) || 0;
      });
      const conPct = todos.map((p) => ({
        ...p,
        _pct: p.ID_DESCUENTO != null ? descuentosMap[p.ID_DESCUENTO] ?? 0 : 0,
      })) as Recomendado[];
      const porId = new Map<number, Recomendado>(conPct.map((p) => [p.ID, p]));

      const favoritos = ((favRes.data || []) as { ID: number }[])
        .map((f) => porId.get(f.ID))
        .filter((p): p is Recomendado => !!p);
      const similares = ((recRes.data?.productos || []) as Producto[])
        .map((p) => porId.get(p.ID) || { ...p, _pct: p.ID_DESCUENTO != null ? descuentosMap[p.ID_DESCUENTO] ?? 0 : 0 })
        .filter((p): p is Recomendado => !!p);

      const unidos: Recomendado[] = [];
      const vistos = new Set<number>();
      const agregar = (lista: Recomendado[]) => {
        for (const p of lista) {
          if (vistos.has(p.ID)) continue;
          vistos.add(p.ID);
          unidos.push(p);
          if (unidos.length >= 10) break;
        }
      };
      agregar(favoritos);
      if (unidos.length < 10) agregar(similares);
      // Siempre completar con productos al azar para que la sección tenga variedad
      if (unidos.length < 10) {
        const barajados = [...conPct].sort(() => Math.random() - 0.5);
        for (const p of barajados) {
          if (vistos.has(p.ID)) continue;
          vistos.add(p.ID);
          unidos.push(p);
          if (unidos.length >= 10) break;
        }
      }
      setRecomendados(unidos);
    } catch {
      setRecomendados([]);
    } finally {
      setCargandoRecomendados(false);
    }
  }, []);

  useEffect(() => {
    if (estaLogueado) cargarRecomendados();
  }, [estaLogueado, cargarRecomendados]);

  if (!estaLogueado) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Carrito</Text>
        <Text style={styles.subtitle}>Inicia sesión para ver tu carrito</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>INICIAR SESIÓN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loadingCart) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e73737" />
      </View>
    );
  }

  const subtotal = cart.reduce(
    (acc, item) => acc + Number(item.PRECIO) * item.CANTIDAD,
    0
  );

  const idsEnCarrito = new Set(cart.map((c) => c.ID));
  const paraMostrar = recomendados.filter((p) => !idsEnCarrito.has(p.ID));

  const renderItem = ({ item }: { item: any }) => {
    const stock = Number(item.STOCK ?? 0);
    const subtotalItem = Number(item.PRECIO) * item.CANTIDAD;
    return (
      <View style={styles.itemCard}>
        <View style={styles.itemImgWrap}>
          <Image source={{ uri: resolverImagen(item.IMAGEN) || undefined }} style={styles.itemImage} resizeMode="contain" />
          <TouchableOpacity style={styles.itemDelete} onPress={() => setItemAEliminar(item)}>
            <Ionicons name="close" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.itemBody}>
          <Text numberOfLines={2} style={styles.itemName}>
            {item.NOMBRE}
          </Text>
          {item.COLOR || item.ATRIBUTO ? (
            <View style={styles.itemVariantPill}>
              <Text style={styles.itemVariant} numberOfLines={1}>
                {[item.COLOR, item.ATRIBUTO].filter(Boolean).join(" · ")}
              </Text>
            </View>
          ) : null}
          <View style={styles.itemPriceRow}>
            <Text style={styles.itemPrice}>
              ${Number(item.PRECIO).toLocaleString("es-CO")} <Text style={styles.itemPriceUnit}>c/u</Text>
            </Text>
            <Text style={styles.itemSubtotal}>${subtotalItem.toLocaleString("es-CO")}</Text>
          </View>
          <View style={styles.qtyRow}>
            <View style={styles.qtyGroup}>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => decreaseQuantity(item.ID_CARRITO)}>
                <Ionicons name="remove" size={16} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.CANTIDAD}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={() => increaseQuantity(item.ID_CARRITO)}>
                <Ionicons name="add" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
            {stock > 0 && stock <= 5 ? (
              <Text style={styles.stockLow}>¡Solo quedan {stock}!</Text>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <FlatList
        style={styles.container}
        data={cart}
        keyExtractor={(item) => item.ID_CARRITO.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#e73737"]}
            tintColor="#e73737"
          />
        }
        ListHeaderComponent={
          <Text style={styles.headerTitle}>
            MI CARRITO ({totalProductos} {totalProductos === 1 ? "producto" : "productos"})
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="cart-outline" size={64} color="#ccc" />
            <Text style={styles.title}>Tu carrito está vacío</Text>
            <Text style={styles.subtitle}>Explora el catálogo y agrega productos</Text>
            <TouchableOpacity style={styles.button} onPress={() => router.push("/catalogo")}>
              <Text style={styles.buttonText}>VER CATÁLOGO</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={renderItem}
        ListFooterComponent={
          <View>
            {cart.length > 0 ? (
              <View style={styles.footer}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Subtotal</Text>
                  <Text style={styles.totalValue}>${subtotal.toLocaleString("es-CO")}</Text>
                </View>
                <TouchableOpacity style={styles.checkoutBtn} onPress={() => router.push("/checkout")}>
                  <Text style={styles.checkoutBtnText}>CONTINUAR AL PAGO</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {cargandoRecomendados ? (
              <ActivityIndicator style={styles.recLoading} color="#e73737" />
            ) : paraMostrar.length > 0 ? (
              <View style={styles.recSection}>
                <Text style={styles.recTitle}>TE PUEDE GUSTAR</Text>
                <FlatList
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  data={paraMostrar}
                  keyExtractor={(p) => p.ID.toString()}
                  renderItem={({ item }) => <RecomendadoCard p={item} />}
                />
              </View>
            ) : null}
          </View>
        }
      />

      {/* MODAL: ¿Seguro que deseas eliminar del carrito? */}
      <Modal
        visible={itemAEliminar != null}
        transparent
        animationType="fade"
        onRequestClose={() => setItemAEliminar(null)}
      >
        <View style={styles.confBackdrop}>
          <View style={styles.confCard}>
            <View style={styles.confIconWrap}>
              <Ionicons name="trash-outline" size={26} color="#e73737" />
            </View>
            <Text style={styles.confTitle}>¿Eliminar del carrito?</Text>
            <Text style={styles.confText} numberOfLines={2}>
              ¿Seguro que deseas eliminar "{itemAEliminar?.NOMBRE}" de tu carrito?
            </Text>
            <View style={styles.confBtns}>
              <TouchableOpacity style={styles.confCancel} onPress={() => setItemAEliminar(null)}>
                <Text style={styles.confCancelText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confDelete}
                onPress={() => {
                  if (itemAEliminar) removeFromCart(itemAEliminar.ID_CARRITO);
                  setItemAEliminar(null);
                }}
              >
                <Text style={styles.confDeleteText}>SÍ, ELIMINAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
    backgroundColor: "#fff",
  },
  listContent: {
    padding: 15,
    paddingBottom: 120,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#002244",
  },
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 40,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 12,
    padding: 10,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  itemImgWrap: {
    position: "relative",
  },
  itemImage: {
    width: 96,
    height: 104,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },
  itemDelete: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(231, 55, 55, 0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  itemBody: {
    flex: 1,
    paddingLeft: 12,
  },
  itemName: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#111827",
  },
  itemVariantPill: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f5f9",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 5,
    maxWidth: "100%",
  },
  itemVariant: {
    color: "#475569",
    fontSize: 11,
  },
  itemPriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 6,
  },
  itemPrice: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 14,
  },
  itemPriceUnit: {
    fontWeight: "400",
    color: "#9ca3af",
    fontSize: 11,
  },
  itemSubtotal: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#002244",
  },
  qtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  qtyGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  qtyBtn: {
    backgroundColor: "#002244",
    borderRadius: 8,
    padding: 5,
  },
  qtyText: {
    marginHorizontal: 12,
    fontWeight: "bold",
    fontSize: 15,
    minWidth: 18,
    textAlign: "center",
  },
  stockLow: {
    color: "#b45309",
    fontSize: 11,
    fontWeight: "600",
  },
  footer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 15,
    marginTop: 5,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  totalValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#e73737",
  },
  checkoutBtn: {
    backgroundColor: "#e73737",
    padding: 15,
    borderRadius: 10,
  },
  checkoutBtnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  recLoading: {
    marginTop: 20,
  },
  recSection: {
    marginTop: 22,
  },
  recTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#002244",
    marginBottom: 12,
  },
  recCard: {
    width: 150,
    marginRight: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  recImgWrap: {
    position: "relative",
  },
  recImg: {
    width: "100%",
    height: 110,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  recChip: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "#e73737",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recChipText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 10,
  },
  recAgotado: {
    position: "absolute",
    bottom: 6,
    left: 6,
    backgroundColor: "rgba(17, 17, 17, 0.8)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recAgotadoText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 9,
  },
  recAdd: {
    position: "absolute",
    right: 6,
    bottom: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e73737",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  recAddDisabled: {
    backgroundColor: "#cbd5e1",
  },
  recName: {
    fontWeight: "bold",
    fontSize: 12.5,
    color: "#111827",
    marginTop: 8,
    minHeight: 34,
  },
  recPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  recPrice: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 13.5,
  },
  recOld: {
    color: "#9ca3af",
    fontSize: 10.5,
    textDecorationLine: "line-through",
  },
  button: {
    backgroundColor: "#e73737",
    padding: 15,
    borderRadius: 10,
    width: "100%",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    color: "#666",
    marginBottom: 25,
    textAlign: "center",
  },
  confBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  confCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 22,
    alignItems: "center",
  },
  confIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  confTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#111",
    textAlign: "center",
  },
  confText: {
    fontSize: 13.5,
    color: "#555",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 19,
  },
  confBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
    width: "100%",
  },
  confCancel: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  confCancelText: {
    color: "#374151",
    fontWeight: "bold",
    fontSize: 13,
  },
  confDelete: {
    flex: 1,
    backgroundColor: "#e73737",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  confDeleteText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
  recBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  recSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    paddingBottom: 34,
  },
  recSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  recSheetImg: {
    width: 64,
    height: 64,
    borderRadius: 10,
    backgroundColor: "#f0f0f0",
  },
  recSheetTitles: {
    flex: 1,
  },
  recSheetName: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#111",
  },
  recSheetPrecio: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 16,
    marginTop: 3,
  },
  recCloseBtn: {
    padding: 4,
  },
  recCargando: {
    paddingVertical: 30,
    alignItems: "center",
  },
  recSelector: {
    marginTop: 12,
  },
  recSelectorTitle: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 8,
  },
  recOpciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  recSelChip: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  recSelChipSelected: {
    backgroundColor: "#e73737",
    borderColor: "#e73737",
  },
  recSelChipText: {
    color: "#333",
    fontSize: 13,
  },
  recSelChipTextSelected: {
    color: "#fff",
    fontWeight: "bold",
  },
  recStockBox: {
    marginTop: 14,
  },
  recStockOk: {
    color: "#16a34a",
    fontWeight: "bold",
    fontSize: 13.5,
  },
  recStockAgotado: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 13.5,
  },
  recCantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
  },
  recCantLabel: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#111",
  },
  recCantControl: {
    flexDirection: "row",
    alignItems: "center",
  },
  recCantBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    padding: 7,
  },
  recCantValue: {
    marginHorizontal: 14,
    fontWeight: "bold",
    fontSize: 16,
    minWidth: 20,
    textAlign: "center",
  },
  recAddBtn: {
    marginTop: 18,
    backgroundColor: "#e73737",
    borderRadius: 12,
    padding: 15,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  recAddBtnDisabled: {
    opacity: 0.45,
  },
  recAddBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
});