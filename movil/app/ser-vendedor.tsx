import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { volverAtras } from "../utils/navegacion";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import api from "../constants/api";

const DEPARTAMENTOS = [
  "Amazonas", "Antioquia", "Arauca", "AtlÃ¡ntico", "BogotÃ¡ D.C.", "BolÃ­var",
  "BoyacÃ¡", "Caldas", "CaquetÃ¡", "Casanare", "Cauca", "Cesar", "ChocÃ³",
  "CÃ³rdoba", "Cundinamarca", "GuainÃ­a", "Guaviare", "Huila", "La Guajira",
  "Magdalena", "Meta", "NariÃ±o", "Norte de Santander", "Putumayo", "QuindÃ­o",
  "Risaralda", "San AndrÃ©s y Providencia", "Santander", "Sucre", "Tolima",
  "Valle del Cauca", "VaupÃ©s", "Vichada",
];

interface Solicitud {
  ID_SOLICITUD: number;
  NOMBRE_EMPRESA: string;
  NIT: string;
  NOMBRE_REPRESENTANTE: string;
  EMAIL_EMPRESA: string;
  TELEFONO: string;
  DEPARTAMENTO: string;
  CIUDAD: string;
  DIRECCION: string | null;
  CATEGORIAS: string | null;
  DESCRIPCION: string | null;
  ESTADO: string;
  OBSERVACION_ADMIN: string | null;
}

interface Vendedor {
  ID_VENDEDOR: number;
  EMAIL_VENDEDOR: string;
  USUARIO: string;
  DEBE_CAMBIAR_PASSWORD: number;
}

interface Categoria {
  ID_CATEGORIA: number;
  NOMBRE_CATEGORIA: string;
}

const VACIO = {
  nombre_empresa: "",
  nit: "",
  nombre_representante: "",
  email_empresa: "",
  telefono: "",
  departamento: "",
  ciudad: "",
  direccion: "",
  descripcion: "",
};

export default function SerVendedor() {
  const insets = useSafeAreaInsets();
  const { estaLogueado, cargando } = useAuth();
  const [cargandoEstado, setCargandoEstado] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [form, setForm] = useState({ ...VACIO });
  const [catsSel, setCatsSel] = useState<number[]>([]);
  const [acepta, setAcepta] = useState(false);
  const [deptoOpen, setDeptoOpen] = useState(false);

  const cargarEstado = () => {
    if (!estaLogueado) {
      setSolicitud(null);
      setVendedor(null);
      setCargandoEstado(false);
      return;
    }
    api
      .get("/api/vendedor/solicitud")
      .then((res) => {
        const s: Solicitud | null = res.data?.solicitud;
        const v: Vendedor | null = res.data?.vendedor;
        setSolicitud(s);
        setVendedor(v);
        if (s) {
          setForm({
            nombre_empresa: s.NOMBRE_EMPRESA || "",
            nit: s.NIT || "",
            nombre_representante: s.NOMBRE_REPRESENTANTE || "",
            email_empresa: s.EMAIL_EMPRESA || "",
            telefono: s.TELEFONO || "",
            departamento: s.DEPARTAMENTO || "",
            ciudad: s.CIUDAD || "",
            direccion: s.DIRECCION || "",
            descripcion: s.DESCRIPCION || "",
          });
        }
      })
      .catch(() => setSolicitud(null))
      .finally(() => setCargandoEstado(false));
  };

  useEffect(() => {
    if (cargando) return;
    cargarEstado();
    api
      .get("/api/productos/categorias")
      .then((res) => setCategorias(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCategorias([]));
  }, [cargando, estaLogueado]);

  const toggleCat = (id: number) =>
    setCatsSel((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));

  const setCampo = (campo: keyof typeof VACIO, valor: string) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  async function enviar() {
    try {
      if (!acepta) {
        Alert.alert("PolÃ­ticas obligatorias", "Debes aceptar las polÃ­ticas de vendedor para continuar.");
        return;
      }
      if (catsSel.length === 0) {
        Alert.alert("Selecciona categorÃ­as", "Elige al menos una categorÃ­a en la que quieras vender.");
        return;
      }
      setEnviando(true);
      const res = await api.post("/api/vendedor/solicitud", {
        ...form,
        email_empresa: form.email_empresa.trim().toLowerCase(),
        categorias: categorias
          .filter((c) => catsSel.includes(c.ID_CATEGORIA))
          .map((c) => c.NOMBRE_CATEGORIA)
          .join(", "),
      });
      Alert.alert("Â¡Solicitud enviada!", res.data?.msg || "Tu solicitud fue registrada correctamente.");
      cargarEstado();
    } catch (e: any) {
      Alert.alert("No se pudo enviar", e?.response?.data?.msg || "OcurriÃ³ un error. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (cargando || cargandoEstado) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e73737" />
      </View>
    );
  }

  const estado = solicitud?.ESTADO || null;

  if (estado === "APROBADA") {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={[styles.back, { paddingTop: insets.top + 14 }]} onPress={volverAtras}>
          <Ionicons name="arrow-back" size={20} color="#111" />
          <Text style={styles.backText}> Volver</Text>
        </TouchableOpacity>
        <View style={styles.okBox}>
          <View style={styles.okIco}>
            <Ionicons name="checkmark-circle" size={60} color="#22c55e" />
          </View>
          <Text style={styles.okTitulo}>Â¡Bienvenido a JADDA SPORTS!</Text>
          <Text style={styles.okSub}>Tu solicitud fue aprobada. Estas son tus credenciales de vendedor:</Text>
          <View style={styles.credenciales}>
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>Correo de acceso:</Text>
              <Text style={styles.credValue}>{vendedor?.EMAIL_VENDEDOR || solicitud?.EMAIL_EMPRESA}</Text>
            </View>
            <View style={styles.credRow}>
              <Text style={styles.credLabel}>Usuario:</Text>
              <Text style={styles.credValue}>{vendedor?.USUARIO}</Text>
            </View>
          </View>
          {vendedor?.DEBE_CAMBIAR_PASSWORD ? (
            <View style={styles.nota}>
              <Ionicons name="time" size={16} color="#f59e0b" />
              <Text style={styles.notaText}>
                {" "}Tienes una <Text style={{ fontWeight: "bold" }}>contraseÃ±a temporal</Text>: al iniciar sesiÃ³n el sistema te pedirÃ¡ cambiarla.
              </Text>
            </View>
          ) : (
            <View style={styles.nota}>
              <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
              <Text style={styles.notaText}> Tu contraseÃ±a ya fue actualizada.</Text>
            </View>
          )}
          <TouchableOpacity style={styles.button} onPress={() => router.push("/(tabs)/perfil")}>
            <Text style={styles.buttonText}>IR A MI PERFIL</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={[styles.back, { paddingTop: insets.top + 14 }]} onPress={volverAtras}>
          <Ionicons name="arrow-back" size={20} color="#111" />
          <Text style={styles.backText}> Volver</Text>
        </TouchableOpacity>

        <View style={styles.hero}>
          <Ionicons name="storefront" size={40} color="#e73737" />
          <Text style={styles.heroTitulo}>ConviÃ©rtete en vendedor</Text>
          <Text style={styles.heroSub}>AmplÃ­a tu negocio vendiendo en la tienda deportiva mÃ¡s completa de Colombia.</Text>
        </View>

        {estado === "PENDIENTE" && (
          <View style={styles.bannerPend}>
            <Ionicons name="time" size={16} color="#f59e0b" />
            <Text style={styles.bannerPendText}>
              {" "}Tu solicitud estÃ¡ <Text style={{ fontWeight: "bold" }}>en revisiÃ³n</Text>. En un plazo mÃ¡ximo de 48 horas recibirÃ¡s una respuesta en tu correo.
            </Text>
          </View>
        )}
        {estado === "RECHAZADA" && (
          <View style={styles.bannerRech}>
            <Ionicons name="close-circle" size={16} color="#ef4444" />
            <Text style={styles.bannerRechText}>
              {" "}<Text style={{ fontWeight: "bold" }}>Solicitud rechazada:</Text>{" "}
              {solicitud?.OBSERVACION_ADMIN || "No cumpliÃ³ con los requisitos."} Puedes corregir los datos y volver a enviarla.
            </Text>
          </View>
        )}

        <Text style={styles.formTitulo}>
          {estado === "RECHAZADA" ? "Vuelve a enviar tu solicitud" : "Formulario de solicitud"}
        </Text>

        <Text style={styles.label}>Nombre de la empresa *</Text>
        <TextInput style={styles.input} value={form.nombre_empresa} onChangeText={(v) => setCampo("nombre_empresa", v)} placeholder="Ej: Deportes Andinos SAS" maxLength={150} />

        <Text style={styles.label}>NIT *</Text>
        <TextInput style={styles.input} value={form.nit} onChangeText={(v) => setCampo("nit", v)} placeholder="Solo nÃºmeros (5-20 dÃ­gitos)" maxLength={20} keyboardType="number-pad" />

        <Text style={styles.label}>Representante legal *</Text>
        <TextInput style={styles.input} value={form.nombre_representante} onChangeText={(v) => setCampo("nombre_representante", v)} placeholder="Nombre completo" />

        <Text style={styles.label}>Correo de la empresa *</Text>
        <TextInput style={styles.input} value={form.email_empresa} onChangeText={(v) => setCampo("email_empresa", v)} placeholder="ventas@tuempresa.com" autoCapitalize="none" keyboardType="email-address" />

        <Text style={styles.label}>TelÃ©fono *</Text>
        <TextInput style={styles.input} value={form.telefono} onChangeText={(v) => setCampo("telefono", v)} placeholder="Ej: 3001234567" maxLength={15} keyboardType="phone-pad" />

        <Text style={styles.label}>Departamento *</Text>
        <TouchableOpacity style={styles.select} onPress={() => setDeptoOpen(!deptoOpen)}>
          <Text style={form.departamento ? styles.selectText : styles.selectPlaceholder}>
            {form.departamento || "Selecciona..."}
          </Text>
          <Ionicons name={deptoOpen ? "chevron-up" : "chevron-down"} size={16} color="#888" />
        </TouchableOpacity>
        {deptoOpen && (
          <ScrollView style={styles.options} nestedScrollEnabled>
            {DEPARTAMENTOS.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.option, form.departamento === d && styles.optionActive]}
                onPress={() => {
                  setCampo("departamento", d);
                  setDeptoOpen(false);
                }}
              >
                <Text style={[styles.optionText, form.departamento === d && styles.optionTextActive]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <Text style={styles.label}>Ciudad *</Text>
        <TextInput style={styles.input} value={form.ciudad} onChangeText={(v) => setCampo("ciudad", v)} placeholder="Ciudad o municipio" />

        <Text style={styles.label}>DirecciÃ³n de la empresa</Text>
        <TextInput style={styles.input} value={form.direccion} onChangeText={(v) => setCampo("direccion", v)} placeholder="Calle, carrera, barrio" />

        <Text style={styles.label}>CategorÃ­as en las que quieres vender *</Text>
        {categorias.length === 0 ? (
          <Text style={styles.notaTexto}>Cargando categorÃ­as...</Text>
        ) : (
          <View style={styles.cats}>
            {categorias.map((c) => {
              const on = catsSel.includes(c.ID_CATEGORIA);
              return (
                <TouchableOpacity
                  key={c.ID_CATEGORIA}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => toggleCat(c.ID_CATEGORIA)}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{c.NOMBRE_CATEGORIA}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>CuÃ©ntanos sobre tu negocio</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={form.descripcion}
          onChangeText={(v) => setCampo("descripcion", v)}
          placeholder="Productos que ofreces, experiencia, cobertura..."
          maxLength={2000}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <TouchableOpacity style={styles.checkRow} onPress={() => setAcepta(!acepta)}>
          <Ionicons
            name={acepta ? "checkbox" : "square-outline"}
            size={22}
            color={acepta ? "#e73737" : "#888"}
          />
          <Text style={styles.checkText}>
            He leÃ­do y acepto las <Text style={{ fontWeight: "bold" }}>PolÃ­ticas de vendedor de Colombia</Text> de JADDA SPORTS.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={enviar} disabled={enviando}>
          <Ionicons name="paper-plane" size={16} color="#fff" />
          <Text style={styles.buttonText}> {enviando ? "ENVIANDO..." : "ENVIAR SOLICITUD"}</Text>
        </TouchableOpacity>

        <Text style={styles.aviso}>
          Al enviar aceptas que tu solicitud serÃ¡ evaluada en un plazo mÃ¡ximo de <Text style={{ fontWeight: "bold" }}>48 horas</Text>. Si es aprobada, recibirÃ¡s en el correo de la empresa tus <Text style={{ fontWeight: "bold" }}>credenciales de vendedor</Text>.
        </Text>

        <View style={styles.politicas}>
          <Text style={styles.politicasTitulo}>PolÃ­ticas de vendedor (Colombia)</Text>
          {[
            ["Datos veraces:", " la informaciÃ³n de tu empresa debe ser real y verificable (NIT, representante legal, direcciÃ³n y contacto)."],
            ["Productos autorizados:", " solo se venden artÃ­culos deportivos, ropa y accesorios originales. EstÃ¡ prohibido vender productos falsificados, ilegales o que infrinjan derechos de autor."],
            ["Precios y stock:", " mantÃ©n tus precios en pesos colombianos y tu inventario actualizado; los pedidos deben poder despacharse dentro de los plazos ofrecidos."],
            ["Calidad y envÃ­os:", " responde las solicitudes de devoluciÃ³n y garantÃ­as segÃºn la ley colombiana (Estatuto del Consumidor, Ley 1480 de 2011)."],
            ["Comisiones y pagos:", " los pagos de las ventas se liquidan segÃºn lo pactado al momento de la aprobaciÃ³n de tu cuenta."],
            ["Reglas de la plataforma:", " no estÃ¡ permitido el fraude, la suplantaciÃ³n, la publicidad engaÃ±osa ni la venta fuera del catÃ¡logo."],
            ["EliminaciÃ³n de la cuenta:", " si dejas de vender o incumples estas polÃ­ticas, JADDA SPORTS podrÃ¡ suspender o eliminar tu cuenta de vendedor sin derecho a reclamo."],
            ["Tratamiento de datos:", " tus datos se tratan segÃºn nuestra PolÃ­tica de privacidad y la Ley 1581 de 2012."],
          ].map(([negrita, texto], i) => (
            <View key={i} style={styles.polItem}>
              <Ionicons name="ellipse" size={7} color="#e73737" />
              <Text style={styles.polText}>
                <Text style={{ fontWeight: "bold" }}>{negrita}</Text>{texto}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    paddingBottom: 60,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  backText: {
    color: "#111",
    fontWeight: "600",
  },
  hero: {
    backgroundColor: "#002244",
    paddingVertical: 30,
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: 8,
  },
  heroTitulo: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
  },
  heroSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },
  bannerPend: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 14,
  },
  bannerPendText: {
    color: "#92400e",
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  bannerRech: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 14,
  },
  bannerRechText: {
    color: "#991b1b",
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
  formTitulo: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#111",
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 4,
  },
  label: {
    color: "#555",
    fontSize: 12,
    fontWeight: "bold",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 13,
    fontSize: 14,
    marginHorizontal: 16,
  },
  textarea: {
    minHeight: 100,
  },
  select: {
    borderWidth: 2,
    borderColor: "#d1d5db",
    borderRadius: 12,
    padding: 13,
    marginHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectText: {
    color: "#111",
    fontSize: 14,
  },
  selectPlaceholder: {
    color: "#9ca3af",
    fontSize: 14,
  },
  options: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    maxHeight: 200,
  },
  option: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  optionActive: {
    backgroundColor: "#fdeaea",
  },
  optionText: {
    color: "#333",
  },
  optionTextActive: {
    color: "#e73737",
    fontWeight: "bold",
  },
  cats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginHorizontal: 16,
  },
  chip: {
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipOn: {
    borderColor: "#e73737",
    backgroundColor: "#fdeaea",
  },
  chipText: {
    color: "#555",
    fontSize: 12,
    fontWeight: "600",
  },
  chipTextOn: {
    color: "#e73737",
  },
  notaTexto: {
    color: "#888",
    fontSize: 12,
    marginHorizontal: 16,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
  },
  checkText: {
    color: "#444",
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e73737",
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 18,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 15,
  },
  aviso: {
    color: "#888",
    fontSize: 12,
    lineHeight: 18,
    marginHorizontal: 16,
    marginTop: 12,
  },
  politicas: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 20,
    elevation: 1,
  },
  politicasTitulo: {
    color: "#002244",
    fontWeight: "bold",
    fontSize: 15,
    marginBottom: 10,
  },
  polItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  polText: {
    color: "#555",
    fontSize: 12,
    lineHeight: 18,
    flex: 1,
  },
  okBox: {
    alignItems: "center",
    marginTop: 30,
  },
  okIco: {
    marginBottom: 6,
  },
  okTitulo: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    textAlign: "center",
  },
  okSub: {
    color: "#666",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    marginHorizontal: 30,
  },
  credenciales: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 18,
    width: "90%",
    elevation: 2,
  },
  credRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  credLabel: {
    color: "#888",
    fontSize: 13,
  },
  credValue: {
    color: "#111",
    fontWeight: "bold",
    fontSize: 13,
  },
  nota: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 14,
    width: "90%",
  },
  notaText: {
    color: "#92400e",
    fontSize: 12,
    flex: 1,
    lineHeight: 17,
  },
});
