import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import api, { resolverImagen } from "../constants/api";
import BellNotificaciones from "./BellNotificaciones";

interface Categoria {
  ID_CATEGORIA: number;
  NOMBRE_CATEGORIA: string;
}

interface Producto {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  CATEGORIA?: string;
  ID_DESCUENTO?: number | null;
  IMAGEN?: string;
}

interface Sugerencia {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  IMAGEN: string;
}

export default function Header() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { usuario, estaLogueado, esVendedor, esAdmin } = useAuth();
  const { totalProductos } = useCart();
  const [vendedorMenuAbierto, setVendedorMenuAbierto] = useState(false);
  const esPanelVendedor = pathname?.startsWith("/vendedor");

  const [searchTerm, setSearchTerm] = useState("");
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [showSugerencias, setShowSugerencias] = useState(false);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [ofertas, setOfertas] = useState<Producto[]>([]);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});
  const [menuAbierto, setMenuAbierto] = useState<null | "catalogo" | "ofertas">(null);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    api
      .get("/api/productos/categorias")
      .then((res) => setCategorias(res.data))
      .catch(() => {});
    Promise.all([api.get("/api/productos"), api.get("/api/productos/descuentos")])
      .then(([prods, dcts]) => {
        setOfertas(prods.data.filter((p: Producto) => p.ID_DESCUENTO != null));
        const map: Record<number, number> = {};
        dcts.data.forEach((d: { ID_DESCUENTO: number; PORCENTAJE: number }) => {
          map[d.ID_DESCUENTO] = d.PORCENTAJE;
        });
        setDescuentosMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchTerm.trim().length > 1) {
        try {
          const res = await api.get("/api/productos", {
            params: { search: searchTerm },
          });
          setSugerencias(res.data.slice(0, 5));
          setShowSugerencias(true);
        } catch {
          setSugerencias([]);
        }
      } else {
        setSugerencias([]);
        setShowSugerencias(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const buscar = () => {
    if (searchTerm.trim()) {
      router.push(`/catalogo?search=${encodeURIComponent(searchTerm.trim())}`);
      setSearchTerm("");
      setShowSugerencias(false);
    }
  };

  const irProducto = (id: number) => {
    setShowSugerencias(false);
    setSearchTerm("");
    router.push(`/producto/${id}`);
  };

  const irCatalogoCat = (nombre: string) => {
    setMenuAbierto(null);
    router.push(`/catalogo?cat=${encodeURIComponent(nombre)}`);
  };

  const marcaInicial = (usuario?.NOMBRE_USUARIO || "U").charAt(0).toUpperCase();

  const vendedorTabs = [
    { label: "Inicio vendedor", icon: "home" as const, ruta: "/vendedor" },
    { label: "Mi tienda", icon: "storefront" as const, ruta: "/vendedor/tienda" },
    { label: "Mis productos", icon: "cube" as const, ruta: "/vendedor/productos" },
    { label: "Publicar producto", icon: "add-circle" as const, ruta: "/vendedor/nuevo" },
    { label: "Órdenes", icon: "receipt" as const, ruta: "/vendedor/ordenes" },
    { label: "Mis ventas", icon: "cash" as const, ruta: "/vendedor/ventas" },
    { label: "Devoluciones", icon: "return-up-back" as const, ruta: "/vendedor/devoluciones" },
    { label: "Chats", icon: "chatbubbles" as const, ruta: "/vendedor/chats" },
    { label: "Reportes", icon: "bar-chart" as const, ruta: "/vendedor/reportes" },
  ];

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + 6 }]}>
      {/* FILA 1: hamburger vendedor + logo + brand | campana | avatar/login */}
      <View style={styles.topRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {esVendedor && esPanelVendedor && (
            <TouchableOpacity
              style={styles.hamburgerBtn}
              onPress={() => setVendedorMenuAbierto(true)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.brand} onPress={() => router.replace("/(tabs)")}>
            <Image
              source={{ uri: resolverImagen("/images/logo-jadda-transparente.png") || undefined }}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brandName}>
              JADDA <Text style={styles.brandSports}>SPORTS</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.topActions}>
          {estaLogueado && <BellNotificaciones />}
          {!esVendedor && (
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/(tabs)/carrito")}>
              <Ionicons name="cart" size={20} color="#fff" />
              {totalProductos > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{totalProductos > 99 ? "99+" : totalProductos}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {estaLogueado ? (
            <TouchableOpacity
              style={styles.avatarBtn}
              onPress={() => (esVendedor ? router.push("/vendedor" as any) : router.push("/(tabs)/perfil"))}
            >
              {usuario?.foto_url ? (
                <Image source={{ uri: resolverImagen(usuario.foto_url) || undefined }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarLetra}>
                  <Text style={styles.avatarLetraText}>{marcaInicial}</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.loginBtn} onPress={() => router.push("/login")}>
              <Text style={styles.loginBtnText}>ENTRAR</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* DRAWER VENDEDOR — 3 rallitas */}
      <Modal visible={vendedorMenuAbierto} transparent animationType="fade" onRequestClose={() => setVendedorMenuAbierto(false)}>
        <TouchableOpacity style={styles.drawerBackdrop} activeOpacity={1} onPress={() => setVendedorMenuAbierto(false)}>
          <View style={styles.drawerPanel}>
            <View style={styles.drawerHeader}>
              <View style={styles.drawerBrandRow}>
                <Ionicons name="storefront" size={22} color="#1aa084" />
                <Text style={styles.drawerTitle}>Panel vendedor</Text>
              </View>
              <TouchableOpacity onPress={() => setVendedorMenuAbierto(false)} style={styles.drawerClose}>
                <Ionicons name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>
            <Text style={styles.drawerSub}>JADDA SPORTS · {usuario?.NOMBRE_USUARIO || "Vendedor"}</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12 }}>
              {vendedorTabs.map((t) => (
                <TouchableOpacity
                  key={t.ruta}
                  style={styles.drawerItem}
                  onPress={() => {
                    setVendedorMenuAbierto(false);
                    router.push(t.ruta as any);
                  }}
                >
                  <Ionicons name={t.icon} size={20} color="#1aa084" style={{ width: 24 }} />
                  <Text style={styles.drawerItemText}>{t.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#ccc" />
                </TouchableOpacity>
              ))}
              <View style={styles.drawerDivider} />
              <TouchableOpacity
                style={styles.drawerItem}
                onPress={() => {
                  setVendedorMenuAbierto(false);
                  router.push("/(tabs)/perfil");
                }}
              >
                <Ionicons name="person" size={20} color="#64748b" style={{ width: 24 }} />
                <Text style={[styles.drawerItemText, { color: "#334155" }]}>Mi perfil</Text>
              </TouchableOpacity>
              {esAdmin && (
                <TouchableOpacity
                  style={styles.drawerItem}
                  onPress={() => {
                    setVendedorMenuAbierto(false);
                    router.push("/(tabs)" as any);
                  }}
                >
                  <Ionicons name="shield-checkmark" size={20} color="#e73737" style={{ width: 24 }} />
                  <Text style={[styles.drawerItemText, { color: "#e73737" }]}>Panel admin (web)</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* FILA 2: menú INICIO / CATÁLOGO / OFERTAS / VENDER */}
      <View style={styles.menuRow}>
        <TouchableOpacity style={styles.menuItem} onPress={() => router.replace("/(tabs)")}>
          <Text style={[styles.menuText, styles.menuActive]}>INICIO</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => setMenuAbierto(menuAbierto === "catalogo" ? null : "catalogo")}>
          <Text style={styles.menuText}>CATÁLOGO <Ionicons name="chevron-down" size={12} color="#fff" /></Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => setMenuAbierto(menuAbierto === "ofertas" ? null : "ofertas")}>
          <Text style={styles.menuText}>OFERTAS <Ionicons name="chevron-down" size={12} color="#fff" /></Text>
        </TouchableOpacity>
        {!esVendedor && (
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/ser-vendedor")}>
            <Text style={styles.menuTextVender}>VENDER</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* FILA 3: buscador con sugerencias */}
      <View style={styles.searchWrap}>
        <TextInput
          ref={searchRef}
          style={styles.searchInput}
          placeholder="BUSCAR PRODUCTO..."
          placeholderTextColor="#bbb"
          value={searchTerm}
          onChangeText={setSearchTerm}
          onSubmitEditing={buscar}
          returnKeyType="search"
        />
        <TouchableOpacity style={styles.searchIcon} onPress={buscar}>
          <Ionicons name="search" size={18} color="#e73737" />
        </TouchableOpacity>

        {showSugerencias && (
          <View style={styles.dropdown}>
            {sugerencias.length > 0 ? (
              sugerencias.map((s) => (
                <TouchableOpacity key={s.ID} style={styles.dropItem} onPress={() => irProducto(s.ID)}>
                  <Image source={{ uri: resolverImagen(s.IMAGEN) || undefined }} style={styles.dropImg} />
                  <View style={styles.dropInfo}>
                    <Text numberOfLines={1} style={styles.dropName}>{s.NOMBRE}</Text>
                    <Text style={styles.dropPrice}>${Number(s.PRECIO).toLocaleString("es-CO")}</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.dropVacio}>No se encontraron productos</Text>
            )}
          </View>
        )}
      </View>

      {/* MODAL CATÁLOGO */}
      <Modal visible={menuAbierto === "catalogo"} transparent animationType="fade" onRequestClose={() => setMenuAbierto(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMenuAbierto(null)}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>Explora por categoría</Text>
            <FlatList
              data={categorias}
              keyExtractor={(c) => String(c.ID_CATEGORIA)}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.catItem} onPress={() => irCatalogoCat(item.NOMBRE_CATEGORIA)}>
                  <Text style={styles.catNombre}>{item.NOMBRE_CATEGORIA}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#e73737" />
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.verTodo} onPress={() => { setMenuAbierto(null); router.push("/catalogo"); }}>
              <Text style={styles.verTodoText}>Ver todo el catálogo →</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL OFERTAS */}
      <Modal visible={menuAbierto === "ofertas"} transparent animationType="fade" onRequestClose={() => setMenuAbierto(null)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setMenuAbierto(null)}>
          <View style={styles.modalPanel}>
            <Text style={styles.modalTitle}>🔥 Ofertas destacadas</Text>
            {ofertas.length > 0 ? (
              <ScrollView style={{ maxHeight: 320 }}>
                {ofertas.slice(0, 8).map((p) => (
                  <TouchableOpacity key={p.ID} style={styles.catItem} onPress={() => { setMenuAbierto(null); router.push(`/producto/${p.ID}`); }}>
                    <Text style={styles.catNombre}>{p.NOMBRE}</Text>
                    <Text style={styles.ofertaPct}>
                      {p.ID_DESCUENTO != null && descuentosMap[p.ID_DESCUENTO]
                        ? `-${descuentosMap[p.ID_DESCUENTO]}%`
                        : `$${Number(p.PRECIO).toLocaleString("es-CO")}`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.dropVacio}>No hay ofertas disponibles por el momento.</Text>
            )}
            <TouchableOpacity style={styles.verTodo} onPress={() => { setMenuAbierto(null); router.push("/catalogo?descuento=true"); }}>
              <Text style={styles.verTodoText}>Ver todas las ofertas →</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#e73737",
    paddingBottom: 8,
    elevation: 6,
    zIndex: 100,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 36,
    height: 36,
  },
  brandName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  brandSports: {
    color: "#ffd166",
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    position: "relative",
    padding: 2,
  },
  cartBadge: {
    position: "absolute",
    top: -6,
    right: -8,
    backgroundColor: "#fff",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: "#e73737",
    fontSize: 10,
    fontWeight: "bold",
  },
  avatarBtn: {
    marginLeft: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  avatarLetra: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e73737",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetraText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  loginBtn: {
    borderWidth: 1,
    borderColor: "#e73737",
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "#e73737",
  },
  loginBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 11,
  },
  menuRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 4,
  },
  menuItem: {
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  menuText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  menuActive: {
    color: "#fff",
  },
  menuTextVender: {
    color: "#ffd166",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  searchWrap: {
    position: "relative",
    marginHorizontal: 12,
    marginTop: 6,
    zIndex: 200,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    paddingRight: 42,
    fontSize: 13,
    color: "#111",
  },
  searchIcon: {
    position: "absolute",
    right: 12,
    top: 8,
  },
  dropdown: {
    position: "absolute",
    top: 42,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 10,
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    overflow: "hidden",
  },
  dropItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dropImg: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: "#eee",
  },
  dropInfo: {
    flex: 1,
    marginLeft: 10,
  },
  dropName: {
    fontWeight: "600",
    fontSize: 13,
    color: "#111",
  },
  dropPrice: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 12,
    marginTop: 2,
  },
  dropVacio: {
    padding: 16,
    textAlign: "center",
    color: "#888",
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalPanel: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    maxHeight: 480,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 12,
  },
  catItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  catNombre: {
    fontSize: 14,
    color: "#111",
    flex: 1,
  },
  ofertaPct: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 13,
  },
  verTodo: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  verTodoText: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 14,
  },
  hamburgerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(2,12,20,0.48)",
    flexDirection: "row",
  },
  drawerPanel: {
    width: 310,
    maxWidth: "84%",
    backgroundColor: "#f8fafc",
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 16,
    borderWidth: 1,
    borderLeftWidth: 0,
    borderColor: "#e2e8f0",
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  drawerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  drawerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 0.3,
  },
  drawerClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  drawerSub: {
    marginTop: 6,
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  drawerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  drawerItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  drawerDivider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 10,
  },
});
