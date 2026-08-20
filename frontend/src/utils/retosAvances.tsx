import type { ReactNode } from "react";
import Swal from "sweetalert2";
import axios from "axios";
import {
  FaRunning, FaRoute, FaCalendarCheck, FaShoePrints, FaDumbbell,
} from "react-icons/fa";

export const TIPOS: Record<string, { icono: ReactNode; clase: string; etiqueta: string }> = {
  sesiones: { icono: <FaRunning />, clase: "tipo-sesiones", etiqueta: "Sesiones" },
  km: { icono: <FaRoute />, clase: "tipo-km", etiqueta: "Kilómetros" },
  dias: { icono: <FaCalendarCheck />, clase: "tipo-dias", etiqueta: "Días" },
  pasos: { icono: <FaShoePrints />, clase: "tipo-pasos", etiqueta: "Pasos" },
};

export const tipoDe = (metaTipo: string) =>
  TIPOS[metaTipo] || { icono: <FaDumbbell />, clase: "tipo-otro", etiqueta: metaTipo };

export const esVideoUrlReto = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

const ESTADO_EVIDENCIA: Record<string, { bg: string; color: string; txt: string }> = {
  pendiente: { bg: "#fef3c7", color: "#92400e", txt: "EN REVISIÓN" },
  aprobado: { bg: "#dcfce7", color: "#166534", txt: "APROBADO" },
  rechazado: { bg: "#fee2e2", color: "#991b1b", txt: "RECHAZADO" },
};

/** Modal "Mis avances enviados" (Swal oscuro): lista las evidencias del reto del
 *  usuario con sus previews (imagen/video), estado, cantidad, motivo de revisión
 *  (si el admin lo dio) y botón eliminar SOLO en avances pendientes. El material
 *  se conserva en disco tras la revisión para que el usuario pueda volver a verlo. */
export async function verEvidenciasReto(reto: any, alCambiar: () => void) {
  let evidencias: any[] = [];
  try {
    const res = await axios.get(`/api/retos/evidencias/${reto.ID_RETO_USUARIO}`);
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
    let archivos: string[] = [];
    if (ev.RUTA) {
      archivos = [ev.RUTA];
      try { archivos = [ev.RUTA, ...(JSON.parse(ev.RUTAS_EXTRA || "[]"))]; } catch {}
    }
    const previews = archivos.length === 0
      ? `<div style="flex:1;display:flex;align-items:center;justify-content:center;background:#1c1c1c;border-radius:8px;min-height:90px;color:#777;font-size:0.75rem;text-align:center;padding:10px">Este avance no tiene material adjunto.</div>`
      : archivos.map((url) =>
          esVideoUrlReto(url)
            ? `<video src="${url}" controls preload="metadata" style="width:120px;height:90px;object-fit:cover;border-radius:8px;background:#000"></video>`
            : `<img src="${url}" alt="evidencia" style="width:120px;height:90px;object-fit:cover;border-radius:8px;background:#000" />`
        ).join("");
    const est = ESTADO_EVIDENCIA[ev.ESTADO] || { bg: "#e2e8f0", color: "#334155", txt: ev.ESTADO };
    const motivoCaja = (esRechazado: boolean) =>
      `<p style="margin:8px 0 0;padding:8px 10px;border-radius:8px;font-size:0.75rem;line-height:1.45;background:${esRechazado ? "#3a1517" : "#22303f"};color:${esRechazado ? "#ffd5d8" : "#b6c8dd"};text-align:left">
         <strong style="color:${esRechazado ? "#ff8f98" : "#8fa3c0"}">${esRechazado ? "Motivo del rechazo:" : "Comentario del equipo:"}</strong> ${ev.OBSERVACION}
       </p>`;
    const motivo =
      ev.ESTADO === "rechazado" && ev.OBSERVACION
        ? `<button id="reto-motivo-${ev.ID_EVIDENCIA}" style="margin:8px 0 0;background:#3a1517;color:#ff8f98;border:1px solid #e73737;border-radius:8px;padding:6px 12px;font-size:0.72rem;font-weight:700;cursor:pointer">Ver motivo de la revisión</button>
           <div id="reto-motivo-box-${ev.ID_EVIDENCIA}" style="display:none;width:100%">${motivoCaja(true)}</div>`
        : ev.ESTADO === "aprobado" && ev.OBSERVACION
          ? motivoCaja(false)
          : "";
    return `
      <div style="display:flex;gap:12px;align-items:flex-start;padding:12px;background:#222;border-radius:12px;margin-bottom:10px">
        <div style="display:flex;flex-wrap:wrap;gap:6px;flex:1">
          ${previews}
          ${motivo}
        </div>
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
        .filter((ev) => ev.ESTADO === "rechazado" && ev.OBSERVACION)
        .forEach((ev) => {
          const btn = document.getElementById(`reto-motivo-${ev.ID_EVIDENCIA}`);
          const box = document.getElementById(`reto-motivo-box-${ev.ID_EVIDENCIA}`);
          btn?.addEventListener("click", () => {
            if (!box) return;
            const visible = box.style.display !== "none";
            box.style.display = visible ? "none" : "block";
            btn.textContent = visible ? "Ver motivo de la revisión" : "Ocultar motivo";
          });
        });
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
              alCambiar();
              Swal.fire({ icon: "success", title: "AVANCE ELIMINADO", text: "Ya puedes enviar un nuevo avance con el material correcto.", timer: 2000, showConfirmButton: false, background: "#1a1a1a", color: "#fff" });
            } catch (err: any) {
              Swal.fire({ icon: "error", title: "NO SE PUDO ELIMINAR", text: err.response?.data?.msg || "Error al eliminar el avance", background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e73737" });
            }
          });
        });
    },
  });
}

const MAX_ARCHIVOS = 10;
const MAX_MB_POR_ARCHIVO = 100;

const formatearMB = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

/** Modal "Reportar avance" (Swal oscuro): stepper de cantidad + dropzone con
 *  previews y subida con barra de progreso real (XHR, streaming). */
export async function reportarAvanceReto(
  idRetoUsuario: number,
  restante: number,
  metaTipo: string,
  alCambiar: () => void
) {
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
            alCambiar();
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
}