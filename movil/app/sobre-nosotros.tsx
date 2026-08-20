import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { volverAtras } from "../utils/navegacion";

const INTEGRANTES = [
  {
    nombre: "Yeison Alexander Fernandez Muñoz",
    rol: "Desarrollador Full Stack",
    descripcion:
      "Principal desarrollador de JADDA SPORTS. Encargado del diseño frontend, la estructura visual de la plataforma y múltiples funcionalidades esenciales: catálogo dinámico, carrito de compras, mini carrito flotante, integración con React y TypeScript, conexión con el backend y optimización general de la experiencia de usuario.",
    correo: "yeisonfernandez2022@gmail.com",
    inicial: "Y",
  },
  {
    nombre: "Duglas Montenegro",
    rol: "Desarrollador Backend",
    descripcion:
      "Aquí puedes colocar la descripción de Duglas, habilidades, aporte al proyecto y demás información.",
    correo: "correo@ejemplo.com",
    inicial: "D",
  },
  {
    nombre: "Juan Arias",
    rol: "Diseñador UI/UX",
    descripcion:
      "Aquí puedes colocar la descripción de Juan, habilidades, aporte al proyecto y demás información.",
    correo: "correo@ejemplo.com",
    inicial: "J",
  },
  {
    nombre: "Miguel Castro",
    rol: "Gestor de Base de Datos",
    descripcion:
      "Aquí puedes colocar la descripción de Miguel, habilidades, aporte al proyecto y demás información.",
    correo: "correo@ejemplo.com",
    inicial: "M",
  },
];

const TECNOLOGIAS = [
  { nombre: "React", icono: "logo-react" as const },
  { nombre: "TypeScript", icono: "code-slash" as const },
  { nombre: "Node.js", icono: "terminal" as const },
  { nombre: "MySQL", icono: "server" as const },
];

export default function SobreNosotros() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <TouchableOpacity style={[styles.back, { paddingTop: insets.top + 14 }]} onPress={volverAtras}>
        <Ionicons name="arrow-back" size={20} color="#111" />
        <Text style={styles.backText}> Volver</Text>
      </TouchableOpacity>

      <View style={styles.hero}>
        <Text style={styles.heroTitle}>SOBRE NOSOTROS</Text>
        <Text style={styles.heroSub}>Conoce más sobre el equipo detrás de JADDA SPORTS y el propósito de nuestro proyecto.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitulo}>¿Qué es JADDA SPORTS?</Text>
        <Text style={styles.parrafo}>
          JADDA SPORTS es una tienda deportiva enfocada en brindar productos de calidad para personas apasionadas por el deporte, el rendimiento y el estilo. Nuestro objetivo es ofrecer ropa, calzado y accesorios deportivos modernos que se adapten tanto a atletas como a quienes buscan comodidad y actitud en su día a día.
        </Text>
        <Text style={styles.parrafo}>
          Como proyecto, nace con la idea de combinar tecnología, diseño y pasión por el deporte en una plataforma moderna e intuitiva, permitiendo a los usuarios explorar productos fácilmente, gestionar sus compras y vivir una experiencia similar a la de una tienda deportiva profesional.
        </Text>
        <Text style={styles.parrafo}>
          Buscamos representar motivación, disciplina y superación, valores que identifican a quienes viven el deporte dentro y fuera de la cancha.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>TECNOLOGÍAS</Text>
      <View style={styles.techRow}>
        {TECNOLOGIAS.map((t) => (
          <View key={t.nombre} style={styles.techCard}>
            <Ionicons name={t.icono} size={26} color="#e73737" />
            <Text style={styles.techNombre}>{t.nombre}</Text>
            <Text style={styles.techDesc}>
              {t.nombre === "React" && "Interfaces modernas y dinámicas."}
              {t.nombre === "TypeScript" && "Escalabilidad y seguridad."}
              {t.nombre === "Node.js" && "Lógica del sistema backend."}
              {t.nombre === "MySQL" && "Almacenamiento de toda la información."}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>NUESTRO EQUIPO</Text>
      {INTEGRANTES.map((miembro, i) => (
        <View key={i} style={styles.miembro}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{miembro.inicial}</Text>
          </View>
          <Text style={styles.miembroNombre}>{miembro.nombre}</Text>
          <Text style={styles.miembroRol}>{miembro.rol}</Text>
          <Text style={styles.miembroDesc}>{miembro.descripcion}</Text>
          <Text style={styles.miembroCorreoLabel}>Correo</Text>
          <Text style={styles.miembroCorreo}>{miembro.correo}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
    paddingVertical: 34,
    paddingHorizontal: 24,
    alignItems: "center",
    marginTop: 10,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  heroSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 19,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    marginHorizontal: 16,
    marginTop: 16,
    elevation: 2,
  },
  cardTitulo: {
    color: "#e63946",
    fontWeight: "bold",
    fontSize: 18,
    marginBottom: 10,
  },
  parrafo: {
    color: "#555",
    fontSize: 13,
    lineHeight: 21,
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#e63946",
    fontWeight: "bold",
    fontSize: 20,
    textAlign: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  techRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  techCard: {
    width: "46%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    elevation: 2,
  },
  techNombre: {
    color: "#e63946",
    fontWeight: "bold",
    fontSize: 15,
    marginTop: 8,
  },
  techDesc: {
    color: "#666",
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
  },
  miembro: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 14,
    alignItems: "center",
    elevation: 2,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: "#e63946",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff1f1",
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 34,
    fontWeight: "bold",
    color: "#e63946",
  },
  miembroNombre: {
    color: "#111",
    fontWeight: "bold",
    fontSize: 16,
    textAlign: "center",
  },
  miembroRol: {
    color: "#e63946",
    fontWeight: "600",
    fontSize: 13,
    marginTop: 4,
  },
  miembroDesc: {
    color: "#666",
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 10,
  },
  miembroCorreoLabel: {
    color: "#111",
    fontWeight: "bold",
    fontSize: 12,
    marginTop: 12,
  },
  miembroCorreo: {
    color: "#777",
    fontSize: 12,
    marginTop: 2,
  },
});
