import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import api from "../constants/api";
import BackButton from "../components/BackButton";

interface Reto {
  ID_RETO: number;
  TITULO: string;
  DESCRIPCION: string;
  META_TIPO: string;
  META_VALOR: number;
  RECOMPENSA_PORCENTAJE: number;
  FECHA_INICIO?: string;
  FECHA_FIN?: string;
}

interface MiReto extends Reto {
  ID_RETO_USUARIO: number;
  PROGRESO: number;
  COMPLETADO: number;
  CUPON_GENERADO?: string | null;
  EVIDENCIAS_PENDIENTES?: number;
  EVIDENCIAS_APROBADAS?: number;
  EVIDENCIAS_RECHAZADAS?: number;
}

const UNIDADES: Record<string, string> = {
  km: "km",
  horas: "horas",
  dias: "días",
  sesiones: "sesiones",
  unidades: "unidades",
};

export default function Retos() {
  const { estaLogueado, cargando } = useAuth();
  const [disponibles, setDisponibles] = useState<Reto[]>([]);
  const [misRetos, setMisRetos] = useState<MiReto[]>([]);
  const [loading, setLoading] = useState(true);
  const [unirseLoading, setUnirseLoading] = useState<number | null>(null);

  const cargar = useCallback(() => {
    Promise.all([
      api.get("/api/retos").catch(() => ({ data: [] })),
      api.get("/api/retos/mis-retos").catch(() => ({ data: [] })),
    ]).then(([dis, mis]) => {
      setDisponibles(dis.data || []);
      setMisRetos(mis.data || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!estaLogueado) {
      router.replace("/login");
      return;
    }
    cargar();
  }, [estaLogueado, cargar]);

  async function unirse(reto: Reto) {
    setUnirseLoading(reto.ID_RETO);
    try {
      const res = await api.post(`/api/retos/unirse/${reto.ID_RETO}`);
      Alert.alert("¡INSCRITO!", res.data?.msg || "Te has inscrito al reto.");
      cargar();
    } catch (e: any) {
      Alert.alert("ERROR", e?.response?.data?.msg || "No se pudo inscribir.");
    } finally {
      setUnirseLoading(null);
    }
  }

  const retoUnido = (id: number) => misRetos.some((m) => m.ID_RETO === id);

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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      <BackButton />
      <View style={styles.hero}>
        <View style={styles.heroIco}>
          <Ionicons name="trophy" size={34} color="#e73737" />
        </View>
        <Text style={styles.heroTitle}>Retos Deportivos</Text>
        <Text style={styles.heroSub}>Completa la meta, gana descuentos</Text>
      </View>

      {misRetos.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mis retos</Text>
          {misRetos.map((m) => {
            const pct = Math.min(100, Math.round((m.PROGRESO / m.META_VALOR) * 100));
            return (
              <View key={m.ID_RETO_USUARIO} style={[styles.card, m.COMPLETADO === 1 && styles.cardDone]}>
                <View style={styles.cardHeader}>
                  <View style={styles.trofeo}>
                    <Ionicons name={m.COMPLETADO === 1 ? "trophy" : "trophy-outline"} size={20} color="#e73737" />
                  </View>
                  <Text style={styles.cardTitulo}>{m.TITULO}</Text>
                  {m.COMPLETADO === 1 ? (
                    <View style={styles.badgeDone}>
                      <Text style={styles.badgeDoneText}>COMPLETADO</Text>
                    </View>
                  ) : (
                    <View style={styles.badgeProgreso}>
                      <Text style={styles.badgeProgresoText}>{pct}%</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.cardDesc}>{m.DESCRIPCION}</Text>

                <View style={styles.metaRow}>
                  <Text style={styles.metaTexto}>
                    <Ionicons name="flag" size={12} color="#e73737" /> Meta: {m.META_VALOR} {UNIDADES[m.META_TIPO] || m.META_TIPO}
                  </Text>
                  <Text style={styles.recompensa}>{m.RECOMPENSA_PORCENTAJE}% dto</Text>
                </View>

                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.progresoTexto}>
                  {m.PROGRESO}/{m.META_VALOR} {UNIDADES[m.META_TIPO] || m.META_TIPO}
                  {m.EVIDENCIAS_PENDIENTES ? ` · ${m.EVIDENCIAS_PENDIENTES} en revisión` : ""}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Retos disponibles</Text>
        {disponibles.length === 0 ? (
          <View style={styles.vacio}>
            <Ionicons name="trophy-outline" size={60} color="#ccc" />
            <Text style={styles.vacioTitle}>No hay retos activos en este momento</Text>
          </View>
        ) : (
          disponibles.map((r) => {
            const unido = retoUnido(r.ID_RETO);
            return (
              <View key={r.ID_RETO} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.trofeo}>
                    <Ionicons name="flag" size={18} color="#e73737" />
                  </View>
                  <Text style={styles.cardTitulo}>{r.TITULO}</Text>
                </View>
                <Text style={styles.cardDesc}>{r.DESCRIPCION}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.metaTexto}>
                    Meta: {r.META_VALOR} {UNIDADES[r.META_TIPO] || r.META_TIPO}
                  </Text>
                  <Text style={styles.recompensa}>Gana {r.RECOMPENSA_PORCENTAJE}%</Text>
                </View>
                <TouchableOpacity
                  style={[styles.button, unido && styles.buttonDisabled]}
                  disabled={unido || unirseLoading === r.ID_RETO}
                  onPress={() => unirse(r)}
                >
                  <Text style={styles.buttonText}>
                    {unirseLoading === r.ID_RETO ? "INSCRIBIENDO..." : unido ? "YA INSCRITO" : "UNIRSE AL RETO"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
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
    backgroundColor: "#f4f5f7",
  },
  container: {
    flex: 1,
    backgroundColor: "#f4f5f7",
  },
  hero: {
    backgroundColor: "#002244",
    paddingVertical: 34,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  heroIco: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(231,55,55,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: -0.5,
  },
  heroSub: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 12,
    marginTop: 6,
  },
  section: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    color: "#002244",
    fontWeight: "bold",
    fontSize: 16,
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
  },
  cardDone: {
    borderWidth: 1,
    borderColor: "#b7e4c7",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  trofeo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#fff1f1",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  cardTitulo: {
    flex: 1,
    fontWeight: "bold",
    fontSize: 15,
    color: "#111",
  },
  badgeDone: {
    backgroundColor: "#e8f8ee",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeDoneText: {
    color: "#198754",
    fontSize: 10,
    fontWeight: "bold",
  },
  badgeProgreso: {
    backgroundColor: "#fff1f1",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeProgresoText: {
    color: "#e73737",
    fontSize: 11,
    fontWeight: "bold",
  },
  cardDesc: {
    color: "#6c757d",
    fontSize: 13,
    marginTop: 10,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  metaTexto: {
    color: "#555",
    fontSize: 12,
  },
  recompensa: {
    color: "#e73737",
    fontWeight: "bold",
    fontSize: 12,
  },
  progressBar: {
    backgroundColor: "#e9ecef",
    height: 8,
    borderRadius: 10,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#e73737",
    borderRadius: 10,
  },
  progresoTexto: {
    color: "#adb5bd",
    fontSize: 11,
    marginTop: 6,
  },
  vacio: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
  },
  vacioTitle: {
    color: "#6c757d",
    fontSize: 15,
    marginTop: 10,
  },
  button: {
    backgroundColor: "#e73737",
    padding: 13,
    borderRadius: 10,
    marginTop: 14,
  },
  buttonDisabled: {
    backgroundColor: "#e9ecef",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
  },
});
