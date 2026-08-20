import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useState, useEffect, useCallback } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import api from "../constants/api";
import BackButton from "../components/BackButton";

interface DiaPlan {
  dia: number;
  actividad: string;
  series?: number;
}

interface Plan {
  ID_PLAN: number;
  TITULO: string;
  PLAN_DESC: string;
  DURACION_DIAS: number;
  NIVEL: string;
  CONTENIDO: DiaPlan[];
  NOMBRE_CATEGORIA: string;
  DIAS_COMPLETADOS: number[];
  COMPLETADO: number;
}

export default function MisPlanes() {
  const { estaLogueado, cargando } = useAuth();
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [marcando, setMarcando] = useState(false);

  const cargar = useCallback(() => {
    api
      .get("/api/planes")
      .then((res) => setPlanes(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!estaLogueado) {
      router.replace("/login");
      return;
    }
    cargar();
  }, [estaLogueado, cargar]);

  async function toggleDia(plan: Plan, dia: number) {
    if (marcando) return;
    const prev = Array.isArray(plan.DIAS_COMPLETADOS) ? plan.DIAS_COMPLETADOS : [];
    const nuevos = prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia];
    setMarcando(true);
    try {
      await api.post(`/api/planes/marcar-dia/${plan.ID_PLAN}`, {
        dia,
        dias_completados: nuevos,
      });
      cargar();
    } catch {
    } finally {
      setMarcando(false);
    }
  }

  const totalDias = planes.reduce((a, p) => a + (p.CONTENIDO?.length || 0), 0);
  const hechos = planes.reduce((a, p) => a + (Array.isArray(p.DIAS_COMPLETADOS) ? p.DIAS_COMPLETADOS.length : 0), 0);
  const completados = planes.filter((p) => p.COMPLETADO).length;

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
          <Ionicons name="barbell" size={34} color="#e73737" />
        </View>
        <Text style={styles.heroTitle}>Planes de Entrenamiento</Text>
        <Text style={styles.heroSub}>Planes personalizados generados automáticamente según tus compras</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{planes.length}</Text>
          <Text style={styles.statLabel}>Planes</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: "#198754" }]}>
            {hechos}<Text style={styles.statTotal}>/{totalDias}</Text>
          </Text>
          <Text style={styles.statLabel}>Días hechos</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statNum, { color: "#e73737" }]}>{completados}</Text>
          <Text style={styles.statLabel}>Completados</Text>
        </View>
      </View>

      {planes.length === 0 ? (
        <View style={styles.vacio}>
          <Ionicons name="barbell-outline" size={60} color="#ccc" />
          <Text style={styles.vacioTitle}>Aún no tienes planes de entrenamiento</Text>
          <Text style={styles.vacioSub}>¡Compra productos deportivos y los desbloquearás!</Text>
        </View>
      ) : (
        planes.map((plan) => {
          const dias = plan.CONTENIDO || [];
          const hechosPlan = Array.isArray(plan.DIAS_COMPLETADOS) ? plan.DIAS_COMPLETADOS : [];
          const pct = dias.length > 0 ? Math.round((hechosPlan.length / dias.length) * 100) : 0;
          const isOpen = expandido === plan.ID_PLAN;

          return (
            <View key={plan.ID_PLAN} style={[styles.planCard, plan.COMPLETADO === 1 && styles.planCardDone]}>
              <View style={[styles.accentBar, { backgroundColor: plan.COMPLETADO === 1 ? "#198754" : "#e73737" }]} />
              <TouchableOpacity onPress={() => setExpandido(isOpen ? null : plan.ID_PLAN)}>
                <View style={styles.planHeader}>
                  <View style={styles.planIco}>
                    <Ionicons name="fitness" size={24} color="#e73737" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.planTitulo}>{plan.TITULO}</Text>
                    <View style={styles.chipsRow}>
                      <Text style={styles.chipCat}>{plan.NOMBRE_CATEGORIA}</Text>
                      <Text style={styles.chipNivel}>{plan.NIVEL}</Text>
                      <Text style={styles.chipDias}>{plan.DURACION_DIAS} días</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "center" }}>
                    {plan.COMPLETADO === 1 ? (
                      <View style={styles.completadoBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#198754" />
                        <Text style={styles.completadoText}> Hecho</Text>
                      </View>
                    ) : (
                      <View style={styles.pctCircle}>
                        <Text style={styles.pctText}>{pct}%</Text>
                      </View>
                    )}
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color="#adb5bd" />
                  </View>
                </View>

                <Text style={styles.planDesc}>{plan.PLAN_DESC}</Text>

                {plan.COMPLETADO !== 1 && (
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${Math.min(pct, 100)}%` }]} />
                  </View>
                )}
              </TouchableOpacity>

              {isOpen && dias.length > 0 && (
                <View style={styles.diasWrap}>
                  <Text style={styles.diasTitle}>Días de entrenamiento</Text>
                  <View style={styles.diasGrid}>
                    {dias.map((item, idx) => {
                      const hecho = hechosPlan.includes(item.dia);
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.dia, hecho && styles.diaHecho]}
                          onPress={() => toggleDia(plan, item.dia)}
                        >
                          <View style={[styles.diaNum, hecho && styles.diaNumHecho]}>
                            {hecho ? <Ionicons name="checkmark" size={16} color="#fff" /> : <Text style={styles.diaNumText}>{item.dia}</Text>}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.diaActividad}>{item.actividad}</Text>
                            <Text style={styles.diaSeries}>
                              {Number(item.series) > 0 ? `${item.series} series` : "Descanso"}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}
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
    textAlign: "center",
    marginTop: 6,
  },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: -20,
    gap: 10,
  },
  stat: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    elevation: 2,
  },
  statNum: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#e73737",
  },
  statTotal: {
    fontSize: 13,
    color: "#adb5bd",
  },
  statLabel: {
    color: "#6c757d",
    fontSize: 11,
    marginTop: 2,
  },
  vacio: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 40,
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 24,
  },
  vacioTitle: {
    color: "#6c757d",
    fontSize: 16,
    marginTop: 10,
  },
  vacioSub: {
    color: "#adb5bd",
    fontSize: 13,
    marginTop: 6,
  },
  planCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    overflow: "hidden",
    elevation: 2,
  },
  planCardDone: {
    borderWidth: 1,
    borderColor: "#b7e4c7",
  },
  accentBar: {
    height: 4,
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  planIco: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff1f1",
    justifyContent: "center",
    alignItems: "center",
  },
  planTitulo: {
    color: "#002244",
    fontWeight: "bold",
    fontSize: 16,
  },
  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    flexWrap: "wrap",
  },
  chipCat: {
    color: "#6c757d",
    fontSize: 11,
  },
  chipNivel: {
    backgroundColor: "#fff1f1",
    color: "#e73737",
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 20,
    fontWeight: "600",
  },
  chipDias: {
    color: "#6c757d",
    fontSize: 11,
  },
  pctCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: "#e73737",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  pctText: {
    fontWeight: "bold",
    color: "#002244",
    fontSize: 12,
  },
  completadoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f8ee",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 4,
  },
  completadoText: {
    color: "#198754",
    fontSize: 11,
    fontWeight: "600",
  },
  planDesc: {
    color: "#6c757d",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingTop: 12,
    lineHeight: 18,
  },
  progressBar: {
    backgroundColor: "#e9ecef",
    height: 6,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 14,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#e73737",
    borderRadius: 10,
  },
  diasWrap: {
    borderTopWidth: 1,
    borderTopColor: "#f1f1f1",
    padding: 16,
  },
  diasTitle: {
    color: "#002244",
    fontWeight: "600",
    fontSize: 14,
    marginBottom: 12,
  },
  diasGrid: {
    gap: 8,
  },
  dia: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#e9ecef",
    gap: 12,
  },
  diaHecho: {
    backgroundColor: "#e8f8ee",
    borderColor: "#b7e4c7",
  },
  diaNum: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e9ecef",
    justifyContent: "center",
    alignItems: "center",
  },
  diaNumHecho: {
    backgroundColor: "#198754",
  },
  diaNumText: {
    fontWeight: "bold",
    color: "#6c757d",
  },
  diaActividad: {
    color: "#002244",
    fontWeight: "600",
    fontSize: 13,
  },
  diaSeries: {
    color: "#adb5bd",
    fontSize: 11,
    marginTop: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#111",
  },
  button: {
    backgroundColor: "#e73737",
    padding: 15,
    borderRadius: 10,
    width: "100%",
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "bold",
  },
});
