import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import api from "../constants/api";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [enviando, setEnviando] = useState(false);

  const suscribir = async () => {
    const email = newsletterEmail.trim();
    if (!email || !emailRegex.test(email)) {
      Alert.alert("CORREO INVÁLIDO", "Ingresa un correo válido para suscribirte.");
      return;
    }
    setEnviando(true);
    try {
      const res = await api.post("/api/newsletter", { email });
      if (res.data.ok) {
        Alert.alert("¡SUSCRITO!", res.data.msg || "Gracias por suscribirte a nuestras novedades.");
        setNewsletterEmail("");
      } else {
        Alert.alert("ERROR", res.data.msg || "No se pudo suscribir.");
      }
    } catch {
      Alert.alert("ERROR", "No se pudo suscribir. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={styles.footer}>
      <View style={styles.grid}>
        {/* MARCA */}
        <View style={styles.col}>
          <Text style={styles.marca}>
            JADDA <Text style={styles.marcaSports}>SPORTS</Text>
          </Text>
          <Text style={styles.descripcion}>
            Pasión por el deporte y la excelencia. Encuentra ropa, calzado y accesorios para superar tus límites.
          </Text>
          <View style={styles.contactoRow}>
            <Ionicons name="location" size={14} color="#e73737" />
            <Text style={styles.contacto}>Bogotá, Colombia</Text>
          </View>
          <TouchableOpacity style={styles.contactoRow} onPress={() => router.push("/contacto")}>
            <Ionicons name="mail" size={14} color="#e73737" />
            <Text style={styles.contactoLink}>Contáctanos</Text>
          </TouchableOpacity>
          <View style={styles.contactoRow}>
            <Ionicons name="shield-checkmark" size={14} color="#e73737" />
            <Text style={styles.contacto}>Compra 100% segura</Text>
          </View>
        </View>

        {/* NAVEGACIÓN */}
        <View style={styles.col}>
          <Text style={styles.colTitle}>NAVEGACIÓN</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)")}>
            <Text style={styles.link}>Inicio</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/catalogo")}>
            <Text style={styles.link}>Catálogo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/catalogo?descuento=true")}>
            <Text style={styles.link}>Ofertas</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/sobre-nosotros")}>
            <Text style={styles.link}>Sobre Nosotros</Text>
          </TouchableOpacity>
        </View>

        {/* ATENCIÓN AL CLIENTE */}
        <View style={styles.col}>
          <Text style={styles.colTitle}>ATENCIÓN AL CLIENTE</Text>
          <TouchableOpacity onPress={() => router.push("/preguntas-frecuentes")}>
            <Text style={styles.link}>Preguntas frecuentes</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/politicas-devolucion")}>
            <Text style={styles.link}>Políticas de devolución</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/terminos-condiciones")}>
            <Text style={styles.link}>Términos y condiciones</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/politica-privacidad")}>
            <Text style={styles.link}>Política de privacidad</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/pqr")}>
            <Text style={styles.link}>PQR</Text>
          </TouchableOpacity>
        </View>

        {/* SÍGUENOS */}
        <View style={styles.col}>
          <Text style={styles.colTitle}>SÍGUENOS</Text>
          <View style={styles.redes}>
            <View style={styles.social}>
              <Ionicons name="logo-facebook" size={18} color="#fff" />
            </View>
            <View style={styles.social}>
              <Ionicons name="logo-instagram" size={18} color="#fff" />
            </View>
            <View style={styles.social}>
              <Ionicons name="logo-whatsapp" size={18} color="#fff" />
            </View>
          </View>
          <Text style={styles.sello}>¡Únete a la comunidad <Text style={styles.bold}>JADDA</Text> y entrena con nosotros!</Text>
        </View>
      </View>

      {/* NEWSLETTER */}
      <View style={styles.newsletter}>
        <Text style={styles.newsletterText}>Novedades y ofertas en tu correo</Text>
        <View style={styles.newsletterForm}>
          <TextInput
            style={styles.newsletterInput}
            placeholder="Tu correo electrónico"
            placeholderTextColor="#bbb"
            value={newsletterEmail}
            onChangeText={setNewsletterEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity style={styles.newsletterBtn} onPress={suscribir} disabled={enviando}>
            <Ionicons name="paper-plane" size={16} color="#fff" />
            <Text style={styles.newsletterBtnText}> {enviando ? "..." : "SUSCRIBIRME"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.bottomText}>© 2026 JADDA SPORTS - Todos los derechos reservados</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: "#111827",
    marginTop: 20,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 20,
    gap: 20,
  },
  col: {
    width: "45%",
  },
  marca: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  marcaSports: {
    color: "#e73737",
  },
  descripcion: {
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 12,
  },
  contactoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  contacto: {
    color: "#9ca3af",
    fontSize: 12,
  },
  contactoLink: {
    color: "#e73737",
    fontSize: 12,
  },
  colTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 1,
  },
  link: {
    color: "#9ca3af",
    fontSize: 12,
    marginBottom: 8,
  },
  redes: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  social: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e73737",
    justifyContent: "center",
    alignItems: "center",
  },
  sello: {
    color: "#9ca3af",
    fontSize: 11,
    lineHeight: 16,
  },
  bold: {
    fontWeight: "700",
    color: "#fff",
  },
  newsletter: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    paddingTop: 16,
  },
  newsletterText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 10,
  },
  newsletterForm: {
    flexDirection: "row",
    alignItems: "center",
  },
  newsletterInput: {
    flex: 1,
    backgroundColor: "#1f2937",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    fontSize: 13,
  },
  newsletterBtn: {
    backgroundColor: "#e73737",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  newsletterBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 12,
  },
  bottom: {
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    padding: 14,
    alignItems: "center",
  },
  bottomText: {
    color: "#6b7280",
    fontSize: 11,
  },
});
