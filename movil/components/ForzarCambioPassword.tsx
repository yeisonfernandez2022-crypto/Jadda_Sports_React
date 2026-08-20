import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../context/AuthContext";
import api from "../constants/api";

export default function ForzarCambioPassword() {
  const { usuario, estaLogueado, logout, refreshPerfil } = useAuth();
  const [visible, setVisible] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => {
    if (estaLogueado && Number(usuario?.DEBE_CAMBIAR_PASSWORD) === 1) {
      setVisible(true);
    }
  }, [estaLogueado, usuario?.DEBE_CAMBIAR_PASSWORD]);

  const cerrar = () => {
    setVisible(false);
    logout();
    router.replace("/login");
  };

  const cambiar = async () => {
    if (!actual || !nueva || !confirmar) {
      Alert.alert("ERROR", "Completa los tres campos.");
      return;
    }
    if (nueva.length < 8) {
      Alert.alert("ERROR", "La nueva contraseña debe tener mínimo 8 caracteres.");
      return;
    }
    if (nueva !== confirmar) {
      Alert.alert("ERROR", "Las contraseñas no coinciden.");
      return;
    }
    setCambiando(true);
    try {
      await api.post("/api/auth/cambiar-password", {
        password_actual: actual,
        password_nueva: nueva,
      });
      setVisible(false);
      Alert.alert("CONTRASEÑA ACTUALIZADA", "Ya puedes usar tu cuenta con tu nueva contraseña.");
      await refreshPerfil();
    } catch (error: any) {
      Alert.alert("ERROR", error?.response?.data?.msg || "La contraseña actual es incorrecta.");
    } finally {
      setCambiando(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cerrar}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <Text style={styles.title}>Debes cambiar tu contraseña</Text>
          <Text style={styles.text}>
            Tu cuenta usa una contraseña temporal (enviada por correo). Crea una nueva contraseña personal:
          </Text>

          <TextInput
            placeholder="Contraseña temporal actual"
            secureTextEntry
            value={actual}
            onChangeText={setActual}
            style={styles.input}
          />
          <TextInput
            placeholder="Nueva contraseña (mínimo 8 caracteres)"
            secureTextEntry
            value={nueva}
            onChangeText={setNueva}
            style={styles.input}
          />
          <TextInput
            placeholder="Repite la nueva contraseña"
            secureTextEntry
            value={confirmar}
            onChangeText={setConfirmar}
            style={styles.input}
          />

          <TouchableOpacity style={styles.btn} onPress={cambiar} disabled={cambiando}>
            <Text style={styles.btnText}>{cambiando ? "CAMBIANDO..." : "CAMBIAR CONTRASEÑA"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnCerrar} onPress={cerrar}>
            <Text style={styles.btnCerrarText}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 22,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 22,
  },
  title: {
    fontSize: 19,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 8,
  },
  text: {
    color: "#555",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: "#e73737",
    padding: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  btnText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  btnCerrar: {
    padding: 14,
    marginTop: 4,
    alignItems: "center",
  },
  btnCerrarText: {
    color: "#666",
    fontWeight: "600",
  },
});
