import "../css/MetodosPagoPerfil.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import axios from "axios";
import { FaPlus, FaTrash, FaStar, FaCreditCard, FaMobileAlt, FaUniversity, FaMoneyBillWave, FaUndo } from "react-icons/fa";
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
  NUMERO_TARJETA?: string | null;
  VENCIMIENTO?: string | null;
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
  { id: 2, nombre: "Tarjeta de débito", icono: <FaCreditCard /> },
  { id: 3, nombre: "Tarjeta de crédito", icono: <FaCreditCard /> },
];

const detalleDe = (m: MetodoPago) => {
  const partes: string[] = [];
  if (m.TITULAR) partes.push(`Titular: ${m.TITULAR}`);
  if (m.NUMERO_TARJETA) partes.push(`•••• ${m.NUMERO_TARJETA}`);
  if (m.VENCIMIENTO) partes.push(`Vence ${m.VENCIMIENTO}`);
  if (m.TELEFONO) partes.push(`Celular: ${m.TELEFONO}`);
  if (m.BANCO) partes.push(`Banco: ${m.BANCO}`);
  if (m.TIPO) partes.push(m.TIPO);
  return partes.join(" · ");
};

export default function PerfilMetodosPago() {
  const [metodos, setMetodos] = useState<MetodoPago[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState({ mostrar: false, mensaje: "", tipo: "success" });
  // Eliminación con deshacer: se quita de la lista al instante (sin modal) y
  // el DELETE real se dispara al agotar los 5 s; Deshacer la vuelve a poner.
  const [pendiente, setPendiente] = useState<{ metodo: MetodoPago; indice: number; segundos: number } | null>(null);
  const pendienteRef = useRef<{ metodo: MetodoPago; indice: number } | null>(null);
  const contadoresPend = useRef<{ timer: number | null; intervalo: number | null }>({ timer: null, intervalo: null });

  const [form, setForm] = useState({
    id_metodo: 2,
    titular: "",
    numero: "",
    vencimiento: "",
    cvv: "",
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

  // La app solo guarda tarjetas (débito/crédito): Wompi no guarda datos
  // propios (el método se elige dentro de su checkout).
  const requiereTitular = form.id_metodo === 2 || form.id_metodo === 3;

  // Espejo de backend/utils/pagos.js vencimientoValido: MM/AA y no vencida
  // (el mes actual completo sigue contando como válido).
  const vencimientoFutura = (texto: string) => {
    const m = texto.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (!m) return false;
    const mes = Number(m[1]);
    const anio = 2000 + Number(m[2]);
    const ahora = new Date();
    return anio > ahora.getFullYear() || (anio === ahora.getFullYear() && mes >= ahora.getMonth() + 1);
  };

  const formValido = () => {
    if (!form.titular.trim()) return "El nombre del titular es obligatorio.";
    const numeroDigitos = form.numero.replace(/\D/g, "");
    if (numeroDigitos.length < 13 || numeroDigitos.length > 19) {
      return "El número de tarjeta debe tener entre 13 y 19 dígitos.";
    }
    if (!vencimientoFutura(form.vencimiento)) {
      return "La fecha de vencimiento debe ser MM/AA y no estar vencida.";
    }
    if (form.cvv.replace(/\D/g, "").length < 3) {
      return "El CVV debe tener 3 o 4 dígitos.";
    }
    return null;
  };

  function resetForm() {
    setForm({ id_metodo: 2, titular: "", numero: "", vencimiento: "", cvv: "" });
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const invalido = formValido();
    if (invalido) return mostrarToast(invalido, "error");
    setGuardando(true);
    try {
      const payload: Record<string, string | number> = { id_metodo: form.id_metodo };
      payload.titular = form.titular.trim();
      payload.numero = form.numero.replace(/\D/g, "");
      payload.vencimiento = form.vencimiento;
      payload.cvv = form.cvv.replace(/\D/g, "");
      await axios.post("/api/usuarios/metodos-pago", payload, { withCredentials: true });
      mostrarToast("Método de pago guardado.", "success");
      resetForm();
      fetchMetodos();
    } catch (err: any) {
      mostrarToast(err?.response?.data?.msg || "Error al guardar el método de pago.", "error");
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

  async function confirmarEliminacion(metodo: MetodoPago, indice: number) {
    try {
      await axios.delete(`/api/usuarios/metodos-pago/${metodo.ID}`, { withCredentials: true });
    } catch {
      setMetodos(prev => {
        if (prev.some(x => x.ID === metodo.ID)) return prev;
        const copia = [...prev];
        copia.splice(Math.min(indice, copia.length), 0, metodo);
        return copia;
      });
      mostrarToast("Error al eliminar el método de pago.", "error");
    }
    pendienteRef.current = null;
    setPendiente(null);
  }

  function limpiarContadores() {
    if (contadoresPend.current.timer) window.clearTimeout(contadoresPend.current.timer);
    if (contadoresPend.current.intervalo) window.clearInterval(contadoresPend.current.intervalo);
    contadoresPend.current = { timer: null, intervalo: null };
  }

  function eliminarMetodo(m: MetodoPago, indice: number) {
    if (pendienteRef.current) {
      // Había otro borrado esperando: se confirma al instante sin esperar sus 5 s
      limpiarContadores();
      confirmarEliminacion(pendienteRef.current.metodo, pendienteRef.current.indice);
    }
    setMetodos(prev => prev.filter(x => x.ID !== m.ID));
    pendienteRef.current = { metodo: m, indice };
    setPendiente({ metodo: m, indice, segundos: 5 });
    contadoresPend.current.intervalo = window.setInterval(() => {
      setPendiente(prev => (prev && prev.segundos > 1 ? { ...prev, segundos: prev.segundos - 1 } : prev));
    }, 1000);
    contadoresPend.current.timer = window.setTimeout(() => {
      const p = pendienteRef.current;
      limpiarContadores();
      pendienteRef.current = null;
      setPendiente(null);
      if (p) confirmarEliminacion(p.metodo, p.indice);
    }, 5000);
  }

  function deshacerEliminacion() {
    const p = pendienteRef.current;
    if (!p) return;
    limpiarContadores();
    pendienteRef.current = null;
    setPendiente(null);
    setMetodos(prev => {
      if (prev.some(x => x.ID === p.metodo.ID)) return prev;
      const copia = [...prev];
      copia.splice(Math.min(p.indice, copia.length), 0, p.metodo);
      return copia;
    });
  }

  // Si el usuario sale de la página con una eliminación en espera, se confirma
  useEffect(() => () => {
    if (contadoresPend.current.timer) window.clearTimeout(contadoresPend.current.timer);
    if (contadoresPend.current.intervalo) window.clearInterval(contadoresPend.current.intervalo);
    const p = pendienteRef.current;
    if (p) axios.delete(`/api/usuarios/metodos-pago/${p.metodo.ID}`, { withCredentials: true }).catch(() => {});
  }, []);

  return (
    <div className="mp-page">
      {pendiente && (
        <div className="mp-undo-bar">
          <span>
            Se eliminó <strong>{pendiente.metodo.NOMBRE_METODO}{pendiente.metodo.TITULAR ? ` de ${pendiente.metodo.TITULAR}` : ""}</strong>
          </span>
          <button className="mp-undo-btn" onClick={deshacerEliminacion}>
            <FaUndo /> Deshacer ({pendiente.segundos}s)
          </button>
        </div>
      )}
      {toast.mostrar && (
        <div className={`toast-dir ${toast.tipo}`}>
          {toast.tipo === "success" ? "✅" : "❌"} {toast.mensaje}
        </div>
      )}

      <div className="mp-card">
        <div className="mp-header">
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
                  onChange={(e) => setForm(prev => ({ ...prev, id_metodo: Number(e.target.value) }))}
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
                      onChange={(e) => setForm(prev => ({ ...prev, titular: e.target.value }))}
                    />
                  </div>
                  <div className="form-group full">
                    <label>Número de tarjeta *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="1234 5678 9012 3456"
                      maxLength={23}
                      value={form.numero}
                      onChange={(e) => setForm(prev => ({ ...prev, numero: e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim() }))}
                    />
                  </div>
                  <div className="form-group">
                    <label>Vencimiento *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="MM/AA"
                      maxLength={5}
                      value={form.vencimiento}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, "");
                        setForm(prev => ({ ...prev, vencimiento: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2, 4)}` : d }));
                      }}
                    />
                  </div>
                  <div className="form-group">
                    <label>CVV *</label>
                    <input
                      type="password"
                      inputMode="numeric"
                      placeholder="123"
                      maxLength={4}
                      value={form.cvv}
                      onChange={(e) => setForm(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, "") }))}
                    />
                  </div>
                  <div className="form-group full">
                    <span className="mp-nota-seguridad">
                      Por seguridad solo se guardan los últimos 4 dígitos de la tarjeta; el CVV no se almacena.
                    </span>
                  </div>
                </>
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
            {metodos.map((m, i) => (
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
                  <button className="btn-del-dir" title="Eliminar" onClick={() => eliminarMetodo(m, i)}>
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
