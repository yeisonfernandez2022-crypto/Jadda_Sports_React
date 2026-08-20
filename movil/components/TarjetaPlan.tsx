import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function TarjetaPlan() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <TouchableOpacity style={[styles.card, styles.planCard]} onPress={() => setAbierto(true)}>
        <View style={styles.ico}>
          <Ionicons name="barbell" size={22} color="#fff" />
        </View>
        <View style={styles.copia}>
          <Text style={styles.titulo}>Plan de entrenamiento GRATIS</Text>
          <Text style={styles.texto}>
            Compra cualquier producto y recibe un plan personalizado de entrenamiento sin costo adicional.
          </Text>
        </View>
        <Text style={styles.cta}>Más información</Text>
      </TouchableOpacity>

      <Modal visible={abierto} transparent animationType="fade" onRequestClose={() => setAbierto(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setAbierto(false)}>
          <View style={styles.modal}>
            <TouchableOpacity style={styles.modalCerrar} onPress={() => setAbierto(false)}>
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
            <View style={[styles.ico, styles.modalIco]}>
              <Ionicons name="barbell" size={28} color="#fff" />
            </View>
            <Text style={styles.modalTitle}>¿Cómo funciona tu plan de entrenamiento?</Text>
            <Text style={styles.modalPaso}>1. Compra <Text style={styles.bold}>cualquier producto</Text> de nuestro catálogo, sin importar la categoría.</Text>
            <Text style={styles.modalPaso}>2. Al confirmar tu compra, generamos <Text style={styles.bold}>tu plan personalizado</Text> automáticamente.</Text>
            <Text style={styles.modalPaso}>3. Accede a él desde tu perfil en la sección <Text style={styles.bold}>"Mis planes"</Text>.</Text>
            <Text style={styles.modalPaso}>4. Sigue las rutinas diarias y registra tu avance; tu progreso se guarda día a día.</Text>
            <Text style={styles.modalNota}>Es un beneficio exclusivo de JADDA SPORTS: entrena, progresa y aprovecha cada compra al máximo.</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    elevation: 3,
  },
  planCard: {
    borderLeftWidth: 5,
    borderLeftColor: "#002244",
  },
  ico: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#e73737",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  copia: {
    flex: 1,
  },
  titulo: {
    fontWeight: "bold",
    fontSize: 14,
    color: "#111",
  },
  texto: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  cta: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 12,
    marginTop: 8,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 22,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 22,
  },
  modalCerrar: {
    position: "absolute",
    top: 14,
    right: 14,
    zIndex: 2,
    padding: 4,
  },
  modalIco: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111",
    marginBottom: 12,
  },
  modalPaso: {
    fontSize: 14,
    color: "#444",
    lineHeight: 21,
    marginBottom: 8,
  },
  bold: {
    fontWeight: "700",
    color: "#111",
  },
  modalNota: {
    fontSize: 12,
    color: "#888",
    marginTop: 10,
    lineHeight: 17,
  },
});
