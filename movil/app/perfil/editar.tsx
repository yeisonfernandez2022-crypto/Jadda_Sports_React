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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PerfilEditar() {
  const { estaLogueado, cargando, refreshPerfil } = useAuth();

  const [perfil, setPerfil] = useState<any>(null);
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [usuario, setUsuario] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");

  // cambio de email
  const [nuevoEmail, setNuevoEmail] = useState("");
  const [passEmail, setPassEmail] = useState("");
  const [codigoEmail, setCodigoEmail] = useState("");
  const [emailPendiente, setEmailPendiente] = useState(false);

  // verificación de password para teléfono
  const [passTelefono, setPassTelefono] = useState("");
  const [telefonoVerificado, setTelefonoVerificado] = useState(false);

  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!estaLogueado) {
      router.replace("/login");
      return;
    }
    api
      .get("/api/auth/perfil")
      .then((res) => {
        const u = res.data.usuario || res.data;
        setPerfil(u);
        setNombre(u.NOMBRE_USUARIO || "");
        setApellido(u.APELLIDO_USUARIO || "");
        setEmail(u.EMAIL || "");
        setTelefono(u.TELEFONO || "");
        setUsuario(u.USUARIO || "");
        setTipoDocumento(u.TIPO_DOCUMENTO || "");
        setNumeroDocumento(u.NUMERO_DOCUMENTO || "");
      })
      .catch(() => {});
  }, [estaLogueado]);

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

  async function guardarBasico() {
    try {
      setGuardando(true);
      const payload: any = { nombre, apellido, usuario };
      if (telefono) payload.telefono = telefono;
      await api.put("/api/auth/perfil", payload);
      await refreshPerfil();
      Alert.alert("GUARDADO", "Tu información se actualizó correctamente.");
    } catch (error: any) {
      Alert.alert("ERROR", error?.response?.data?.message || "No se pudo actualizar.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarTelefono() {
    try {
      if (!telefono.trim() || !/^\d{7,10}$/.test(telefono.trim())) {
        Alert.alert("ERROR", "El teléfono debe tener entre 7 y 10 dígitos.");
        return;
      }
      if (!telefonoVerificado) {
        if (!passTelefono) {
          Alert.alert("VERIFICA", "Escribe tu contraseña actual para cambiar el teléfono.");
          return;
        }
        const res = await api.post("/api/auth/verificar-password", { password: passTelefono });
        if (res.data.ok) setTelefonoVerificado(true);
      }
      await api.put("/api/auth/perfil", { telefono });
      await refreshPerfil();
      setTelefonoVerificado(false);
      setPassTelefono("");
      Alert.alert("GUARDADO", "Tu teléfono se actualizó correctamente.");
    } catch (error: any) {
      Alert.alert("ERROR", error?.response?.data?.message || "La contraseña actual no es correcta.");
    }
  }

  async function guardarDocumento() {
    try {
      await api.put("/api/auth/perfil", { tipo_documento: tipoDocumento, numero_documento: numeroDocumento });
      await refreshPerfil();
      Alert.alert("GUARDADO", "Tu documento se actualizó correctamente.");
    } catch (error: any) {
      Alert.alert("ERROR", error?.response?.data?.message || "No se pudo actualizar.");
    }
  }

  async function solicitarCambioEmail() {
    try {
      if (!nuevoEmail.trim() || !emailRegex.test(nuevoEmail.trim())) {
        Alert.alert("ERROR", "Escribe un correo válido.");
        return;
      }
      if (!passEmail) {
        Alert.alert("ERROR", "Escribe tu contraseña actual.");
        return;
      }
      const res = await api.post("/api/auth/cambiar-email", {
        email: nuevoEmail.trim(),
        password: passEmail,
      });
      if (res.data.ok) {
        setEmailPendiente(true);
        Alert.alert("CÓDIGO ENVIADO", res.data.message || "Te enviamos un código al correo nuevo.");
      }
    } catch (error: any) {
      Alert.alert("ERROR", error?.response?.data?.message || "No se pudo solicitar el cambio.");
    }
  }

  async function confirmarCambioEmail() {
    try {
      const res = await api.post("/api/auth/confirmar-cambio-email", {
        email: nuevoEmail.trim(),
        codigo: codigoEmail.trim(),
      });
      if (res.data.ok) {
        setEmailPendiente(false);
        setNuevoEmail("");
        setPassEmail("");
        setCodigoEmail("");
        await refreshPerfil();
        api
          .get("/api/auth/perfil")
          .then((r) => setEmail((r.data.usuario || r.data).EMAIL || ""))
          .catch(() => {});
        Alert.alert("¡CORREO ACTUALIZADO!", "Tu correo se cambió correctamente.");
      }
    } catch (error: any) {
      Alert.alert("ERROR", error?.response?.data?.message || "El código es incorrecto o expiró.");
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackButton />
      <Text style={styles.title}>Información de mi perfil</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Datos personales</Text>
        <TextInput style={styles.input} placeholder="Nombres" value={nombre} onChangeText={setNombre} />
        <TextInput style={styles.input} placeholder="Apellidos" value={apellido} onChangeText={setApellido} />
        <TextInput style={styles.input} placeholder="Nombre de usuario" value={usuario} onChangeText={setUsuario} autoCapitalize="none" />
        <TouchableOpacity style={styles.button} onPress={guardarBasico} disabled={guardando}>
          <Text style={styles.buttonText}>{guardando ? "GUARDANDO..." : "GUARDAR"}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Correo electrónico</Text>
        <Text style={styles.current}>Actual: {email}</Text>
        {!emailPendiente ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Nuevo correo"
              value={nuevoEmail}
              onChangeText={setNuevoEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              style={styles.input}
              placeholder="Tu contraseña actual"
              value={passEmail}
              onChangeText={setPassEmail}
              secureTextEntry
            />
            <TouchableOpacity style={styles.button} onPress={solicitarCambioEmail}>
              <Text style={styles.buttonText}>SOLICITAR CAMBIO DE CORREO</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.hint}>Te enviamos un código de 6 dígitos a {nuevoEmail}. Escríbelo para confirmar:</Text>
            <TextInput
              style={styles.input}
              placeholder="Código de 6 dígitos"
              value={codigoEmail}
              onChangeText={setCodigoEmail}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={styles.button} onPress={confirmarCambioEmail}>
              <Text style={styles.buttonText}>CONFIRMAR CAMBIO</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Teléfono</Text>
        <TextInput style={styles.input} placeholder="Teléfono" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
        {!telefonoVerificado && (
          <TextInput
            style={styles.input}
            placeholder="Contraseña actual para verificar"
            value={passTelefono}
            onChangeText={setPassTelefono}
            secureTextEntry
          />
        )}
        <TouchableOpacity style={styles.button} onPress={guardarTelefono}>
          <Text style={styles.buttonText}>GUARDAR TELÉFONO</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Documento de identidad</Text>
        <View style={styles.row}>
          {["CC", "CE", "TI", "PAS"].map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tipoDoc, tipoDocumento === t && styles.tipoDocActive]}
              onPress={() => setTipoDocumento(t)}
            >
              <Text style={[styles.tipoDocText, tipoDocumento === t && styles.tipoDocTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Número de documento"
          value={numeroDocumento}
          onChangeText={setNumeroDocumento}
          keyboardType="number-pad"
        />
        <TouchableOpacity style={styles.button} onPress={guardarDocumento}>
          <Text style={styles.buttonText}>GUARDAR DOCUMENTO</Text>
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
    backgroundColor: "#f5f5f5",
  },
  container: {
    padding: 16,
    backgroundColor: "#f5f5f5",
    flexGrow: 1,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    elevation: 2,
  },
  cardTitle: {
    fontWeight: "bold",
    fontSize: 15,
    color: "#111",
    marginBottom: 12,
  },
  current: {
    color: "#888",
    fontSize: 13,
    marginBottom: 10,
  },
  hint: {
    color: "#666",
    fontSize: 13,
    marginBottom: 10,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    padding: 13,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#e73737",
    padding: 14,
    borderRadius: 10,
    marginTop: 4,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  tipoDoc: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  tipoDocActive: {
    backgroundColor: "#e73737",
    borderColor: "#e73737",
  },
  tipoDocText: {
    fontWeight: "bold",
    color: "#555",
  },
  tipoDocTextActive: {
    color: "#fff",
  },
});
