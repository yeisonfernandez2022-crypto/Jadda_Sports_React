import { useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FaTrophy, FaRunning, FaFire, FaDumbbell, FaCheckCircle, FaPlus, FaArrowLeft, FaImage, FaClock, FaTimesCircle, FaEye } from "react-icons/fa";
import Swal from "sweetalert2";
import axios from "axios";

const ICONOS: Record<string, ReactNode> = {
  sesiones: <FaRunning />,
  km: <FaFire />,
  dias: <FaFire />,
};

function Retos() {
  const { usuarioLogueado, esAdmin } = useAuth();
  const navigate = useNavigate();
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

  const leerArchivoBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
      reader.readAsDataURL(file);
    });

  const MAX_ARCHIVOS = 10;
  const MAX_MB_POR_ARCHIVO = 10;

  const reportar = async (idRetoUsuario: number, restante: number, metaTipo: string) => {
    const maxCantidad = Math.max(1, restante);
    let archivos: { id: number; url: string; material: string; tipo_material: string }[] = [];
    let nextId = 0;

    const { value: resultado, isConfirmed } = await Swal.fire({
      title: "Reportar avance",
      html: `
        <div style="text-align:left">
          <label style="display:block;font-size:0.85rem;color:#bbb;margin-bottom:6px">
            ¿Cuánto sumas a tu progreso? <span style="color:#e73737">(máx. ${maxCantidad} ${metaTipo})</span>
          </label>
          <input type="number" id="cantidad-reto" class="swal2-input" min="1" max="${maxCantidad}" value="1" style="margin:0 0 18px" />
          <label style="display:block;font-size:0.85rem;color:#bbb;margin-bottom:6px">
            Evidencia (foto o video — puedes subir hasta ${MAX_ARCHIVOS})
          </label>
          <input type="file" id="archivos-reto" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            style="width:100%;padding:8px;border-radius:8px;background:#2a2a2a;color:#fff;border:1px solid #444" />
          <div id="preview-reto" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;min-height:0"></div>
          <small id="contador-reto" style="color:#888;display:block;margin-top:8px">0/${MAX_ARCHIVOS} archivos — cada uno máx. ${MAX_MB_POR_ARCHIVO} MB</small>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: "Enviar avance",
      cancelButtonText: "Cancelar",
      background: "#1a1a1a",
      color: "#fff",
      confirmButtonColor: "#e73737",
      allowOutsideClick: false,
      didOpen: () => {
        const input = document.getElementById("archivos-reto") as HTMLInputElement;
        const contenedor = document.getElementById("preview-reto");
        const contador = document.getElementById("contador-reto");

        const render = () => {
          if (!contenedor) return;
          contenedor.innerHTML = "";
          archivos.forEach((a) => {
            const div = document.createElement("div");
            div.style.cssText = "position:relative;width:84px;height:84px;border-radius:10px;overflow:hidden;border:1px solid #444;flex-shrink:0";
            if (a.tipo_material === "video") {
              const vid = document.createElement("video");
              vid.src = a.url;
              vid.muted = true;
              vid.style.cssText = "width:100%;height:100%;object-fit:cover";
              div.appendChild(vid);
            } else {
              const img = document.createElement("img");
              img.src = a.url;
              img.style.cssText = "width:100%;height:100%;object-fit:cover";
              div.appendChild(img);
            }
            const badge = document.createElement("div");
            badge.style.cssText = "position:absolute;bottom:2px;left:2px;background:rgba(0,0,0,0.75);color:#fff;font-size:0.58rem;padding:1px 6px;border-radius:6px;font-weight:700";
            badge.textContent = a.tipo_material === "video" ? "VIDEO" : "FOTO";
            div.appendChild(badge);
            const botonX = document.createElement("button");
            botonX.textContent = "✕";
            botonX.title = "Quitar archivo";
            botonX.style.cssText = "position:absolute;top:2px;right:2px;background:rgba(231,55,55,0.95);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:0.6rem;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center";
            botonX.onclick = () => {
              URL.revokeObjectURL(a.url);
              archivos = archivos.filter((x) => x.id !== a.id);
              render();
            };
            div.appendChild(botonX);
            contenedor.appendChild(div);
          });
          if (contador) contador.textContent = `${archivos.length}/${MAX_ARCHIVOS} archivos — cada uno máx. ${MAX_MB_POR_ARCHIVO} MB`;
        };

        input.addEventListener("change", () => {
          const nuevos = Array.from(input.files || []);
          for (const file of nuevos) {
            if (archivos.length >= MAX_ARCHIVOS) {
              Swal.showValidationMessage(`Máximo ${MAX_ARCHIVOS} archivos por avance`);
              break;
            }
            const esVideo = file.type.startsWith("video/");
            const esImagen = file.type.startsWith("image/");
            if (!esVideo && !esImagen) continue;
            if (file.size > MAX_MB_POR_ARCHIVO * 1024 * 1024) {
              Swal.showValidationMessage(`"${file.name}" supera los ${MAX_MB_POR_ARCHIVO} MB`);
              continue;
            }
            const id = nextId++;
            archivos.push({ id, url: URL.createObjectURL(file), material: "", tipo_material: esVideo ? "video" : "imagen" });
            leerArchivoBase64(file)
              .then((dataUrl) => {
                const e = archivos.find((x) => x.id === id);
                if (e) e.material = dataUrl;
              })
              .catch(() => {});
          }
          input.value = "";
          render();
        });
      },
      preConfirm: () => {
        const cantidad = Number((document.getElementById("cantidad-reto") as HTMLInputElement).value);
        if (!cantidad || cantidad < 1 || cantidad > maxCantidad) {
          Swal.showValidationMessage(`El avance debe ser entre 1 y ${maxCantidad} ${metaTipo}`);
          return false;
        }
        const lista = archivos.filter((a) => a.material);
        if (lista.length === 0) {
          Swal.showValidationMessage("Debes adjuntar al menos una foto o video");
          return false;
        }
        if (lista.length < archivos.length) {
          Swal.showValidationMessage("Cargando archivos, espera un momento…");
          return false;
        }
        if (lista.some((a) => a.material.length > MAX_MB_POR_ARCHIVO * 1.4 * 1024 * 1024)) {
          Swal.showValidationMessage(`Algún archivo supera los ${MAX_MB_POR_ARCHIVO} MB`);
          return false;
        }
        return {
          cantidad,
          materiales: lista.map((a) => ({ material: a.material, tipo_material: a.tipo_material })),
        };
      },
    });
    if (!isConfirmed || !resultado) return;

    try {
      const res = await axios.post(`/api/retos/progreso/${idRetoUsuario}`, {
        cantidad: resultado.cantidad,
        materiales: resultado.materiales,
      });

      Swal.fire({
        icon: "info",
        title: "Avance en revisión",
        text: res.data.msg || "Deja que nuestros asesores revisen el material para aprobar el avance. Puede tardar hasta 24 horas en ser revisado.",
        timer: 4000,
        showConfirmButton: false,
        background: "#1a1a1a",
        color: "#fff",
      });
      cargarDatos();
    } catch (err: any) {
      Swal.fire({ icon: "error", title: "Error", text: err.response?.data?.msg || "Error al reportar" });
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
    <div style={{ background: "#f4f5f7", minHeight: "100vh", padding: "20px 24px 40px" }}>
      <div className="container">
        <button className="btn btn-outline-secondary btn-sm mb-3" onClick={() => navigate(-1)}>
          <FaArrowLeft className="me-1" /> Volver
        </button>

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
                      ) : esAdmin ? (
                        <button className="btn btn-outline-secondary btn-sm w-100" disabled>
                          <FaEye className="me-1" /> Solo visualización
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
                const pendientes = Number(r.EVIDENCIAS_PENDIENTES) || 0;
                const rechazadas = Number(r.EVIDENCIAS_RECHAZADAS) || 0;
                const restante = Math.max(0, r.META_VALOR - r.PROGRESO - pendientes);
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
                        {pendientes > 0 && (
                          <div className="alert alert-warning py-1 px-2 mb-2 small text-center" role="alert">
                            <FaClock className="me-1" /> {pendientes} avance{pendientes !== 1 ? "s" : ""} en revisión
                          </div>
                        )}
                        {rechazadas > 0 && !r.COMPLETADO && (
                          <div className="alert alert-danger py-1 px-2 mb-2 small text-center" role="alert">
                            <FaTimesCircle className="me-1" /> {rechazadas} avance{rechazadas !== 1 ? "s" : ""} rechazado{rechazadas !== 1 ? "s" : ""} — vuelve a intentarlo
                          </div>
                        )}
                        {r.COMPLETADO && r.CUPON_GENERADO && (
                          <div className="alert alert-success py-2 mb-2 small text-center">
                            Cupón: <strong>{r.CUPON_GENERADO}</strong> — {r.RECOMPENSA_PORCENTAJE}% descuento, un solo uso
                          </div>
                        )}
                        {!r.COMPLETADO && !esAdmin && (
                          <button
                            className="btn btn-outline-danger btn-sm w-100"
                            onClick={() => reportar(r.ID_RETO_USUARIO, restante, r.META_TIPO)}
                            disabled={restante <= 0}
                          >
                            <FaImage className="me-1" /> Reportar avance {restante > 0 ? `(máx. ${restante})` : ""}
                          </button>
                        )}
                        {esAdmin && !r.COMPLETADO && (
                          <div className="alert alert-secondary py-1 px-2 mb-0 small text-center" role="alert">
                            <FaEye className="me-1" /> Solo visualización
                          </div>
                        )}
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
