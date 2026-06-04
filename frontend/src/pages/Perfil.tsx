import "../css/Perfil.css";
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Perfil() {
  const navigate = useNavigate();
  const { usuarioLogueado } = useAuth();

  const [usuario, setUsuario] = useState({
    nombre: "",
    apellido: "",
    email: "",
    foto_url: "",
  });

  useEffect(() => {
    if (!usuarioLogueado) {
      navigate("/");
      return;
    }

    cargarPerfil();
  }, [usuarioLogueado]);

  async function cargarPerfil() {
    try {
      const res = await axios.get(
        "http://localhost:5000/api/auth/perfil",
        {
          withCredentials: true,
        }
      );

      const user = res.data.usuario;

      setUsuario({
        nombre: user.NOMBRE_USUARIO || "",
        apellido: user.APELLIDO_USUARIO || "",
        email: user.EMAIL || "",
        foto_url: user.FOTO_URL || "",
      });
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="perfil-page">

      {/* CABECERA */}

      <div className="perfil-hero">

        <img
          src={
            usuario.foto_url ||
            "https://cdn-icons-png.flaticon.com/512/149/149071.png"
          }
          alt="Perfil"
          className="perfil-avatar"
        />

        <div className="perfil-info">
          <h1>
            {usuario.nombre} {usuario.apellido}
          </h1>

          <p>{usuario.email}</p>
        </div>

      </div>

      {/* TARJETAS */}

      <div className="perfil-dashboard">

        <div
          className="dashboard-card"
          onClick={() =>
            navigate("/perfil/editar")
          }
        >
          <div className="card-icon">
            👤
          </div>

          <h3>Mi Perfil</h3>

          <p>
            Edita tus datos personales
            y foto de perfil.
          </p>
        </div>

        <div
          className="dashboard-card"
          onClick={() =>
            navigate("/perfil/seguridad")
          }
        >
          <div className="card-icon">
            🔒
          </div>

          <h3>Seguridad</h3>

          <p>
            Cambia tu contraseña y
            gestiona el acceso.
          </p>
        </div>

        <div
          className="dashboard-card"
          onClick={() =>
            navigate("/perfil/compras")
          }
        >
          <div className="card-icon">
            📦
          </div>

          <h3>Mis Compras</h3>

          <p>
            Consulta pedidos e
            historial de compras.
          </p>
        </div>

        <div
          className="dashboard-card"
          onClick={() =>
            navigate("/perfil/direcciones")
          }
        >
          <div className="card-icon">
            📍
          </div>

          <h3>Direcciones</h3>

          <p>
            Administra direcciones
            de envío.
          </p>
        </div>

      </div>

    </div>
  );
}