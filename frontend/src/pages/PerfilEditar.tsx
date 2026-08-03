import "../css/PerfilEditar.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaArrowLeft, FaCamera, FaEdit, FaSave, FaLock, FaImage } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";

export default function PerfilEditar() {
  const navigate = useNavigate();
  const { refreshPerfil } = useAuth();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ mostrar: false, mensaje: "", tipo: "success" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [usuario, setUsuario] = useState({
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    tipo_documento: "CC",
    numero_documento: "",
    foto_url: "",
    fecha_registro: ""
  });

  const [editandoInfo, setEditandoInfo] = useState(false);

  useEffect(() => { cargarPerfil(); }, []);

  async function cargarPerfil() {
    try {
      const res = await axios.get("/api/auth/perfil", { withCredentials: true });
      const user = res.data.usuario;
      setUsuario({
        nombre: user.NOMBRE_USUARIO || "",
        apellido: user.APELLIDO_USUARIO || "",
        email: user.EMAIL || "",
        telefono: user.TELEFONO || "",
        tipo_documento: user.TIPO_DOCUMENTO || "CC",
        numero_documento: user.NUMERO_DOCUMENTO || "",
        foto_url: user.FOTO_URL || "",
        fecha_registro: user.FECHA_REGISTRO || ""
      });
    } catch {
      mostrarToast("Error al cargar la información.", "error");
    }
  }

  function mostrarToast(mensaje: string, tipo: "success" | "error") {
    setToast({ mostrar: true, mensaje, tipo });
    setTimeout(() => setToast(prev => ({ ...prev, mostrar: false })), 3000);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setUsuario({ ...usuario, [e.target.name]: e.target.value });
  }

  async function subirFotoDesdeNavegador(file: File) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      return mostrarToast("Formato no válido. Usa jpg, png, webp o gif.", "error");
    }
    if (file.size > 5 * 1024 * 1024) {
      return mostrarToast("La foto debe pesar menos de 5 MB.", "error");
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setLoading(true);
        const res = await axios.post("/api/auth/foto", { foto: reader.result }, { withCredentials: true });
        if (res.data.ok) {
          setUsuario(prev => ({ ...prev, foto_url: res.data.url }));
          await axios.put("/api/auth/perfil", { foto_url: res.data.url }, { withCredentials: true });
          await refreshPerfil();
          mostrarToast("Foto subida y actualizada correctamente.", "success");
        }
      } catch {
        mostrarToast("No se pudo subir la foto.", "error");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  function iniciarEdicion() {
    setEditandoInfo(true);
  }

  function cancelarEdicion() {
    cargarPerfil();
    setEditandoInfo(false);
  }

  async function guardarInfo() {
    if (!/^\d{7,10}$/.test(usuario.telefono)) {
      return mostrarToast("El teléfono debe tener entre 7 y 10 dígitos.", "error");
    }

    try {
      setLoading(true);
      await axios.put("/api/auth/perfil", {
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        usuario: usuario.nombre,
        telefono: usuario.telefono,
        tipo_documento: usuario.tipo_documento,
        numero_documento: usuario.numero_documento,
      }, { withCredentials: true });
      await refreshPerfil();
      setEditandoInfo(false);
      mostrarToast("Información actualizada correctamente.", "success");
    } catch {
      mostrarToast("No se pudieron guardar los cambios.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="editar-perfil-page">
      {toast.mostrar && (
        <div className={`toast-editar ${toast.tipo}`}>
          {toast.tipo === "success" ? "✅" : "❌"} {toast.mensaje}
        </div>
      )}

      <div className="editar-card">
        <button className="btn-volver" onClick={() => navigate("/perfil")}>
          <FaArrowLeft /> Volver
        </button>

        <h1>Mi Perfil</h1>

        {/* Sección de foto - siempre editable */}
        <div className="seccion-foto">
          <div className="foto-section">
            <div className="foto-container">
              <img
                src={usuario.foto_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
                alt="Perfil"
                className="foto-perfil"
              />
              <div className="overlay-foto">
                <FaCamera />
                <span>Foto</span>
              </div>
            </div>
            <div className="foto-url-input">
              <label>Foto de perfil</label>
              <button
                className="btn-subir-navegador"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <FaImage /> {loading ? "Subiendo..." : "Subir foto desde el navegador"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) subirFotoDesdeNavegador(file);
                  e.target.value = "";
                }}
              />
              <small style={{ color: "#64748b", fontSize: "0.75rem" }}>
                Formatos: jpg, png, webp o gif. Máximo 5 MB.
              </small>
            </div>
          </div>
        </div>

        {/* Sección de información - bloqueada por defecto */}
        <div className="seccion-info">
          <div className="seccion-info-header">
            <h2>Información personal</h2>
            {!editandoInfo ? (
              <button className="btn-editar-info" onClick={iniciarEdicion}>
                <FaEdit /> Editar
              </button>
            ) : (
              <span className="editando-badge"><FaEdit /> Editando...</span>
            )}
          </div>

          <div className="form-grid">
            <div className="input-group">
              <label>Nombre</label>
              <input type="text" name="nombre" value={usuario.nombre} onChange={handleChange} disabled={!editandoInfo} />
            </div>

            <div className="input-group">
              <label>Apellido</label>
              <input type="text" name="apellido" value={usuario.apellido} onChange={handleChange} disabled={!editandoInfo} />
            </div>

            <div className="input-group">
              <label>Correo electrónico</label>
              <input type="email" value={usuario.email} disabled />
            </div>

            <div className="input-group">
              <label>Teléfono</label>
              <input type="tel" name="telefono" value={usuario.telefono} onChange={handleChange} maxLength={10} disabled={!editandoInfo} />
            </div>

            <div className="input-group">
              <label>Tipo de documento</label>
              <select name="tipo_documento" value={usuario.tipo_documento} onChange={handleChange} disabled={!editandoInfo}>
                <option value="CC">Cédula de Ciudadanía</option>
                <option value="CE">Cédula de Extranjería</option>
                <option value="TI">Tarjeta de Identidad</option>
                <option value="PAS">Pasaporte</option>
              </select>
            </div>

            <div className="input-group">
              <label>Número de documento</label>
              <input type="text" name="numero_documento" value={usuario.numero_documento} onChange={handleChange} disabled={!editandoInfo} />
            </div>
          </div>

          {editandoInfo && (
            <div className="edit-actions">
              <button className="btn-cancelar-info" onClick={cancelarEdicion} disabled={loading}>
                Cancelar
              </button>
              <button className="btn-guardar-info" disabled={loading} onClick={guardarInfo}>
                <FaSave /> {loading ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          )}

          {!editandoInfo && (
            <div className="info-bloqueada-msg">
              <FaLock /> Los campos están bloqueados. Presiona "Editar" para modificarlos.
            </div>
          )}
        </div>

        {/* Sección de información de la cuenta */}
        <div className="seccion-cuenta">
          <h2>Información de tu cuenta</h2>
          <div className="cuenta-grid">
            <div className="cuenta-item">
              <span className="cuenta-label">Correo electrónico</span>
              <span className="cuenta-valor">{usuario.email || "—"}</span>
            </div>
            <div className="cuenta-item">
              <span className="cuenta-label">Miembro desde</span>
              <span className="cuenta-valor">
                {usuario.fecha_registro
                  ? new Date(usuario.fecha_registro).toLocaleDateString("es-CO", {
                      weekday: "long", year: "numeric", month: "long", day: "numeric"
                    })
                  : "—"}
              </span>
            </div>
            <div className="cuenta-item">
              <span className="cuenta-label">Documento</span>
              <span className="cuenta-valor">
                {usuario.tipo_documento
                  ? `${usuario.tipo_documento}${usuario.numero_documento ? ` · ${usuario.numero_documento}` : ""}`
                  : "Sin registrar"}
              </span>
            </div>
            <div className="cuenta-item">
              <span className="cuenta-label">Contraseña</span>
              <button className="btn-cambiar-pass" onClick={() => navigate("/perfil/seguridad")}>
                <FaLock /> Cambiar contraseña
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
