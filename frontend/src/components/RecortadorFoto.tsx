import "../css/RecortadorFoto.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { FaCrop, FaSearchPlus, FaSearchMinus, FaTimes } from "react-icons/fa";
import Swal from "sweetalert2";

const LADO_SALIDA = 720; // la foto exportada es cuadrada de LADO x LADO px

type Props = {
  archivo: File;
  subiendo: boolean;
  onCancelar: () => void;
  onConfirmar: (dataUrl: string) => void | Promise<void>;
};

// Dibuja SOLO la parte elegida en un canvas cuadrado y la exporta como
// dataURL (JPEG de fotos; PNG cuando la original puede llevar transparencia).
// El crop salió del <img> del Cropper y el canvas pinta el MISMO <img>, así
// que la orientación EXIF se comporta idéntica en ambos.
async function recortarComoDatos(
  archivo: File,
  urlFoto: string,
  area: Area
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("No se pudo leer la imagen"));
    el.src = urlFoto;
  });

  const tipo =
    archivo.type === "image/png" || archivo.type === "image/gif"
      ? "image/png"
      : "image/jpeg";

  const canvas = document.createElement("canvas");
  canvas.width = LADO_SALIDA;
  canvas.height = LADO_SALIDA;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");

  // Recorte seguro: clamp del área al tamaño real de la imagen (por si el
  // redondeo del cropper la sale medio pixel), ajustando el destino a escala.
  const sw0 = area.width || 1;
  const sh0 = area.height || 1;
  let x = area.x;
  let y = area.y;
  let w = area.width;
  let h = area.height;
  let dx = 0;
  let dy = 0;
  if (x < 0) { dx = (-x / sw0) * LADO_SALIDA; w += x; x = 0; }
  if (y < 0) { dy = (-y / sh0) * LADO_SALIDA; h += y; y = 0; }
  if (x + w > img.naturalWidth) w = img.naturalWidth - x;
  if (y + h > img.naturalHeight) h = img.naturalHeight - y;

  if (w > 0 && h > 0) {
    ctx.drawImage(
      img, x, y, w, h,
      dx, dy, (w / sw0) * LADO_SALIDA, (h / sh0) * LADO_SALIDA
    );
  } else {
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, LADO_SALIDA, LADO_SALIDA);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, tipo, 0.92));
  if (!blob) throw new Error("No se pudo generar el recorte");

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo convertir el recorte"));
    reader.readAsDataURL(blob);
  });
}

export default function RecortadorFoto({ archivo, subiendo, onCancelar, onConfirmar }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [exportando, setExportando] = useState(false);
  const areaRecorte = useRef<Area | null>(null);

  const urlFoto = useMemo(() => URL.createObjectURL(archivo), [archivo]);
  useEffect(() => () => URL.revokeObjectURL(urlFoto), [urlFoto]);

  const ocupado = subiendo || exportando;

  // Esc cierra solo cuando no hay subida en vuelo.
  useEffect(() => {
    const alPresionar = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !ocupado) onCancelar();
    };
    document.addEventListener("keydown", alPresionar);
    return () => document.removeEventListener("keydown", alPresionar);
  }, [ocupado, onCancelar]);

  async function confirmar() {
    if (ocupado) return;
    const area = areaRecorte.current;
    if (!area) return;
    setExportando(true);
    try {
      const dataUrl = await recortarComoDatos(archivo, urlFoto, area);
      await onConfirmar(dataUrl);
    } catch (e) {
      void Swal.fire({
        icon: "error",
        title: "ERROR AL RECORTAR",
        text: e instanceof Error ? e.message : "No se pudo procesar la imagen.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="rc-overlay" onClick={() => { if (!ocupado) onCancelar(); }}>
      <div className="rc-tarjeta" role="dialog" aria-modal="true" aria-label="Recortar foto de perfil" onClick={(e) => e.stopPropagation()}>
        <div className="rc-cabecera">
          <span className="rc-ico"><FaCrop /></span>
          <h3>Elige cómo se verá tu foto</h3>
          <button type="button" className="rc-cerrar" aria-label="Cerrar" disabled={ocupado} onClick={() => onCancelar()}>
            <FaTimes />
          </button>
        </div>

        <p className="rc-hint">
          Arrastra la imagen para moverla y ajusta el zoom. Solo la parte dentro
          del círculo se guardará para tu perfil.
        </p>

        <div className="rc-crop">
          <Cropper
            image={urlFoto}
            crop={crop}
            zoom={zoom}
            rotation={0}
            aspect={1}
            minZoom={1}
            maxZoom={4}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area, pixeles) => {
              areaRecorte.current = pixeles;
            }}
          />
        </div>

        <div className="rc-zoom-row">
          <FaSearchMinus className="rc-zoom-ico" />
          <input
            type="range"
            className="rc-zoom"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            aria-label="Zoom de la foto"
            disabled={ocupado}
          />
          <FaSearchPlus className="rc-zoom-ico" />
        </div>

        <div className="rc-acciones">
          <button type="button" className="rc-btn-cancelar" disabled={ocupado} onClick={() => onCancelar()}>
            Cancelar
          </button>
          <button type="button" className="rc-btn-subir" disabled={ocupado} onClick={() => void confirmar()}>
            {ocupado ? (
              <>
                <span className="rc-mini-spinner" aria-hidden="true" /> Subiendo…
              </>
            ) : (
              "Subir foto"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
