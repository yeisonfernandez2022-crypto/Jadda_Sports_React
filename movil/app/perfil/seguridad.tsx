import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect } from "react";
import { router } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import api from "../../constants/api";
import BackButton from "../../components/BackButton";
import { COLORES, RADIO, SOMBRA } from "../../styles/weblike";

export default function Seguridad() {
  const { estaLogueado, cargando } = useAuth();
  const [perfil, setPerfil] = useState<any>(null);

  const [passActual, setPassActual] = useState("");
  const [passNueva, setPassNueva] = useState("");
  const [passConfirmar, setPassConfirmar] = useState("");
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => {
    if (!estaLogueado) {
      router.replace("/login");
      return;
    }
    api
      .get("/api/auth/perfil")
      .then((res) => setPerfil(res.data))
      .catch(() => {});
  }, [estaLogueado]);

  async function cambiarPassword() {
    if (!passActual || !passNueva || !passConfirmar) {
      Alert.alert("ERROR", "Completa los tres campos.");
      return;
    }
    if (passNueva.length < 8) {
      Alert.alert("ERROR", "La nueva contraseña debe tener mínimo 8 caracteres.");
      return;
    }
    if (passNueva !== passConfirmar) {
      Alert.alert("ERROR", "Las contraseñas no coinciden.");
      return;
    }
    setCambiando(true);
    try {
      await api.post("/api/auth/cambiar-password", {
        password_actual: passActual,
        password_nueva: passNueva,
      });
      setPassActual("");
      setPassNueva("");
      setPassConfirmar("");
      Alert.alert("¡CONTRASEÑA ACTUALIZADA!", "Tu contraseña se cambió correctamente.");
    } catch (error: any) {
      Alert.alert("ERROR", error?.response?.data?.msg || "La contraseña actual es incorrecta.");
    } finally {
      setCambiando(false);
    }
  }

  if (cargando) {
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

  const u = perfil?.usuario || perfil;
  const ultimaConexion = u?.ULTIMA_CONEXION || null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton />
      <Text style={styles.title}>Seguridad</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Última conexión</Text>
        {ultimaConexion ? (
          <Text style={styles.conexion}>
            {new Date(ultimaConexion).toLocaleString("es-CO", {
              weekday: "long",
              day: "2-digit",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        ) : (
          <Text style={styles.conexion}>Aún no hay registros de conexión</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cambiar contraseña</Text>
        <TextInput
          style={styles.input}
          placeholder="Contraseña actual"
          value={passActual}
          onChangeText={setPassActual}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Nueva contraseña (mínimo 8 caracteres)"
          value={passNueva}
          onChangeText={setPassNueva}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Repite la nueva contraseña"
          value={passConfirmar}
          onChangeText={setPassConfirmar}
          secureTextEntry
        />
        <TouchableOpacity style={styles.button} onPress={cambiarPassword} disabled={cambiando}>
          <Text style={styles.buttonText}>{cambiando ? "CAMBIANDO..." : "CAMBIAR CONTRASEÑA"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
    backgroundColor: COLORES.fondo,
  },
  container: {
    padding: 16,
    backgroundColor: COLORES.fondo,
    flexGrow: 1,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORES.navy,
    marginBottom: 16,
  },
  card: {
    backgroundColor: COLORES.blanco,
    borderRadius: RADIO.card,
    padding: 16,
    marginBottom: 14,
    ...SOMBRA,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 15,
    color: COLORES.dark,
    marginBottom: 12,
  },
  conexion: {
    color: COLORES.sub,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORES.borde,
    borderRadius: RADIO.input,
    padding: 13,
    marginBottom: 12,
    backgroundColor: COLORES.blanco,
    color: COLORES.texto,
  },
  button: {
    backgroundColor: COLORES.rojo,
    padding: 14,
    borderRadius: RADIO.input,
    marginTop: 4,
  },
  buttonText: {
    color: COLORES.blanco,
    textAlign: "center",
    fontWeight: "bold",
  },
});
