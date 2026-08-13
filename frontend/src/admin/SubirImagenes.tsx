import { useRef, useState } from "react";
import Swal from "sweetalert2";
import { FaCloudUploadAlt, FaLink, FaChevronLeft, FaChevronRight } from "react-icons/fa";

interface Props {
  urls: string[];
  onChange: (urls: string[]) => void;
  idProducto?: number;
}

const leerComoDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });

const SubirImagenes = ({ urls, onChange, idProducto }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [urlPegada, setUrlPegada] = useState("");
  const [error, setError] = useState("");

  const subirArchivos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setSubiendo(true);
    setError("");
    try {
      const imagenes: { nombre: string; data: string }[] = [];
      for (const file of Array.from(files)) {
        if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
          setError(`"${file.name}" no es una imagen válida (jpg, png, webp, gif)`);
          continue;
        }
        imagenes.push({ nombre: file.name, data: await leerComoDataURL(file) });
      }
      if (imagenes.length === 0) return;

      const res = await fetch("/api/productos/imagenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagenes, ...(idProducto ? { idProducto } : {}) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al subir las imágenes");

      onChange([...urls, ...data.urls].slice(0, 8));
    } catch (err: any) {
      setError(err.message || "Error al subir las imágenes");
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const agregarUrlPegada = () => {
    const url = urlPegada.trim();
    if (!url) return;
    if (!/^(https?:\/\/|\/)/.test(url)) {
      setError("La URL debe empezar con http(s):// o /");
      return;
    }
    onChange([...urls, url].slice(0, 8));
    setUrlPegada("");
    setError("");
  };

  const boton = {
    display: "flex" as const,
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    border: "2px dashed #ccc",
    borderRadius: "10px",
    background: "#fafafa",
    cursor: "pointer",
    fontSize: "0.9rem",
    color: "#555",
    width: "100%",
  };

  const mover = (idx: number, dir: number) => {
    const destino = idx + dir;
    if (destino < 0 || destino >= urls.length) return;
    const next = [...urls];
    [next[idx], next[destino]] = [next[destino], next[idx]];
    onChange(next);
  };

  const quitar = (idx: number) => {
    Swal.fire({
      title: "¿Quitar esta imagen?",
      text: "La imagen se quitará del producto. Puedes volver a subirla después.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Quitar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33",
      reverseButtons: true,
    }).then((r) => {
      if (r.isConfirmed) onChange(urls.filter((_, i) => i !== idx));
    });
  };

  return (
    <div>
      {urls.length > 0 && (
        <div className="si-items">
          {urls.map((url, idx) => (
            <div key={`${url}-${idx}`} className="si-item">
              <img src={url} alt={`Imagen ${idx + 1}`} className="si-thumb" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              <span className={`si-badge ${idx === 0 ? "portada" : ""}`}>{idx === 0 ? "Portada" : idx + 1}</span>
              {urls.length > 1 && (
                <div className="si-arrows">
                  <button type="button" className="si-arrow" disabled={idx === 0} onClick={() => mover(idx, -1)} title="Mover antes">
                    <FaChevronLeft />
                  </button>
                  <button type="button" className="si-arrow" disabled={idx === urls.length - 1} onClick={() => mover(idx, 1)} title="Mover después">
                    <FaChevronRight />
                  </button>
                </div>
              )}
              <button type="button" className="si-remove" onClick={() => quitar(idx)} title="Quitar imagen">✕</button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        style={{ display: "none" }}
        onChange={(e) => subirArchivos(e.target.files)}
      />
      <button
        type="button"
        style={{ ...boton, opacity: subiendo ? 0.6 : 1, cursor: subiendo ? "wait" : "pointer" }}
        onClick={() => fileRef.current?.click()}
        disabled={subiendo}
      >
        {subiendo ? (
          <span className="spinner-border spinner-border-sm text-secondary" />
        ) : (
          <FaCloudUploadAlt size={18} />
        )}
        {subiendo ? "Subiendo imágenes..." : "Subir imágenes del computador"}
      </button>

      <div style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "center" }}>
        <FaLink style={{ color: "#999", flexShrink: 0 }} />
        <input
          type="text"
          className="admin-input"
          style={{ marginBottom: 0 }}
          value={urlPegada}
          onChange={(e) => setUrlPegada(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarUrlPegada(); } }}
          placeholder="o pega una URL de imagen https://..."
        />
        <button type="button" className="btn btn-outline-secondary btn-sm" style={{ flexShrink: 0 }} onClick={agregarUrlPegada}>
          Agregar
        </button>
      </div>

      {error && <small style={{ color: "#d33", display: "block", marginTop: "6px" }}>{error}</small>}
      {urls.length > 0 && (
        <small className="si-hint">Usa las flechas para ordenar: la <b>Portada</b> (roja) es la primera imagen — es la que ven los clientes en catálogo y listados.</small>
      )}
    </div>
  );
};

export default SubirImagenes;
