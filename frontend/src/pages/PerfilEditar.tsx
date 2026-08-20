import "../css/PerfilEditar.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaArrowLeft, FaPencilAlt, FaSave, FaLock, FaUserTag } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import Breadcrumb from "../components/Breadcrumb";

type CampoAbierto = "nombres" | "correo" | "telefono" | "usuario" | null;

export default function PerfilEditar() {
  const navigate = useNavigate();
  const { refreshPerfil } = useAuth();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ mostrar: false, mensaje: "", tipo: "success" });

  const [usuario, setUsuario] = useState({
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    nick: "",
    fecha_registro: ""
  });

  const [campoAbierto, setCampoAbierto] = useState<CampoAbierto>(null);
  const [borrador, setBorrador] = useState({
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    nick: ""
  });
  const [pasoCorreo, setPasoCorreo] = useState<"form" | "codigo">("form");
  const [codigoCorreo, setCodigoCorreo] = useState("");
  const [passCorreo, setPassCorreo] = useState("");
  const [passTelefono, setPassTelefono] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown <= 0]);

  useEffect(() => {
    cargarPerfil();
  }, []);

  async function cargarPerfil() {
    try {
      const res = await axios.get("/api/auth/perfil", { withCredentials: true });
      const user = res.data.usuario;
      setUsuario({
        nombre: user.NOMBRE_USUARIO || "",
        apellido: user.APELLIDO_USUARIO || "",
        email: user.EMAIL || "",
        telefono: user.TELEFONO || "",
        nick: user.USUARIO || "",
        fecha_registro: user.FECHA_REGISTRO || ""
      });
      setBorrador({
        nombre: user.NOMBRE_USUARIO || "",
        apellido: user.APELLIDO_USUARIO || "",
        email: user.EMAIL || "",
        telefono: user.TELEFONO || "",
        nick: user.USUARIO || ""
      });
    } catch {
      mostrarToast("Error al cargar la información.", "error");
    }
  }

  function mostrarToast(mensaje: string, tipo: "success" | "error") {
    setToast({ mostrar: true, mensaje, tipo });
    setTimeout(() => setToast(prev => ({ ...prev, mostrar: false })), 3000);
  }

  function abrirCampo(campo: CampoAbierto) {
    setBorrador({ ...borrador, ...usuario });
    setCampoAbierto(campo);
    setPasoCorreo("form");
    setCodigoCorreo("");
    setPassCorreo("");
    setPassTelefono("");
  }

  function mensajeError(error: any, fallback: string) {
    return error?.response?.data?.message || fallback;
  }

  async function guardarNombres() {
    if (!borrador.nombre.trim()) return mostrarToast("El nombre es obligatorio.", "error");
    try {
      setLoading(true);
      await axios.put("/api/auth/perfil", {
        nombre: borrador.nombre.trim(),
        apellido: borrador.apellido.trim()
      }, { withCredentials: true });
      await refreshPerfil();
      await cargarPerfil();
      setCampoAbierto(null);
      mostrarToast("Nombres actualizados correctamente.", "success");
    } catch (error) {
      mostrarToast(mensajeError(error, "No se pudieron guardar los cambios."), "error");
    } finally {
      setLoading(false);
    }
  }

  async function enviarCodigoCorreo() {
    const correo = borrador.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return mostrarToast("Escribe un correo electrónico válido.", "error");
    }
    if (!passCorreo) {
      return mostrarToast("Escribe tu contraseña actual para confirmar.", "error");
    }
    try {
      setLoading(true);
      await axios.post("/api/auth/cambiar-email", { email: correo, password: passCorreo }, { withCredentials: true });
      setPasoCorreo("codigo");
      setCodigoCorreo("");
      setCooldown(100);
      mostrarToast(`Te enviamos un código a ${correo}.`, "success");
    } catch (error) {
      mostrarToast(mensajeError(error, "No se pudo enviar el código."), "error");
    } finally {
      setLoading(false);
    }
  }

  async function confirmarCorreo() {
    if (!/^\d{6}$/.test(codigoCorreo.trim())) {
      return mostrarToast("Escribe el código de 6 dígitos.", "error");
    }
    try {
      setLoading(true);
      await axios.post("/api/auth/confirmar-cambio-email", {
        email: borrador.email.trim(),
        codigo: codigoCorreo.trim()
      }, { withCredentials: true });
      await refreshPerfil();
      await cargarPerfil();
      setCampoAbierto(null);
      setPasoCorreo("form");
      setPassCorreo("");
      setCodigoCorreo("");
      mostrarToast("Correo actualizado correctamente.", "success");
    } catch (error) {
      mostrarToast(mensajeError(error, "El código no es válido."), "error");
    } finally {
      setLoading(false);
    }
  }

  async function guardarTelefono() {
    const telefono = borrador.telefono.trim();
    if (!/^\d{7,10}$/.test(telefono)) {
      return mostrarToast("El teléfono debe tener entre 7 y 10 dígitos.", "error");
    }
    if (!passTelefono) {
      return mostrarToast("Escribe tu contraseña actual para confirmar.", "error");
    }
    try {
      setLoading(true);
      await axios.post("/api/auth/verificar-password", { password: passTelefono }, { withCredentials: true });
      await axios.put("/api/auth/perfil", { telefono }, { withCredentials: true });
      await refreshPerfil();
      await cargarPerfil();
      setCampoAbierto(null);
      setPassTelefono("");
      mostrarToast("Teléfono actualizado correctamente.", "success");
    } catch (error) {
      mostrarToast(mensajeError(error, "No se pudo actualizar el teléfono."), "error");
    } finally {
      setLoading(false);
    }
  }

  async function guardarUsuario() {
    const nick = borrador.nick.trim();
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(nick)) {
      return mostrarToast("El nombre de usuario debe tener entre 3 y 20 caracteres sin espacios (letras, números, . _ -).", "error");
    }
    try {
      setLoading(true);
      await axios.put("/api/auth/perfil", { usuario: nick }, { withCredentials: true });
      await refreshPerfil();
      await cargarPerfil();
      setCampoAbierto(null);
      mostrarToast("Nombre de usuario actualizado correctamente.", "success");
    } catch (error) {
      mostrarToast(mensajeError(error, "No se pudo actualizar el nombre de usuario."), "error");
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

        <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Editar perfil" }]} />

        <h1>Mi Perfil</h1>

        <div className="campos-lista">
          {/* NOMBRES */}
          <div className={`campo-fila ${campoAbierto === "nombres" ? "abierto" : ""}`}>
            <div
              className="campo-fila-principal"
              onClick={() => campoAbierto !== "nombres" && abrirCampo("nombres")}
            >
              <div className="campo-info">
                <span className="campo-label">Nombres</span>
                <span className="campo-valor">
                  {[usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || "—"}
                </span>
              </div>
              <FaPencilAlt className="campo-icono" />
            </div>
            {campoAbierto === "nombres" && (
              <div className="campo-editor">
                <div className="campo-editor-grid">
                  <div className="input-group">
                    <label>Nombre</label>
                    <input
                      type="text"
                      value={borrador.nombre}
                      onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                      placeholder="Tu nombre"
                    />
                  </div>
                  <div className="input-group">
                    <label>Apellido</label>
                    <input
                      type="text"
                      value={borrador.apellido}
                      onChange={(e) => setBorrador({ ...borrador, apellido: e.target.value })}
                      placeholder="Tus apellidos"
                    />
                  </div>
                </div>
                <div className="campo-editor-acciones">
                  <button className="btn-cancelar-campo" onClick={() => setCampoAbierto(null)} disabled={loading}>
                    Cancelar
                  </button>
                  <button className="btn-guardar-campo" onClick={guardarNombres} disabled={loading}>
                    <FaSave /> {loading ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* CORREO */}
          <div className={`campo-fila ${campoAbierto === "correo" ? "abierto" : ""}`}>
            <div
              className="campo-fila-principal"
              onClick={() => campoAbierto !== "correo" && abrirCampo("correo")}
            >
              <div className="campo-info">
                <span className="campo-label">Correo electrónico</span>
                <span className="campo-valor">{usuario.email || "—"}</span>
              </div>
              <FaPencilAlt className="campo-icono" />
            </div>
            {campoAbierto === "correo" && (
              <div className="campo-editor">
                {pasoCorreo === "form" ? (
                  <>
                    <div className="input-group">
                      <label>Correo nuevo</label>
                      <input
                        type="email"
                        value={borrador.email}
                        onChange={(e) => setBorrador({ ...borrador, email: e.target.value })}
                        placeholder="tucorreo@ejemplo.com"
                      />
                    </div>
                    <div className="input-group">
                      <label>Contraseña actual</label>
                      <input
                        type="password"
                        value={passCorreo}
                        onChange={(e) => setPassCorreo(e.target.value)}
                        placeholder="••••••••"
                      />
                    </div>
                    <p className="campo-hint">
                      Verificaremos tu contraseña y enviaremos un código al correo nuevo para confirmar el cambio.
                    </p>
                    <div className="campo-editor-acciones">
                      <button className="btn-cancelar-campo" onClick={() => setCampoAbierto(null)} disabled={loading}>
                        Cancelar
                      </button>
                      <button className="btn-guardar-campo" onClick={enviarCodigoCorreo} disabled={loading}>
                        <FaSave /> {loading ? "Enviando..." : "Enviar código"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="campo-exito">
                      Te enviamos un código de 6 dígitos a <strong>{borrador.email.trim()}</strong>.
                    </p>
                    <div className="input-group">
                      <label>Código de verificación</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={codigoCorreo}
                        onChange={(e) => setCodigoCorreo(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                      />
                    </div>
                    <p className="campo-hint">El código expira en 15 minutos.</p>
                    <div className="campo-editor-acciones">
                      <button className="btn-cancelar-campo" onClick={() => setPasoCorreo("form")} disabled={loading}>
                        Volver
                      </button>
                      <button className="btn-guardar-campo" onClick={confirmarCorreo} disabled={loading}>
                        <FaSave /> {loading ? "Confirmando..." : "Confirmar cambio"}
                      </button>
                    </div>
                    <button
                      className="link-reenviar"
                      onClick={enviarCodigoCorreo}
                      disabled={cooldown > 0 || loading}
                    >
                      {cooldown > 0 ? `Reenviar código en ${cooldown}s` : "Reenviar código"}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* TELÉFONO */}
          <div className={`campo-fila ${campoAbierto === "telefono" ? "abierto" : ""}`}>
            <div
              className="campo-fila-principal"
              onClick={() => campoAbierto !== "telefono" && abrirCampo("telefono")}
            >
              <div className="campo-info">
                <span className="campo-label">Teléfono</span>
                <span className="campo-valor">{usuario.telefono || "—"}</span>
              </div>
              <FaPencilAlt className="campo-icono" />
            </div>
            {campoAbierto === "telefono" && (
              <div className="campo-editor">
                <div className="input-group">
                  <label>Teléfono</label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={borrador.telefono}
                    onChange={(e) => setBorrador({ ...borrador, telefono: e.target.value.replace(/\D/g, "") })}
                    placeholder="3001234567"
                  />
                </div>
                <div className="input-group">
                  <label>Contraseña actual</label>
                  <input
                    type="password"
                    value={passTelefono}
                    onChange={(e) => setPassTelefono(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <p className="campo-hint">Confirma con tu contraseña actual para guardar el cambio.</p>
                <div className="campo-editor-acciones">
                  <button className="btn-cancelar-campo" onClick={() => setCampoAbierto(null)} disabled={loading}>
                    Cancelar
                  </button>
                  <button className="btn-guardar-campo" onClick={guardarTelefono} disabled={loading}>
                    <FaSave /> {loading ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* NOMBRE DE USUARIO */}
          <div className={`campo-fila ${campoAbierto === "usuario" ? "abierto" : ""}`}>
            <div
              className="campo-fila-principal"
              onClick={() => campoAbierto !== "usuario" && abrirCampo("usuario")}
            >
              <div className="campo-info">
                <span className="campo-label">
                  <FaUserTag className="campo-label-icono" /> Nombre de usuario
                </span>
                <span className="campo-valor">@{usuario.nick || "—"}</span>
                <span className="campo-hint">Se te asignó automáticamente al registrarte. Puedes cambiarlo.</span>
              </div>
              <FaPencilAlt className="campo-icono" />
            </div>
            {campoAbierto === "usuario" && (
              <div className="campo-editor">
                <div className="input-group">
                  <label>Nombre de usuario</label>
                  <input
                    type="text"
                    value={borrador.nick}
                    onChange={(e) => setBorrador({ ...borrador, nick: e.target.value.replace(/\s/g, "").slice(0, 20) })}
                    placeholder="tu.usuario"
                    maxLength={20}
                  />
                </div>
                <p className="campo-hint">
                  Entre 3 y 20 caracteres: letras, números y . _ - (sin espacios). Debe ser único.
                </p>
                <div className="campo-editor-acciones">
                  <button className="btn-cancelar-campo" onClick={() => setCampoAbierto(null)} disabled={loading}>
                    Cancelar
                  </button>
                  <button className="btn-guardar-campo" onClick={guardarUsuario} disabled={loading}>
                    <FaSave /> {loading ? "Guardando..." : "Guardar"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Información de la cuenta */}
        <div className="seccion-cuenta">
          <h2>Información de tu cuenta</h2>
          <div className="cuenta-grid">
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