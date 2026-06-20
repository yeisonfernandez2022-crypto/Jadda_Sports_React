import "../css/Perfil.css";
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  FaUser, FaLock, FaBox, FaMapMarkerAlt, FaHeart,
  FaCalendarAlt, FaPhone, FaIdCard, FaTrophy
} from "react-icons/fa";

export default function Perfil() {
  const navigate = useNavigate();
  const { usuarioLogueado } = useAuth();

  const [usuario, setUsuario] = useState({
    nombre: "", apellido: "", email: "",
    telefono: "", tipo_documento: "",
    numero_documento: "", foto_url: "",
    fecha_registro: ""
  });

  useEffect(() => {
    if (!usuarioLogueado) { navigate("/"); return; }
    cargarPerfil();
  }, [usuarioLogueado]);

  async function cargarPerfil() {
    try {
      const res = await axios.get("http://localhost:5000/api/auth/perfil", { withCredentials: true });
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

  const docLabels: Record<string, string> = {
    CC: "Cédula de Ciudadanía", CE: "Cédula de Extranjería",
    TI: "Tarjeta de Identidad", PAS: "Pasaporte"
  };

  return (
    <div className="perfil-page">
      <div className="perfil-hero">
        <img
          src={usuario.foto_url || "https://cdn-icons-png.flaticon.com/512/149/149071.png"}
          alt="Perfil" className="perfil-avatar"
        />
        <div className="perfil-info">
          <h1>{usuario.nombre} {usuario.apellido}</h1>
          <p className="perfil-email">{usuario.email}</p>
          <div className="perfil-badges">
            {usuario.telefono && (
              <span className="badge-perfil"><FaPhone /> {usuario.telefono}</span>
            )}
            {usuario.fecha_registro && (
              <span className="badge-perfil">
                <FaCalendarAlt /> Miembro desde {new Date(usuario.fecha_registro).toLocaleDateString("es-CO", { year: "numeric", month: "long" })}
              </span>
            )}
          </div>
          {usuario.tipo_documento && usuario.numero_documento && (
            <p className="perfil-doc">
              <FaIdCard /> {docLabels[usuario.tipo_documento] || usuario.tipo_documento}: {usuario.numero_documento}
            </p>
          )}
          <span className="miembro-jadda"><FaTrophy /> Miembro JADDA Sports</span>
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
      </div>
    </div>
  );
}
