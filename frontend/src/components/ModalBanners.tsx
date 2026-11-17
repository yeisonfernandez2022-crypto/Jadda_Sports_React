/*
 * ModalBanners: gestión del carrusel de la portada desde la propia tienda.
 * Lo abre el lápiz del banner (visible SOLO para admins): lista completo con
 * agregar, editar, ocultar/mostrar y eliminar. Los cambios se reflejan al
 * cerrar (Principal recarga la lista pública).
 */
import { useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import { FaImages, FaEdit, FaTrash, FaPlus, FaEye, FaEyeSlash, FaImage } from "react-icons/fa";
import "../css/modalBanners.css";

export interface Banner {
  ID_BANNER: number;
  IMAGEN: string;
  TEXTO_ALT: string;
  ORDEN: number;
  ACTIVO: number;
  FECHA_CREACION?: string;
}

interface Props {
  onCerrar: () => void;
}

const MAX_ORDEN = 9999;

// Espejo de la especificación del backend (bannerController): los banners
// originales miden 1757×432 (proporción 4.07:1). El carrusel recorta con
// object-fit: cover, así que basta exigir la PROPORCIÓN ±3 % y un ancho mínimo.
const RELACION_OBJETIVO = 1757 / 432;
const TOLERANCIA_RELACION = 0.03;
const ANCHO_MINIMO = 1200;
const ALTO_SUGERIDO = Math.round(ANCHO_MINIMO / RELACION_OBJETIVO); // 295

interface Medidas { ancho: number; alto: number }

/** Mide la imagen con el propio navegador (naturalWidth/Height no necesitan
 *  CORS, funciona igual con Cloudinary que con /images del backend). */
const medirImagen = (url: string) =>
  new Promise<Medidas | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ancho: img.naturalWidth, alto: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = url;
  });

/** Devuelve [error, medidas]: el mismo veredicto que aplicará el backend. */
const verificarDimensiones = async (url: string): Promise<[string | null, Medidas | null]> => {
  const medidas = await medirImagen(url);
  if (!medidas) {
    return ["No se pudo cargar la imagen para verificar sus medidas. Revisa que la URL sea una imagen válida (jpg, png, webp, gif).", null];
  }
  if (medidas.ancho < ANCHO_MINIMO) {
    return [
      `La imagen (${medidas.ancho}×${medidas.alto} px) es demasiado pequeña. El ancho mínimo es ${ANCHO_MINIMO} px — tamaño recomendado ${ANCHO_MINIMO}×${ALTO_SUGERIDO} px`,
      medidas,
    ];
  }
  const relacion = medidas.ancho / medidas.alto;
  if (Math.abs(relacion - RELACION_OBJETIVO) / RELACION_OBJETIVO > TOLERANCIA_RELACION) {
    return [
      `La imagen (${medidas.ancho}×${medidas.alto} px) no tiene la proporción del carrusel (4.07:1). Exporta a ${ANCHO_MINIMO}×${ALTO_SUGERIDO} px o superior respetando esa proporción`,
      medidas,
    ];
  }
  return [null, medidas];
};

const ModalBanners = ({ onCerrar }: Props) => {
  const [lista, setLista] = useState<Banner[]>([]);
  const [cargando, setCargando] = useState(true);
  // null = vista de listado; número = editando ese banner; 0 = creando uno nuevo
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [imagen, setImagen] = useState("");
  const [textoAlt, setTextoAlt] = useState("");
  const [orden, setOrden] = useState("1");
  const [activo, setActivo] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [medidasDetectadas, setMedidasDetectadas] = useState<Medidas | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);

  const cargar = async () => {
    try {
      const res = await fetch("/api/banners/admin", { credentials: "include" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setLista(data as Banner[]);
      } else {
        void Swal.fire({ icon: "warning", title: data.msg || "No se pudieron cargar los banners" });
      }
    } catch {
      void Swal.fire({ icon: "error", title: "Error al cargar los banners" });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargar();
    // Escape cierra el modal (igual que clic fuera de la tarjeta)
    const enTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !guardando && !subiendo) onCerrar();
    };
    document.addEventListener("keydown", enTecla);
    return () => document.removeEventListener("keydown", enTecla);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirNuevo = () => {
    setEditandoId(0);
    setImagen("");
    setTextoAlt("");
    setOrden(String(lista.length + 1));
    setActivo(true);
    setMedidasDetectadas(null);
  };

  const abrirEdicion = (b: Banner) => {
    setEditandoId(b.ID_BANNER);
    setImagen(b.IMAGEN);
    setTextoAlt(b.TEXTO_ALT || "");
    setOrden(String(b.ORDEN ?? 0));
    setActivo(!!b.ACTIVO);
    setMedidasDetectadas(null);
    // Mide la imagen actual enseguida para mostrar el veredicto en el listado
    void medirImagen(b.IMAGEN).then(setMedidasDetectadas);
  };

  const volverALista = () => setEditandoId(null);

  /** Sube el archivo elegido por el endpoint existente de imágenes (base64 por
   *  JSON → Cloudinary si está configurado, con fallback a disco local). */
  const subirArchivo = async (archivo: File) => {
    setSubiendo(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(String(lector.result));
        lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
        lector.readAsDataURL(archivo);
      });
      const res = await fetch("/api/productos/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imagenes: [{ nombre: archivo.name, data: dataUrl }] }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.urls) && data.urls.length > 0) {
        setImagen(data.urls[0]);
        // Veredicto inmediato de proporción para la imagen recién subida
        setMedidasDetectadas(null);
        const medidas = await medirImagen(data.urls[0]);
        setMedidasDetectadas(medidas);
      } else {
        void Swal.fire({ icon: "warning", title: data.error || "No se pudo subir la imagen" });
      }
    } catch {
      void Swal.fire({ icon: "error", title: "Error al subir la imagen" });
    } finally {
      setSubiendo(false);
    }
  };

  const guardar = async () => {
    const imagenLimpia = imagen.trim();
    if (!imagenLimpia) {
      void Swal.fire({ icon: "warning", title: "Falta la imagen", text: "Sube un archivo o pega la URL de la imagen del banner" });
      return;
    }
    const ordenNum = Number.parseInt(orden, 10);
    if (!Number.isFinite(ordenNum) || ordenNum < 0 || ordenNum > MAX_ORDEN) {
      void Swal.fire({ icon: "warning", title: "Orden inválido", text: `Debe ser un número entre 0 y ${MAX_ORDEN}` });
      return;
    }
    // La proporción/ancho se valida AQUÍ (aviso inmediato) y en el backend
    // (autoridad final) — el carrusel exige 1757:432 ±3 % y ancho ≥ 1200.
    setGuardando(true);
    try {
      const [errorDimensiones] = await verificarDimensiones(imagenLimpia);
      if (errorDimensiones) {
        void Swal.fire({ icon: "warning", title: "Imagen no apta para el carrusel", text: errorDimensiones });
        return;
      }
      const esNuevo = editandoId === 0;
      const url = esNuevo ? "/api/banners" : `/api/banners/${editandoId}`;
      const res = await fetch(url, {
        method: esNuevo ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ IMAGEN: imagenLimpia, TEXTO_ALT: textoAlt.trim(), ORDEN: ordenNum, ACTIVO: activo ? 1 : 0 }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        void Swal.fire({ icon: "success", title: data.msg, timer: 1500, showConfirmButton: false });
        volverALista();
        void cargar();
      } else {
        void Swal.fire({ icon: "warning", title: data.msg || "No se pudo guardar el banner" });
      }
    } catch {
      void Swal.fire({ icon: "error", title: "Error al guardar el banner" });
    } finally {
      setGuardando(false);
    }
  };

  const alternarActivo = async (b: Banner) => {
    try {
      const res = await fetch(`/api/banners/${b.ID_BANNER}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ IMAGEN: b.IMAGEN, TEXTO_ALT: b.TEXTO_ALT, ORDEN: b.ORDEN, ACTIVO: b.ACTIVO ? 0 : 1 }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        void cargar();
      } else {
        void Swal.fire({ icon: "warning", title: data.msg || "No se pudo cambiar la visibilidad" });
      }
    } catch {
      void Swal.fire({ icon: "error", title: "Error al cambiar la visibilidad" });
    }
  };

  const eliminar = async (b: Banner) => {
    const { isConfirmed } = await Swal.fire({
      icon: "question",
      title: "¿Eliminar este banner?",
      text: "Dejará de mostrarse en la portada. Esta acción no se puede deshacer.",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#dc3545",
      cancelButtonColor: "#6c757d",
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/banners/${b.ID_BANNER}`, { method: "DELETE", credentials: "include" });
      const data = await res.json();
      if (res.ok && data.ok) {
        void Swal.fire({ icon: "success", title: data.msg, timer: 1500, showConfirmButton: false });
        void cargar();
      } else {
        void Swal.fire({ icon: "warning", title: data.msg || "No se pudo eliminar el banner" });
      }
    } catch {
      void Swal.fire({ icon: "error", title: "Error al eliminar el banner" });
    }
  };

  const enFormulario = editandoId !== null;

  return (
    <div
      className="mbn-overlay"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget && !guardando && !subiendo) onCerrar(); }}
    >
      <div className="mbn-modal" role="dialog" aria-modal="true" aria-label="Gestión de banners">
        <button type="button" className="mbn-cerrar" aria-label="Cerrar" onClick={onCerrar}>✕</button>

        <div className="mbn-hero">
          <div className="mbn-hero-icono"><FaImages /></div>
          <div>
            <h2>{enFormulario ? (editandoId === 0 ? "Nuevo banner" : "Editar banner") : "Banners de la portada"}</h2>
            <p>{enFormulario ? "Imagen, texto alternativo, orden y visibilidad" : `${lista.length} banner${lista.length !== 1 ? "s" : ""} en el carrusel de la tienda`}</p>
          </div>
        </div>

        {enFormulario ? (
          <div className="mbn-cuerpo">
            <label className="form-label fw-bold small" htmlFor="mbn-imagen">Imagen *</label>
            <div className="mbn-imagen-zona">
              {imagen ? (
                <img className="mbn-previa" src={imagen} alt={textoAlt || "Vista previa del banner"} />
              ) : (
                <div className="mbn-previa-vacia"><FaImage /> Sin imagen</div>
              )}
              <div className="mbn-imagen-acciones">
                <input
                  ref={inputArchivoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const archivo = e.target.files?.[0];
                    if (archivo) void subirArchivo(archivo);
                    e.target.value = "";
                  }}
                />
                <button type="button" className="mbn-btn mbn-btn-secundario" onClick={() => inputArchivoRef.current?.click()} disabled={subiendo}>
                  {subiendo ? "Subiendo..." : "Subir desde el equipo"}
                </button>
                <input
                  id="mbn-imagen"
                  className="form-control"
                  placeholder="...o pega una URL de imagen"
                  value={imagen}
                  maxLength={500}
                  onChange={(e) => { setImagen(e.target.value); setMedidasDetectadas(null); }}
                  onBlur={(e) => { if (e.target.value.trim()) void medirImagen(e.target.value.trim()).then(setMedidasDetectadas); }}
                />
                <p className="mbn-ayuda-medidas">
                  La imagen debe tener proporción 4.07:1 — tamaño recomendado <strong>1757×432 px</strong> o superior con la misma proporción (mínimo {ANCHO_MINIMO} px de ancho).
                </p>
                {medidasDetectadas && (
                  (() => {
                    const r = medidasDetectadas.ancho / medidasDetectadas.alto;
                    const ok = medidasDetectadas.ancho >= ANCHO_MINIMO && Math.abs(r - RELACION_OBJETIVO) / RELACION_OBJETIVO <= TOLERANCIA_RELACION;
                    return (
                      <p className={ok ? "mbn-veredicto mbn-veredicto-ok" : "mbn-veredicto mbn-veredicto-mal"}>
                        {ok ? "✔" : "✘"} Medidas detectadas: {medidasDetectadas.ancho}×{medidasDetectadas.alto} px
                        {ok ? " — apta para el carrusel" : " — no cumple la proporción/mínimo"}
                      </p>
                    );
                  })()
                )}
              </div>
            </div>

            <label className="form-label fw-bold small mt-3" htmlFor="mbn-alt">Texto alternativo</label>
            <input
              id="mbn-alt"
              className="form-control"
              placeholder="Descripción de la imagen (accesibilidad y SEO)"
              value={textoAlt}
              maxLength={200}
              onChange={(e) => setTextoAlt(e.target.value)}
            />

            <div className="mbn-fila-formulario">
              <div>
                <label className="form-label fw-bold small" htmlFor="mbn-orden">Orden</label>
                <input
                  id="mbn-orden"
                  className="form-control"
                  type="number"
                  min={0}
                  max={MAX_ORDEN}
                  value={orden}
                  onChange={(e) => setOrden(e.target.value)}
                />
              </div>
              <div className="mbn-activo">
                <label className="form-label fw-bold small" htmlFor="mbn-activo">Visibilidad</label>
                <div className="form-check form-switch mb-0">
                  <input
                    id="mbn-activo"
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    checked={activo}
                    onChange={(e) => setActivo(e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="mbn-activo">
                    Visible en la tienda
                  </label>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mbn-cuerpo mbn-lista">
            {cargando ? (
              <div className="mbn-vacio">Cargando banners...</div>
            ) : lista.length === 0 ? (
              <div className="mbn-vacio">No hay banners registrados. Agrega el primero.</div>
            ) : (
              lista.map((b) => (
                <div className="mbn-fila" key={b.ID_BANNER}>
                  <img className="mbn-miniatura" src={b.IMAGEN} alt={b.TEXTO_ALT || `Banner ${b.ID_BANNER}`} />
                  <div className="mbn-fila-info">
                    <span className={`mbn-orden-badge ${b.ACTIVO ? "" : "mbn-inactivo"}`}>#{b.ORDEN}</span>
                    <span className="mbn-alt-truncado" title={b.TEXTO_ALT}>{b.TEXTO_ALT || "Sin texto alternativo"}</span>
                  </div>
                  <div className="mbn-fila-acciones">
                    <button
                      type="button"
                      className={`mbn-btn-accion ${b.ACTIVO ? "" : "mbn-acc-apagado"}`}
                      title={b.ACTIVO ? "Ocultar de la tienda" : "Mostrar en la tienda"}
                      aria-label={b.ACTIVO ? "Ocultar de la tienda" : "Mostrar en la tienda"}
                      onClick={() => void alternarActivo(b)}
                    >
                      {b.ACTIVO ? <FaEye /> : <FaEyeSlash />}
                    </button>
                    <button type="button" className="mbn-btn-accion" title="Editar" aria-label="Editar banner" onClick={() => abrirEdicion(b)}>
                      <FaEdit />
                    </button>
                    <button type="button" className="mbn-btn-accion mbn-acc-eliminar" title="Eliminar" aria-label="Eliminar banner" onClick={() => void eliminar(b)}>
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))
            )}
            <button type="button" className="mbn-btn mbn-btn-guardar mbn-agregar" onClick={abrirNuevo}>
              <FaPlus /> Agregar banner
            </button>
          </div>
        )}

        <div className="mbn-pie">
          {enFormulario ? (
            <>
              <button type="button" className="mbn-btn mbn-btn-cancelar" onClick={volverALista}>Volver</button>
              <button type="button" className="mbn-btn mbn-btn-guardar" onClick={guardar} disabled={guardando || subiendo}>
                {guardando ? "Guardando..." : editandoId === 0 ? "Crear banner" : "Guardar cambios"}
              </button>
            </>
          ) : (
            <button type="button" className="mbn-btn mbn-btn-cancelar" onClick={onCerrar}>Cerrar</button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalBanners;
