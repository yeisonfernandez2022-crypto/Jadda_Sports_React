import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { resolverImagen } from "../../../constants/api";
import BackButton from "../../../components/BackButton";

export default function VendedorEditar() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const [cargando, setCargando] = useState(true);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [descuentos, setDescuentos] = useState<any[]>([]);
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [precio, setPrecio] = useState("");
  const [idCategoria, setIdCategoria] = useState("");
  const [idProveedor, setIdProveedor] = useState("");
  const [idDescuento, setIdDescuento] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagenes, setImagenes] = useState<string[]>([]);
  const [urlTemp, setUrlTemp] = useState("");
  const [variantes, setVariantes] = useState([{ COLOR: "", NOMBRE_ATRIBUTO: "Talla", ATRIBUTO: "", STOCK: "" }]);
  const [caracteristicas, setCaracteristicas] = useState([{ propiedad: "", valor: "" }]);
  const [estado, setEstado] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get("/api/productos/categorias").then((r) => setCategorias(r.data));
    api.get("/api/proveedores").then((r) => setProveedores(r.data));
    api.get("/api/productos/descuentos").then((r) => setDescuentos(r.data));
    api
      .get(`/api/vendedor/productos/${id}`)
      .then((r) => {
        const p = r.data;
        setNombre(p.NOMBRE || "");
        setMarca(p.MARCA || "");
        setPrecio(String(p.PRECIO ?? ""));
        setIdCategoria(String(p.ID_CATEGORIA || ""));
        setIdProveedor(String(p.ID_PROVEEDOR || ""));
        setIdDescuento(p.ID_DESCUENTO ? String(p.ID_DESCUENTO) : "");
        setDescripcion(p.DESCRIPCION || "");
        setImagenes((p.IMAGENES || []).map((i: any) => i.url));
        const vars = (p.VARIANTES || []).map((v: any) => ({ COLOR: v.COLOR || "", NOMBRE_ATRIBUTO: v.NOMBRE_ATRIBUTO || "Talla", ATRIBUTO: v.ATRIBUTO || "", STOCK: String(v.STOCK ?? "") }));
        setVariantes(vars.length ? vars : [{ COLOR: "", NOMBRE_ATRIBUTO: "Talla", ATRIBUTO: "", STOCK: "" }]);
        const cars = (p.CARACTERISTICAS || []).map((c: any) => ({ propiedad: c.NOMBRE_ATRIBUTO || "", valor: c.VALOR_ATRIBUTO || "" }));
        setCaracteristicas(cars.length ? cars : [{ propiedad: "", valor: "" }]);
        setEstado(p.ESTADO_PUBLICACION || null);
      })
      .catch(() => Alert.alert("Error", "No se pudo cargar el producto"))
      .finally(() => setCargando(false));
  }, [id]);

  const variantesValidas = variantes.filter((v) => v.COLOR.trim() && v.NOMBRE_ATRIBUTO && v.ATRIBUTO.trim());
  const puedePublicar = !!nombre.trim() && Number(precio) > 0 && !!idCategoria && !!idProveedor && !!descripcion.trim() && imagenes.length > 0 && variantesValidas.length > 0;

  const guardar = async () => {
    if (!puedePublicar) return Alert.alert("Campos incompletos", "Completa todos los campos obligatorios");
    const listaCar = caracteristicas.filter((c) => c.propiedad.trim() && c.valor.trim()).map((c) => ({ NOMBRE_ATRIBUTO: c.propiedad.trim(), VALOR_ATRIBUTO: c.valor.trim() }));
    if (variantesValidas.some((v) => v.COLOR.trim()) && !listaCar.some((c) => c.NOMBRE_ATRIBUTO === "Color")) {
      listaCar.push({ NOMBRE_ATRIBUTO: "Color", VALOR_ATRIBUTO: variantesValidas.map((v) => v.COLOR).join(", ") });
    }
    setGuardando(true);
    try {
      await api.put(`/api/vendedor/productos/${id}`, {
        NOMBRE: nombre.trim(),
        MARCA: marca.trim() || "Genérico",
        PRECIO: Number(precio),
        DESCRIPCION: descripcion.trim(),
        ID_CATEGORIA: Number(idCategoria),
        ID_PROVEEDOR: Number(idProveedor),
        ID_DESCUENTO: idDescuento ? Number(idDescuento) : null,
        IMAGENES: imagenes,
        VARIANTES: variantesValidas.map((v) => ({ ...v, STOCK: Number(v.STOCK) || 0 })),
        CARACTERISTICAS: listaCar,
      });
      Alert.alert("Actualizado", "Volvió a revisión para re-aprobación.", [{ text: "OK", onPress: () => (router.replace as any)("/vendedor/productos") }]);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.msg || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) return <View style={styles.centered}><ActivityIndicator size="large" color="#1aa084" /></View>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton texto="Editar producto" />
      <Text style={styles.h1}>Editar producto</Text>
      {estado && <View style={[styles.badge, { backgroundColor: estado === "APROBADO" ? "#dcfce7" : estado === "PENDIENTE" ? "#fef3c7" : "#fee2e2" }]}><Text style={styles.badgeText}>{estado}</Text></View>}
      <Text style={styles.sub}>Al guardar vuelve a revisión</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Nombre *</Text><TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Nombre" />
        <Text style={styles.label}>Marca</Text><TextInput style={styles.input} value={marca} onChangeText={setMarca} placeholder="Marca" />
        <Text style={styles.label}>Precio *</Text><TextInput style={styles.input} value={precio} onChangeText={setPrecio} placeholder="Precio" keyboardType="numeric" />
        <Text style={styles.label}>Categoría *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ flexDirection: "row", gap: 8 }}>{categorias.map((c) => <TouchableOpacity key={c.ID_CATEGORIA} style={[styles.chip, String(c.ID_CATEGORIA) === idCategoria && styles.chipActive]} onPress={() => setIdCategoria(String(c.ID_CATEGORIA))}><Text style={[styles.chipText, String(c.ID_CATEGORIA) === idCategoria && styles.chipTextActive]}>{c.NOMBRE_CATEGORIA}</Text></TouchableOpacity>)}</View></ScrollView>
        <Text style={styles.label}>Proveedor *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ flexDirection: "row", gap: 8 }}>{proveedores.map((p) => { const pid = String(p.ID_PROVEEDOR || p.id_proveedor); return <TouchableOpacity key={pid} style={[styles.chip, pid === idProveedor && styles.chipActive]} onPress={() => setIdProveedor(pid)}><Text style={[styles.chipText, pid === idProveedor && styles.chipTextActive]}>{p.NOMBRE_PROVEEDOR || p.nombre_proveedor}</Text></TouchableOpacity>; })}</View></ScrollView>
        <Text style={styles.label}>Descuento</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}><View style={{ flexDirection: "row", gap: 8 }}><TouchableOpacity style={[styles.chip, !idDescuento && styles.chipActive]} onPress={() => setIdDescuento("")}><Text style={[styles.chipText, !idDescuento && styles.chipTextActive]}>Sin descuento</Text></TouchableOpacity>{descuentos.map((d) => <TouchableOpacity key={d.ID_DESCUENTO} style={[styles.chip, String(d.ID_DESCUENTO) === idDescuento && styles.chipActive]} onPress={() => setIdDescuento(String(d.ID_DESCUENTO))}><Text style={[styles.chipText, String(d.ID_DESCUENTO) === idDescuento && styles.chipTextActive]}>{d.DESCRIPCION} ({d.PORCENTAJE}%)</Text></TouchableOpacity>)}</View></ScrollView>
        <Text style={styles.label}>Descripción *</Text><TextInput style={[styles.input, { height: 80, textAlignVertical: "top" }]} value={descripcion} onChangeText={setDescripcion} multiline placeholder="Descripción" />
        <Text style={styles.label}>Imágenes *</Text>
        <View style={{ flexDirection: "row", gap: 8 }}><TextInput style={[styles.input, { flex: 1 }]} value={urlTemp} onChangeText={setUrlTemp} placeholder="URL" /><TouchableOpacity style={styles.btnSmall} onPress={() => { if (urlTemp.trim()) { setImagenes([...imagenes, urlTemp.trim()]); setUrlTemp(""); } }}><Text style={styles.btnSmallText}>Agregar</Text></TouchableOpacity></View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>{imagenes.map((u, i) => <View key={i} style={styles.thumbWrap}><Image source={{ uri: resolverImagen(u) || u }} style={styles.thumb} /><TouchableOpacity style={styles.thumbClose} onPress={() => setImagenes(imagenes.filter((_, idx) => idx !== i))}><Ionicons name="close" size={12} color="#fff" /></TouchableOpacity></View>)}</View>
        <Text style={[styles.label, { marginTop: 12 }]}>Variantes *</Text>
        {variantes.map((v, i) => (
          <View key={i} style={styles.row}>
            <TextInput placeholder="Color" style={[styles.input, { flex: 1 }]} value={v.COLOR} onChangeText={(t) => { const n = [...variantes]; n[i].COLOR = t; setVariantes(n); }} />
            <TextInput placeholder="Valor" style={[styles.input, { flex: 1 }]} value={v.ATRIBUTO} onChangeText={(t) => { const n = [...variantes]; n[i].ATRIBUTO = t; setVariantes(n); }} />
            <TextInput placeholder="Stock" style={[styles.input, { width: 60 }]} value={v.STOCK} onChangeText={(t) => { const n = [...variantes]; n[i].STOCK = t; setVariantes(n); }} keyboardType="numeric" />
            <TouchableOpacity onPress={() => setVariantes(variantes.filter((_, idx) => idx !== i))}><Ionicons name="trash" size={18} color="#e73737" /></TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={() => setVariantes([...variantes, { COLOR: "", NOMBRE_ATRIBUTO: "Talla", ATRIBUTO: "", STOCK: "" }])} style={styles.addBtn}><Ionicons name="add-circle" size={16} color="#1aa084" /><Text style={styles.addText}>Agregar variante</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btnPub, !puedePublicar && { opacity: 0.5 }]} onPress={guardar} disabled={guardando}><Text style={styles.btnPubText}>{guardando ? "Guardando..." : "Guardar cambios"}</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f8fafc" },
  container: { padding: 16, backgroundColor: "#f8fafc", flexGrow: 1, paddingBottom: 32 },
  h1: { fontSize: 18, fontWeight: "800", color: "#0f172a" },
  sub: { fontSize: 12, color: "#64748b", marginBottom: 12 },
  badge: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, marginTop: 6 },
  badgeText: { fontSize: 11, fontWeight: "800" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 14, elevation: 1, gap: 6 },
  label: { fontSize: 11, fontWeight: "700", color: "#334155", marginTop: 10 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, backgroundColor: "#fff" },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0", marginRight: 8 },
  chipActive: { backgroundColor: "#1aa084", borderColor: "#1aa084" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  chipTextActive: { color: "#fff" },
  btnSmall: { backgroundColor: "#1aa084", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, justifyContent: "center" },
  btnSmallText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  thumbWrap: { width: 64, height: 64, borderRadius: 10, overflow: "hidden", position: "relative" },
  thumb: { width: "100%", height: "100%" },
  thumbClose: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", width: 18, height: 18, borderRadius: 9, justifyContent: "center", alignItems: "center" },
  row: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 },
  addBtn: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 6 },
  addText: { color: "#1aa084", fontWeight: "700", fontSize: 12 },
  btnPub: { backgroundColor: "#1aa084", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 16 },
  btnPubText: { color: "#fff", fontWeight: "800" },
});
