import { useRef, useState } from "react";
import { FaCloudUploadAlt, FaLink } from "react-icons/fa";

interface Props {
  urls: string[];
  onChange: (urls: string[]) => void;
}

const leerComoDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });

const SubirImagenes = ({ urls, onChange }: Props) => {
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
        body: JSON.stringify({ imagenes }),
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

  const miniatura = {
    width: "72px",
    height: "72px",
    objectFit: "cover" as const,
    borderRadius: "8px",
    border: "1px solid #ddd",
  };

  const quitar = {
    position: "absolute" as const,
    top: "-8px",
    right: "-8px",
    width: "22px",
    height: "22px",
    borderRadius: "50%",
    border: "none",
    background: "#d33",
    color: "#fff",
    fontSize: "0.7rem",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "10px" }}>
        {urls.map((url, idx) => (
          <div key={`${url}-${idx}`} style={{ position: "relative" }}>
            <img src={url} alt={`Imagen ${idx + 1}`} style={miniatura} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
            <button type="button" style={quitar} onClick={() => onChange(urls.filter((_, i) => i !== idx))} title="Quitar imagen">✕</button>
          </div>
        ))}
      </div>

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
        <small className="text-secondary d-block mt-1">Primera imagen = portada del producto.</small>
      )}
    </div>
  );
};

export default SubirImagenes;
