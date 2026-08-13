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

  const esVideoUrl = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

  const ESTADO_EVIDENCIA: Record<string, { bg: string; color: string; txt: string }> = {
    pendiente: { bg: "#fef3c7", color: "#92400e", txt: "EN REVISIÓN" },
    aprobado: { bg: "#dcfce7", color: "#166534", txt: "APROBADO" },
    rechazado: { bg: "#fee2e2", color: "#991b1b", txt: "RECHAZADO" },
  };

  const verEvidencias = async (r: any) => {
    let evidencias: any[] = [];
    try {
      const res = await axios.get(`/api/retos/evidencias/${r.ID_RETO_USUARIO}`);
      evidencias = res.data;
    } catch {
      Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar tus avances", background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e73737" });
      return;
    }
    if (evidencias.length === 0) {
      Swal.fire({ icon: "info", title: "Sin avances enviados", text: "Aún no has reportado avances en este reto.", background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e73737" });
      return;
    }

    const html = evidencias.map((ev) => {
      let archivos: string[] = [ev.RUTA];
      try { archivos = [ev.RUTA, ...(JSON.parse(ev.RUTAS_EXTRA || "[]"))]; } catch {}
      const previews = archivos.map((url) =>
        esVideoUrl(url)
          ? `<video src="${url}" controls preload="metadata" style="width:120px;height:90px;object-fit:cover;border-radius:8px;background:#000"></video>`
          : `<img src="${url}" alt="evidencia" style="width:120px;height:90px;object-fit:cover;border-radius:8px;background:#000" />`
      ).join("");
      const est = ESTADO_EVIDENCIA[ev.ESTADO] || { bg: "#e2e8f0", color: "#334155", txt: ev.ESTADO };
      return `
        <div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:#222;border-radius:12px;margin-bottom:10px">
          <div style="display:flex;flex-wrap:wrap;gap:6px;flex:1">${previews}</div>
          <div style="min-width:120px;text-align:right">
            <span style="display:inline-block;background:${est.bg};color:${est.color};font-size:0.65rem;font-weight:800;padding:3px 10px;border-radius:20px;letter-spacing:.4px">${est.txt}</span>
            <p style="margin:6px 0 0;font-size:0.78rem;color:#bbb">+${ev.CANTIDAD} · ${new Date(ev.FECHA_SUBIDA).toLocaleDateString("es-CO")}</p>
            ${ev.ESTADO === "pendiente"
              ? `<button id="reto-del-ev-${ev.ID_EVIDENCIA}" style="margin-top:8px;background:#3a1517;color:#ff8f98;border:1px solid #e73737;border-radius:8px;padding:5px 12px;font-size:0.72rem;font-weight:700;cursor:pointer">Eliminar avance</button>`
              : ""}
          </div>
        </div>`;
    }).join("");

    Swal.fire({
      title: "Mis avances enviados",
      html: `<div style="max-height:60vh;overflow-y:auto;text-align:left">${html}</div>
             <p style="margin:10px 0 0;font-size:0.75rem;color:#888;text-align:left">Si enviaste algo mal, elimina el avance en revisión y vuelve a reportarlo.</p>`,
      background: "#1a1a1a",
      color: "#fff",
      confirmButtonText: "Cerrar",
      confirmButtonColor: "#e73737",
      didOpen: () => {
        evidencias
          .filter((ev) => ev.ESTADO === "pendiente")
          .forEach((ev) => {
            document.getElementById(`reto-del-ev-${ev.ID_EVIDENCIA}`)?.addEventListener("click", async () => {
              const { isConfirmed } = await Swal.fire({
                icon: "warning",
                title: "¿Eliminar este avance?",
                text: "Está en revisión. Al eliminarlo podrás enviar uno nuevo con el material correcto.",
                showCancelButton: true,
                confirmButtonText: "Sí, eliminar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#e73737",
                reverseButtons: true,
                background: "#1a1a1a",
                color: "#fff",
              });
              if (!isConfirmed) return;
              try {
                await axios.delete(`/api/retos/evidencias/${ev.ID_EVIDENCIA}`);
                Swal.close();
                cargarDatos();
                Swal.fire({ icon: "success", title: "AVANCE ELIMINADO", text: "Ya puedes enviar un nuevo avance con el material correcto.", timer: 2000, showConfirmButton: false, background: "#1a1a1a", color: "#fff" });
              } catch (err: any) {
                Swal.fire({ icon: "error", title: "NO SE PUDO ELIMINAR", text: err.response?.data?.msg || "Error al eliminar el avance", background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e73737" });
              }
            });
          });
      },
    });
  };

  const MAX_ARCHIVOS = 10;
  const MAX_MB_POR_ARCHIVO = 100;

  const formatearMB = (bytes: number) =>
    bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(bytes / 1024)} KB`;

  const reportar = async (idRetoUsuario: number, restante: number, metaTipo: string) => {
    const maxCantidad = Math.max(1, restante);
    let archivos: { id: number; name: string; file: File; url: string; tipo: "imagen" | "video" }[] = [];
    let nextId = 0;

    const { value: resultado, isConfirmed } = await Swal.fire({
      title: "Reportar avance",
      html: `
        <div style="text-align:left">
          <div style="margin-bottom:16px">
            <label style="display:block;font-size:0.85rem;color:#bbb;margin-bottom:6px">
              ¿Cuánto sumas a tu progreso? <span style="color:#e73737">(máx. ${maxCantidad} ${metaTipo})</span>
            </label>
            <div style="display:flex;align-items:center;gap:8px">
              <button type="button" id="rw-minus" style="width:36px;height:36px;border-radius:8px;border:1px solid #444;background:#2a2a2a;color:#fff;font-size:1.1rem;cursor:pointer">−</button>
              <input type="number" id="cantidad-reto" class="swal2-input" min="1" max="${maxCantidad}" value="1"
                style="margin:0;width:90px;text-align:center;font-size:1rem" />
              <button type="button" id="rw-plus" style="width:36px;height:36px;border-radius:8px;border:1px solid #444;background:#2a2a2a;color:#fff;font-size:1.1rem;cursor:pointer">+</button>
            </div>
          </div>

          <label style="display:block;font-size:0.85rem;color:#bbb;margin-bottom:6px">
            Evidencia (foto o video)
          </label>
          <div id="rw-drop"
            style="border:2px dashed #444;border-radius:12px;padding:22px 14px;text-align:center;cursor:pointer;transition:all .2s;background:#222">
            <div style="font-size:1.6rem;color:#e73737;margin-bottom:6px">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 8v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1l2-3h4l2 3h5a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="3.2"/>
              </svg>
            </div>
            <strong style="display:block;font-size:0.9rem;color:#eee">Sube tus fotos o videos</strong>
            <span style="font-size:0.78rem;color:#888">Toca aquí o arrastra los archivos · foto o video</span>
          </div>
          <input type="file" id="archivos-reto" hidden multiple
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" />
          <div id="preview-reto" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;min-height:0"></div>
          <small id="contador-reto" style="color:#888;display:block;margin-top:8px">0/${MAX_ARCHIVOS} archivos — hasta ${MAX_MB_POR_ARCHIVO} MB c/u</small>
          <p style="margin:10px 0 0;padding:9px 11px;border-radius:8px;background:#223;font-size:0.75rem;color:#8fa3c0">
            Nuestros asesores revisan tu avance en menos de 24 horas. Un video de más de 100 MB se sube poco a poco, sin bloquear la página.
          </p>
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
        const drop = document.getElementById("rw-drop");
        const contenedor = document.getElementById("preview-reto");
        const contador = document.getElementById("contador-reto");

        const render = () => {
          if (!contenedor) return;
          contenedor.innerHTML = "";
          archivos.forEach((a) => {
            const div = document.createElement("div");
            div.style.cssText = "position:relative;width:86px;height:86px;border-radius:10px;overflow:hidden;border:1px solid #444;flex-shrink:0;background:#000";
            if (a.tipo === "video") {
              const vid = document.createElement("video");
              vid.src = a.url;
              vid.muted = true;
              vid.loop = true;
              vid.playsInline = true;
              vid.preload = "metadata";
              vid.style.cssText = "width:100%;height:100%;object-fit:cover";
              vid.play().catch(() => {});
              div.appendChild(vid);
            } else {
              const img = document.createElement("img");
              img.src = a.url;
              img.style.cssText = "width:100%;height:100%;object-fit:cover";
              div.appendChild(img);
            }
            const badge = document.createElement("div");
            badge.style.cssText = "position:absolute;top:2px;left:2px;background:rgba(0,0,0,0.75);color:#fff;font-size:0.56rem;padding:1px 6px;border-radius:6px;font-weight:700";
            badge.textContent = a.tipo === "video" ? "VIDEO" : "FOTO";
            div.appendChild(badge);
            const sizeChip = document.createElement("div");
            sizeChip.style.cssText = "position:absolute;bottom:2px;left:2px;background:rgba(0,0,0,0.75);color:#cbd5e1;font-size:0.54rem;padding:1px 6px;border-radius:6px";
            sizeChip.textContent = formatearMB(a.file.size);
            div.appendChild(sizeChip);
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
          if (contador) contador.textContent = `${archivos.length}/${MAX_ARCHIVOS} archivos — hasta ${MAX_MB_POR_ARCHIVO} MB c/u`;
        };

        const agregarArchivos = (files: FileList | File[]) => {
          for (const file of Array.from(files)) {
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
            archivos.push({ id, name: file.name, file, url: URL.createObjectURL(file), tipo: esVideo ? "video" : "imagen" });
          }
          input.value = "";
          render();
        };

        input.addEventListener("change", () => agregarArchivos(input.files || []));

        if (drop) {
          drop.addEventListener("click", () => input.click());
          drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.style.borderColor = "#e73737"; drop.style.background = "#2a2222"; });
          drop.addEventListener("dragleave", () => { drop.style.borderColor = "#444"; drop.style.background = "#222"; });
          drop.addEventListener("drop", (e) => {
            e.preventDefault();
            drop.style.borderColor = "#444";
            drop.style.background = "#222";
            agregarArchivos(e.dataTransfer?.files || []);
          });
        }

        const ajustar = (d: number) => {
          const inp = document.getElementById("cantidad-reto") as HTMLInputElement;
          let v = Number(inp.value || 1) + d;
          inp.value = String(Math.min(maxCantidad, Math.max(1, v)));
        };
        document.getElementById("rw-plus")?.addEventListener("click", () => ajustar(1));
        document.getElementById("rw-minus")?.addEventListener("click", () => ajustar(-1));
      },
      preConfirm: () => {
        const cantidad = Number((document.getElementById("cantidad-reto") as HTMLInputElement).value);
        if (!cantidad || cantidad < 1 || cantidad > maxCantidad) {
          Swal.showValidationMessage(`El avance debe ser entre 1 y ${maxCantidad} ${metaTipo}`);
          return false;
        }
        if (archivos.length === 0) {
          Swal.showValidationMessage("Debes adjuntar al menos una foto o video");
          return false;
        }
        return cantidad;
      },
    });
    if (!isConfirmed || !resultado) return;

    // ---- Subida real con barra de progreso (streaming, soporta videos grandes) ----
    const lista = archivos;
    Swal.fire({
      title: "Subiendo evidencia…",
      html: `
        <div style="text-align:left">
          <div style="background:#2a2a2a;border-radius:10px;overflow:hidden;height:14px;border:1px solid #444">
            <div id="rw-prog-fill" style="width:0%;height:100%;background:linear-gradient(90deg,#e73737,#ff6b6b);transition:width .2s"></div>
          </div>
          <p id="rw-prog-pct" style="text-align:center;font-weight:700;margin:10px 0 2px;font-size:1.1rem">0%</p>
          <p style="margin:0;font-size:0.78rem;color:#888">No cierres esta ventana mientras se suben ${lista.length} archivo${lista.length !== 1 ? "s" : ""}</p>
        </div>
      `,
      allowOutsideClick: false,
      showConfirmButton: false,
      background: "#1a1a1a",
      color: "#fff",
      didOpen: () => {
        const fd = new FormData();
        fd.append("cantidad", String(resultado));
        lista.forEach((a) => fd.append("materiales", a.file, a.name));

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/retos/progreso/${idRetoUsuario}`);
        xhr.withCredentials = true;
        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          const fill = document.getElementById("rw-prog-fill");
          const pctEl = document.getElementById("rw-prog-pct");
          if (fill) fill.style.width = `${pct}%`;
          if (pctEl) pctEl.textContent = `${pct}%`;
        };
        xhr.onload = () => {
          try {
            const resp = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              Swal.fire({
                icon: "info",
                title: "Avance en revisión",
                text: resp.msg || "Deja que nuestros asesores revisen el material para aprobar el avance. Puede tardar hasta 24 horas en ser revisado.",
                timer: 4000,
                showConfirmButton: false,
                background: "#1a1a1a",
                color: "#fff",
              });
              cargarDatos();
            } else {
              Swal.fire({ icon: "error", title: "Error", text: resp.msg || "Error al reportar", background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e73737" });
            }
          } catch {
            Swal.fire({ icon: "error", title: "Error de conexión", text: "No se pudo completar la subida. Inténtalo de nuevo.", background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e73737" });
          }
        };
        xhr.onerror = () => {
          Swal.fire({ icon: "error", title: "Error de conexión", text: "No se pudo completar la subida. Inténtalo de nuevo.", background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e73737" });
        };
        xhr.send(fd);
      },
    });
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
                          <div
                            className="alert alert-warning py-1 px-2 mb-2 small text-center"
                            role="alert"
                            style={{ cursor: "pointer", userSelect: "none" }}
                            onClick={() => verEvidencias(r)}
                          >
                            <FaClock className="me-1" /> {pendientes} avance{pendientes !== 1 ? "s" : ""} en revisión — ver avances
                          </div>
                        )}
                        {rechazadas > 0 && !r.COMPLETADO && (
                          <div
                            className="alert alert-danger py-1 px-2 mb-2 small text-center"
                            role="alert"
                            style={{ cursor: "pointer", userSelect: "none" }}
                            onClick={() => verEvidencias(r)}
                          >
                            <FaTimesCircle className="me-1" /> {rechazadas} avance{rechazadas !== 1 ? "s" : ""} rechazado{rechazadas !== 1 ? "s" : ""} — ver avances
                          </div>
                        )}
                        {r.COMPLETADO && r.CUPON_GENERADO && (
                          <div className="alert alert-success py-2 mb-2 small text-center">
                            Cupón: <strong>{r.CUPON_GENERADO}</strong> — {r.RECOMPENSA_PORCENTAJE}% descuento, un solo uso
                          </div>
                        )}
                        {r.COMPLETADO && (
                          <div className="text-center mb-2">
                            <button
                              className="btn btn-link btn-sm p-0"
                              style={{ cursor: "pointer", color: "#e73737" }}
                              onClick={() => verEvidencias(r)}
                            >
                              Ver avances enviados
                            </button>
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
