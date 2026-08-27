import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import api from "../../constants/api";
import BackButton from "../../components/BackButton";

interface MensajeChat {
  ID_MENSAJE: number;
  ROL_AUTOR: "CLIENTE" | "VENDEDOR" | "ADMIN" | "SISTEMA";
  AUTOR_NOMBRE: string | null;
  MENSAJE: string;
  FECHA: string;
}

const horaCorta = (f: string) =>
  new Date(f).toLocaleString("es-CO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Chat móvil genérico (devoluciones hoy; soporte/vendedor después).
 *  id = ID_CHAT. Polling cada 4s; input bloqueado si la conversación está CERRADA. */
export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [mensajes, setMensajes] = useState<MensajeChat[]>([]);
  const [miRol, setMiRol] = useState<string>("CLIENTE");
  const [estadoChat, setEstadoChat] = useState<string>("");
  const [titulo, setTitulo] = useState("Conversación");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const scrollRef = useRef<ScrollView>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await api.get(`/api/chat/${id}/mensajes`);
      const data = res.data;
      if (data?.ok) {
        setMensajes(data.mensajes || []);
        setMiRol(data.mi_rol || "CLIENTE");
        setEstadoChat(data.chat?.ESTADO || "");
        const c = data.chat;
        let t = "Conversación";
        if (c?.TIPO === "SOPORTE") t = "Soporte JADDA SPORTS";
        else if (c?.TIPO === "VENDEDOR") t = c.VENDEDOR_EMPRESA || "Vendedor";
        else if (c?.TIPO === "DEVOLUCION") t = c.PARTE === "CLIENTE" ? "Soporte JADDA · Devolución" : c.PARTE === "VENDEDOR" ? "Soporte JADDA · Vendedor" : "Devolución · Acuerdo";
        setTitulo(t);
      }
    } catch {
      /* silencio en polling */
    } finally {
      setCargando(false);
    }
  }, [id]);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 4000);
    return () => clearInterval(t);
  }, [cargar]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd?.({ animated: true }), 150);
  }, [mensajes.length]);

  const enviar = async () => {
    const msg = texto.trim();
    if (!msg || enviando || estadoChat === "CERRADA") return;
    setEnviando(true);
    try {
      await api.post(`/api/chat/${id}/mensajes`, { mensaje: msg });
      setTexto("");
      await cargar();
    } catch (err: any) {
      // el backend rechaza con mensaje claro si está cerrada
    } finally {
      setEnviando(false);
    }
  };

  const cerrada = estadoChat === "CERRADA";

  return (
    <KeyboardAvoidingView
      style={styles.contenedor}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <View style={styles.header}>
        <BackButton />
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitulo} numberOfLines={1}>{titulo}</Text>
          <Text style={styles.headerSub}>{cerrada ? "Conversación cerrada" : "En línea"}</Text>
        </View>
      </View>

      {cargando ? (
        <View style={styles.centro}>
          <ActivityIndicator size="large" color="#e63946" />
        </View>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            style={styles.mensajes}
            contentContainerStyle={{ padding: 14, gap: 9 }}
            showsVerticalScrollIndicator={false}
          >
            {mensajes.map((m) =>
              m.ROL_AUTOR === "SISTEMA" ? (
                <View key={m.ID_MENSAJE} style={styles.burbujaSistema}>
                  <Text style={styles.sistemaTexto}>{m.MENSAJE}</Text>
                </View>
              ) : (
                <View key={m.ID_MENSAJE} style={[styles.filaMensaje, m.ROL_AUTOR === miRol && styles.filaMia]}>
                  <View style={[styles.burbuja, m.ROL_AUTOR === miRol ? styles.burbujaMia : styles.burbujaOtro]}>
                    {m.ROL_AUTOR !== miRol && (
                      <Text style={styles.autor}>
                        {m.ROL_AUTOR === "ADMIN" ? "Equipo JADDA" : m.AUTOR_NOMBRE || m.ROL_AUTOR}
                      </Text>
                    )}
                    <Text style={[styles.mensajeTexto, m.ROL_AUTOR === miRol && styles.mensajeTextoMio]}>{m.MENSAJE}</Text>
                    <Text style={[styles.hora, m.ROL_AUTOR === miRol && styles.horaMia]}>{horaCorta(m.FECHA)}</Text>
                  </View>
                </View>
              )
            )}
          </ScrollView>

          <View style={styles.inputFila}>
            <TextInput
              style={[styles.input, cerrada && styles.inputDeshabilitado]}
              placeholder={cerrada ? "Conversación cerrada" : "Escribe un mensaje�?�"}
              placeholderTextColor="#94a3b8"
              value={texto}
              editable={!cerrada}
              multiline
              onChangeText={setTexto}
            />
            <TouchableOpacity
              style={[styles.btnEnviar, (!texto.trim() || enviando || cerrada) && styles.btnEnviarOff]}
              onPress={enviar}
              disabled={!texto.trim() || enviando || cerrada}
            >
              {enviando ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={17} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: "#f5f7fa", paddingTop: 44 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  headerTitulo: { fontSize: 14.5, fontWeight: "800", color: "#0f172a" },
  headerSub: { fontSize: 10.5, color: "#22c55e", fontWeight: "600" },
  centro: { flex: 1, justifyContent: "center", alignItems: "center" },
  mensajes: { flex: 1 },
  filaMensaje: { flexDirection: "row" },
  filaMia: { justifyContent: "flex-end" },
  burbuja: {
    maxWidth: "78%",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  burbujaOtro: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderBottomLeftRadius: 4,
  },
  burbujaMia: {
    backgroundColor: "#002244",
    borderBottomRightRadius: 4,
  },
  autor: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#dc2626",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  mensajeTexto: { fontSize: 13, color: "#0f172a", lineHeight: 18 },
  mensajeTextoMio: { color: "#fff" },
  hora: { fontSize: 8.5, color: "#94a3b8", alignSelf: "flex-end", marginTop: 3 },
  horaMia: { color: "rgba(255,255,255,0.6)" },
  burbujaSistema: {
    alignSelf: "center",
    backgroundColor: "#f1f5f9",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 6,
    maxWidth: "85%",
  },
  sistemaTexto: { fontSize: 11, color: "#475569", textAlign: "center" },
  inputFila: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#eef2f7",
  },
  input: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 8,
    fontSize: 13,
    color: "#0f172a",
  },
  inputDeshabilitado: { opacity: 0.55 },
  btnEnviar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#dc2626",
    alignItems: "center",
    justifyContent: "center",
  },
  btnEnviarOff: { opacity: 0.45 },
});

