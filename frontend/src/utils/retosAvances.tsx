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
  reps: { icono: <FaDumbbell />, clase: "tipo-reps", etiqueta: "Repeticiones" },
  pasos: { icono: <FaShoePrints />, clase: "tipo-pasos", etiqueta: "Pasos" },
};

export const tipoDe = (metaTipo: string) =>
  TIPOS[metaTipo] || { icono: <FaDumbbell />, clase: "tipo-otro", etiqueta: metaTipo };

export const esMetaAcumulable = (metaTipo: string) =>
  ["km", "reps"].includes(String(metaTipo || "").toLowerCase());

export const esVideoUrlReto = (url: string) => /\.(mp4|webm|mov)(\?|$)/i.test(url);

const ESTADO_EVIDENCIA: Record<string, { bg: string; color: string; txt: string }> = {
  pendiente: { bg: "#fef3c7", color: "#92400e", txt: "EN REVISIÓN" },
  aprobado: { bg: "#dcfce7", color: "#166534", txt: "APROBADO" },
  rechazado: { bg: "#fee2e2", color: "#991b1b", txt: "RECHAZADO" },
};

const ORDEN_ESTADO: Record<string, number> = { pendiente: 0, aprobado: 1, rechazado: 2 };
const TITULO_GRUPO: Record<string, string> = {
  pendiente: "En revisión",
  aprobado: "Aprobados",
  rechazado: "Rechazados",
};
const COLOR_DOT: Record<string, string> = {
  pendiente: "#f59e0b",
  aprobado: "#22c55e",
  rechazado: "#ef4444",
};

const unidad = (metaTipo: string, n: number) => {
  const t = String(metaTipo || "").toLowerCase();
  if (t === "km") return "km";
  if (t === "reps") return n === 1 ? "rep" : "reps";
  if (t === "dias") return n === 1 ? "día" : "días";
  if (t === "sesiones") return n === 1 ? "sesión" : "sesiones";
  return metaTipo || "unidades";
};

const formatoFechaHora = (fecha: string) =>
  new Date(fecha).toLocaleString("es-CO", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true,
  });

/** SVG inline del hero del modal de avances (los iconos React de TIPOS no se
 *  pueden interpolar dentro del string html del Swal: renderizarían
 *  "[object Object]"). Estilo stroke acorde al resto del modal. */
const svgHeroReto = (metaTipo: string) => {
  const tipo = String(metaTipo || "").toLowerCase();
  const dibujo =
    tipo === "sesiones"
      ? `<circle cx="12" cy="14" r="7"/><path d="M10 2h4M12 2v5M12 14v-3.5M12 14l2.4 1.4"/>`
      : tipo === "km"
        ? `<circle cx="6" cy="18" r="2.6"/><circle cx="18" cy="6" r="2.6"/><path d="M8.6 18h6.4a3 3 0 0 0 3-3v-2a3 3 0 0 0-3-3H9"/>`
        : tipo === "dias"
          ? `<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M9 16l2 2 4-4"/>`
          : tipo === "pasos"
            ? `<path d="M3 12h4l2.5-6 4 12L16 12h5"/>`
            : `<path d="M7.5 12h9"/><rect x="4" y="8" width="3" height="8" rx="1"/><rect x="17" y="8" width="3" height="8" rx="1"/><path d="M2.2 10.5v3M21.8 10.5v3"/>`;
  return `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${dibujo}</svg>`;
};

/** Modal "Mis avances enviados" (Swal claro y organizado): hero con progreso del
 *  reto, resumen por estados, tarjetas agrupadas (En revisión / Aprobados /
 *  Rechazados) con previews, cantidad, fecha/hora y motivo de revisión. El
 *  material se conserva tras la revisión para que el usuario siempre lo vea. */
export async function verEvidenciasReto(reto: any, alCambiar: () => void) {
  let evidencias: any[] = [];
  try {
    const res = await axios.get(`/api/retos/evidencias/${reto.ID_RETO_USUARIO}`);
    evidencias = res.data;
  } catch {
    void Swal.fire({ icon: "error", title: "Error", text: "No se pudieron cargar tus avances", background: "#fff", color: "#0f172a", confirmButtonColor: "#e73737" });
    return;
  }
  if (evidencias.length === 0) {
    void Swal.fire({ icon: "info", title: "Sin avances enviados", text: "Aún no has reportado avances en este reto.", background: "#fff", color: "#0f172a", confirmButtonColor: "#e73737" });
    return;
  }

  const metaTipo = String(reto.META_TIPO || "");
  const pctHero = Math.min(
    100,
    Math.round((Number(reto.PROGRESO) / Math.max(1, Number(reto.META_VALOR))) * 100)
  );
  const grupos: Record<string, any[]> = {};
  evidencias.forEach((ev) => {
    (grupos[ev.ESTADO] = grupos[ev.ESTADO] || []).push(ev);
  });
  const ordenEstados = Object.keys(grupos).sort((a, b) => (ORDEN_ESTADO[a] ?? 9) - (ORDEN_ESTADO[b] ?? 9));
  const conteo = (estado: string) =>
    evidencias.filter((ev) => ev.ESTADO === estado).length;

  const chipResumen = (estado: string, label: string) => {
    const n = conteo(estado);
    if (n === 0) return "";
    const est = ESTADO_EVIDENCIA[estado];
    return `<span class="ra-resumen-chip" style="background:${est.bg};color:${est.color}">${label}: ${n}</span>`;
  };

  const tarjeta = (ev: any) => {
    let archivos: string[] = [];
    if (ev.RUTA) {
      archivos = [ev.RUTA];
      try {
        archivos = [ev.RUTA, ...(JSON.parse(ev.RUTAS_EXTRA || "[]"))];
      } catch {
        /* RUTAS_EXTRA corrupto: se conserva solo la RUTA principal */
      }
    }
    const nVideos = archivos.filter(esVideoUrlReto).length;
    const nFotos = archivos.length - nVideos;
    const chipMaterial =
      archivos.length === 0
        ? "Sin material"
        : [
            nFotos > 0 ? `${nFotos} foto${nFotos !== 1 ? "s" : ""}` : "",
            nVideos > 0 ? `${nVideos} video${nVideos !== 1 ? "s" : ""}` : "",
          ].filter(Boolean).join(" + ");
    const previews = archivos.length === 0
      ? `<div class="ra-sin-material">Este avance no tiene material adjunto</div>`
      : archivos.map((url) =>
          esVideoUrlReto(url)
            ? `<video src="${url}" controls preload="metadata" class="ra-thumb"></video>`
            : `<img src="${url}" alt="evidencia" class="ra-thumb" />`
        ).join("");
    const est = ESTADO_EVIDENCIA[ev.ESTADO] || { bg: "#e2e8f0", color: "#334155", txt: String(ev.ESTADO).toUpperCase() };

    let bloqueMotivo = "";
    if (ev.ESTADO === "rechazado" && ev.OBSERVACION) {
      bloqueMotivo = `
        <button id="reto-motivo-${ev.ID_EVIDENCIA}" class="ra-btn-motivo">Ver motivo de la revisión</button>
        <div id="reto-motivo-box-${ev.ID_EVIDENCIA}" style="display:none;width:100%">
          <p class="ra-motivo ra-motivo-rechazo"><strong>Motivo del rechazo:</strong> ${ev.OBSERVACION}</p>
        </div>`;
    } else if (ev.ESTADO === "aprobado" && ev.OBSERVACION) {
      bloqueMotivo = `<p class="ra-motivo ra-motivo-aprobado"><strong>Comentario del equipo:</strong> ${ev.OBSERVACION}</p>`;
    }

    return `
      <div class="ra-card" data-estado="${ev.ESTADO}">
        <div class="ra-card-head">
          <span class="ra-estado" style="background:${est.bg};color:${est.color}">${est.txt}</span>
          <span class="ra-fecha">${formatoFechaHora(ev.FECHA_SUBIDA)}</span>
        </div>
        <div class="ra-card-body">
          <div class="ra-thumbs">${previews}</div>
          <div class="ra-lado">
            <strong class="ra-cant">+${ev.CANTIDAD} ${unidad(metaTipo, ev.CANTIDAD)}</strong>
            <span class="ra-material">${chipMaterial}</span>
            ${ev.ESTADO === "pendiente"
              ? `<button id="reto-del-ev-${ev.ID_EVIDENCIA}" class="ra-btn-eliminar">Eliminar avance</button>`
              : ""}
          </div>
        </div>
        ${bloqueMotivo}
      </div>`;
  };

  const html = `
    <div class="ra-hero">
      <div class="ra-hero-icono">${svgHeroReto(metaTipo)}</div>
      <div class="ra-hero-texto">
        <strong class="ra-hero-titulo">Mis avances enviados</strong>
        <span class="ra-hero-sub">${reto.TITULO}</span>
        <div class="ra-hero-barra"><span style="width:${pctHero}%"></span></div>
        <span class="ra-hero-progreso">${reto.PROGRESO}/${reto.META_VALOR} ${unidad(metaTipo, Number(reto.META_VALOR))} · ${pctHero}%</span>
      </div>
    </div>
    <div class="ra-resumen">
      ${chipResumen("pendiente", "En revisión")}
      ${chipResumen("aprobado", "Aprobados")}
      ${chipResumen("rechazado", "Rechazados")}
    </div>
    <div class="ra-lista">
      ${ordenEstados.map((estado) => `
        <div class="ra-grupo-titulo"><span class="ra-grupo-dot" style="background:${COLOR_DOT[estado] || "#94a3b8"}"></span>${TITULO_GRUPO[estado] || "Otros"} (${grupos[estado].length})</div>
        ${grupos[estado].map(tarjeta).join("")}`).join("")}
    </div>
    <p class="ra-pie">Si enviaste algo mal, elimina el avance en revisión y vuelve a reportarlo. Nuestros asesores revisan tu material en menos de 24 horas.</p>`;

  void Swal.fire({
    customClass: { popup: "reto-avances-popup" },
    showClass: { popup: "swal2-show ra-pop" },
    html,
    background: "#fff",
    color: "#0f172a",
    confirmButtonText: "Cerrar",
    confirmButtonColor: "#e73737",
    showCloseButton: true,
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
              background: "#fff",
              color: "#0f172a",
            });
            if (!isConfirmed) return;
            try {
              await axios.delete(`/api/retos/evidencias/${ev.ID_EVIDENCIA}`);
              Swal.close();
              alCambiar();
              void Swal.fire({ icon: "success", title: "Avance eliminado", text: "Ya puedes enviar un nuevo avance con el material correcto.", timer: 2000, showConfirmButton: false, background: "#fff", color: "#0f172a" });
            } catch (err: any) {
              void Swal.fire({ icon: "error", title: "No se pudo eliminar", text: err.response?.data?.msg || "Error al eliminar el avance", background: "#fff", color: "#0f172a", confirmButtonColor: "#e73737" });
            }
          });
        });
    },
  });
}

const MAX_ARCHIVOS = 5;
const MAX_MB_POR_ARCHIVO = 25;

const formatearMB = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;

/** Panel del formulario "Reportar avance": para retos acumulables (km/reps) un
 *  stepper de cantidad libre; para retos por días/sesiones un panel informativo
 *  (la cantidad es fija: 1 unidad por avance, máximo un avance por día). */
const bloqueCantidad = (acumulable: boolean, maxCantidad: number, metaTipo: string) => {
  if (acumulable) {
    return `
      <div class="ra-cantidad">
        <label class="ra-label">
          ¿Cuánto sumas a tu progreso?
          <span class="ra-cant-max">(máx. ${maxCantidad} ${metaTipo})</span>
        </label>
        <div class="ra-cantidad-stepper">
          <button type="button" id="rw-minus">−</button>
          <input type="number" id="cantidad-reto" class="swal2-input" min="1" max="${maxCantidad}" value="1" />
          <button type="button" id="rw-plus">+</button>
        </div>
      </div>`;
  }
  const tipo = String(metaTipo || "").toLowerCase();
  const singular = tipo === "sesiones" ? "sesión" : tipo === "dias" ? "día" : metaTipo;
  return `
    <div class="ra-avance-dia">
      <div class="ra-avance-dia-icono">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="18" height="16" rx="2"/>
          <path d="M16 3v4M8 3v4M3 11h18M9 16l2 2 4-4"/>
        </svg>
      </div>
      <div class="ra-avance-dia-texto">
        <strong>1 ${singular} por avance</strong>
        <p>Solo se permite un avance por día en retos de días o sesiones. Si el equipo lo rechaza, puedes corregir el material y volver a enviarlo.</p>
      </div>
    </div>`;
};

/** Modal "Reportar avance" (Swal claro y compacto, sin scroll en pantalla):
 *  reglas por tipo de meta + dropzone con previews y subida con barra de
 *  progreso real (XHR, streaming). */
export async function reportarAvanceReto(
  idRetoUsuario: number,
  restante: number,
  metaTipo: string,
  alCambiar: () => void
) {
  const acumulable = esMetaAcumulable(metaTipo);
  const maxCantidad = Math.max(1, restante);
  let archivos: { id: number; name: string; file: File; url: string; tipo: "imagen" | "video" }[] = [];
  let nextId = 0;

  const { value: resultado, isConfirmed } = await Swal.fire({
    title: "Reportar avance",
    customClass: { popup: "reto-modal-popup" },
    html: `
      <div class="ra-form">
        ${bloqueCantidad(acumulable, maxCantidad, metaTipo)}

        <label class="ra-label">Evidencia: capturas de tu app de fitness (también valen fotos y videos cortos)</label>
        <div id="rw-drop" class="ra-dropzone">
          <div class="ra-dropzone-icono">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 8v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1l2-3h4l2 3h5a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="3.2"/>
            </svg>
          </div>
          <strong class="ra-dropzone-titulo">Sube tu evidencia</strong>
          <span class="ra-dropzone-sub">Toca aquí o arrastra los archivos · capturas de tu app de fitness/reloj (km, pasos, sesiones…) · también fotos o videos cortos</span>
        </div>
        <input type="file" id="archivos-reto" hidden multiple
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" />
        <div id="preview-reto" class="ra-previews"></div>
        <small id="contador-reto" class="ra-contador">0/${MAX_ARCHIVOS} archivos — hasta ${MAX_MB_POR_ARCHIVO} MB c/u</small>
        <p class="ra-nota">Nuestros asesores revisan tu avance en menos de 24 horas. Cada archivo puede pesar hasta 25 MB.</p>
        <p class="ra-aviso"><strong>Aviso:</strong> la evidencia debe ser real. Las capturas alteradas o editadas pueden hacer que tu avance sea rechazado.</p>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "Enviar avance",
    cancelButtonText: "Cancelar",
    background: "#fff",
    color: "#0f172a",
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
          div.className = "ra-preview";
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
          badge.className = "ra-preview-badge";
          badge.textContent = a.tipo === "video" ? "VIDEO" : "FOTO";
          div.appendChild(badge);
          const sizeChip = document.createElement("div");
          sizeChip.className = "ra-preview-size";
          sizeChip.textContent = formatearMB(a.file.size);
          div.appendChild(sizeChip);
          const botonX = document.createElement("button");
          botonX.textContent = "✕";
          botonX.title = "Quitar archivo";
          botonX.className = "ra-preview-x";
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
        drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.style.borderColor = "#e73737"; drop.style.background = "#fef2f2"; });
        drop.addEventListener("dragleave", () => { drop.style.borderColor = "var(--ra-borde, #cbd5e1)"; drop.style.background = "#f8fafc"; });
        drop.addEventListener("drop", (e) => {
          e.preventDefault();
          drop.style.borderColor = "var(--ra-borde, #cbd5e1)";
          drop.style.background = "#f8fafc";
          agregarArchivos(e.dataTransfer?.files || []);
        });
      }

      if (acumulable) {
        const ajustar = (d: number) => {
          const inp = document.getElementById("cantidad-reto") as HTMLInputElement;
          const v = Number(inp.value || 1) + d;
          inp.value = String(Math.min(maxCantidad, Math.max(1, v)));
        };
        document.getElementById("rw-plus")?.addEventListener("click", () => ajustar(1));
        document.getElementById("rw-minus")?.addEventListener("click", () => ajustar(-1));
      }
    },
    preConfirm: () => {
      if (archivos.length === 0) {
        Swal.showValidationMessage("Debes adjuntar al menos una foto o video");
        return false;
      }
      if (!acumulable) return 1;
      const cantidad = Number((document.getElementById("cantidad-reto") as HTMLInputElement).value);
      if (!cantidad || cantidad < 1 || cantidad > maxCantidad) {
        Swal.showValidationMessage(`El avance debe ser entre 1 y ${maxCantidad} ${metaTipo}`);
        return false;
      }
      return cantidad;
    },
  });
  if (!isConfirmed || !resultado) return;

  // ---- Subida real con barra de progreso (streaming, soporta videos grandes) ----
  const lista = archivos;
  void Swal.fire({
    title: "Subiendo evidencia…",
    html: `
      <div style="text-align:left">
        <div class="ra-progreso-track">
          <div id="rw-prog-fill" style="width:0%"></div>
        </div>
        <p id="rw-prog-pct" class="ra-progreso-pct">0%</p>
        <p class="ra-progreso-pie">No cierres esta ventana mientras se suben ${lista.length} archivo${lista.length !== 1 ? "s" : ""}</p>
      </div>
    `,
    allowOutsideClick: false,
    showConfirmButton: false,
    background: "#fff",
    color: "#0f172a",
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
            void Swal.fire({
              icon: "success",
              title: "Avance en revisión",
              text: resp.msg || "Deja que nuestros asesores revisen el material para aprobar el avance. Puede tardar hasta 24 horas en ser revisado.",
              timer: 4000,
              showConfirmButton: false,
              background: "#fff",
              color: "#0f172a",
            });
            alCambiar();
          } else {
            void Swal.fire({ icon: "error", title: "Error", text: resp.msg || "Error al reportar", background: "#fff", color: "#0f172a", confirmButtonColor: "#e73737" });
          }
        } catch {
          void Swal.fire({ icon: "error", title: "Error de conexión", text: "No se pudo completar la subida. Inténtalo de nuevo.", background: "#fff", color: "#0f172a", confirmButtonColor: "#e73737" });
        }
      };
      xhr.onerror = () => {
        void Swal.fire({ icon: "error", title: "Error de conexión", text: "No se pudo completar la subida. Inténtalo de nuevo.", background: "#fff", color: "#0f172a", confirmButtonColor: "#e73737" });
      };
      xhr.send(fd);
    },
  });
}
