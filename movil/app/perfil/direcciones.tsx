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
import { DEPARTAMENTOS } from "../../data/colombia";
import BackButton from "../../components/BackButton";

interface Direccion {
  ID_DIRECCION: number;
  DIRECCION: string;
  BARRIO?: string | null;
  CIUDAD: string;
  DEPARTAMENTO: string;
  CODIGO_POSTAL?: string | null;
  TELEFONO_CONTACTO?: string | null;
  ES_PRINCIPAL: number;
  ETIQUETA?: string | null;
}

const VACIA: Partial<Direccion> = {
  DIRECCION: "",
  BARRIO: "",
  CIUDAD: "",
  DEPARTAMENTO: "",
  CODIGO_POSTAL: "",
  TELEFONO_CONTACTO: "",
  ETIQUETA: "",
};

export default function Direcciones() {
  const { estaLogueado, cargando } = useAuth();
  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Direccion | null>(null);
  const [form, setForm] = useState<Partial<Direccion>>({ ...VACIA });
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(() => {
    api
      .get("/api/direcciones")
      .then((res) => setDirecciones(res.data))
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

  const abrirNueva = () => {
    setEditando(null);
    setForm({ ...VACIA });
    setModal(true);
  };

  const abrirEditar = (d: Direccion) => {
    setEditando(d);
    setForm({ ...d });
    setModal(true);
  };

  async function guardar() {
    try {
      if (!form.DIRECCION?.trim() || !form.CIUDAD?.trim() || !form.DEPARTAMENTO) {
        Alert.alert("ERROR", "Dirección, ciudad y departamento son obligatorios.");
        return;
      }
      setGuardando(true);
      const payload = {
        direccion: form.DIRECCION,
        barrio: form.BARRIO,
        ciudad: form.CIUDAD,
        departamento: form.DEPARTAMENTO,
        codigo_postal: form.CODIGO_POSTAL,
        telefono_contacto: form.TELEFONO_CONTACTO,
        es_principal: Boolean(form.ES_PRINCIPAL),
        etiqueta: form.ETIQUETA,
      };
      if (editando) {
        await api.put(`/api/direcciones/${editando.ID_DIRECCION}`, payload);
      } else {
        await api.post("/api/direcciones", payload);
      }
      setModal(false);
      cargar();
    } catch (error: any) {
      Alert.alert("ERROR", error?.response?.data?.msg || "No se pudo guardar la dirección.");
    } finally {
      setGuardando(false);
    }
  }

  function eliminar(d: Direccion) {
    Alert.alert("Eliminar dirección", "¿Seguro que quieres eliminar esta dirección?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/direcciones/${d.ID_DIRECCION}`);
            cargar();
          } catch {
            Alert.alert("ERROR", "No se pudo eliminar.");
          }
        },
      },
    ]);
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
        <Text style={styles.title}>Mis direcciones</Text>
        <TouchableOpacity style={styles.addBtn} onPress={abrirNueva}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {direcciones.length === 0 ? (
          <View style={styles.vacioWrap}>
            <Ionicons name="map-outline" size={60} color="#ccc" />
            <Text style={styles.vacio}>No tienes direcciones guardadas</Text>
            <TouchableOpacity style={styles.button} onPress={abrirNueva}>
              <Text style={styles.buttonText}>AGREGAR DIRECCIÓN</Text>
            </TouchableOpacity>
          </View>
        ) : (
          direcciones.map((d) => (
            <View key={d.ID_DIRECCION} style={styles.card}>
              <View style={styles.cardTop}>
                {d.ETIQUETA ? (
                  <Text style={styles.etiqueta}>{d.ETIQUETA}</Text>
                ) : (
                  <Text style={styles.etiqueta}>Dirección</Text>
                )}
                {d.ES_PRINCIPAL === 1 && (
                  <View style={styles.principalBadge}>
                    <Text style={styles.principalText}>PRINCIPAL</Text>
                  </View>
                )}
              </View>
              <Text style={styles.direccion}>{d.DIRECCION}</Text>
              <Text style={styles.ciudad}>
                {d.BARRIO ? `${d.BARRIO}, ` : ""}{d.CIUDAD} - {d.DEPARTAMENTO}
              </Text>
              {d.CODIGO_POSTAL ? <Text style={styles.extra}>C.P. {d.CODIGO_POSTAL}</Text> : null}
              {d.TELEFONO_CONTACTO ? <Text style={styles.extra}>Tel: {d.TELEFONO_CONTACTO}</Text> : null}
              <View style={styles.acciones}>
                <TouchableOpacity style={styles.btnEditar} onPress={() => abrirEditar(d)}>
                  <Ionicons name="pencil" size={15} color="#002244" />
                  <Text style={styles.btnEditarText}> Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnEliminar} onPress={() => eliminar(d)}>
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
            <Text style={styles.modalTitle}>{editando ? "Editar dirección" : "Nueva dirección"}</Text>

            <TextInput style={styles.input} placeholder="Etiqueta (ej: Casa, Trabajo)" value={form.ETIQUETA || ""} onChangeText={(v) => setForm({ ...form, ETIQUETA: v })} />
            <TextInput style={styles.input} placeholder="Dirección (ej: Cra 45 # 23-12)" value={form.DIRECCION || ""} onChangeText={(v) => setForm({ ...form, DIRECCION: v })} />
            <TextInput style={styles.input} placeholder="Barrio" value={form.BARRIO || ""} onChangeText={(v) => setForm({ ...form, BARRIO: v })} />
            <TextInput style={styles.input} placeholder="Ciudad" value={form.CIUDAD || ""} onChangeText={(v) => setForm({ ...form, CIUDAD: v })} />

            <Text style={styles.label}>Departamento</Text>
            <ScrollView style={styles.deptos} nestedScrollEnabled>
              {Object.keys(DEPARTAMENTOS).map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.depto, form.DEPARTAMENTO === d && styles.deptoActive]}
                  onPress={() => setForm({ ...form, DEPARTAMENTO: d })}
                >
                  <Text style={[styles.deptoText, form.DEPARTAMENTO === d && styles.deptoTextActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput style={styles.input} placeholder="Código postal" value={form.CODIGO_POSTAL || ""} onChangeText={(v) => setForm({ ...form, CODIGO_POSTAL: v })} />
            <TextInput style={styles.input} placeholder="Teléfono de contacto" value={form.TELEFONO_CONTACTO || ""} onChangeText={(v) => setForm({ ...form, TELEFONO_CONTACTO: v })} keyboardType="phone-pad" />

            <TouchableOpacity
              style={styles.principalToggle}
              onPress={() => setForm({ ...form, ES_PRINCIPAL: form.ES_PRINCIPAL ? 0 : 1 })}
            >
              <Ionicons
                name={form.ES_PRINCIPAL ? "checkbox" : "square-outline"}
                size={20}
                color={form.ES_PRINCIPAL ? "#e73737" : "#888"}
              />
              <Text style={styles.principalToggleText}> Establecer como principal</Text>
            </TouchableOpacity>

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
    marginVertical: 14,
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  etiqueta: {
    fontWeight: "bold",
    color: "#002244",
    fontSize: 13,
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
  direccion: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },
  ciudad: {
    color: "#666",
    fontSize: 13,
    marginTop: 4,
  },
  extra: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },
  acciones: {
    flexDirection: "row",
    gap: 14,
    marginTop: 12,
  },
  btnEditar: {
    flexDirection: "row",
    alignItems: "center",
  },
  btnEditarText: {
    color: "#002244",
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
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
  },
  label: {
    fontWeight: "600",
    color: "#111",
    marginBottom: 6,
  },
  deptos: {
    maxHeight: 160,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    marginBottom: 12,
  },
  depto: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  deptoActive: {
    backgroundColor: "#fdeaea",
  },
  deptoText: {
    color: "#333",
  },
  deptoTextActive: {
    color: "#e73737",
    fontWeight: "bold",
  },
  principalToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  principalToggleText: {
    color: "#444",
    fontSize: 13,
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
