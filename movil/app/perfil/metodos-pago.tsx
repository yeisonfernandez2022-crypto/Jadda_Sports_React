import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import api from "../../constants/api";
import BackButton from "../../components/BackButton";

interface Metodo {
  ID: number;
  ID_METODO: number;
  TITULAR?: string | null;
  TELEFONO?: string | null;
  BANCO?: string | null;
  TIPO?: string | null;
  NUMERO_TARJETA?: string | null;
  VENCIMIENTO?: string | null;
  ES_PRINCIPAL: number;
  NOMBRE_METODO: string;
  DESCRIPCION?: string | null;
}

// La app móvil solo guarda tarjetas (débito/crédito): Wompi no guarda datos
// propios (el método se elige dentro de su checkout).
const METODOS_SELECCION = [
  { id: "debito", label: "Tarjeta de débito", desc: "Paga directo desde tu cuenta", icon: "card" as const },
  { id: "credito", label: "Tarjeta de crédito", desc: "Paga con tu cupo", icon: "card" as const },
];

const ID_METODO: Record<string, number> = { debito: 2, credito: 3 };

export default function MetodosPago() {
  const { estaLogueado, cargando } = useAuth();
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(false);
  const [metodoSel, setMetodoSel] = useState("debito");
  const [titular, setTitular] = useState("");
  const [numero, setNumero] = useState("");
  const [vencimiento, setVencimiento] = useState("");
  const [cvv, setCvv] = useState("");
  const [banco, setBanco] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    api
      .get("/api/usuarios/metodos-pago")
      .then((res) => setMetodos(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!estaLogueado) {
      router.replace("/login");
      return;
    }
    cargar();
  }, [estaLogueado, cargar]);

  // Espejo de backend/utils/pagos.js vencimientoValido: MM/AA y no vencida.
  const vencimientoFutura = (t: string) => {
    const m = t.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (!m) return false;
    const anio = 2000 + Number(m[2]);
    const ahora = new Date();
    return anio > ahora.getFullYear() || (anio === ahora.getFullYear() && Number(m[1]) >= ahora.getMonth() + 1);
  };

  async function guardar() {
    try {
      const numeroDigitos = numero.replace(/\D/g, "");
      const cvvDigitos = cvv.replace(/\D/g, "");
      if (!titular.trim()) {
        Alert.alert("ERROR", "El nombre del titular es obligatorio.");
        return;
      }
      if (numeroDigitos.length < 13 || numeroDigitos.length > 19) {
        Alert.alert("ERROR", "El número de tarjeta debe tener entre 13 y 19 dígitos.");
        return;
      }
      if (!vencimientoFutura(vencimiento)) {
        Alert.alert("ERROR", "La fecha de vencimiento debe ser MM/AA y no estar vencida.");
        return;
      }
      if (cvvDigitos.length < 3 || cvvDigitos.length > 4) {
        Alert.alert("ERROR", "El CVV debe tener 3 o 4 dígitos.");
        return;
      }
      setGuardando(true);
      await api.post("/api/usuarios/metodos-pago", {
        id_metodo: ID_METODO[metodoSel],
        titular: titular.trim(),
        numero: numeroDigitos,
        vencimiento,
        cvv: cvvDigitos,
        banco: banco || null,
      });
      setModal(false);
      setTitular("");
      setNumero("");
      setVencimiento("");
      setCvv("");
      setBanco("");
      cargar();
    } catch (error: any) {
      Alert.alert("ERROR", error?.response?.data?.msg || "No se pudo guardar el método.");
    } finally {
      setGuardando(false);
    }
  }

  function eliminar(m: Metodo) {
    Alert.alert("Eliminar método", "¿Seguro que quieres eliminar este método de pago?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/usuarios/metodos-pago/${m.ID}`);
            cargar();
          } catch {
            Alert.alert("ERROR", "No se pudo eliminar.");
          }
        },
      },
    ]);
  }

  async function hacerPrincipal(m: Metodo) {
    try {
      await api.put(`/api/usuarios/metodos-pago/${m.ID}/principal`);
      cargar();
    } catch {
      Alert.alert("ERROR", "No se pudo cambiar el método principal.");
    }
  }

  if (cargando || loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e73737" />
      </View>
    );
  }

  if (!estaLogueado) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Inicia sesión</Text>
        <TouchableOpacity style={styles.button} onPress={() => router.push("/login")}>
          <Text style={styles.buttonText}>ENTRAR</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BackButton />
      <View style={styles.header}>
        <Text style={styles.title}>Métodos de pago</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModal(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {metodos.length === 0 ? (
          <View style={styles.vacioWrap}>
            <Ionicons name="card-outline" size={60} color="#ccc" />
            <Text style={styles.vacio}>No tienes métodos de pago guardados</Text>
            <Text style={styles.vacioSub}>Guarda tu forma de pago para pagar más rápido.</Text>
            <TouchableOpacity style={styles.button} onPress={() => setModal(true)}>
              <Text style={styles.buttonText}>AGREGAR MÉTODO</Text>
            </TouchableOpacity>
          </View>
        ) : (
          metodos.map((m) => (
            <View key={m.ID} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.metodoIcon}>
                  <Ionicons name="card" size={22} color="#e73737" />
                </View>
                <View style={styles.metodoInfo}>
                  <Text style={styles.metodoNombre}>{m.NOMBRE_METODO}</Text>
                  {m.TITULAR && <Text style={styles.metodoDato}>Titular: {m.TITULAR}</Text>}
                  {m.NUMERO_TARJETA && <Text style={styles.metodoDato}>•••• {m.NUMERO_TARJETA}</Text>}
                  {m.VENCIMIENTO && <Text style={styles.metodoDato}>Vence {m.VENCIMIENTO}</Text>}
                  {m.BANCO && <Text style={styles.metodoDato}>Banco: {m.BANCO}</Text>}
                </View>
                {m.ES_PRINCIPAL === 1 && (
                  <View style={styles.principalBadge}>
                    <Text style={styles.principalText}>PRINCIPAL</Text>
                  </View>
                )}
              </View>
              <View style={styles.acciones}>
                {m.ES_PRINCIPAL !== 1 && (
                  <TouchableOpacity style={styles.btnPrincipal} onPress={() => hacerPrincipal(m)}>
                    <Ionicons name="star" size={15} color="#e73737" />
                    <Text style={styles.btnPrincipalText}> Hacer principal</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.btnEliminar} onPress={() => eliminar(m)}>
                  <Ionicons name="trash" size={15} color="#ef4444" />
                  <Text style={styles.btnEliminarText}> Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <Modal visible={modal} transparent animationType="slide" onRequestClose={() => setModal(false)}>
        <View style={styles.modalBackdrop}>
          <ScrollView contentContainerStyle={styles.modal}>
            <Text style={styles.modalTitle}>Nuevo método de pago</Text>

            {METODOS_SELECCION.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.metodoOption, metodoSel === m.id && styles.metodoOptionActive]}
                onPress={() => setMetodoSel(m.id)}
              >
                <Ionicons name={m.icon} size={20} color={metodoSel === m.id ? "#e73737" : "#666"} />
                <View style={{ marginLeft: 12, flex: 1 }}>
                  <Text style={[styles.metodoOptionLabel, metodoSel === m.id && { color: "#e73737" }]}>{m.label}</Text>
                  <Text style={styles.metodoOptionDesc}>{m.desc}</Text>
                </View>
                <Ionicons
                  name={metodoSel === m.id ? "radio-button-on" : "radio-button-off"}
                  size={20}
                  color={metodoSel === m.id ? "#e73737" : "#bbb"}
                />
              </TouchableOpacity>
            ))}

            <TextInput style={styles.input} placeholder="Titular" value={titular} onChangeText={setTitular} />
            <TextInput
              style={styles.input}
              placeholder="Número de tarjeta"
              value={numero}
              onChangeText={(t) => setNumero(t.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim())}
              keyboardType="number-pad"
              maxLength={23}
            />
            <View style={styles.filaInput}>
              <TextInput
                style={[styles.input, { flex: 1, marginRight: 6 }]}
                placeholder="MM/AA"
                value={vencimiento}
                onChangeText={(t) => {
                  const d = t.replace(/\D/g, "");
                  setVencimiento(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2, 4)}` : d);
                }}
                keyboardType="number-pad"
                maxLength={5}
              />
              <TextInput
                style={[styles.input, { flex: 1, marginLeft: 6 }]}
                placeholder="CVV"
                value={cvv}
                onChangeText={(t) => setCvv(t.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
              />
            </View>
            <TextInput style={styles.input} placeholder="Banco (opcional)" value={banco} onChangeText={setBanco} />
            <Text style={styles.notaSeguridad}>
              Por seguridad solo se guardan los últimos 4 dígitos de la tarjeta; el CVV no se almacena.
            </Text>

            <TouchableOpacity style={styles.button} onPress={guardar} disabled={guardando}>
              <Text style={styles.buttonText}>{guardando ? "GUARDANDO..." : "GUARDAR"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModal(false)}>
              <Text style={styles.cancelText}>CANCELAR</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
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
    padding: 16,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
  },
  addBtn: {
    backgroundColor: "#e73737",
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  vacioWrap: {
    alignItems: "center",
    paddingTop: 40,
  },
  vacio: {
    color: "#888",
    fontSize: 15,
    marginVertical: 10,
  },
  vacioSub: {
    color: "#aaa",
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  metodoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fdeaea",
    justifyContent: "center",
    alignItems: "center",
  },
  metodoInfo: {
    flex: 1,
    marginLeft: 12,
  },
  metodoNombre: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#111",
  },
  metodoDato: {
    color: "#777",
    fontSize: 12,
    marginTop: 2,
  },
  principalBadge: {
    backgroundColor: "#e73737",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  principalText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  acciones: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  btnPrincipal: {
    flexDirection: "row",
    alignItems: "center",
  },
  btnPrincipalText: {
    color: "#e73737",
    fontWeight: "600",
  },
  btnEliminar: {
    flexDirection: "row",
    alignItems: "center",
  },
  btnEliminarText: {
    color: "#ef4444",
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
  },
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 14,
  },
  metodoOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  metodoOptionActive: {
    borderColor: "#e73737",
    backgroundColor: "#fdeaea",
  },
  metodoOptionLabel: {
    fontWeight: "600",
    color: "#333",
    fontSize: 14,
  },
  metodoOptionDesc: {
    color: "#999",
    fontSize: 11,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
  },
  filaInput: {
    flexDirection: "row",
  },
  notaSeguridad: {
    color: "#888",
    fontSize: 11,
    marginBottom: 14,
    textAlign: "center",
    lineHeight: 16,
  },
  button: {
    backgroundColor: "#e73737",
    padding: 15,
    borderRadius: 10,
    marginBottom: 8,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  cancelBtn: {
    padding: 12,
    alignItems: "center",
  },
  cancelText: {
    color: "#666",
    fontWeight: "600",
  },
});
