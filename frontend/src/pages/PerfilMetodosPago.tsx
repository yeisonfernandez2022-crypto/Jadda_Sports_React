import "../css/MetodosPagoPerfil.css";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { FaArrowLeft, FaPlus, FaTrash, FaStar, FaCreditCard, FaMobileAlt, FaUniversity, FaMoneyBillWave } from "react-icons/fa";
import Breadcrumb from "../components/Breadcrumb";

interface MetodoPago {
  ID: number;
  ID_METODO: number;
  NOMBRE_METODO: string;
  DESCRIPCION: string | null;
  TITULAR: string | null;
  TELEFONO: string | null;
  BANCO: string | null;
  TIPO: string | null;
  ES_PRINCIPAL: number;
  FECHA_CREADO: string;
}

const ICONOS: Record<number, ReactNode> = {
  2: <FaCreditCard />,
  3: <FaCreditCard />,
  4: <FaMobileAlt />,
  5: <FaMobileAlt />,
  7: <FaUniversity />,
};

const iconoDe = (m: MetodoPago) =>
  ICONOS[m.ID_METODO] || <FaMoneyBillWave />;

const TIPOS = [
  { id: 2, nombre: "Tarjeta de crédito / débito", icono: <FaCreditCard /> },
  { id: 4, nombre: "Nequi", icono: <FaMobileAlt /> },
  { id: 5, nombre: "Daviplata", icono: <FaMobileAlt /> },
  { id: 7, nombre: "PSE", icono: <FaUniversity /> },
];

const BANCOS = ["Bancolombia", "BBVA", "Davivienda", "Banco de Bogotá", "Nequi", "Banco Popular", "Colpatria", "AV Villas"];

const detalleDe = (m: MetodoPago) => {
  const partes: string[] = [];
  if (m.TITULAR) partes.push(`Titular: ${m.TITULAR}`);
  if (m.TELEFONO) partes.push(`Celular: ${m.TELEFONO}`);
  if (m.BANCO) partes.push(`Banco: ${m.BANCO}`);
  if (m.TIPO) partes.push(m.TIPO);
  return partes.join(" · ");
};

export default function PerfilMetodosPago() {
  const navigate = useNavigate();
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState({ mostrar: false, mensaje: "", tipo: "success" });

  const [form, setForm] = useState({
    id_metodo: 2,
    titular: "",
    telefono: "",
    banco: "",
    tipo: "débito",
  });

  const fetchMetodos = async () => {
    try {
      const res = await axios.get("/api/usuarios/metodos-pago", { withCredentials: true });
      setMetodos(res.data);
    } catch {
      mostrarToast("Error al cargar los métodos de pago.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMetodos(); }, []);

  function mostrarToast(mensaje: string, tipo: "success" | "error") {
    setToast({ mostrar: true, mensaje, tipo });
    setTimeout(() => setToast(prev => ({ ...prev, mostrar: false })), 3000);
  }

  const requiereTelefono = form.id_metodo === 4 || form.id_metodo === 5;
  const requiereBanco = form.id_metodo === 7;
  const requiereTitular = form.id_metodo === 2 || form.id_metodo === 3;

  const formValido = () => {
    if (requiereTitular && !form.titular.trim()) return "El nombre del titular es obligatorio.";
    if (requiereTelefono && !/^\d{7,10}$/.test(form.telefono.trim())) return "Ingresa un celular válido (7 a 10 dígitos).";
    if (requiereBanco && !form.banco) return "Selecciona tu banco.";
    return null;
  };

  function resetForm() {
    setForm({ id_metodo: 2, titular: "", telefono: "", banco: "", tipo: "débito" });
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalido = formValido();
    if (invalido) return mostrarToast(invalido, "error");
    setGuardando(true);
    try {
      const payload: Record<string, string | number> = { id_metodo: form.id_metodo };
      if (requiereTitular) {
        payload.titular = form.titular.trim();
        payload.tipo = form.tipo;
        if (form.banco) payload.banco = form.banco;
      }
      if (requiereTelefono) payload.telefono = form.telefono.trim();
      if (requiereBanco) payload.banco = form.banco;
      await axios.post("/api/usuarios/metodos-pago", payload, { withCredentials: true });
      mostrarToast("Método de pago guardado.", "success");
      resetForm();
      fetchMetodos();
    } catch {
      mostrarToast("Error al guardar el método de pago.", "error");
    } finally {
      setGuardando(false);
    }
  }

  async function establecerPrincipal(id: number) {
    try {
      await axios.put(`/api/usuarios/metodos-pago/${id}/principal`, {}, { withCredentials: true });
      mostrarToast("Método principal actualizado.", "success");
      fetchMetodos();
    } catch {
      mostrarToast("Error al actualizar el método principal.", "error");
    }
  }

  async function eliminarMetodo(m: MetodoPago) {
    const { isConfirmed } = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar método de pago?",
      text: m.TITULAR
        ? `Se eliminará ${m.NOMBRE_METODO} de ${m.TITULAR}.`
        : `Se eliminará ${m.NOMBRE_METODO}.`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      background: "#1a1a1a",
      color: "#fff",
    });
    if (!isConfirmed) return;
    try {
      await axios.delete(`/api/usuarios/metodos-pago/${m.ID}`, { withCredentials: true });
      mostrarToast("Método de pago eliminado.", "success");
      fetchMetodos();
    } catch {
      mostrarToast("Error al eliminar el método de pago.", "error");
    }
  }

  return (
    <div className="mp-page">
      {toast.mostrar && (
        <div className={`toast-dir ${toast.tipo}`}>
          {toast.tipo === "success" ? "✅" : "❌"} {toast.mensaje}
        </div>
      )}

      <div className="mp-card">
        <div className="mp-header">
          <button className="btn-volver-dir" onClick={() => navigate("/perfil")}>
            <FaArrowLeft /> Volver
          </button>
          <Breadcrumb items={[{ label: "Mi perfil", to: "/perfil" }, { label: "Métodos de pago" }]} />
          <h1><FaCreditCard className="mp-icon-title" /> Métodos de pago</h1>
          <p className="mp-subtitle">
            Estos métodos aparecerán guardados al momento de pagar tu compra.
          </p>
        </div>

        {showForm && (
          <form className="mp-form" onSubmit={handleSubmit}>
            <div className="mp-form-grid">
              <div className="form-group full">
                <label>Tipo de método de pago *</label>
                <select
                  className="mp-select"
                  value={form.id_metodo}
                  onChange={(e) => setForm({ ...form, id_metodo: Number(e.target.value) })}
                >
                  {TIPOS.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </select>
              </div>

              {requiereTitular && (
                <>
                  <div className="form-group full">
                    <label>Titular *</label>
                    <input
                      type="text"
                      placeholder="Nombre del titular de la tarjeta"
                      value={form.titular}
                      maxLength={100}
                      onChange={(e) => setForm({ ...form, titular: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Tipo de tarjeta</label>
                    <select
                      className="mp-select"
                      value={form.tipo}
                      onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                    >
                      <option value="débito">Débito</option>
                      <option value="crédito">Crédito</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Banco (opcional)</label>
                    <select
                      className="mp-select"
                      value={form.banco}
                      onChange={(e) => setForm({ ...form, banco: e.target.value })}
                    >
                      <option value="">Sin banco</option>
                      {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                </>
              )}

              {requiereTelefono && (
                <div className="form-group full">
                  <label>Celular {form.id_metodo === 4 ? "Nequi" : "Daviplata"} *</label>
                  <input
                    type="text"
                    placeholder="300 123 4567"
                    maxLength={10}
                    value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value.replace(/\D/g, "") })}
                  />
                </div>
              )}

              {requiereBanco && (
                <div className="form-group full">
                  <label>Banco *</label>
                  <select
                    className="mp-select"
                    value={form.banco}
                    onChange={(e) => setForm({ ...form, banco: e.target.value })}
                  >
                    <option value="">Selecciona tu banco</option>
                    {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-guardar-dir" disabled={guardando}>
                {guardando ? "Guardando..." : "Guardar método de pago"}
              </button>
              <button type="button" className="btn-cancelar-dir" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </form>
        )}

        {!showForm && (
          <button className="btn-agregar" onClick={() => setShowForm(true)}>
            <FaPlus /> Agregar método de pago
          </button>
        )}

        {loading ? (
          <div className="mp-loading">Cargando métodos de pago...</div>
        ) : metodos.length === 0 ? (
          <div className="mp-empty">
            <div className="mp-empty-icon"><FaCreditCard /></div>
            <p>No tienes métodos de pago guardados.</p>
            <small>Agrega uno y aparecerá listo cuando vayas a pagar.</small>
          </div>
        ) : (
          <div className="mp-lista">
            {metodos.map((m) => (
              <div key={m.ID} className={`mp-item${m.ES_PRINCIPAL ? " principal" : ""}`}>
                <div className="mp-item-left">
                  <div className="mp-item-icon">{iconoDe(m)}</div>
                  <div>
                    <div className="mp-item-header">
                      <strong>{m.NOMBRE_METODO}</strong>
                      {m.ES_PRINCIPAL ? <span className="mp-badge">Principal</span> : null}
                    </div>
                    <div className="mp-item-info">
                      <p>{detalleDe(m)}</p>
                      <small>Guardado el {new Date(m.FECHA_CREADO).toLocaleDateString("es-CO")}</small>
                    </div>
                  </div>
                </div>
                <div className="mp-item-actions">
                  {!m.ES_PRINCIPAL && (
                    <button className="btn-edit-dir" title="Usar por defecto al pagar" onClick={() => establecerPrincipal(m.ID)}>
                      <FaStar />
                    </button>
                  )}
                  <button className="btn-del-dir" title="Eliminar" onClick={() => eliminarMetodo(m)}>
                    <FaTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
