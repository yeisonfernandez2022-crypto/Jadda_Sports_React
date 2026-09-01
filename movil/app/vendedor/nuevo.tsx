import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api, { resolverImagen } from "../../constants/api";
import BackButton from "../../components/BackButton";

const TIPOS = ["Talla", "Peso", "Capacidad", "Longitud", "Diámetro", "Voltaje", "Potencia", "Resistencia", "Material", "Tamaño"];

export default function VendedorNuevo() {
  const insets = useSafeAreaInsets();
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
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    api.get("/api/productos/categorias").then((r) => {
      setCategorias(r.data);
      if (r.data.length) setIdCategoria(String(r.data[0].ID_CATEGORIA));
    });
    api.get("/api/proveedores").then((r) => {
      setProveedores(r.data);
      if (r.data.length) setIdProveedor(String(r.data[0].ID_PROVEEDOR || r.data[0].id_proveedor));
    });
    api.get("/api/productos/descuentos").then((r) => setDescuentos(r.data));
  }, []);

  const variantesValidas = variantes.filter((v) => v.COLOR.trim() && v.NOMBRE_ATRIBUTO && v.ATRIBUTO.trim());
  const camposFaltantes = [
    !nombre.trim() ? "nombre" : null,
    !(Number(precio) > 0) ? "precio" : null,
    !idCategoria ? "categoría" : null,
    !idProveedor ? "proveedor" : null,
    !descripcion.trim() ? "descripción" : null,
    imagenes.length === 0 ? "imagen" : null,
    variantesValidas.length === 0 ? "variante" : null,
  ].filter(Boolean) as string[];

  const puedePublicar = camposFaltantes.length === 0;

  const agregarUrl = () => {
    if (!urlTemp.trim()) return;
    if (!/^(https?:\/\/|\/)/.test(urlTemp.trim())) {
      Alert.alert("URL inválida", "Debe empezar con http(s):// o /");
      return;
    }
    setImagenes([...imagenes, urlTemp.trim()].slice(0, 8));
    setUrlTemp("");
  };

  const crearDescuento = () => {
    Alert.prompt(
      "Crear descuento",
      "Escribe: Nombre, Porcentaje (1-100). Ej: Oferta 20",
      async (texto) => {
        if (!texto) return;
        const [nombreD, pctStr] = texto.split(",").map((s) => s.trim());
        const pct = Number(pctStr);
        if (!nombreD || !pct || pct < 1 || pct > 100) {
          Alert.alert("Datos inválidos", "Formato: Nombre, porcentaje. Ej: Oferta,20");
          return;
        }
        try {
          const res = await api.post("/api/productos/descuentos", { DESCRIPCION: nombreD, PORCENTAJE: pct });
          Alert.alert("¡Descuento creado!", `${nombreD} (${pct}%)`);
          const r2 = await api.get("/api/productos/descuentos");
          setDescuentos(r2.data);
          setIdDescuento(String(res.data.ID_DESCUENTO));
        } catch (e: any) {
          Alert.alert("Error", e?.response?.data?.error || "No se pudo crear");
        }
      },
      "plain-text",
      "",
      "default"
    );
  };

  const guardar = async () => {
    if (!nombre.trim()) return Alert.alert("Falta nombre", "Escribe el nombre");
    if (!precio || Number(precio) <= 0) return Alert.alert("Falta precio", "Precio mayor a 0");
    if (!idCategoria) return Alert.alert("Falta categoría", "Selecciona categoría");
    if (!idProveedor) return Alert.alert("Falta proveedor", "Selecciona proveedor");
    if (!descripcion.trim()) return Alert.alert("Falta descripción", "Escribe descripción");
    if (imagenes.length === 0) return Alert.alert("Falta imagen", "Agrega al menos una imagen");
    if (variantesValidas.length === 0) return Alert.alert("Falta variante", "Agrega al menos una variante completa");

    const listaCar = caracteristicas
      .filter((c) => c.propiedad.trim() && c.valor.trim())
      .map((c) => ({ NOMBRE_ATRIBUTO: c.propiedad.trim(), VALOR_ATRIBUTO: c.valor.trim() }));
    if (variantesValidas.some((v) => v.COLOR.trim()) && !listaCar.some((c) => c.NOMBRE_ATRIBUTO === "Color")) {
      listaCar.push({ NOMBRE_ATRIBUTO: "Color", VALOR_ATRIBUTO: variantesValidas.map((v) => v.COLOR).join(", ") });
    }

    setGuardando(true);
    try {
      const res = await api.post("/api/vendedor/productos", {
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
      Alert.alert("¡Enviado a revisión!", "El equipo de JADDA lo revisará en menos de 48h.", [{ text: "OK", onPress: () => (router.replace as any)("/vendedor/productos") }]);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.msg || e?.response?.data?.error || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <BackButton texto="Publicar producto" />
      <Text style={styles.h1}>Publicar producto</Text>
      <Text style={styles.sub}>Igual que el admin · quedará en revisión antes de salir a la tienda</Text>

      {/* Vista previa */}
      {(nombre.trim() || descripcion.trim() || imagenes[0]) && (
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>
            <Ionicons name="eye" size={14} color="#e73737" /> Vista previa
          </Text>
          <View style={styles.previewCard}>
            <Image source={{ uri: resolverImagen(imagenes[0]) || "https://placehold.co/400x400?text=JADDA" }} style={styles.previewImg} />
            <View style={{ flex: 1 }}>
              <Text style={styles.previewMarca}>{marca.trim() || "Genérico"}</Text>
              <Text style={styles.previewNombre}>{nombre.trim() || "Nombre del producto"}</Text>
              <Text style={styles.previewPrecio}>${Number(precio || 0).toLocaleString("es-CO")}</Text>
              {descripcion ? <Text style={styles.previewDesc} numberOfLines={2}>{descripcion}</Text> : null}
            </View>
          </View>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Nombre del producto *</Text>
        <TextInput style={styles.input} value={nombre} onChangeText={setNombre} placeholder="Ej: Sudadera Térmica Pro" />

        <Text style={styles.label}>Marca</Text>
        <TextInput style={styles.input} value={marca} onChangeText={setMarca} placeholder="Ej: Nike, Adidas" />

        <Text style={styles.label}>Precio (COP) *</Text>
        <TextInput style={styles.input} value={precio} onChangeText={setPrecio} placeholder="Ej: 120000" keyboardType="numeric" />

        <Text style={styles.label}>Categoría *</Text>
        <View style={styles.pickerWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row" }}>
            {categorias.map((c) => (
              <TouchableOpacity
                key={c.ID_CATEGORIA}
                style={[styles.chip, String(c.ID_CATEGORIA) === idCategoria && styles.chipActive]}
                onPress={() => setIdCategoria(String(c.ID_CATEGORIA))}
              >
                <Text style={[styles.chipText, String(c.ID_CATEGORIA) === idCategoria && styles.chipTextActive]}>{c.NOMBRE_CATEGORIA}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.label}>Proveedor *</Text>
        <View style={styles.pickerWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {proveedores.map((p) => {
              const id = String(p.ID_PROVEEDOR || p.id_proveedor);
              const nombreP = p.NOMBRE_PROVEEDOR || p.nombre_proveedor;
              return (
                <TouchableOpacity key={id} style={[styles.chip, id === idProveedor && styles.chipActive]} onPress={() => setIdProveedor(id)}>
                  <Text style={[styles.chipText, id === idProveedor && styles.chipTextActive]}>{nombreP}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <Text style={styles.label}>Descuento (opcional)</Text>
        <View style={styles.pickerWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity style={[styles.chip, !idDescuento && styles.chipActive]} onPress={() => setIdDescuento("")}>
              <Text style={[styles.chipText, !idDescuento && styles.chipTextActive]}>Sin descuento</Text>
            </TouchableOpacity>
            {descuentos.map((d) => (
              <TouchableOpacity key={d.ID_DESCUENTO} style={[styles.chip, String(d.ID_DESCUENTO) === idDescuento && styles.chipActive]} onPress={() => setIdDescuento(String(d.ID_DESCUENTO))}>
                <Text style={[styles.chipText, String(d.ID_DESCUENTO) === idDescuento && styles.chipTextActive]}>
                  {d.DESCRIPCION} ({d.PORCENTAJE}%)
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.chipAdd} onPress={crearDescuento}>
              <Text style={styles.chipAddText}>+ Crear</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        <Text style={styles.label}>Descripción *</Text>
        <TextInput style={[styles.input, { height: 90, textAlignVertical: "top" }]} value={descripcion} onChangeText={setDescripcion} placeholder="Describe el producto, usos y beneficiosâ€¦" multiline />

        <Text style={styles.label}>Imágenes *</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput style={[styles.input, { flex: 1 }]} value={urlTemp} onChangeText={setUrlTemp} placeholder="Pega URL https://..." />
          <TouchableOpacity style={styles.btnSmall} onPress={agregarUrl}>
            <Text style={styles.btnSmallText}>Agregar</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {imagenes.map((u, i) => (
            <View key={i} style={styles.thumbWrap}>
              <Image source={{ uri: resolverImagen(u) || u }} style={styles.thumb} />
              <TouchableOpacity style={styles.thumbClose} onPress={() => setImagenes(imagenes.filter((_, idx) => idx !== i))}>
                <Ionicons name="close" size={14} color="#fff" />
              </TouchableOpacity>
              {i === 0 && <View style={styles.portadaBadge}><Text style={styles.portadaText}>Portada</Text></View>}
            </View>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 16 }]}>Variantes (color, talla, stock) *</Text>
        {variantes.map((v, i) => (
          <View key={i} style={styles.varianteRow}>
            <TextInput placeholder="Color" style={[styles.input, styles.varianteInput]} value={v.COLOR} onChangeText={(t) => { const n = [...variantes]; n[i].COLOR = t; setVariantes(n); }} />
            <View style={styles.pickerMini}>
              <Text style={styles.pickerMiniLabel}>{v.NOMBRE_ATRIBUTO}</Text>
            </View>
            <TextInput placeholder="Valor" style={[styles.input, styles.varianteInput]} value={v.ATRIBUTO} onChangeText={(t) => { const n = [...variantes]; n[i].ATRIBUTO = t; setVariantes(n); }} />
            <TextInput placeholder="Stock" style={[styles.input, { width: 60 }]} value={v.STOCK} onChangeText={(t) => { const n = [...variantes]; n[i].STOCK = t; setVariantes(n); }} keyboardType="numeric" />
            <TouchableOpacity onPress={() => setVariantes(variantes.filter((_, idx) => idx !== i))}>
              <Ionicons name="trash" size={18} color="#e73737" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={() => setVariantes([...variantes, { COLOR: "", NOMBRE_ATRIBUTO: "Talla", ATRIBUTO: "", STOCK: "" }])}>
          <Ionicons name="add-circle" size={18} color="#1aa084" />
          <Text style={styles.addText}>Agregar variante</Text>
        </TouchableOpacity>

        <Text style={[styles.label, { marginTop: 16 }]}>Características</Text>
        {caracteristicas.map((c, i) => (
          <View key={i} style={styles.varianteRow}>
            <TextInput placeholder="Propiedad" style={[styles.input, styles.varianteInput]} value={c.propiedad} onChangeText={(t) => { const n = [...caracteristicas]; n[i].propiedad = t; setCaracteristicas(n); }} />
            <TextInput placeholder="Valor" style={[styles.input, styles.varianteInput]} value={c.valor} onChangeText={(t) => { const n = [...caracteristicas]; n[i].valor = t; setCaracteristicas(n); }} />
            <TouchableOpacity onPress={() => setCaracteristicas(caracteristicas.filter((_, idx) => idx !== i))}>
              <Ionicons name="trash" size={18} color="#e73737" />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity style={styles.addBtn} onPress={() => setCaracteristicas([...caracteristicas, { propiedad: "", valor: "" }])}>
          <Ionicons name="add-circle" size={18} color="#1aa084" />
          <Text style={styles.addText}>Agregar característica</Text>
        </TouchableOpacity>

        {!puedePublicar && (
          <View style={styles.avisoFalta}>
            <Text style={styles.avisoFaltaTitle}>Debes completar todos los campos obligatorios</Text>
            <Text style={styles.avisoFaltaText}>Faltan: {camposFaltantes.join(", ")}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.btnPublicar, (!puedePublicar || guardando) && { opacity: 0.5 }]} onPress={guardar} disabled={!puedePublicar || guardando}>
          <Text style={styles.btnPublicarText}>{guardando ? "Publicando..." : "Publicar producto"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnCancelar} onPress={() => router.back()}>
          <Text style={styles.btnCancelarText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#f8fafc", flexGrow: 1, paddingBottom: 32 },
  h1: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  sub: { fontSize: 12, color: "#64748b", marginBottom: 12 },
  preview: { backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#e2e8f0", borderStyle: "dashed" },
  previewTitle: { fontSize: 11, fontWeight: "800", color: "#e73737", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  previewCard: { flexDirection: "row", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  previewImg: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#f1f5f9" },
  previewMarca: { fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },
  previewNombre: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  previewPrecio: { fontSize: 13, fontWeight: "800", color: "#e73737", marginTop: 4 },
  previewDesc: { fontSize: 11, color: "#64748b", marginTop: 4 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, elevation: 1 },
  label: { fontSize: 11, fontWeight: "700", color: "#334155", marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, backgroundColor: "#fff" },
  pickerWrap: { marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0", marginRight: 8 },
  chipActive: { backgroundColor: "#1aa084", borderColor: "#1aa084" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#334155" },
  chipTextActive: { color: "#fff" },
  chipAdd: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#1aa084", borderStyle: "dashed" },
  chipAddText: { fontSize: 12, fontWeight: "700", color: "#1aa084" },
  btnSmall: { backgroundColor: "#1aa084", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, justifyContent: "center" },
  btnSmallText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  thumbWrap: { width: 72, height: 72, borderRadius: 10, overflow: "hidden", position: "relative" },
  thumb: { width: "100%", height: "100%", backgroundColor: "#f1f5f9" },
  thumbClose: { position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  portadaBadge: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#e73737", paddingVertical: 2, alignItems: "center" },
  portadaText: { color: "#fff", fontSize: 8, fontWeight: "800" },
  varianteRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 },
  varianteInput: { flex: 1 },
  pickerMini: { paddingHorizontal: 8, paddingVertical: 10, backgroundColor: "#f1f5f9", borderRadius: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  pickerMiniLabel: { fontSize: 11, fontWeight: "700", color: "#334155" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  addText: { color: "#1aa084", fontWeight: "700", fontSize: 12 },
  avisoFalta: { backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fee2e2", borderRadius: 10, padding: 12, marginTop: 16 },
  avisoFaltaTitle: { fontSize: 12, fontWeight: "800", color: "#991b1b" },
  avisoFaltaText: { fontSize: 11, color: "#b91c1c", marginTop: 4, textTransform: "capitalize" },
  btnPublicar: { backgroundColor: "#1aa084", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 16 },
  btnPublicarText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  btnCancelar: { paddingVertical: 12, alignItems: "center", marginTop: 8 },
  btnCancelarText: { color: "#64748b", fontWeight: "700" },
});

