import { useState, useEffect, useMemo, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { FaDumbbell, FaCheckCircle, FaRunning, FaSwimmer, FaBicycle, FaFutbol, FaFire, FaCalendarAlt, FaStar, FaChevronDown, FaChevronUp } from "react-icons/fa";
import axios from "axios";

const CAT_COLORS: Record<string, string> = {
  Running: "#e74c3c",
  Gimnasio: "#2ecc71",
  Baloncesto: "#f39c12",
  Ciclismo: "#3498db",
  Natacion: "#1abc9c",
  Futbol: "#e67e22",
  Cardio: "#9b59b6",
  Hogar: "#1abc9c",
};

const CAT_BG: Record<string, string> = {
  Running: "linear-gradient(135deg, #e74c3c, #c0392b)",
  Gimnasio: "linear-gradient(135deg, #2ecc71, #27ae60)",
  Baloncesto: "linear-gradient(135deg, #f39c12, #e67e22)",
  Ciclismo: "linear-gradient(135deg, #3498db, #2980b9)",
  Natacion: "linear-gradient(135deg, #1abc9c, #16a085)",
  Futbol: "linear-gradient(135deg, #e67e22, #d35400)",
  Cardio: "linear-gradient(135deg, #9b59b6, #8e44ad)",
  Hogar: "linear-gradient(135deg, #1abc9c, #16a085)",
};

const ICONOS: Record<string, ReactNode> = {
  Running: <FaRunning />,
  Gimnasio: <FaDumbbell />,
  Baloncesto: <FaFutbol />,
  Ciclismo: <FaBicycle />,
  Natacion: <FaSwimmer />,
  Futbol: <FaFutbol />,
};

function Planes() {
  const { usuarioLogueado } = useAuth();
  const [planes, setPlanes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [diasCompletados, setDiasCompletados] = useState<Record<number, number[]>>({});
  const cargar = async () => {
    try {
      const res = await axios.get("/api/planes");
      setPlanes(res.data);
      res.data.forEach((p: any) => {
        setDiasCompletados((prev) => ({ ...prev, [p.ID_PLAN]: [] }));
      });
    } catch (err) {
      console.error("Error al cargar planes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usuarioLogueado) cargar();
  }, [usuarioLogueado]);

  const toggleDia = async (idPlan: number, dia: number, _contenidos: any[]) => {
    const prev = diasCompletados[idPlan] || [];
    const nuevos = prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia];
    setDiasCompletados((prev2) => ({ ...prev2, [idPlan]: nuevos }));
    try {
      await axios.post(`/api/planes/marcar-dia/${idPlan}`, {
        dia,
        dias_completados: nuevos,
      });
    } catch (err) {
      console.error("Error al marcar día:", err);
    }
  };

  const stats = useMemo(() => {
    const totalDias = planes.reduce((acc, p) => acc + ((p.CONTENIDO || []).length), 0);
    const hechos = planes.reduce((acc, p) => acc + (diasCompletados[p.ID_PLAN]?.length || 0), 0);
    const completados = planes.filter((p) => p.COMPLETADO).length;
    let racha = 0;
    for (const p of planes) {
      const dias = (diasCompletados[p.ID_PLAN] || []).sort((a: number, b: number) => b - a);
      for (let i = 0; i < dias.length - 1; i++) {
        if (dias[i] - dias[i + 1] === 1) racha++;
        else break;
      }
    }
    return { totalDias, hechos, completados, racha };
  }, [planes, diasCompletados]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
        <div className="spinner-border text-danger" role="status" />
      </div>
    );
  }

  return (
    <div style={{ background: "#0f0f0f", minHeight: "100vh", paddingBottom: 60 }}>
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        padding: "60px 24px 40px",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-40%", left: "-20%", width: "300px", height: "300px",
          borderRadius: "50%", background: "rgba(230,57,70,0.08)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "-30%", right: "-10%", width: "250px", height: "250px",
          borderRadius: "50%", background: "rgba(230,57,70,0.06)", pointerEvents: "none",
        }} />
        <div className="container position-relative">
          <div style={{ fontSize: "3rem", color: "#e63946", marginBottom: 12 }}>
            <FaDumbbell />
          </div>
          <h1 className="fw-bold text-white" style={{ fontSize: "2rem", letterSpacing: -0.5 }}>
            Planes de Entrenamiento
          </h1>
          <p style={{ color: "rgba(255,255,255,0.6)", maxWidth: 500, margin: "8px auto 0" }}>
            Planes personalizados generados automáticamente según tus compras
          </p>
        </div>
      </div>

      <div className="container" style={{ marginTop: -20 }}>
        {planes.length === 0 ? (
          <div className="text-center py-5" style={{ color: "rgba(255,255,255,0.4)" }}>
            <FaDumbbell style={{ fontSize: "4rem", opacity: 0.2 }} className="mb-3" />
            <p style={{ fontSize: "1.1rem" }}>Aún no tienes planes de entrenamiento.</p>
            <p className="mb-0">¡Compra productos deportivos y los desbloquearás!</p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-3">
                <div style={{
                  background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "16px 12px",
                  border: "1px solid rgba(255,255,255,0.06)", textAlign: "center",
                }}>
                  <div style={{ color: "#e63946", fontSize: "1.5rem", fontWeight: 700 }}>{planes.length}</div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>Planes activos</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div style={{
                  background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "16px 12px",
                  border: "1px solid rgba(255,255,255,0.06)", textAlign: "center",
                }}>
                  <div style={{ color: "#2ecc71", fontSize: "1.5rem", fontWeight: 700 }}>{stats.hechos}<span style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.3)" }}>/{stats.totalDias}</span></div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>Días completados</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div style={{
                  background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "16px 12px",
                  border: "1px solid rgba(255,255,255,0.06)", textAlign: "center",
                }}>
                  <div style={{ color: "#f39c12", fontSize: "1.5rem", fontWeight: 700 }}>
                    <FaFire style={{ marginRight: 4 }} />{stats.racha}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>Racha</div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div style={{
                  background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "16px 12px",
                  border: "1px solid rgba(255,255,255,0.06)", textAlign: "center",
                }}>
                  <div style={{ color: stats.completados > 0 ? "#2ecc71" : "rgba(255,255,255,0.3)", fontSize: "1.5rem", fontWeight: 700 }}>
                    <FaStar />{stats.completados}
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>Completados</div>
                </div>
              </div>
            </div>

            {/* Plan cards */}
            {planes.map((plan) => {
              const contenidos: any[] = plan.CONTENIDO || [];
              const completados = diasCompletados[plan.ID_PLAN] || [];
              const pct = contenidos.length > 0 ? Math.round((completados.length / contenidos.length) * 100) : 0;
              const isOpen = expandido === plan.ID_PLAN;
              const grad = CAT_BG[plan.NOMBRE_CATEGORIA] || "linear-gradient(135deg, #e63946, #c0392b)";
              const color = CAT_COLORS[plan.NOMBRE_CATEGORIA] || "#e63946";

              return (
                <div className="mb-3" key={plan.ID_PLAN}>
                  <div
                    style={{
                      background: plan.COMPLETADO ? "linear-gradient(135deg, #0a2e1a, #0f3d22)" : "#1a1a2e",
                      borderRadius: 20,
                      border: `1px solid ${plan.COMPLETADO ? "rgba(46,204,113,0.2)" : "rgba(255,255,255,0.06)"}`,
                      cursor: "pointer",
                      overflow: "hidden",
                      transition: "all 0.3s",
                      boxShadow: isOpen ? "0 8px 30px rgba(0,0,0,0.4)" : "0 2px 10px rgba(0,0,0,0.2)",
                    }}
                    onClick={() => setExpandido(isOpen ? null : plan.ID_PLAN)}
                  >
                    {/* Accent bar */}
                    <div style={{ height: 4, background: grad }} />

                    <div style={{ padding: "20px 24px" }}>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div className="d-flex align-items-center gap-3">
                          <div style={{
                            width: 48, height: 48, borderRadius: 14,
                            background: `${color}22`, display: "flex",
                            alignItems: "center", justifyContent: "center",
                            fontSize: "1.3rem", color,
                          }}>
                            {ICONOS[plan.NOMBRE_CATEGORIA] || <FaDumbbell />}
                          </div>
                          <div>
                            <h5 className="fw-bold mb-1" style={{ color: "#fff", fontSize: "1.1rem" }}>
                              {plan.TITULO}
                            </h5>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem" }}>
                                <FaCalendarAlt style={{ marginRight: 4, fontSize: "0.7rem" }} />
                                {plan.NOMBRE_CATEGORIA}
                              </span>
                              <span style={{
                                background: `${color}22`, color, fontSize: "0.7rem",
                                padding: "2px 10px", borderRadius: 20, fontWeight: 600,
                              }}>
                                {plan.NIVEL}
                              </span>
                              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.78rem" }}>
                                {plan.DURACION_DIAS} días
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2">
                          {plan.COMPLETADO ? (
                            <span style={{
                              background: "rgba(46,204,113,0.15)", color: "#2ecc71",
                              padding: "4px 14px", borderRadius: 20, fontSize: "0.8rem",
                              fontWeight: 600, whiteSpace: "nowrap",
                            }}>
                              <FaCheckCircle className="me-1" />Completado
                            </span>
                          ) : (
                            <div style={{ position: "relative", width: 44, height: 44 }}>
                              <svg width="44" height="44" viewBox="0 0 36 36">
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                  fill="none" stroke={pct >= 100 ? "#2ecc71" : "#e63946"}
                                  strokeWidth="3" strokeDasharray={`${pct}, 100`} />
                              </svg>
                              <span style={{
                                position: "absolute", inset: 0, display: "flex",
                                alignItems: "center", justifyContent: "center",
                                fontSize: "0.7rem", fontWeight: 700, color: "#fff",
                              }}>
                                {pct}%
                              </span>
                            </div>
                          )}
                          <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.8rem", marginLeft: 4 }}>
                            {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                          </span>
                        </div>
                      </div>

                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.85rem", marginBottom: 12 }}>
                        {plan.PLAN_DESC}
                      </p>

                      {!plan.COMPLETADO && (
                        <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 10, height: 6, overflow: "hidden" }}>
                          <div style={{
                            width: `${Math.min(pct, 100)}%`, height: "100%",
                            background: grad, borderRadius: 10,
                            transition: "width 0.8s ease",
                          }} />
                        </div>
                      )}

                      {isOpen && contenidos.length > 0 && (
                        <div
                          style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 16 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <h6 style={{ color: "rgba(255,255,255,0.7)", fontWeight: 600, marginBottom: 12, fontSize: "0.9rem" }}>
                            <FaCalendarAlt style={{ marginRight: 8, color }} />
                            Días de entrenamiento
                          </h6>
                          <div className="row g-2">
                            {contenidos.map((item: any, idx: number) => {
                              const hecho = completados.includes(item.dia);
                              return (
                                <div className="col-12 col-md-6" key={idx}>
                                  <div
                                    style={{
                                      display: "flex", alignItems: "center", gap: 12,
                                      padding: "10px 14px", borderRadius: 14,
                                      background: hecho ? "rgba(46,204,113,0.08)" : "rgba(255,255,255,0.03)",
                                      border: `1px solid ${hecho ? "rgba(46,204,113,0.15)" : "rgba(255,255,255,0.05)"}`,
                                      cursor: "pointer",
                                      transition: "all 0.2s",
                                    }}
                                    onClick={() => toggleDia(plan.ID_PLAN, item.dia, contenidos)}
                                  >
                                    <div style={{
                                      width: 36, height: 36, borderRadius: "50%",
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                      background: hecho ? "linear-gradient(135deg, #2ecc71, #27ae60)" : "rgba(255,255,255,0.08)",
                                      color: hecho ? "#fff" : "rgba(255,255,255,0.4)",
                                      fontWeight: 700, fontSize: "0.8rem", flexShrink: 0,
                                    }}>
                                      {hecho ? <FaCheckCircle /> : item.dia}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ color: "#fff", fontWeight: 600, fontSize: "0.85rem" }}>
                                        {item.actividad}
                                      </div>
                                      <div style={{ color: "rgba(255,255,255,0.35)", fontSize: "0.75rem" }}>
                                        {item.series > 0 ? `${item.series} series` : "Descanso"}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

export default Planes;
