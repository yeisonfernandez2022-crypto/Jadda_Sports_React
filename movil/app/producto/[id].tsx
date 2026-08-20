import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { volverAtras } from "../../utils/navegacion";
import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { resolverImagen } from "../../constants/api";
import { useCart } from "../../context/CartContext";
import { useFavoritos } from "../../context/FavoritosContext";
import { useAuth } from "../../context/AuthContext";
import ZoomableImage from "../../components/ZoomableImage";

interface ImagenProducto {
  url: string;
  ORDEN: number;
}

interface Caracteristica {
  NOMBRE_ATRIBUTO: string;
  VALOR_ATRIBUTO: string;
}

interface Variante {
  ID_VARIANTE: number;
  COLOR: string;
  NOMBRE_ATRIBUTO: string;
  ATRIBUTO: string;
  STOCK: number;
}

interface Resena {
  ID_USUARIO: number;
  NOMBRE_USUARIO: string;
  FOTO_URL: string | null;
  CALIFICACION: number;
  COMENTARIO: string | null;
  FECHA: string;
}

interface Producto {
  ID: number;
  NOMBRE: string;
  DESCRIPCION: string;
  PRECIO: number;
  MARCA: string;
  CATEGORIA: string;
  STOCK: number;
  ID_DESCUENTO: number | null;
  IMAGENES: ImagenProducto[];
  CARACTERISTICAS: Caracteristica[];
  VARIANTES: Variante[];
}

export default function ProductoDetalle() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { addToCart } = useCart();
  const { esFavorito, toggleFavorito } = useFavoritos();
  const { estaLogueado } = useAuth();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [indiceImagen, setIndiceImagen] = useState(0);
  const [colorSeleccionado, setColorSeleccionado] = useState("");
  const [atributoSeleccionado, setAtributoSeleccionado] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});
  const [agregado, setAgregado] = useState(false);

  const [galeriaAbierta, setGaleriaAbierta] = useState(false);
  const [resenas, setResenas] = useState<Resena[]>([]);
  const [calificacion, setCalificacion] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviandoResena, setEnviandoResena] = useState(false);

  const insets = useSafeAreaInsets();
  const { width: anchoVentana, height: altoVentana } = useWindowDimensions();

  useEffect(() => {
    cargarProducto();
    api.get("/api/productos/descuentos")
      .then((res) => {
        const map: Record<number, number> = {};
        res.data.forEach((d: { ID_DESCUENTO: number; PORCENTAJE: number }) => {
          map[d.ID_DESCUENTO] = d.PORCENTAJE;
        });
        setDescuentosMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (id) {
      cargarResenas();
    }
  }, [id]);

  useEffect(() => {
    setCantidad(1);
  }, [colorSeleccionado, atributoSeleccionado]);

  async function cargarProducto() {
    try {
      const response = await api.get(`/api/productos/${id}`);
      setProducto(response.data);
    } catch (error) {
      console.log("Error cargando producto:", error);
    } finally {
      setLoading(false);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await cargarProducto();
    try {
      const res = await api.get("/api/productos/descuentos");
      const map: Record<number, number> = {};
      res.data.forEach((d: { ID_DESCUENTO: number; PORCENTAJE: number }) => {
        map[d.ID_DESCUENTO] = d.PORCENTAJE;
      });
      setDescuentosMap(map);
    } catch {}
    await cargarResenas();
    setRefreshing(false);
  };

  const cargarResenas = async () => {
    try {
      const res = await api.get(`/api/productos/${id}/resenas`);
      setResenas(res.data || []);
    } catch {}
  };

  const enviarResena = async () => {
    if (calificacion === 0) return;
    setEnviandoResena(true);
    try {
      await api.post(`/api/productos/${id}/resenas`, {
        calificacion,
        comentario: comentario.trim(),
      });
      setComentario("");
      setCalificacion(0);
      await cargarResenas();
      Alert.alert("¡Gracias!", "Tu reseña fue publicada.");
    } catch {
      Alert.alert("Error", "No se pudo publicar tu reseña. Intenta de nuevo.");
    } finally {
      setEnviandoResena(false);
    }
  };

  const formatearFecha = (f: string) => {
    try {
      const fecha = new Date(f.includes(" ") ? f.replace(" ", "T") : f);
      if (isNaN(fecha.getTime())) return "";
      return fecha.toLocaleDateString("es-CO", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const promedio = resenas.length
    ? resenas.reduce((acc, r) => acc + Number(r.CALIFICACION || 0), 0) / resenas.length
    : 0;

  const favorito = esFavorito(Number(id));

  const colores = useMemo(
    () => [...new Set((producto?.VARIANTES || []).map((v) => v.COLOR))],
    [producto]
  );

  const nombreAtributo = producto?.VARIANTES?.[0]?.NOMBRE_ATRIBUTO || "Atributo";

  const atributosDisponibles = useMemo(() => {
    const v = producto?.VARIANTES || [];
    const base = colorSeleccionado ? v.filter((x) => x.COLOR === colorSeleccionado) : v;
    return [...new Set(base.map((x) => x.ATRIBUTO))];
  }, [producto, colorSeleccionado]);

  const varianteSeleccionada = producto?.VARIANTES?.find(
    (v) => v.COLOR === colorSeleccionado && v.ATRIBUTO === atributoSeleccionado
  );

  const stockActual = varianteSeleccionada?.STOCK || 0;
  const totalStock = (producto?.VARIANTES || []).reduce((acc, v) => acc + Number(v.STOCK || 0), 0);

  const precioFinal = useMemo(() => {
    if (!producto) return 0;
    return producto.ID_DESCUENTO != null && descuentosMap[producto.ID_DESCUENTO]
      ? Number(producto.PRECIO) * (1 - Number(descuentosMap[producto.ID_DESCUENTO]) / 100)
      : Number(producto.PRECIO);
  }, [producto, descuentosMap]);

  const pctDescuento = producto?.ID_DESCUENTO != null ? descuentosMap[producto.ID_DESCUENTO] || 0 : 0;

  const cambiarColor = (color: string) => {
    if (colorSeleccionado === color) {
      setColorSeleccionado("");
      return;
    }
    setColorSeleccionado(color);
    const atributosDelNuevoColor = [...new Set((producto?.VARIANTES || []).filter((v) => v.COLOR === color).map((v) => v.ATRIBUTO))];
    if (!atributosDelNuevoColor.includes(atributoSeleccionado)) {
      setAtributoSeleccionado("");
    }
  };

  const handleAgregar = async () => {
    if (!producto) return;
    if (!colorSeleccionado || !atributoSeleccionado) {
      Alert.alert("SELECCIONA LAS OPCIONES", `Debes elegir color y ${nombreAtributo.toLowerCase()} para agregar al carrito.`);
      return;
    }
    if (!varianteSeleccionada) return;
    const ok = await addToCart(producto.ID, varianteSeleccionada.ID_VARIANTE, cantidad);
    if (ok) {
      setAgregado(true);
      setTimeout(() => setAgregado(false), 2000);
    }
  };

  const suscribirAviso = async () => {
    if (!estaLogueado) {
      Alert.alert("INICIA SESIÓN", "Debes iniciar sesión para que te avisemos cuando vuelva a estar disponible.", [
        { text: "Ahora no" },
        { text: "Iniciar sesión", onPress: () => router.push("/login") },
      ]);
      return;
    }
    if (!varianteSeleccionada) return;
    try {
      await api.post(`/api/productos/variantes/${varianteSeleccionada.ID_VARIANTE}/suscribir`);
      Alert.alert("¡Listo!", "Te avisaremos por correo y notificaciones cuando vuelva a estar disponible.");
    } catch {
      Alert.alert("Error", "No se pudo guardar el aviso. Intenta de nuevo.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#e73737" />
        <Text style={{ marginTop: 15 }}>Cargando producto...</Text>
      </View>
    );
  }

  if (!producto) {
    return (
      <View style={styles.loading}>
        <Text>Producto no encontrado</Text>
      </View>
    );
  }

  const imagenes = producto.IMAGENES || [];

  return (
    <View style={styles.page}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 110 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={["#e73737"]}
          tintColor="#e73737"
        />
      }
    >
      {/* IMAGEN PRINCIPAL */}
      <View style={styles.imageWrap}>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => imagenes.length > 0 && setGaleriaAbierta(true)}
        >
          <Image
            source={{ uri: resolverImagen(imagenes[indiceImagen]?.url) || undefined }}
            style={styles.image}
            resizeMode="contain"
          />
        </TouchableOpacity>
        {totalStock <= 0 && (
          <View style={styles.agotadoOverlay} pointerEvents="none">
            <Text style={styles.agotadoText}>AGOTADO</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={volverAtras}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.favBtn, { top: insets.top + 12 }]}
          onPress={() => toggleFavorito(Number(id))}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={favorito ? "heart" : "heart-outline"} size={24} color={favorito ? "#e73737" : "#fff"} />
        </TouchableOpacity>
      </View>

      {/* MINIATURAS */}
      {imagenes.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
          {imagenes.map((img, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => {
                setIndiceImagen(index);
                setGaleriaAbierta(true);
              }}
            >
              <Image
                source={{ uri: resolverImagen(img.url) || undefined }}
                style={[styles.thumbnail, indiceImagen === index && styles.thumbnailActive]}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={styles.content}>
        {/* CHIPS CATEGORÍA + MARCA */}
        <View style={styles.tagsRow}>
          {producto.CATEGORIA ? (
            <View style={styles.tagCategoria}>
              <Text style={styles.tagCategoriaText}>{producto.CATEGORIA.toUpperCase()}</Text>
            </View>
          ) : null}
          {producto.MARCA ? (
            <View style={styles.tagMarca}>
              <Text style={styles.tagMarcaText}>{producto.MARCA.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.nombre}>{producto.NOMBRE}</Text>

        {resenas.length > 0 && (
          <View style={styles.ratingRow}>
            <View style={styles.ratingEstrellas}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons
                  key={n}
                  name={n <= Math.round(promedio) ? "star" : "star-outline"}
                  size={15}
                  color="#ffd166"
                />
              ))}
            </View>
            <Text style={styles.ratingTexto}>
              {promedio.toFixed(1)} · {resenas.length} reseña{resenas.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        {pctDescuento > 0 ? (
          <>
            <View style={styles.precioRow}>
              <Text style={styles.precioDescuento}>
                ${precioFinal.toLocaleString("es-CO")}
              </Text>
              <View style={styles.chipDescuento}>
                <Text style={styles.chipDescuentoText}>-{pctDescuento}%</Text>
              </View>
            </View>
            <Text style={styles.precioOriginal}>${Number(producto.PRECIO).toLocaleString("es-CO")}</Text>
          </>
        ) : (
          <Text style={styles.precio}>${Number(producto.PRECIO).toLocaleString("es-CO")}</Text>
        )}

        {/* SELECTOR DE COLOR */}
        {colores.length > 0 && (
          <View style={styles.selector}>
            <Text style={styles.selectorTitle}>Color:</Text>
            <View style={styles.opciones}>
              {colores.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[styles.chip, colorSeleccionado === color && styles.chipSelected]}
                  onPress={() => cambiarColor(color)}
                >
                  <Text style={[styles.chipText, colorSeleccionado === color && styles.chipTextSelected]}>
                    {color}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* SELECTOR DE ATRIBUTO */}
        {atributosDisponibles.length > 0 && (
          <View style={styles.selector}>
            <Text style={styles.selectorTitle}>{nombreAtributo}:</Text>
            <View style={styles.opciones}>
              {atributosDisponibles.map((opcion) => (
                <TouchableOpacity
                  key={opcion}
                  style={[styles.chip, atributoSeleccionado === opcion && styles.chipSelected]}
                  onPress={() =>
                    setAtributoSeleccionado(atributoSeleccionado === opcion ? "" : opcion)
                  }
                >
                  <Text style={[styles.chipText, atributoSeleccionado === opcion && styles.chipTextSelected]}>
                    {opcion}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* HINT DE SELECCIÓN */}
        {(!colorSeleccionado || !atributoSeleccionado) && (
          <Text style={styles.selectorHint}>
            Selecciona color y {nombreAtributo.toLowerCase()} para continuar
          </Text>
        )}

        {/* STOCK DINÁMICO */}
        {colorSeleccionado && atributoSeleccionado && (
          <View style={styles.stockBox}>
            {stockActual > 0 ? (
              <Text style={styles.stockOk}>Stock disponible: {stockActual} unidades</Text>
            ) : (
              <Text style={styles.stockAgotado}>Agotado por el momento</Text>
            )}
          </View>
        )}

        {/* AVISO DE REPOSICIÓN (RF-035) */}
        {colorSeleccionado && atributoSeleccionado && stockActual <= 0 && (
          <TouchableOpacity style={styles.avisoBtn} onPress={suscribirAviso}>
            <Ionicons name="notifications-outline" size={18} color="#e73737" />
            <Text style={styles.avisoBtnText}>Avísame cuando vuelva a estar disponible</Text>
          </TouchableOpacity>
        )}

        {/* CANTIDAD */}
        <View style={styles.selector}>
          <Text style={styles.selectorTitle}>Cantidad:</Text>
          <View style={styles.cantidadRow}>
            <TouchableOpacity
              style={styles.cantBtn}
              onPress={() => {
                if (!colorSeleccionado || !atributoSeleccionado) {
                  Alert.alert("Selecciona las opciones", `Elige un color y ${nombreAtributo.toLowerCase()} primero.`);
                  return;
                }
                if (cantidad > 1) setCantidad(cantidad - 1);
              }}
            >
              <Text style={styles.cantBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.cantValue}>{cantidad}</Text>
            <TouchableOpacity
              style={styles.cantBtn}
              onPress={() => {
                if (!colorSeleccionado || !atributoSeleccionado) {
                  Alert.alert("Selecciona las opciones", `Elige un color y ${nombreAtributo.toLowerCase()} primero.`);
                  return;
                }
                if (cantidad < stockActual) {
                  setCantidad(cantidad + 1);
                } else {
                  Alert.alert("Stock limitado", "No hay más unidades disponibles.");
                }
              }}
            >
              <Text style={styles.cantBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.subtotal}>Subtotal: ${(precioFinal * cantidad).toLocaleString("es-CO")}</Text>
        </View>

        {/* BENEFICIOS */}
        <View style={styles.beneficios}>
          <View style={styles.beneficio}>
            <View style={styles.beneficioIco}>
              <Ionicons name="car" size={17} color="#e73737" />
            </View>
            <Text style={styles.beneficioText}>Envío gratis desde $800.000</Text>
          </View>
          <View style={styles.beneficioDiv} />
          <View style={styles.beneficio}>
            <View style={styles.beneficioIco}>
              <Ionicons name="shield-checkmark" size={17} color="#e73737" />
            </View>
            <Text style={styles.beneficioText}>Pago seguro SSL</Text>
          </View>
          <View style={styles.beneficioDiv} />
          <View style={styles.beneficio}>
            <View style={styles.beneficioIco}>
              <Ionicons name="refresh" size={17} color="#e73737" />
            </View>
            <Text style={styles.beneficioText}>Devoluciones y cambios</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* DESCRIPCIÓN */}
        <Text style={styles.sectionTitle}>DESCRIPCIÓN</Text>
        <View style={styles.card}>
          <Text style={styles.descripcion}>{producto.DESCRIPCION}</Text>
        </View>

        {/* CARACTERÍSTICAS */}
        {producto.CARACTERISTICAS && producto.CARACTERISTICAS.length > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>CARACTERÍSTICAS</Text>
            <View style={styles.card}>
              {producto.CARACTERISTICAS.map((item, index) => (
                <View key={index} style={[styles.featureRow, index === producto.CARACTERISTICAS.length - 1 && styles.featureRowLast]}>
                  <Text style={styles.featureName}>{item.NOMBRE_ATRIBUTO}</Text>
                  <Text style={styles.featureValue}>{item.VALOR_ATRIBUTO}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* RESEÑAS */}
        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>RESEÑAS ({resenas.length})</Text>

        {resenas.length > 0 && (
          <View style={styles.resenaPromedio}>
            <View style={styles.resenaEstrellas}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Ionicons
                  key={n}
                  name={n <= Math.round(promedio) ? "star" : "star-outline"}
                  size={18}
                  color="#ffd166"
                />
              ))}
            </View>
            <Text style={styles.resenaPromedioTexto}>
              {promedio.toFixed(1)} · {resenas.length} reseña{resenas.length !== 1 ? "s" : ""}
            </Text>
          </View>
        )}

        {resenas.map((r, i) => (
          <View key={i} style={styles.resenaItem}>
            <View style={styles.resenaHeader}>
              {r.FOTO_URL ? (
                <Image source={{ uri: resolverImagen(r.FOTO_URL) || undefined }} style={styles.resenaAvatar} />
              ) : (
                <View style={[styles.resenaAvatar, styles.resenaAvatarLetra]}>
                  <Text style={styles.resenaAvatarTexto}>{(r.NOMBRE_USUARIO || "?").charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.resenaNombre}>{r.NOMBRE_USUARIO || "Usuario"}</Text>
                <View style={styles.resenaEstrellas}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Ionicons
                      key={n}
                      name={n <= Number(r.CALIFICACION) ? "star" : "star-outline"}
                      size={13}
                      color="#ffd166"
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.resenaFecha}>{formatearFecha(r.FECHA)}</Text>
            </View>
            {r.COMENTARIO ? <Text style={styles.resenaComentario}>{r.COMENTARIO}</Text> : null}
          </View>
        ))}

        {estaLogueado ? (
          <View style={styles.resenaForm}>
            <Text style={styles.resenaFormTitle}>¿Qué opinas de este producto?</Text>
            <View style={styles.resenaEstrellasGrandes}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setCalificacion(n)}>
                  <Ionicons name={n <= calificacion ? "star" : "star-outline"} size={30} color="#ffd166" />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.resenaInput}
              placeholder="Escribe tu reseña (opcional)..."
              placeholderTextColor="#999"
              value={comentario}
              onChangeText={setComentario}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.resenaEnviar, calificacion === 0 && styles.resenaEnviarDisabled]}
              disabled={calificacion === 0 || enviandoResena}
              onPress={enviarResena}
            >
              {enviandoResena ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.resenaEnviarText}>PUBLICAR RESEÑA</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.resenaLogin}>
            <Text style={styles.resenaLoginText}>Inicia sesión para calificar y comentar este producto.</Text>
            <TouchableOpacity style={styles.resenaLoginBtn} onPress={() => router.push("/login")}>
              <Text style={styles.resenaLoginBtnText}>INICIAR SESIÓN</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>

    {/* BARRA FIJA: PRECIO + AÑADIR AL CARRITO */}
    <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
      <View style={styles.bottomPriceWrap}>
        <Text style={styles.bottomPrice}>${precioFinal.toLocaleString("es-CO")}</Text>
        {pctDescuento > 0 && (
          <Text style={styles.bottomOld}>${Number(producto.PRECIO).toLocaleString("es-CO")}</Text>
        )}
      </View>
      <TouchableOpacity
        style={[
          styles.bottomBtn,
          agregado && styles.cartButtonOk,
          (!colorSeleccionado || !atributoSeleccionado || stockActual <= 0) && styles.cartButtonDisabled,
        ]}
        disabled={!colorSeleccionado || !atributoSeleccionado || stockActual <= 0}
        onPress={handleAgregar}
      >
        {agregado ? (
          <>
            <Ionicons name="checkmark" size={19} color="#fff" />
            <Text style={styles.bottomBtnText}> AÑADIDO</Text>
          </>
        ) : (
          <>
            <Ionicons name="cart" size={19} color="#fff" />
            <Text style={styles.bottomBtnText}> AÑADIR AL CARRITO</Text>
          </>
        )}
      </TouchableOpacity>
    </View>

    {/* GALERÍA A PANTALLA COMPLETA CON ZOOM */}
    <Modal
      visible={galeriaAbierta}
      transparent={false}
      animationType="fade"
      onRequestClose={() => setGaleriaAbierta(false)}
    >
      <View style={styles.galeriaBackdrop}>
        <ZoomableImage
          key={imagenes[indiceImagen]?.url || "img"}
          url={imagenes[indiceImagen]?.url || ""}
          ancho={anchoVentana}
          alto={altoVentana}
        />
        <TouchableOpacity
          style={[styles.galeriaCerrar, { top: insets.top + 8 }]}
          onPress={() => setGaleriaAbierta(false)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={30} color="#fff" />
        </TouchableOpacity>
        {imagenes.length > 1 && (
          <>
            <Text style={[styles.galeriaContador, { top: insets.top + 18 }]}>
              {indiceImagen + 1} / {imagenes.length}
            </Text>
            <TouchableOpacity
              style={[styles.galeriaFlecha, styles.galeriaFlechaIzq]}
              onPress={() => setIndiceImagen((indiceImagen - 1 + imagenes.length) % imagenes.length)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-back" size={34} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.galeriaFlecha, styles.galeriaFlechaDer]}
              onPress={() => setIndiceImagen((indiceImagen + 1) % imagenes.length)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="chevron-forward" size={34} color="#fff" />
            </TouchableOpacity>
          </>
        )}
        {imagenes.length > 1 && (
          <View style={[styles.galeriaPie, { bottom: insets.bottom + 20 }]}>
            {imagenes.map((img, i) => (
              <TouchableOpacity key={i} onPress={() => setIndiceImagen(i)}>
                <Image
                  source={{ uri: resolverImagen(img.url) || undefined }}
                  style={[styles.galeriaThumb, i === indiceImagen && styles.galeriaThumbActiva]}
                />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  imageWrap: {
    backgroundColor: "#fff",
    position: "relative",
  },
  image: {
    width: "100%",
    height: 300,
    backgroundColor: "#f0f0f0",
  },
  agotadoOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  agotadoText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 30,
    backgroundColor: "#e73737",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
  },
  favBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    padding: 8,
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
    backgroundColor: "#f0f0f0",
  },
  thumbnailActive: {
    borderColor: "#e73737",
  },
  content: {
    padding: 20,
  },
  nombre: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111",
    marginTop: 8,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  tagCategoria: {
    backgroundColor: "#fdeaea",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagCategoriaText: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  tagMarca: {
    backgroundColor: "#002244",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagMarcaText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 11,
    letterSpacing: 0.5,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  ratingEstrellas: {
    flexDirection: "row",
    gap: 2,
  },
  ratingTexto: {
    color: "#666",
    fontSize: 13.5,
  },
  precio: {
    marginTop: 15,
    fontSize: 32,
    fontWeight: "bold",
    color: "#e73737",
  },
  precioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 15,
  },
  precioDescuento: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#e73737",
  },
  chipDescuento: {
    backgroundColor: "#e73737",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipDescuentoText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
  precioOriginal: {
    marginTop: 2,
    fontSize: 15,
    color: "#999",
    textDecorationLine: "line-through",
  },
  selector: {
    marginTop: 20,
  },
  selectorTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 10,
  },
  opciones: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipSelected: {
    backgroundColor: "#e73737",
    borderColor: "#e73737",
  },
  chipText: {
    color: "#333",
    fontSize: 14,
  },
  chipTextSelected: {
    color: "#fff",
    fontWeight: "bold",
  },
  selectorHint: {
    marginTop: 14,
    color: "#9ca3af",
    fontSize: 13,
    fontStyle: "italic",
  },
  stockBox: {
    marginTop: 18,
  },
  stockOk: {
    color: "#16a34a",
    fontWeight: "bold",
    fontSize: 15,
  },
  stockAgotado: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 15,
  },
  avisoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 15,
    borderWidth: 1,
    borderColor: "#e73737",
    borderRadius: 10,
    padding: 12,
    justifyContent: "center",
  },
  avisoBtnText: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 14,
  },
  cantidadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  cantBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#002244",
  },
  cantBtnText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  cantValue: {
    fontSize: 20,
    fontWeight: "bold",
    minWidth: 40,
    textAlign: "center",
  },
  subtotal: {
    marginTop: 10,
    color: "#666",
    fontSize: 14,
  },
  cartButtonOk: {
    backgroundColor: "#16a34a",
  },
  cartButtonDisabled: {
    opacity: 0.5,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
  },
  bottomPriceWrap: {
    minWidth: 110,
  },
  bottomPrice: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#e73737",
  },
  bottomOld: {
    fontSize: 12,
    color: "#9ca3af",
    textDecorationLine: "line-through",
  },
  bottomBtn: {
    flex: 1,
    backgroundColor: "#e73737",
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
  beneficios: {
    marginTop: 25,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  beneficio: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  beneficioIco: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fdeaea",
    justifyContent: "center",
    alignItems: "center",
  },
  beneficioDiv: {
    width: 1,
    height: 34,
    backgroundColor: "#e5e7eb",
  },
  beneficioText: {
    color: "#444",
    fontSize: 10.5,
    textAlign: "center",
    lineHeight: 13,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 6,
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
    fontSize: 15,
    lineHeight: 23,
    color: "#444",
  },
  featureRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  featureRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  featureName: {
    fontWeight: "bold",
    color: "#333",
  },
  featureValue: {
    color: "#444",
    flexShrink: 1,
    marginLeft: 10,
    textAlign: "right",
  },
  galeriaBackdrop: {
    flex: 1,
    backgroundColor: "#000",
  },
  galeriaCerrar: {
    position: "absolute",
    right: 14,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 22,
    padding: 8,
  },
  galeriaContador: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  galeriaFlecha: {
    position: "absolute",
    top: "50%",
    marginTop: -30,
    zIndex: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 24,
    padding: 8,
  },
  galeriaFlechaIzq: {
    left: 10,
  },
  galeriaFlechaDer: {
    right: 10,
  },
  galeriaPie: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  galeriaThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    backgroundColor: "#222",
  },
  galeriaThumbActiva: {
    borderColor: "#e73737",
  },
  resenaPromedio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  resenaEstrellas: {
    flexDirection: "row",
    gap: 2,
  },
  resenaPromedioTexto: {
    color: "#555",
    fontSize: 14,
  },
  resenaItem: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  resenaHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resenaAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e73737",
  },
  resenaAvatarLetra: {
    justifyContent: "center",
    alignItems: "center",
  },
  resenaAvatarTexto: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 18,
  },
  resenaNombre: {
    fontWeight: "bold",
    color: "#222",
    fontSize: 14,
    marginBottom: 2,
  },
  resenaFecha: {
    color: "#999",
    fontSize: 12,
  },
  resenaComentario: {
    marginTop: 10,
    color: "#444",
    fontSize: 14,
    lineHeight: 21,
  },
  resenaForm: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 5,
  },
  resenaFormTitle: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#111",
    marginBottom: 10,
  },
  resenaEstrellasGrandes: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  resenaInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 12,
    minHeight: 90,
    textAlignVertical: "top",
    color: "#111",
    fontSize: 14,
  },
  resenaEnviar: {
    backgroundColor: "#e73737",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
  },
  resenaEnviarDisabled: {
    opacity: 0.5,
  },
  resenaEnviarText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  resenaLogin: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginTop: 5,
    alignItems: "center",
  },
  resenaLoginText: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
  },
  resenaLoginBtn: {
    backgroundColor: "#e73737",
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  resenaLoginBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 13,
  },
});
