import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import AdminNavbar from "./AdminNavbar";
import AdminFooter from "./AdminFooter";
import VendedorNavbar from "../vendedor/VendedorNavbar";
import Breadcrumb from "../components/Breadcrumb";
import { useAuth } from "../context/AuthContext";
import "../css/adminDashboard.css";
import { FaArrowLeft, FaCamera, FaLock, FaEye, FaEyeSlash, FaSave } from "react-icons/fa";
import React from "react";

interface UsuarioPerfil {
  ID_USUARIO: number;
  NOMBRE_USUARIO: string;
  APELLIDO_USUARIO: string | null;
  USUARIO: string;
  TELEFONO: string | null;
  TIPO_DOCUMENTO: string | null;
  NUMERO_DOCUMENTO: string | null;
  FOTO_URL: string | null;
}

// Detectar si estamos en iframe (modal)
const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const AdminConfiguracion = () => {
  const navigate = useNavigate();
  const { esVendedor } = useAuth();
  const [usuario, setUsuario] = useState<UsuarioPerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [mostrarActual, setMostrarActual] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inIframe = isInIframe();

  const fetchUsuario = async () => {
    try {
      const res = await fetch("/api/auth/perfil", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUsuario(data.usuario || data);
      }
    } catch {
      console.error("Error al cargar perfil");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsuario(); }, []);

  const guardarPerfil = async () => {
    if (!usuario) return;
    if (!usuario.NOMBRE_USUARIO?.trim()) {
      Swal.fire("Campo obligatorio", "El nombre es obligatorio", "warning");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/auth/perfil", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          nombre: usuario.NOMBRE_USUARIO.trim(),
          apellido: usuario.APELLIDO_USUARIO?.trim() || null,
          usuario: usuario.USUARIO.trim(),
          telefono: usuario.TELEFONO?.trim() || null,
          tipo_documento: usuario.TIPO_DOCUMENTO || null,
          numero_documento: usuario.NUMERO_DOCUMENTO || null,
          foto_url: usuario.FOTO_URL,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        Swal.fire({ icon: "success", title: data.message || "Perfil guardado", timer: 1500, showConfirmButton: false });
        fetchUsuario();
      } else {
        Swal.fire({ icon: "warning", title: data.message || "No se pudo guardar" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al guardar el perfil" });
    } finally {
      setGuardando(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(jpeg|png|webp|gif)$/)) {
      Swal.fire("Formato no válido", "Solo se permiten imágenes JPG, PNG, WebP o GIF", "warning");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      Swal.fire("Archivo muy grande", "La imagen no debe superar 10 MB", "warning");
      return;
    }

    setSubiendoFoto(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/auth/foto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ foto: base64 }),
      });
      const data = await res.json();
      if (data.ok && data.url) {
        setUsuario((prev) => (prev ? { ...prev, FOTO_URL: data.url } : null));
        Swal.fire({ icon: "success", title: "Foto actualizada", timer: 1500, showConfirmButton: false });
      } else {
        Swal.fire({ icon: "warning", title: data.message || "No se pudo subir la foto" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al subir la foto" });
    } finally {
      setSubiendoFoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const abrirSelectorFoto = () => {
    fileInputRef.current?.click();
  };

  const cambiarPassword = async () => {
    if (!passwordActual || !passwordNueva || !passwordConfirmar) {
      Swal.fire("Campos obligatorios", "Completa todos los campos", "warning");
      return;
    }
    if (passwordNueva.length < 8) {
      Swal.fire("Contraseña débil", "La nueva contraseña debe tener al menos 8 caracteres", "warning");
      return;
    }
    if (passwordNueva !== passwordConfirmar) {
      Swal.fire("No coinciden", "La nueva contraseña y la confirmación no son iguales", "warning");
      return;
    }
    setCambiandoPassword(true);
    try {
      const res = await fetch("/api/auth/cambiar-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password_actual: passwordActual, password_nueva: passwordNueva }),
      });
      const data = await res.json();
      if (data.ok) {
        Swal.fire({ icon: "success", title: data.msg || "Contraseña actualizada", timer: 1500, showConfirmButton: false });
        setShowPasswordModal(false);
        setPasswordActual("");
        setPasswordNueva("");
        setPasswordConfirmar("");
        setMostrarActual(false);
        setMostrarNueva(false);
        setMostrarConfirmar(false);
      } else {
        Swal.fire({ icon: "warning", title: data.msg || "No se pudo cambiar la contraseña" });
      }
    } catch {
      Swal.fire({ icon: "error", title: "Error al cambiar la contraseña" });
    } finally {
      setCambiandoPassword(false);
    }
  };

  const toggleMostrar = (campo: "actual" | "nueva" | "confirmar") => {
    if (campo === "actual") setMostrarActual((v) => !v);
    else if (campo === "nueva") setMostrarNueva((v) => !v);
    else setMostrarConfirmar((v) => !v);
  };

  return (
    <React.Fragment>
      {!inIframe && (esVendedor ? <VendedorNavbar /> : <AdminNavbar />)}
      <div className={inIframe ? "p-3" : "admin-page"}>
        <div className={inIframe ? "p-3" : "admin-content"}>
          <div className="container">
            <div className="au-header-col">
            <div className="w-100 d-flex justify-content-between align-items-start">
              <div>
                {!inIframe && (
                  <div>
                    <button
                      className="admin-volver"
                      onClick={() => navigate(esVendedor ? "/vendedor" : "/admin")}
                    >
                      <FaArrowLeft /> {esVendedor ? "Volver al Panel de vendedor" : "Volver al inicio"}
                    </button>
                    <div className="mt-2">
                      <Breadcrumb items={esVendedor ? [{ label: "Mi tienda", to: "/vendedor" }, { label: "Configuración" }] : [{ label: "Dashboard", to: "/admin" }, { label: "Configuración" }]} />
                    </div>
                  </div>
                )}
                <div className="au-titulos">
                  <h1>Configuración</h1>
                  <p>Gestiona tu información de perfil, foto y contraseña</p>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-5 text-muted">Cargando configuración...</div>
          ) : usuario ? (
            <div className="row g-4">
              <div className="col-12 col-lg-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body text-center p-4">
                    <div className="position-relative d-inline-block mb-3">
                      <img
                        src={usuario.FOTO_URL || `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.NOMBRE_USUARIO + " " + (usuario.APELLIDO_USUARIO || ""))}&background=0f172a&color=fff&size=128`}
                        alt="Foto de perfil"
                        className="rounded-circle border border-3 border-white shadow"
                        style={{ width: "128px", height: "128px", objectFit: "cover" }}
                      />
                      <button
                        className="btn btn-sm btn-primary position-absolute bottom-0 end-0 m-0 rounded-circle shadow"
                        style={{ transform: "translate(25%, 25%)" }}
                        onClick={abrirSelectorFoto}
                        disabled={subiendoFoto}
                        title="Cambiar foto"
                      >
                        <FaCamera className="fa-xs" />
                      </button>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        style={{ display: "none" }}
                      />
                    </div>
                    <h5 className="mb-1">{usuario.NOMBRE_USUARIO} {usuario.APELLIDO_USUARIO || ""}</h5>
                    <p className="text-muted small mb-0">@{usuario.USUARIO}</p>
                    <div className="mt-3">
                      <button className="btn btn-outline-primary btn-sm w-100" onClick={guardarPerfil} disabled={guardando}>
                        <FaSave className="me-1" /> {guardando ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-12 col-lg-8">
                <div className="card border-0 shadow-sm">
                  <div className="card-header bg-transparent border-bottom">
                    <h5 className="mb-0">Información personal</h5>
                  </div>
                  <div className="card-body">
                    <div className="row g-3">
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold small">Nombre *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={usuario.NOMBRE_USUARIO}
                          onChange={(e) => setUsuario({ ...usuario, NOMBRE_USUARIO: e.target.value })}
                          placeholder="Tu nombre"
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold small">Apellido</label>
                        <input
                          type="text"
                          className="form-control"
                          value={usuario.APELLIDO_USUARIO || ""}
                          onChange={(e) => setUsuario({ ...usuario, APELLIDO_USUARIO: e.target.value })}
                          placeholder="Tu apellido"
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold small">Nombre de usuario *</label>
                        <input
                          type="text"
                          className="form-control"
                          value={usuario.USUARIO}
                          onChange={(e) => setUsuario({ ...usuario, USUARIO: e.target.value })}
                          placeholder="usuario"
                          maxLength={20}
                        />
                        <div className="form-text">Solo letras, números, punto, guion y guion bajo (3-20 caracteres)</div>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold small">Teléfono</label>
                        <input
                          type="text"
                          className="form-control"
                          value={usuario.TELEFONO || ""}
                          onChange={(e) => setUsuario({ ...usuario, TELEFONO: e.target.value })}
                          placeholder="3001234567"
                          maxLength={10}
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold small">Tipo de documento</label>
                        <select
                          className="form-select"
                          value={usuario.TIPO_DOCUMENTO || ""}
                          onChange={(e) => setUsuario({ ...usuario, TIPO_DOCUMENTO: e.target.value })}
                        >
                          <option value="">Selecciona...</option>
                          <option value="CC">Cédula de ciudadanía</option>
                          <option value="TI">Tarjeta de identidad</option>
                          <option value="CE">Cédula de extranjería</option>
                          <option value="NIT">NIT</option>
                          <option value="PAS">Pasaporte</option>
                        </select>
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label fw-bold small">Número de documento</label>
                        <input
                          type="text"
                          className="form-control"
                          value={usuario.NUMERO_DOCUMENTO || ""}
                          onChange={(e) => setUsuario({ ...usuario, NUMERO_DOCUMENTO: e.target.value })}
                          placeholder="123456789"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card border-0 shadow-sm mt-4">
                  <div className="card-header bg-transparent border-bottom d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Seguridad</h5>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => setShowPasswordModal(true)}
                    >
                      <FaLock className="me-1" /> Cambiar contraseña
                    </button>
                  </div>
                  <div className="card-body">
                    <p className="text-muted small">
                      Tu contraseña se usa para iniciar sesión. Asegúrate de usar una contraseña segura y única.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-5 text-muted">No se pudo cargar el perfil</div>
          )}
        </div>
      </div>
    </div>

      {showPasswordModal && (
        <div className="evidencia-overlay" onClick={() => setShowPasswordModal(false)}>
          <div className="au-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <button className="au-modal-x" onClick={() => setShowPasswordModal(false)}>✕</button>
            <div className="au-modal-hero">
              <div className="au-modal-avatar"><FaLock /></div>
              <div className="au-modal-hero-info">
                <h2>Cambiar contraseña</h2>
                <p className="au-modal-usuario">Seguridad de tu cuenta{esVendedor ? " de vendedor" : " de administrador"}</p>
              </div>
            </div>
            <div className="au-modal-body" style={{ paddingTop: 18 }}>
              <div className="mb-3">
                <label className="form-label fw-bold small">Contraseña actual *</label>
                <div className="input-group">
                  <input
                    type={mostrarActual ? "text" : "password"}
                    className="form-control"
                    value={passwordActual}
                    onChange={(e) => setPasswordActual(e.target.value)}
                    placeholder="Tu contraseña actual"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => toggleMostrar("actual")}
                    tabIndex={-1}
                  >
                    {mostrarActual ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold small">Nueva contraseña *</label>
                <div className="input-group">
                  <input
                    type={mostrarNueva ? "text" : "password"}
                    className="form-control"
                    value={passwordNueva}
                    onChange={(e) => setPasswordNueva(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => toggleMostrar("nueva")}
                    tabIndex={-1}
                  >
                    {mostrarNueva ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                <div className="form-text">Mínimo 8 caracteres</div>
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold small">Confirmar nueva contraseña *</label>
                <div className="input-group">
                  <input
                    type={mostrarConfirmar ? "text" : "password"}
                    className="form-control"
                    value={passwordConfirmar}
                    onChange={(e) => setPasswordConfirmar(e.target.value)}
                    placeholder="Repite la nueva contraseña"
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => toggleMostrar("confirmar")}
                    tabIndex={-1}
                  >
                    {mostrarConfirmar ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
            </div>
            <div className="evidencia-modal-footer" style={{ justifyContent: "flex-end" }}>
              <button type="button" className="btn-cancel" onClick={() => setShowPasswordModal(false)}>Cancelar</button>
              <button type="button" className="btn-save-admin" onClick={cambiarPassword} disabled={cambiandoPassword}>
                {cambiandoPassword ? "Actualizando..." : "Actualizar contraseña"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!inIframe && !esVendedor && <AdminFooter />}
    </React.Fragment>
  );
};

export default AdminConfiguracion;