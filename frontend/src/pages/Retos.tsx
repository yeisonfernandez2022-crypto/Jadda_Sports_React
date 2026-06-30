import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { FaTrophy, FaRunning, FaFire, FaDumbbell, FaCheckCircle, FaPlus } from "react-icons/fa";
import Swal from "sweetalert2";
import axios from "axios";

const ICONOS: Record<string, ReactNode> = {
  sesiones: <FaRunning />,
  km: <FaFire />,
  dias: <FaFire />,
};

function Retos() {
  const { usuarioLogueado } = useAuth();
  const [retosDisponibles, setRetosDisponibles] = useState<any[]>([]);
  const [misRetos, setMisRetos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const cargarDatos = async () => {
    try {
      const [disponibles, mis] = await Promise.all([
        axios.get("/api/retos"),
        axios.get("/api/retos/mis-retos"),
      ]);
      setRetosDisponibles(disponibles.data);
      setMisRetos(mis.data);
    } catch (err) {
      console.error("Error al cargar retos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (usuarioLogueado) cargarDatos();
  }, [usuarioLogueado]);

  const unirse = async (idReto: number) => {
    try {
      const res = await axios.post(`/api/retos/unirse/${idReto}`);
      Swal.fire({ icon: "success", title: "Inscrito", text: res.data.msg, timer: 1500, showConfirmButton: false });
      cargarDatos();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.msg || "Error al inscribirse" });
    }
  };

  const reportar = async (idRetoUsuario: number) => {
    const { value: cantidad } = await Swal.fire({
      title: "Reportar avance",
      input: "number",
      inputLabel: "¿Cuánto quieres sumar?",
      inputValue: 1,
      showCancelButton: true,
      confirmButtonText: "Reportar",
      cancelButtonText: "Cancelar",
      background: "#1a1a1a",
      color: "#fff",
      inputAttributes: { min: "1" },
    });
    if (!cantidad) return;

    try {
      const res = await axios.post(`/api/retos/progreso/${idRetoUsuario}`, { cantidad: Number(cantidad) });
      const msg = res.data.completado
        ? "¡Felicidades! Completaste el reto. Revisa tu cupón en Mis Retos."
        : `Progreso actualizado: ${res.data.progreso}/${res.data.meta}`;
      Swal.fire({ icon: res.data.completado ? "success" : "info", title: res.data.completado ? "Reto completado" : "Progreso actualizado", text: msg, timer: 2000, showConfirmButton: false });
      cargarDatos();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.msg || "Error al reportar" });
    }
  };

  const completar = async (idRetoUsuario: number) => {
    try {
      const res = await axios.post(`/api/retos/completar/${idRetoUsuario}`);
      if (res.data.cupon) {
        await Swal.fire({
          icon: "success",
          title: "¡Reto completado!",
          html: `Tu código de descuento: <strong style="font-size:1.5rem;color:#e73737">${res.data.cupon}</strong><br>Válido por 30 días`,
          background: "#1a1a1a",
          color: "#fff",
          confirmButtonColor: "#e73737",
        });
      }
      cargarDatos();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.msg || "Error" });
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
        <div className="spinner-border text-danger" role="status" />
      </div>
    );
  }

  const retosInscritos = new Set(misRetos.map((r: any) => r.ID_RETO));

  return (
    <div style={{ background: "#f4f5f7", minHeight: "100vh", padding: "40px 24px" }}>
      <div className="container">
        <div className="mb-5">
          <h1 className="fw-bold d-flex align-items-center gap-2">
            <FaTrophy className="text-warning" /> Retos Deportivos
          </h1>
          <p className="text-muted">Supera retos, gana descuentos exclusivos</p>
        </div>

        {retosDisponibles.length > 0 && (
          <div className="mb-5">
            <h4 className="fw-bold mb-3">Retos Disponibles</h4>
            <div className="row g-3">
              {retosDisponibles.map((reto) => (
                <div className="col-md-6 col-lg-3" key={reto.ID_RETO}>
                  <div className="card h-100 border-0 shadow-sm" style={{ borderRadius: 16, background: "#fff" }}>
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex align-items-center gap-2 mb-2">
                        <span style={{ fontSize: "1.4rem", color: "#e73737" }}>{ICONOS[reto.META_TIPO] || <FaDumbbell />}</span>
                        <span className="badge bg-dark">{reto.META_TIPO}</span>
                      </div>
                      <h6 className="fw-bold mb-1">{reto.TITULO}</h6>
                      <p className="small text-muted flex-grow-1 mb-2">{reto.DESCRIPCION}</p>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted">Meta: {reto.META_VALOR} {reto.META_TIPO}</small>
                        <small className="text-success fw-bold">{reto.RECOMPENSA_PORCENTAJE}% dto.</small>
                      </div>
                      {retosInscritos.has(reto.ID_RETO) ? (
                        <button className="btn btn-outline-secondary btn-sm w-100" disabled>
                          <FaCheckCircle className="me-1" /> Inscrito
                        </button>
                      ) : (
                        <button className="btn btn-danger btn-sm w-100" onClick={() => unirse(reto.ID_RETO)}>
                          <FaPlus className="me-1" /> Unirse al reto
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h4 className="fw-bold mb-3">Mis Retos</h4>
          {misRetos.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <FaTrophy style={{ fontSize: "3rem", opacity: 0.3 }} className="mb-2" />
              <p>Aún no te has inscrito a ningún reto</p>
            </div>
          ) : (
            <div className="row g-3">
              {misRetos.map((r) => {
                const pct = Math.round((r.PROGRESO / r.META_VALOR) * 100);
                return (
                  <div className="col-md-6" key={r.ID_RETO_USUARIO}>
                    <div className="card border-0 shadow-sm" style={{ borderRadius: 16, background: r.COMPLETADO ? "#f0fff4" : "#fff" }}>
                      <div className="card-body">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <h6 className="fw-bold mb-1">{r.TITULO}</h6>
                            <small className="text-muted">{r.DESCRIPCION}</small>
                          </div>
                          {r.COMPLETADO ? (
                            <span className="badge bg-success fs-6"><FaCheckCircle className="me-1" /> Completado</span>
                          ) : (
                            <span className="badge bg-warning text-dark">En progreso</span>
                          )}
                        </div>
                        <div className="progress mb-2" style={{ height: 8, borderRadius: 4 }}>
                          <div
                            className={`progress-bar ${r.COMPLETADO ? "bg-success" : "bg-danger"}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div className="d-flex justify-content-between small mb-3">
                          <span className="text-muted">{r.PROGRESO}/{r.META_VALOR} {r.META_TIPO}</span>
                          <span className="fw-bold">{pct}%</span>
                        </div>
                        {r.COMPLETADO && r.CUPON_GENERADO && (
                          <div className="alert alert-success py-2 mb-2 small text-center">
                            Cupón: <strong>{r.CUPON_GENERADO}</strong> — {r.RECOMPENSA_PORCENTAJE}% descuento
                          </div>
                        )}
                        <div className="d-flex gap-2">
                          {!r.COMPLETADO && (
                            <>
                              <button className="btn btn-outline-danger btn-sm flex-grow-1" onClick={() => reportar(r.ID_RETO_USUARIO)}>
                                Reportar avance
                              </button>
                              {r.PROGRESO >= r.META_VALOR && (
                                <button className="btn btn-danger btn-sm flex-grow-1" onClick={() => completar(r.ID_RETO_USUARIO)}>
                                  Completar reto
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Retos;
