import "../css/SerVendedor.css";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import {
  FaStore, FaBuilding, FaIdCard, FaUserTie, FaEnvelope, FaPhoneAlt,
  FaMapMarkerAlt, FaCity, FaTag, FaAlignLeft, FaClock, FaCheckCircle,
  FaTimesCircle, FaPaperPlane,
} from "react-icons/fa";

const DEPARTAMENTOS = [
  "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bogotá D.C.", "Bolívar",
  "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó",
  "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira",
  "Magdalena", "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío",
  "Risaralda", "San Andrés y Providencia", "Santander", "Sucre", "Tolima",
  "Valle del Cauca", "Vaupés", "Vichada",
];

interface Solicitud {
  ID_SOLICITUD: number;
  NOMBRE_EMPRESA: string;
  NIT: string;
  NOMBRE_REPRESENTANTE: string;
  EMAIL_EMPRESA: string;
  TELEFONO: string;
  DEPARTAMENTO: string;
  CIUDAD: string;
  DIRECCION: string | null;
  CATEGORIAS: string | null;
  DESCRIPCION: string | null;
  ESTADO: string;
  OBSERVACION_ADMIN: string | null;
  FECHA_CREACION: string;
}

interface Vendedor {
  ID_VENDEDOR: number;
  NOMBRE_EMPRESA: string;
  NIT: string;
  EMAIL_VENDEDOR: string;
  USUARIO: string;
  DEBE_CAMBIAR_PASSWORD: number;
}

interface Categoria {
  ID_CATEGORIA: number;
  NOMBRE_CATEGORIA: string;
}

const vacio = {
  nombre_empresa: "",
  nit: "",
  nombre_representante: "",
  email_empresa: "",
  telefono: "",
  departamento: "",
  ciudad: "",
  direccion: "",
  descripcion: "",
};

export default function SerVendedor() {
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [vendedor, setVendedor] = useState<Vendedor | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [form, setForm] = useState({ ...vacio });
  const [catsSeleccionadas, setCatsSeleccionadas] = useState<number[]>([]);
  const [aceptaPoliticas, setAceptaPoliticas] = useState(false);

  const cargarEstado = () => {
    axios.get("/api/vendedor/solicitud", { withCredentials: true })
      .then((res) => {
        const s: Solicitud | null = res.data.solicitud;
        const v: Vendedor | null = res.data.vendedor;
        setSolicitud(s);
        setVendedor(v);
        if (s) {
          setForm({
            nombre_empresa: s.NOMBRE_EMPRESA,
            nit: s.NIT,
            nombre_representante: s.NOMBRE_REPRESENTANTE,
            email_empresa: s.EMAIL_EMPRESA,
            telefono: s.TELEFONO,
            departamento: s.DEPARTAMENTO,
            ciudad: s.CIUDAD,
            direccion: s.DIRECCION || "",
            descripcion: s.DESCRIPCION || "",
          });
        }
      })
      .catch(() => setSolicitud(null))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargarEstado();
    axios.get("/api/productos/categorias")
      .then((res) => setCategorias(Array.isArray(res.data) ? res.data : []))
      .catch(() => setCategorias([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleCat = (id: number) =>
    setCatsSeleccionadas((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );

  const set = (campo: keyof typeof vacio) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [campo]: e.target.value }));

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aceptaPoliticas) {
      Swal.fire({ icon: "warning", title: "Políticas obligatorias", text: "Debes aceptar las políticas de vendedor para continuar." });
      return;
    }
    if (catsSeleccionadas.length === 0) {
      Swal.fire({ icon: "warning", title: "Selecciona categorías", text: "Elige al menos una categoría en la que quieras vender." });
      return;
    }
    setEnviando(true);
    try {
      const res = await axios.post(
        "/api/vendedor/solicitud",
        {
          ...form,
          email_empresa: form.email_empresa.trim().toLowerCase(),
          categorias: categorias
            .filter((c) => catsSeleccionadas.includes(c.ID_CATEGORIA))
            .map((c) => c.NOMBRE_CATEGORIA)
            .join(", "),
        },
        { withCredentials: true }
      );
      await Swal.fire({
        icon: "success",
        title: "¡Solicitud enviada!",
        html: res.data.msg || "Tu solicitud fue registrada correctamente.",
        confirmButtonColor: "#e63946",
      });
      cargarEstado();
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "No se pudo enviar",
        text: err?.response?.data?.msg || "Ocurrió un error. Intenta de nuevo.",
        confirmButtonColor: "#e63946",
      });
    } finally {
      setEnviando(false);
    }
  };

  if (cargando) return <div className="sv-page"><div className="sv-loading">Cargando...</div></div>;

  const estado = solicitud?.ESTADO || null;

  return (
    <div className="sv-page">
      <div className="sv-hero">
        <FaStore className="sv-hero-icon" />
        <h1>Conviértete en vendedor</h1>
        <p>Amplía tu negocio vendiendo en la tienda deportiva más completa de Colombia.</p>
      </div>

      {estado === "APROBADA" ? (
        <div className="sv-box sv-box-ok">
          <FaCheckCircle className="sv-box-icon" />
          <h2>¡Bienvenido a JADDA SPORTS!</h2>
          <p>Tu solicitud fue aprobada. Estas son tus credenciales de vendedor:</p>
          <div className="sv-credenciales">
            <div><span>Correo de acceso:</span><strong>{vendedor?.EMAIL_VENDEDOR || solicitud?.EMAIL_EMPRESA}</strong></div>
            <div><span>Usuario:</span><strong>{vendedor?.USUARIO}</strong></div>
          </div>
          {vendedor?.DEBE_CAMBIAR_PASSWORD ? (
            <p className="sv-nota">
              <FaClock /> Tienes una <strong>contraseña temporal</strong>: al iniciar sesión el sistema te pedirá
              cambiarla. Ve a <Link to="/perfil/seguridad">Seguridad</Link> para actualizarla.
            </p>
          ) : (
            <p className="sv-nota"><FaCheckCircle /> Tu contraseña ya fue actualizada.</p>
          )}
          <Link to="/perfil" className="sv-btn">Ir a mi perfil</Link>
        </div>
      ) : (
        <div className="sv-grid">
          <form className="sv-form" onSubmit={enviar}>
            <h2>{estado === "RECHAZADA" ? "Vuelve a enviar tu solicitud" : "Formulario de solicitud"}</h2>

            {estado === "PENDIENTE" && (
              <div className="sv-banner sv-banner-pend">
                <FaClock /> Tu solicitud está <strong>en revisión</strong>. En un plazo máximo de 48 horas
                recibirás una respuesta en tu correo.
              </div>
            )}
            {estado === "RECHAZADA" && (
              <div className="sv-banner sv-banner-rech">
                <FaTimesCircle /> <strong>Solicitud rechazada:</strong>{" "}
                {solicitud?.OBSERVACION_ADMIN || "No cumplió con los requisitos."}{" "}
                Puedes corregir los datos y volver a enviarla.
              </div>
            )}

            <div className="sv-field">
              <label><FaBuilding /> Nombre de la empresa *</label>
              <input value={form.nombre_empresa} onChange={set("nombre_empresa")} placeholder="Ej: Deportes Andinos SAS" maxLength={150} required />
            </div>
            <div className="sv-row">
              <div className="sv-field">
                <label><FaIdCard /> NIT *</label>
                <input value={form.nit} onChange={set("nit")} placeholder="Solo números (5-20 dígitos)" maxLength={20} inputMode="numeric" required />
              </div>
              <div className="sv-field">
                <label><FaUserTie /> Representante legal *</label>
                <input value={form.nombre_representante} onChange={set("nombre_representante")} placeholder="Nombre completo" required />
              </div>
            </div>
            <div className="sv-row">
              <div className="sv-field">
                <label><FaEnvelope /> Correo de la empresa *</label>
                <input type="email" value={form.email_empresa} onChange={set("email_empresa")} placeholder="ventas@tuempresa.com" required />
              </div>
              <div className="sv-field">
                <label><FaPhoneAlt /> Teléfono *</label>
                <input value={form.telefono} onChange={set("telefono")} placeholder="Ej: 3001234567" maxLength={15} inputMode="tel" required />
              </div>
            </div>
            <div className="sv-row">
              <div className="sv-field">
                <label><FaMapMarkerAlt /> Departamento *</label>
                <select value={form.departamento} onChange={set("departamento")} required>
                  <option value="">Selecciona...</option>
                  {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="sv-field">
                <label><FaCity /> Ciudad *</label>
                <input value={form.ciudad} onChange={set("ciudad")} placeholder="Ciudad o municipio" required />
              </div>
            </div>
            <div className="sv-field">
              <label><FaMapMarkerAlt /> Dirección de la empresa</label>
              <input value={form.direccion} onChange={set("direccion")} placeholder="Calle, carrera, barrio" />
            </div>

            <div className="sv-field">
              <label><FaTag /> Categorías en las que quieres vender *</label>
              <div className="sv-cats">
                {categorias.length === 0 && <span className="sv-nota">Cargando categorías...</span>}
                {categorias.map((c) => (
                  <button
                    type="button"
                    key={c.ID_CATEGORIA}
                    className={`sv-chip ${catsSeleccionadas.includes(c.ID_CATEGORIA) ? "sv-chip-on" : ""}`}
                    onClick={() => toggleCat(c.ID_CATEGORIA)}
                  >
                    {c.NOMBRE_CATEGORIA}
                  </button>
                ))}
              </div>
            </div>

            <div className="sv-field">
              <label><FaAlignLeft /> Cuéntanos sobre tu negocio</label>
              <textarea value={form.descripcion} onChange={set("descripcion")} rows={4} placeholder="Productos que ofreces, experiencia, cobertura..." maxLength={2000} />
            </div>

            <label className="sv-politicas-check">
              <input type="checkbox" checked={aceptaPoliticas} onChange={(e) => setAceptaPoliticas(e.target.checked)} />
              <span>He leído y acepto las <strong>Políticas de vendedor de Colombia</strong> de JADDA SPORTS.</span>
            </label>

            <button type="submit" className="sv-btn sv-btn-enviar" disabled={enviando}>
              <FaPaperPlane /> {enviando ? "Enviando..." : "Enviar solicitud"}
            </button>

            <p className="sv-aviso">
              Al enviar aceptas que tu solicitud será evaluada en un plazo máximo de <strong>48 horas</strong>.
              Si es aprobada, recibirás en el correo de la empresa tus <strong>credenciales de vendedor</strong>.
            </p>
          </form>

          <aside className="sv-politicas">
            <h3>Políticas de vendedor (Colombia)</h3>
            <ul>
              <li><strong>Datos veraces:</strong> la información de tu empresa debe ser real y verificable (NIT, representante legal, dirección y contacto).</li>
              <li><strong>Productos autorizados:</strong> solo se venden artículos deportivos, ropa y accesorios originales. Está prohibido vender productos falsificados, ilegales o que infrinjan derechos de autor.</li>
              <li><strong>Precios y stock:</strong> mantén tus precios en pesos colombianos y tu inventario actualizado; los pedidos deben poder despacharse dentro de los plazos ofrecidos.</li>
              <li><strong>Calidad y envíos:</strong> responde las solicitudes de devolución y garantías según la ley colombiana (Estatuto del Consumidor, Ley 1480 de 2011).</li>
              <li><strong>Comisiones y pagos:</strong> los pagos de las ventas se liquidan según lo pactado al momento de la aprobación de tu cuenta.</li>
              <li><strong>Reglas de la plataforma:</strong> no está permitido el fraude, la suplantación, la publicidad engañosa ni la venta fuera del catálogo.</li>
              <li><strong>Eliminación de la cuenta:</strong> si dejas de vender o incumples estas políticas, JADDA SPORTS podrá <strong>suspender o eliminar tu cuenta de vendedor</strong> sin derecho a reclamo.</li>
              <li><strong>Tratamiento de datos:</strong> tus datos se tratan según nuestra <Link to="/politica-privacidad">Política de privacidad</Link> y la Ley 1581 de 2012.</li>
            </ul>
            <p className="sv-nota">Las políticas completas están en <Link to="/terminos-condiciones">Términos y condiciones</Link>.</p>
          </aside>
        </div>
      )}
    </div>
  );
}
