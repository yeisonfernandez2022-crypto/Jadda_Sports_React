import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { volverAtras } from "../utils/navegacion";
import * as Linking from "expo-linking";

const FAQS = [
  { p: "¿Cómo puedo hacer un pedido?", r: "Navega por nuestro catálogo, agrega productos al carrito y sigue el proceso de compra. Necesitas tener una cuenta e iniciar sesión." },
  { p: "¿Cuánto tarda el envío?", r: "Los envíos se procesan en 24-48 horas hábiles y llegan en 3-5 días dependiendo de tu ubicación." },
  { p: "¿Puedo cancelar mi pedido?", r: "Sí, puedes cancelar mientras el pedido esté en estado 'Pendiente'. Contacta a soporte para asistencia." },
  { p: "¿Cómo aplico un cupón de descuento?", r: "En la página de Finalizar Compra, hay una sección 'Cupón de descuento' donde ingresas el código y presionas 'Aplicar'." },
  { p: "¿Qué métodos de pago aceptan?", r: "Aceptamos tarjeta débito/crédito, PSE, Nequi y Daviplata." },
];

export default function AyudaSoporte() {
  const insets = useSafeAreaInsets();
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <TouchableOpacity style={[styles.back, { paddingTop: insets.top + 14 }]} onPress={volverAtras}>
        <Ionicons name="arrow-back" size={20} color="#111" />
        <Text style={styles.backText}> Volver</Text>
      </TouchableOpacity>

      <View style={styles.header}>
        <Ionicons name="headset" size={44} color="#e73737" />
        <Text style={styles.titulo}>Ayuda y Soporte</Text>
        <Text style={styles.subtitulo}>Estamos aquí para ayudarte</Text>
      </View>

      <Text style={styles.sectionTitle}>Preguntas frecuentes</Text>
      <View style={styles.card}>
        {FAQS.map((f, i) => (
          <View key={i} style={styles.faqItem}>
            <TouchableOpacity
              style={styles.faqPregunta}
              onPress={() => setFaqOpen(faqOpen === i ? null : i)}
            >
              <Text style={styles.faqTexto}>{f.p}</Text>
              <Ionicons name={faqOpen === i ? "chevron-up" : "chevron-down"} size={16} color="#888" />
            </TouchableOpacity>
            {faqOpen === i && <Text style={styles.faqRespuesta}>{f.r}</Text>}
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Contacto directo</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.contactoItem} onPress={() => Linking.openURL("mailto:soporte@jaddasports.com")}>
          <Ionicons name="mail" size={18} color="#e73737" />
          <Text style={styles.contactoTexto}>soporte@jaddasports.com</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactoItem} onPress={() => Linking.openURL("tel:+573001234567")}>
          <Ionicons name="call" size={18} color="#e73737" />
          <Text style={styles.contactoTexto}>+57 300 123 4567</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.contactoItem} onPress={() => Linking.openURL("https://wa.me/573001234567")}>
          <Ionicons name="logo-whatsapp" size={18} color="#e73737" />
          <Text style={styles.contactoTexto}>+57 300 123 4567</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.pqrCard}>
        <Text style={styles.pqrTitulo}>¿Tienes una queja o reclamo?</Text>
        <Text style={styles.pqrSub}>Déjanos tu PQR y te responderemos a la brevedad.</Text>
        <TouchableOpacity style={styles.pqrBtn} onPress={() => router.push("/pqr")}>
          <Text style={styles.pqrBtnText}>IR A PQR</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f5f7",
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
  header: {
    alignItems: "center",
    paddingVertical: 24,
  },
  titulo: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
    marginTop: 10,
  },
  subtitulo: {
    color: "#6c757d",
    fontSize: 13,
    marginTop: 4,
  },
  sectionTitle: {
    color: "#002244",
    fontWeight: "bold",
    fontSize: 15,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 6,
    elevation: 1,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f1f1",
    paddingHorizontal: 12,
  },
  faqPregunta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    gap: 10,
  },
  faqTexto: {
    color: "#333",
    fontWeight: "600",
    fontSize: 14,
    flex: 1,
  },
  faqRespuesta: {
    color: "#666",
    fontSize: 13,
    lineHeight: 19,
    paddingBottom: 14,
  },
  contactoItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  contactoTexto: {
    color: "#333",
    fontSize: 14,
  },
  pqrCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 20,
    alignItems: "center",
    elevation: 1,
  },
  pqrTitulo: {
    color: "#111",
    fontWeight: "bold",
    fontSize: 15,
  },
  pqrSub: {
    color: "#6c757d",
    fontSize: 13,
    marginTop: 6,
  },
  pqrBtn: {
    backgroundColor: "#e73737",
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  pqrBtnText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
