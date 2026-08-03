import "../css/Perfil.css";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FaLock, FaBox, FaMapMarkerAlt, FaHeart,
  FaCalendarAlt, FaPhone, FaIdCard, FaTrophy, FaDumbbell,
  FaUser, FaCamera, FaEye, FaImage, FaTimes
} from "react-icons/fa";
import Swal from "sweetalert2";

export default function Perfil() {
  const navigate = useNavigate();
  const { usuarioLogueado, refreshPerfil } = useAuth();

  const [usuario, setUsuario] = useState({
    nombre: "", apellido: "", email: "",
    telefono: "", tipo_documento: "",
    numero_documento: "", foto_url: "",
    fecha_registro: ""
  });
  const [menuFotoAbierto, setMenuFotoAbierto] = useState(false);
  const [fotoModalAbierta, setFotoModalAbierta] = useState(false);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuFotoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!usuarioLogueado) { navigate("/"); return; }
    cargarPerfil();
  }, [usuarioLogueado]);

  useEffect(() => {
    const cerrarMenuFoto = (event: MouseEvent) => {
      if (menuFotoRef.current && !menuFotoRef.current.contains(event.target as Node)) {
        setMenuFotoAbierto(false);
      }
    };
    document.addEventListener("mousedown", cerrarMenuFoto);
    return () => document.removeEventListener("mousedown", cerrarMenuFoto);
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
        tipo_documento: user.TIPO_DOCUMENTO || "",
        numero_documento: user.NUMERO_DOCUMENTO || "",
        foto_url: user.FOTO_URL || "",
        fecha_registro: user.FECHA_REGISTRO || ""
      });
    } catch { console.error("Error al cargar perfil"); }
  }

  const fotoActual = usuario.foto_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png";

  async function subirFotoDesdeNavegador(file: File) {
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      return Swal.fire({
        icon: "error", title: "FORMATO NO VÁLIDO",
        text: "Elige una imagen jpg, png, webp o gif.",
        background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946",
      });
    }
    if (file.size > 5 * 1024 * 1024) {
      return Swal.fire({
        icon: "error", title: "IMAGEN MUY GRANDE",
        text: "La foto debe pesar menos de 5 MB.",
        background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946",
      });
    }

    const reader = new FileReader();
    reader.onload = async () => {
      setSubiendoFoto(true);
      try {
        const res = await axios.post("/api/auth/foto", { foto: reader.result }, { withCredentials: true });
        if (res.data.ok) {
          await axios.put("/api/auth/perfil", { foto_url: res.data.url }, { withCredentials: true });
          await refreshPerfil();
          await cargarPerfil();
          setMenuFotoAbierto(false);
          Swal.fire({
            icon: "success", title: "¡FOTO ACTUALIZADA!",
            text: "Tu foto de perfil se actualizó correctamente.",
            background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946",
          });
        }
      } catch {
        Swal.fire({
          icon: "error", title: "NO SE PUDO SUBIR",
          text: "Ocurrió un error al subir la foto. Intenta de nuevo.",
          background: "#1a1a1a", color: "#fff", confirmButtonColor: "#e63946",
        });
      } finally {
        setSubiendoFoto(false);
      }
    };
    reader.readAsDataURL(file);
  }

  const docLabels: Record<string, string> = {
    CC: "Cédula de Ciudadanía", CE: "Cédula de Extranjería",
    TI: "Tarjeta de Identidad", PAS: "Pasaporte"
  };

  const nombreInicial = (usuario.nombre || "U").trim().charAt(0).toUpperCase();

  return (
    <div className="perfil-page">
      <div className="perfil-hero">
        <div className="perfil-avatar-wrapper" ref={menuFotoRef}>
          <div className="perfil-avatar-borde" onClick={() => setMenuFotoAbierto(!menuFotoAbierto)}>
            {usuario.foto_url ? (
              <img src={fotoActual} alt="Perfil" className="perfil-avatar" />
            ) : (
              <div className="perfil-avatar-letra">{nombreInicial}</div>
            )}
            <div className="perfil-avatar-overlay">
              <FaCamera />
              <span>Foto</span>
            </div>
          </div>

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

          {menuFotoAbierto && (
            <div className="perfil-foto-menu">
              <button
                type="button"
                className="perfil-foto-menu-item"
                onClick={() => { setMenuFotoAbierto(false); setFotoModalAbierta(true); }}
              >
                <FaEye /> Ver foto
              </button>
              <button
                type="button"
                className="perfil-foto-menu-item"
                onClick={() => {
                  setMenuFotoAbierto(false);
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
                disabled={subiendoFoto}
              >
                <FaImage /> {subiendoFoto ? "Subiendo..." : "Cargar foto desde el navegador"}
              </button>
            </div>
          )}
        </div>

        <div className="perfil-info">
          <h1>{usuario.nombre} {usuario.apellido}</h1>
          <p className="perfil-email">{usuario.email}</p>
          <div className="perfil-badges">
            {usuario.telefono && (
              <span className="badge-perfil"><FaPhone /> {usuario.telefono}</span>
            )}
            {usuario.fecha_registro && (
              <span className="badge-perfil">
                <FaCalendarAlt /> Miembro desde {new Date(usuario.fecha_registro).toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </span>
            )}
          </div>
          {usuario.tipo_documento && usuario.numero_documento && (
            <p className="perfil-doc">
              <FaIdCard /> {docLabels[usuario.tipo_documento] || usuario.tipo_documento}: {usuario.numero_documento}
            </p>
          )}
        </div>
      </div>

      <div className="perfil-dashboard">
        <div className="dashboard-card" onClick={() => navigate('/PerfilEditar')}>
          <div className="card-icon"><FaUser /></div>
          <h3>Información de mi perfil</h3>
          <p>Edita tus datos personales y foto de perfil.</p>
        </div>

        <div className="dashboard-card" onClick={() => navigate("/perfil/seguridad")}>
          <div className="card-icon"><FaLock /></div>
          <h3>Seguridad</h3>
          <p>Cambia tu contraseña y gestiona el acceso.</p>
        </div>

        <div className="dashboard-card" onClick={() => navigate("/perfil/compras")}>
          <div className="card-icon"><FaBox /></div>
          <h3>Mis Compras</h3>
          <p>Consulta pedidos e historial de compras.</p>
        </div>

        <div className="dashboard-card" onClick={() => navigate("/perfil/direcciones")}>
          <div className="card-icon"><FaMapMarkerAlt /></div>
          <h3>Direcciones</h3>
          <p>Administra direcciones de envío.</p>
        </div>

        <div className="dashboard-card" onClick={() => navigate("/favoritos")}>
          <div className="card-icon"><FaHeart /></div>
          <h3>Favoritos</h3>
          <p>Consulta tus productos guardados.</p>
        </div>

        <div className="dashboard-card" onClick={() => navigate("/retos")}>
          <div className="card-icon"><FaTrophy /></div>
          <h3>Retos</h3>
          <p>Supera retos y gana descuentos.</p>
        </div>

        <div className="dashboard-card" onClick={() => navigate("/mis-planes")}>
          <div className="card-icon"><FaDumbbell /></div>
          <h3>Planes</h3>
          <p>Planes de entrenamiento personalizados.</p>
        </div>
      </div>

      {fotoModalAbierta && (
        <div className="perfil-foto-modal" onClick={() => setFotoModalAbierta(false)}>
          <div className="perfil-foto-modal-contenido" onClick={(e) => e.stopPropagation()}>
            <button className="perfil-foto-modal-cerrar" onClick={() => setFotoModalAbierta(false)}>
              <FaTimes />
            </button>
            <img src={fotoActual} alt="Foto de perfil" />
            <p>{usuario.nombre} {usuario.apellido}</p>
          </div>
        </div>
      )}
    </div>
  );
}
