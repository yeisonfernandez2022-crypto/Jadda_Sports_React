import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import api from "../constants/api";
import { DEPARTAMENTOS } from "../data/colombia";
import { resolverImagen } from "../constants/api";
import { Image } from "react-native";

type Paso = "envio" | "pago";

interface PaymentData {
  [key: string]: string;
}

const BANCOS = ["Bancolombia", "BBVA", "Davivienda", "Banco de Bogotá", "Nequi", "Banco Popular", "Colpatria", "AV Villas"];

const METODOS = [
  { id: "tarjeta", label: "Tarjeta de crédito / débito", icon: "card" as const },
  { id: "pse", label: "PSE", icon: "business" as const },
  { id: "nequi", label: "Nequi", icon: "phone-portrait" as const },
  { id: "daviplata", label: "Daviplata", icon: "phone-portrait-outline" as const },
];

export default function CheckoutScreen() {
  const { cart, clearCart } = useCart();
  const { estaLogueado } = useAuth();

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [barrio, setBarrio] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [paso, setPaso] = useState<Paso>("envio");
  const [metodoPago, setMetodoPago] = useState("tarjeta");
  const [paymentData, setPaymentData] = useState<PaymentData>({});
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [envioCargando, setEnvioCargando] = useState(false);
  const [costoEnvio, setCostoEnvio] = useState(0);
  const [guardarMetodo, setGuardarMetodo] = useState(true);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const subtotal = cart.reduce((acc, item) => acc + Number(item.PRECIO) * item.CANTIDAD, 0);

  useEffect(() => {
    if (!estaLogueado) return;
    api.get("/api/auth/perfil")
      .then((res) => {
        const u = res.data;
        if (u.NOMBRE_USUARIO) setNombre(u.NOMBRE_USUARIO);
        if (u.EMAIL) setCorreo(u.EMAIL);
        if (u.TELEFONO && u.TELEFONO !== "N/A") setTelefono(u.TELEFONO);
      })
      .catch(() => {});
  }, [estaLogueado]);

  useEffect(() => {
    if (!departamento.trim()) {
      setCostoEnvio(0);
      return;
    }
    setEnvioCargando(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get("/api/envio/calcular", {
          params: { departamento, ciudad, subtotal },
        });
        setCostoEnvio(Number(res.data.costo) || 0);
      } catch {
        setCostoEnvio(0);
      } finally {
        setEnvioCargando(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [departamento, ciudad, subtotal]);

  const formOk =
    nombre.trim() !== "" &&
    correo.trim() !== "" && emailRegex.test(correo) &&
    telefono.trim() !== "" &&
    direccion.trim() !== "" &&
    ciudad.trim() !== "" &&
    departamento.trim() !== "";

  const paymentOk = () => {
    if (metodoPago === "tarjeta") {
      return !!paymentData.titular && !!paymentData.numero && !!paymentData.vencimiento && !!paymentData.cvv;
    }
    if (metodoPago === "nequi" || metodoPago === "daviplata") {
      return !!paymentData.telefono;
    }
    if (metodoPago === "pse") {
      return !!paymentData.banco;
    }
    return true;
  };

  const updatePayment = (field: string, value: string) => {
    setPaymentData((prev) => ({ ...prev, [field]: value }));
  };

  const departamentosList = Object.keys(DEPARTAMENTOS);
  const deptosParaSelect = departamento && !departamentosList.includes(departamento)
    ? [departamento, ...departamentosList]
    : departamentosList;
  const ciudadesDept = (departamento && DEPARTAMENTOS[departamento]) || [];
  const ciudadesParaSelect = ciudad && !ciudadesDept.includes(ciudad)
    ? [ciudad, ...ciudadesDept]
    : ciudadesDept;

  const handleCheckout = async () => {
    if (!formOk || !paymentOk()) return;
    setCheckoutLoading(true);
    try {
      const res = await api.post("/api/checkout/procesar", {
        metodoPago,
        paymentData,
        cuponCodigo: "",
        nombre,
        correo,
        telefono,
        direccion,
        barrio,
        ciudad,
        departamento,
        codigoPostal,
        observaciones,
      });

      if (res.data.ok) {
        if (guardarMetodo) {
          const idMetodoMap: Record<string, number> = { tarjeta: 2, pse: 7, nequi: 4, daviplata: 5 };
          await api.post("/api/usuarios/metodos-pago", {
            id_metodo: idMetodoMap[metodoPago] || 2,
            titular: paymentData.titular || null,
            telefono: paymentData.telefono || null,
            banco: paymentData.banco || null,
          }).catch(() => {});
        }
        clearCart();
        const total = subtotal + costoEnvio;
        router.replace({
          pathname: "/compra-exitosa",
          params: {
            ventaId: String(res.data.ventaId),
            referencia: res.data.referencia,
            total: String(total),
          },
        });
      }
    } catch (err: any) {
      Alert.alert("NO SE PUDO PROCESAR", err.response?.data?.error || "Error al procesar la compra. Intenta de nuevo.");
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (!estaLogueado) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Finalizar compra</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
        <TouchableOpacity style={styles.btnRojo} onPress={() => router.push("/login")}>
          <Text style={styles.btnRojoText}>INICIAR SESIÓN</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Stepper */}
        <View style={styles.stepper}>
          <View style={[styles.step, styles.stepActive]}>
            <Ionicons name="cart" size={18} color="#fff" />
            <Text style={styles.stepLabel}>Carrito</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={[styles.step, paso === "envio" || paso === "pago" ? styles.stepActive : styles.stepInactive]}>
            <Ionicons name="car" size={18} color={paso === "envio" || paso === "pago" ? "#fff" : "#999"} />
            <Text style={[styles.stepLabel, paso === "envio" || paso === "pago" ? styles.stepLabelActive : styles.stepLabelInactive]}>Envío</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={[styles.step, paso === "pago" ? styles.stepActive : styles.stepInactive]}>
            <Ionicons name="card" size={18} color={paso === "pago" ? "#fff" : "#999"} />
            <Text style={[styles.stepLabel, paso === "pago" ? styles.stepLabelActive : styles.stepLabelInactive]}>Pago</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepInactive}>
            <Ionicons name="checkmark" size={18} color="#999" />
            <Text style={styles.stepLabelInactive}>Confirmación</Text>
          </View>
        </View>

        <Text style={styles.pageTitle}>
          <Ionicons name="receipt" size={22} color="#e73737" /> FINALIZAR COMPRA
        </Text>

        {/* PASO ENVÍO */}
        {paso === "envio" && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>
              <Ionicons name="location" size={18} color="#e73737" /> Información de envío <Text style={styles.req}>*</Text>
            </Text>

            <Text style={styles.label}>Nombre completo <Text style={styles.req}>*</Text></Text>
            <TextInput style={[styles.input, !nombre.trim() && styles.inputError]} placeholder="Tu nombre" value={nombre} onChangeText={setNombre} />

            <Text style={styles.label}>Teléfono <Text style={styles.req}>*</Text></Text>
            <TextInput style={[styles.input, !telefono.trim() && styles.inputError]} placeholder="Tu teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />

            <Text style={styles.label}>Correo electrónico <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={[styles.input, (!correo.trim() || (correo.trim() && !emailRegex.test(correo))) && styles.inputError]}
              placeholder="tu@correo.com"
              value={correo}
              onChangeText={setCorreo}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {correo.trim() && !emailRegex.test(correo) && <Text style={styles.errText}>Email inválido</Text>}

            <Text style={styles.label}>Dirección <Text style={styles.req}>*</Text></Text>
            <TextInput style={[styles.input, !direccion.trim() && styles.inputError]} placeholder="Cra 45 # 23-12" value={direccion} onChangeText={setDireccion} />

            <Text style={styles.label}>Departamento <Text style={styles.req}>*</Text></Text>
            {deptosParaSelect.map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.selectOption, departamento === d && styles.selectOptionSelected]}
                onPress={() => { setDepartamento(d); setCiudad(""); }}
              >
                <Text style={departamento === d ? styles.selectTextSelected : styles.selectText}>{d}</Text>
                {departamento === d && <Ionicons name="checkmark-circle" size={18} color="#e73737" />}
              </TouchableOpacity>
            ))}

            <Text style={styles.label}>Ciudad <Text style={styles.req}>*</Text></Text>
            {ciudadesParaSelect.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.selectOption, ciudad === c && styles.selectOptionSelected]}
                onPress={() => setCiudad(c)}
              >
                <Text style={ciudad === c ? styles.selectTextSelected : styles.selectText}>{c}</Text>
                {ciudad === c && <Ionicons name="checkmark-circle" size={18} color="#e73737" />}
              </TouchableOpacity>
            ))}
            {departamento && ciudadesParaSelect.length === 0 && (
              <Text style={styles.hint}>Escribe tu ciudad en el campo manual abajo</Text>
            )}

            <Text style={styles.label}>Ciudad (manual)</Text>
            <TextInput style={styles.input} placeholder="Ciudad" value={ciudad} onChangeText={setCiudad} />

            <Text style={styles.label}>Barrio</Text>
            <TextInput style={styles.input} placeholder="Barrio" value={barrio} onChangeText={setBarrio} />

            <Text style={styles.label}>Código postal</Text>
            <TextInput style={styles.input} placeholder="Código postal" value={codigoPostal} onChangeText={setCodigoPostal} keyboardType="number-pad" />

            <Text style={styles.label}>Observaciones</Text>
            <TextInput style={[styles.input, styles.textArea]} placeholder="Indicaciones para la entrega..." value={observaciones} onChangeText={setObservaciones} multiline numberOfLines={3} />

            {/* Costo de envío */}
            <View style={styles.envioBox}>
              <Text style={styles.envioLabel}><Ionicons name="car" size={16} color="#e73737" /> Costo de envío</Text>
              {envioCargando ? (
                <ActivityIndicator size="small" color="#e73737" />
              ) : costoEnvio > 0 ? (
                <Text style={styles.envioValue}>${costoEnvio.toLocaleString("es-CO")}</Text>
              ) : (
                <Text style={styles.envioGratis}>Gratis</Text>
              )}
            </View>
            {subtotal < 800000 && (
              <Text style={styles.hint}>Envío gratis en compras desde $800.000.</Text>
            )}

            {!formOk && (
              <Text style={styles.errText}>Completa los campos obligatorios para continuar</Text>
            )}
            <TouchableOpacity
              style={[styles.btnRojo, !formOk && styles.btnDisabled]}
              disabled={!formOk}
              onPress={() => setPaso("pago")}
            >
              <Text style={styles.btnRojoText}>SIGUIENTE</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PASO PAGO */}
        {paso === "pago" && (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>
              <Ionicons name="card" size={18} color="#e73737" /> Método de pago <Text style={styles.req}>*</Text>
            </Text>

            {METODOS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.metodoItem, metodoPago === m.id && styles.metodoItemSelected]}
                onPress={() => setMetodoPago(m.id)}
              >
                <Ionicons name={m.icon} size={20} color={metodoPago === m.id ? "#e73737" : "#555"} />
                <Text style={[styles.metodoLabel, metodoPago === m.id && styles.metodoLabelSelected]}>{m.label}</Text>
                <Ionicons name={metodoPago === m.id ? "radio-button-on" : "radio-button-off"} size={20} color={metodoPago === m.id ? "#e73737" : "#999"} />
              </TouchableOpacity>
            ))}

            {/* Campos de pago */}
            {metodoPago === "tarjeta" && (
              <>
                <Text style={styles.label}>Titular de la tarjeta <Text style={styles.req}>*</Text></Text>
                <TextInput style={[styles.input, !paymentData.titular && styles.inputError]} placeholder="Nombre del titular" value={paymentData.titular || ""} onChangeText={(v) => updatePayment("titular", v)} />
                <Text style={styles.label}>Número de tarjeta <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={[styles.input, !paymentData.numero && styles.inputError]}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  value={paymentData.numero || ""}
                  keyboardType="number-pad"
                  onChangeText={(v) => updatePayment("numero", v.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim())}
                />
                <View style={styles.row}>
                  <View style={styles.rowHalf}>
                    <Text style={styles.label}>Vencimiento <Text style={styles.req}>*</Text></Text>
                    <TextInput
                      style={[styles.input, !paymentData.vencimiento && styles.inputError]}
                      placeholder="MM/AA"
                      maxLength={5}
                      value={paymentData.vencimiento || ""}
                      keyboardType="number-pad"
                      onChangeText={(v) => {
                        let val = v.replace(/\D/g, "");
                        if (val.length > 2) val = val.slice(0, 2) + "/" + val.slice(2);
                        updatePayment("vencimiento", val);
                      }}
                    />
                  </View>
                  <View style={styles.rowHalf}>
                    <Text style={styles.label}>CVV <Text style={styles.req}>*</Text></Text>
                    <TextInput
                      style={[styles.input, !paymentData.cvv && styles.inputError]}
                      placeholder="123"
                      maxLength={4}
                      value={paymentData.cvv || ""}
                      keyboardType="number-pad"
                      secureTextEntry
                      onChangeText={(v) => updatePayment("cvv", v.replace(/\D/g, ""))}
                    />
                  </View>
                </View>
              </>
            )}

            {(metodoPago === "nequi" || metodoPago === "daviplata") && (
              <>
                <Text style={styles.label}>Número de celular {metodoPago === "nequi" ? "Nequi" : "Daviplata"} <Text style={styles.req}>*</Text></Text>
                <TextInput
                  style={[styles.input, !paymentData.telefono && styles.inputError]}
                  placeholder="300 123 4567"
                  value={paymentData.telefono || ""}
                  keyboardType="phone-pad"
                  onChangeText={(v) => updatePayment("telefono", v.replace(/\D/g, ""))}
                />
              </>
            )}

            {metodoPago === "pse" && (
              <>
                <Text style={styles.label}>Banco <Text style={styles.req}>*</Text></Text>
                {BANCOS.map((b) => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.selectOption, paymentData.banco === b && styles.selectOptionSelected]}
                    onPress={() => updatePayment("banco", b)}
                  >
                    <Text style={paymentData.banco === b ? styles.selectTextSelected : styles.selectText}>{b}</Text>
                    {paymentData.banco === b && <Ionicons name="checkmark-circle" size={18} color="#e73737" />}
                  </TouchableOpacity>
                ))}
              </>
            )}

            <TouchableOpacity style={styles.checkRow} onPress={() => setGuardarMetodo(!guardarMetodo)}>
              <Ionicons name={guardarMetodo ? "checkbox" : "square-outline"} size={22} color="#e73737" />
              <Text style={styles.checkLabel}> Guardar este método para futuras compras</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnOutline} onPress={() => setPaso("envio")}>
              <Text style={styles.btnOutlineText}><Ionicons name="arrow-back" size={16} /> ATRÁS</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* RESUMEN SIEMPRE */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>
            <Ionicons name="bag" size={18} color="#e73737" /> Resumen del pedido
          </Text>

          {cart.map((item) => (
            <View style={styles.resumenItem} key={item.ID_CARRITO}>
              <Image source={{ uri: resolverImagen(item.IMAGEN) || undefined }} style={styles.resumenImg} />
              <View style={styles.resumenInfo}>
                <Text numberOfLines={2} style={styles.resumenNombre}>{item.NOMBRE}</Text>
                {item.COLOR || item.ATRIBUTO ? (
                  <Text style={styles.resumenVariante}>
                    {[item.COLOR ? `Color: ${item.COLOR}` : "", item.ATRIBUTO].filter(Boolean).join(" | ")}
                  </Text>
                ) : null}
                <Text style={styles.resumenPrecio}>
                  ${(Number(item.PRECIO) * item.CANTIDAD).toLocaleString("es-CO")}
                </Text>
              </View>
              <View style={styles.resumenCantBadge}>
                <Text style={styles.resumenCantText}>{item.CANTIDAD}</Text>
              </View>
            </View>
          ))}

          <View style={styles.divider} />

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>${subtotal.toLocaleString("es-CO")}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Envío</Text>
            {envioCargando ? (
              <ActivityIndicator size="small" color="#e73737" />
            ) : costoEnvio > 0 ? (
              <Text style={styles.totalValue}>${costoEnvio.toLocaleString("es-CO")}</Text>
            ) : (
              <Text style={styles.totalGratis}>Gratis</Text>
            )}
          </View>
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.granTotalLabel}>Total</Text>
            <Text style={styles.granTotalValue}>${(subtotal + costoEnvio).toLocaleString("es-CO")}</Text>
          </View>

          {paso === "pago" && (
            <>
              {formOk && !paymentOk() && (
                <Text style={styles.errText}>Completa los datos del método de pago</Text>
              )}
              <TouchableOpacity
                style={[styles.btnRojo, (!formOk || !paymentOk()) && styles.btnDisabled]}
                disabled={!formOk || !paymentOk() || checkoutLoading}
                onPress={handleCheckout}
              >
                {checkoutLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnRojoText}>
                    <Ionicons name="lock-closed" size={16} color="#fff" /> {formOk && paymentOk() ? "PAGAR AHORA" : "COMPLETA LOS CAMPOS"}
                  </Text>
                )}
              </TouchableOpacity>
              <Text style={styles.seguro}>
                <Ionicons name="shield-checkmark" size={14} color="#999" /> Pago seguro con encriptación SSL
              </Text>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#f5f5f5" },
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { padding: 15, paddingBottom: 60 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 25, backgroundColor: "#fff" },
  stepper: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  step: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 16 },
  stepActive: { backgroundColor: "#e73737" },
  stepInactive: { backgroundColor: "#fff" },
  stepLine: { flex: 1, height: 2, backgroundColor: "#ddd", marginHorizontal: 4 },
  stepLabel: { color: "#fff", fontSize: 11, fontWeight: "bold" },
  stepLabelActive: { color: "#e73737", fontWeight: "bold" },
  stepLabelInactive: { color: "#999", fontSize: 11 },
  pageTitle: { fontSize: 20, fontWeight: "bold", color: "#002244", marginBottom: 15, textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, marginBottom: 15, elevation: 3 },
  cardHeader: { fontSize: 17, fontWeight: "bold", marginBottom: 15, color: "#111" },
  req: { color: "#e73737" },
  label: { fontSize: 14, fontWeight: "600", marginTop: 12, marginBottom: 5, color: "#333" },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: "#fff" },
  inputError: { borderColor: "#e73737" },
  textArea: { minHeight: 70, textAlignVertical: "top" },
  errText: { color: "#e73737", fontSize: 12, marginTop: 5 },
  hint: { color: "#888", fontSize: 12, marginTop: 5 },
  selectOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  selectOptionSelected: { borderColor: "#e73737", backgroundColor: "#fff5f5" },
  selectText: { fontSize: 14 },
  selectTextSelected: { fontSize: 14, color: "#e73737", fontWeight: "bold" },
  envioBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 15, padding: 12, borderWidth: 1, borderColor: "#ddd", borderRadius: 10 },
  envioLabel: { fontSize: 14, fontWeight: "600" },
  envioValue: { fontSize: 16, fontWeight: "bold" },
  envioGratis: { color: "#16a34a", fontWeight: "bold" },
  btnRojo: { backgroundColor: "#e73737", padding: 15, borderRadius: 10, marginTop: 20, alignItems: "center" },
  btnRojoText: { color: "#fff", textAlign: "center", fontWeight: "bold", fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
  btnOutline: { borderWidth: 1, borderColor: "#002244", borderRadius: 10, padding: 12, marginTop: 15, alignItems: "center" },
  btnOutlineText: { color: "#002244", fontWeight: "bold", fontSize: 14 },
  metodoItem: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 12, marginBottom: 8 },
  metodoItemSelected: { borderColor: "#e73737", backgroundColor: "#fff5f5" },
  metodoLabel: { flex: 1, fontSize: 15 },
  metodoLabelSelected: { color: "#e73737", fontWeight: "bold" },
  row: { flexDirection: "row", gap: 10 },
  rowHalf: { flex: 1 },
  checkRow: { flexDirection: "row", alignItems: "center", marginTop: 15 },
  checkLabel: { fontSize: 13, color: "#333" },
  resumenItem: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  resumenImg: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#f0f0f0" },
  resumenInfo: { flex: 1, marginLeft: 10 },
  resumenNombre: { fontWeight: "bold", fontSize: 14 },
  resumenVariante: { color: "#888", fontSize: 11, marginTop: 2 },
  resumenPrecio: { color: "#e73737", fontWeight: "bold", fontSize: 13, marginTop: 3 },
  resumenCantBadge: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#002244", justifyContent: "center", alignItems: "center", marginLeft: 8 },
  resumenCantText: { color: "#fff", fontWeight: "bold", fontSize: 12 },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 4 },
  totalLabel: { fontSize: 14, color: "#555" },
  totalValue: { fontSize: 15, fontWeight: "600" },
  totalGratis: { color: "#16a34a", fontWeight: "bold" },
  granTotalLabel: { fontSize: 17, fontWeight: "bold" },
  granTotalValue: { fontSize: 20, fontWeight: "bold", color: "#e73737" },
  seguro: { textAlign: "center", color: "#999", fontSize: 11, marginTop: 10 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10, textAlign: "center" },
  subtitle: { color: "#666", marginBottom: 25, textAlign: "center" },
});
