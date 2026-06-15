import "../css/PerfilEditar.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaArrowLeft } from "react-icons/fa";

export default function PerfilEditar() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mostrarMenuFoto, setMostrarMenuFoto] = useState(false);
  const [toast, setToast] = useState({
    mostrar: false,
    mensaje: "",
    tipo: "success"
  });

  const [usuario, setUsuario] = useState({
    nombre: "",
    apellido: "",
    email: "",
    telefono: "",
    foto_url: ""
  });

  useEffect(() => {
    cargarPerfil();
  }, []);

  async function cargarPerfil() {

    try {

      const res = await axios.get(
        "http://localhost:5000/api/auth/perfil",
        {
          withCredentials: true
        }
      );

      const user = res.data.usuario;

      setUsuario({
        nombre: user.NOMBRE_USUARIO || "",
        apellido: user.APELLIDO_USUARIO || "",
        email: user.EMAIL || "",
        telefono: user.TELEFONO || "",
        foto_url: user.FOTO_URL || ""
      });

    } catch (error) {

      mostrarToast(
        "Error al cargar la información.",
        "error"
      );

    }

  }

  function mostrarToast(
    mensaje: string,
    tipo: "success" | "error"
  ) {

    setToast({
      mostrar: true,
      mensaje,
      tipo
    });

    setTimeout(() => {

      setToast(prev => ({
        ...prev,
        mostrar: false
      }));

    }, 3000);

  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {

    setUsuario({
      ...usuario,
      [e.target.name]: e.target.value
    });

  }

  async function guardarCambios() {

    if (!/^\d{10}$/.test(usuario.telefono)) {

      mostrarToast(
        "El teléfono debe tener 10 dígitos.",
        "error"
      );

      return;

    }

    try {

      setLoading(true);

      await axios.put(
  "http://localhost:5000/api/auth/perfil",
  {
    nombre: usuario.nombre,
    apellido: usuario.apellido,
    usuario: usuario.nombre,
    telefono: usuario.telefono,
    direccion: "",
    foto_url: usuario.foto_url
  },
  {
    withCredentials: true
  }
);

      mostrarToast(
        "Datos actualizados correctamente.",
        "success"
      );

    } catch (error) {

      mostrarToast(
        "No se pudieron guardar los cambios.",
        "error"
      );

    } finally {

      setLoading(false);

    }

  }

  return (

    <div className="editar-perfil-page">

      {toast.mostrar && (
        <div className={`toast ${toast.tipo}`}>
          {toast.tipo === "success"
            ? "✅"
            : "❌"} {toast.mensaje}
        </div>
      )}

      <div className="editar-card">

        <div className="editar-header">

  <button
    className="btn-volver"
    onClick={() => navigate("/perfil")}
  >
    <FaArrowLeft />
    Volver
  </button>

</div>

<h1>Mi Perfil</h1>

        <div className="foto-section">

  <div className="foto-container"
  onClick={() => setMostrarMenuFoto(!mostrarMenuFoto)}
  >
    

    <img
      src={
        usuario.foto_url ||
        "https://cdn-icons-png.flaticon.com/512/149/149071.png"
      }
      alt="Perfil"
      className="foto-perfil"
      
    />

    <div className="overlay-foto">

      <span>📷 Foto</span>

    </div>
    {
  mostrarMenuFoto && (

    <div className="menu-foto">

      <div className="opcion-menu">
        👁 Ver foto
      </div>

      <div className="opcion-menu">
        📷 Añadir desde la computadora
      </div>

      <div className="opcion-menu">
        🔗 Usar URL
      </div>

    </div>

  )
}

  </div>

</div>

        <div className="input-group">

          <label>Nombre</label>

          <input
            value={usuario.nombre}
            onChange={handleChange}
            name="nombre"
          />

        </div>

        <div className="input-group">

          <label>Apellido</label>

          <input
            value={usuario.apellido}
            onChange={handleChange}
            name="apellido"
            
          />

        </div>

        <div className="input-group">

          <label>Correo electrónico</label>

          <input
            value={usuario.email}
            disabled
          />

        </div>

        <div className="input-group">

          <label>Teléfono</label>

          <input
            name="telefono"
            value={usuario.telefono}
            onChange={handleChange}
            maxLength={10}
          />

        </div>

        <div className="miembro-jadda">

          ⭐ Miembro JADDA Sports

        </div>

        <button
          className="btn-guardar"
          disabled={loading}
          onClick={guardarCambios}
        >

          {
            loading
            ? "Guardando..."
            : "Guardar cambios"
          }

        </button>

      </div>

    </div>

  );
}