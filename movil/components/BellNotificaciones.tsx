import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import api from "../constants/api";

interface Notificacion {
  ID_NOTIFICACION: number;
  TIPO: string;
  TITULO: string;
  MENSAJE: string | null;
  RUTA: string | null;
  LEIDA: number;
  FECHA: string;
}

export default function BellNotificaciones() {
  const { estaLogueado } = useAuth();
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [open, setOpen] = useState(false);
  const [cargando, setCargando] = useState(false);

  const cargar = async (soloConteo = false) => {
    if (cargando) return;
    setCargando(true);
    try {
      const [lista, conteo] = await Promise.all([
        api.get("/api/notificaciones"),
        api.get("/api/notificaciones/no-leidas"),
      ]);
      if (!soloConteo) setNotifs(Array.isArray(lista.data) ? lista.data : []);
      setNoLeidas(conteo.data?.total ?? 0);
    } catch {
      /* sin sesión o error de red */
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!estaLogueado) {
      setNotifs([]);
      setNoLeidas(0);
      return;
    }
    cargar();
    const intervalo = setInterval(() => cargar(true), 30000);
    return () => clearInterval(intervalo);
  }, [estaLogueado]);

  const abrir = () => {
    if (!open) cargar();
    setOpen((prev) => !prev);
  };

  const alClic = async (n: Notificacion) => {
    setOpen(false);
    if (!n.LEIDA) {
      api.post(`/api/notificaciones/${n.ID_NOTIFICACION}/leida`).catch(() => {});
      setNoLeidas((prev) => Math.max(0, prev - 1));
      setNotifs((prev) => prev.map((x) => (x.ID_NOTIFICACION === n.ID_NOTIFICACION ? { ...x, LEIDA: 1 } : x)));
    }
  };

  const marcarTodas = async () => {
    try {
      await api.post("/api/notificaciones/leer-todas");
      setNoLeidas(0);
      setNotifs((prev) => prev.map((x) => ({ ...x, LEIDA: 1 })));
    } catch {
      /* ignore */
    }
  };

  if (!estaLogueado) return null;

  return (
    <View>
      <TouchableOpacity style={styles.btn} onPress={abrir}>
        <Ionicons name="notifications-outline" size={22} color="#fff" />
        {noLeidas > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{noLeidas > 99 ? "99+" : noLeidas}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.panelTitle}>Notificaciones</Text>
              {noLeidas > 0 && (
                <TouchableOpacity onPress={marcarTodas}>
                  <Text style={styles.marcarTodas}>Marcar todas</Text>
                </TouchableOpacity>
              )}
            </View>
            {notifs.length === 0 ? (
              <Text style={styles.vacio}>No tienes notificaciones</Text>
            ) : (
              <FlatList
                data={notifs}
                keyExtractor={(n) => String(n.ID_NOTIFICACION)}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.item} onPress={() => alClic(item)}>
                    <View style={[styles.dot, item.LEIDA ? styles.dotLeida : styles.dotNoLeida]} />
                    <View style={styles.itemTexto}>
                      <Text style={[styles.itemTitulo, !item.LEIDA && styles.itemTituloNoLeida]}>{item.TITULO}</Text>
                      {item.MENSAJE ? (
                        <Text numberOfLines={2} style={styles.itemMensaje}>{item.MENSAJE}</Text>
                      ) : null}
                      <Text style={styles.itemFecha}>
                        {item.FECHA
                          ? new Date(item.FECHA).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                          : ""}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: "relative",
    padding: 2,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -8,
    backgroundColor: "#e73737",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  panel: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    maxHeight: 480,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  panelTitle: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#111",
  },
  marcarTodas: {
    color: "#e73737",
    fontWeight: "600",
    fontSize: 13,
  },
  vacio: {
    padding: 24,
    textAlign: "center",
    color: "#888",
  },
  item: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    marginRight: 10,
  },
  dotLeida: {
    backgroundColor: "#ccc",
  },
  dotNoLeida: {
    backgroundColor: "#e73737",
  },
  itemTexto: {
    flex: 1,
  },
  itemTitulo: {
    fontWeight: "600",
    fontSize: 13,
    color: "#111",
  },
  itemTituloNoLeida: {
    fontWeight: "800",
  },
  itemMensaje: {
    color: "#666",
    fontSize: 12,
    marginTop: 2,
  },
  itemFecha: {
    color: "#999",
    fontSize: 10,
    marginTop: 4,
  },
});
