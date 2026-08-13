import Navbar from "../components/Navbar";
import "../css/ResumenCompra.css";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { FaArrowLeft, FaTrash, FaPlus, FaMinus, FaEdit, FaSave, FaMapMarkerAlt, FaHome } from "react-icons/fa";
import { DEPARTAMENTOS } from "../data/colombia";

interface Direccion {
  ID_DIRECCION: number;
  DIRECCION: string;
  BARRIO: string | null;
  CIUDAD: string;
  DEPARTAMENTO: string;
  CODIGO_POSTAL: string | null;
  TELEFONO_CONTACTO: string | null;
  ES_PRINCIPAL: number;
  ETIQUETA?: string;
}

interface PaymentData {
  [key: string]: string;
}

function ResumenCompra() {
  const navigate = useNavigate();
  const { cart, removeFromCart, decreaseQuantity, increaseQuantity, clearCart } = useCart();
  const { usuario } = useAuth();

  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [tipoDocumento, setTipoDocumento] = useState("CC");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [direccion, setDireccion] = useState("");
  const [barrio, setBarrio] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [departamento, setDepartamento] = useState("");
  const [codigoPostal, setCodigoPostal] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [metodoPago, setMetodoPago] = useState("tarjeta");
  const [paymentData, setPaymentData] = useState<PaymentData>({});
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [paso, setPaso] = useState<"envio" | "pago">("envio");

  const irAPaso = (p: "envio" | "pago") => {
    setPaso(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [cuponCodigo, setCuponCodigo] = useState("");
  const [cuponAplicado, setCuponAplicado] = useState<any>(null);
  const [cuponError, setCuponError] = useState("");
  const [cuponLoading, setCuponLoading] = useState(false);
  const [usarMismoTelefono, setUsarMismoTelefono] = useState(false);
  const [guardarMetodoCheck, setGuardarMetodoCheck] = useState(true);
  const [metodosGuardados, setMetodosGuardados] = useState<any[]>([]);

  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [selectedDirId, setSelectedDirId] = useState<number | null>(null);
  const [editandoDirId, setEditandoDirId] = useState<number | null>(null);
  const [agregandoNueva, setAgregandoNueva] = useState(false);
  const [completarPrincipal, setCompletarPrincipal] = useState(false);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [guardandoDir, setGuardandoDir] = useState(false);

  const [costoEnvio, setCostoEnvio] = useState(0);
  const [envioCargando, setEnvioCargando] = useState(false);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});

  const subtotalBase = (cart || []).reduce(
    (acc, item) => acc + Number(item.PRECIO) * (Number(item.CANTIDAD) || 0),
    0
  );

  const descuentoProductos = (cart || []).reduce((acc, item) => {
    const pct = item.ID_DESCUENTO != null ? Number(descuentosMap[item.ID_DESCUENTO]) || 0 : 0;
    return acc + (pct > 0 ? Number(item.PRECIO) * (pct / 100) * (Number(item.CANTIDAD) || 0) : 0);
  }, 0);

  const subtotal = subtotalBase - descuentoProductos;
  const descuento = cuponAplicado ? subtotal * (cuponAplicado.porcentaje / 100) : 0;
  const total = subtotal - descuento + costoEnvio;

  useEffect(() => {
    fetch("/api/productos/descuentos")
      .then((res) => res.json())
      .then((dcts: { ID_DESCUENTO: number; PORCENTAJE: number }[]) => {
        const map: Record<number, number> = {};
        dcts.forEach((d) => {
          map[d.ID_DESCUENTO] = d.PORCENTAJE;
        });
        setDescuentosMap(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!departamento.trim()) {
      setCostoEnvio(0);
      setEnvioCargando(false);
      return;
    }
    setEnvioCargando(true);
    const timer = setTimeout(async () => {
      try {
        const res = await axios.get("/api/envio/calcular", {
          params: { departamento, ciudad, subtotal },
        });
        setCostoEnvio(Number(res.data.costo) || 0);
      } catch {
        setCostoEnvio(0);
      } finally {
        setEnvioCargando(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [departamento, ciudad, subtotal]);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const formOk =
    nombre.trim() !== "" &&
    correo.trim() !== "" && emailRegex.test(correo) &&
    telefono.trim() !== "" &&
    direccion.trim() !== "" &&
    ciudad.trim() !== "" &&
    departamento.trim() !== "";

  const paymentOk = () => {
    if (metodoPago === "tarjeta") {
      return !!paymentData.titular && !!paymentData.numero && !!paymentData.vencimiento && !!paymentData.cvv;
    }
    if (metodoPago === "nequi" || metodoPago === "daviplata") {
      return !!paymentData.telefono;
    }
    if (metodoPago === "pse") {
      return !!paymentData.banco;
    }
    return true;
  };

  const isFormValid = formOk && paymentOk() && cart.length > 0;

  const updatePayment = (field: string, value: string) => {
    setPaymentData((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (usarMismoTelefono && telefono) {
      setPaymentData((prev) => ({ ...prev, telefono }));
    }
  }, [usarMismoTelefono, telefono]);

  useEffect(() => {
    const saved = localStorage.getItem("jadda_payment_method");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.metodoPago === metodoPago) {
          setPaymentData(parsed.data || {});
        }
      } catch {}
    } else {
      setPaymentData({});
      setUsarMismoTelefono(false);
    }
  }, [metodoPago]);

  useEffect(() => {
    if (!usuario) return;

    if (usuario.NOMBRE_USUARIO) {
      const nombreCompleto = usuario.APELLIDO_USUARIO
        ? `${usuario.NOMBRE_USUARIO} ${usuario.APELLIDO_USUARIO}`
        : usuario.NOMBRE_USUARIO;
      setNombre(nombreCompleto);
    }
    if (usuario.EMAIL) setCorreo(usuario.EMAIL);
    if (usuario.TIPO_DOCUMENTO) setTipoDocumento(usuario.TIPO_DOCUMENTO);
    if (usuario.NUMERO_DOCUMENTO) setNumeroDocumento(usuario.NUMERO_DOCUMENTO);
    if (usuario.TELEFONO && usuario.TELEFONO !== "N/A") setTelefono(usuario.TELEFONO);

    fetchDirecciones();
    fetchMetodosGuardados();
  }, [usuario]);

  const fetchMetodosGuardados = async () => {
    try {
      const res = await axios.get("/api/usuarios/metodos-pago", { withCredentials: true });
      setMetodosGuardados(res.data);
      const principal = res.data.find((m: any) => m.ES_PRINCIPAL);
      if (principal) {
        cargarMetodoGuardado(principal);
      }
    } catch {}
  };

  function cargarMetodoGuardado(m: any) {
    const mapMetodo: Record<number, string> = { 2: "tarjeta", 4: "nequi", 5: "daviplata", 7: "pse" };
    const metodoKey = Object.entries(mapMetodo).find(([id]) => Number(id) === m.ID_METODO)?.[1];
    if (!metodoKey) return;
    setMetodoPago(metodoKey);
    const data: PaymentData = {};
    if (m.TITULAR) data.titular = m.TITULAR;
    if (m.TELEFONO) data.telefono = m.TELEFONO;
    if (m.BANCO) data.banco = m.BANCO;
    setPaymentData(data);
  }

  const fetchDirecciones = async () => {
    try {
      const res = await axios.get("/api/direcciones", { withCredentials: true });
      setDirecciones(res.data);
      const principal = res.data.find((d: Direccion) => d.ES_PRINCIPAL === 1) || res.data[0];
      if (principal && selectedDirId === null) {
        setSelectedDirId(principal.ID_DIRECCION);
        llenarFormConDireccion(principal);
        // Si la principal viene incompleta (creada en el registro), se abre directa en modo
        // "completar": el usuario solo ve dirección, barrio, ciudad, departamento y observaciones.
        if (direccionIncompleta(principal)) {
          setEditandoDirId(principal.ID_DIRECCION);
          setCompletarPrincipal(true);
        }
      }
    } catch { /* sin direcciones */ }
  };

  function direccionIncompleta(dir: Direccion) {
    return !dir.DIRECCION || dir.DIRECCION.includes("@") || dir.CIUDAD === 'Sin especificar' || !dir.CIUDAD ||
           dir.DEPARTAMENTO === 'Sin especificar' || !dir.DEPARTAMENTO;
  }

  function llenarFormConDireccion(dir: Direccion) {
    // Si la dirección guardada es un correo (autofill viejo), se limpia para que
    // el usuario escriba la dirección del domicilio y no se repita.
    const esCorreo = (dir.DIRECCION || "").includes("@");
    setDireccion(esCorreo ? "" : dir.DIRECCION || "");
    setBarrio(dir.BARRIO || "");
    setCiudad(dir.CIUDAD || "");
    setDepartamento(dir.DEPARTAMENTO || "");
    setCodigoPostal(dir.CODIGO_POSTAL || "");
    if (dir.TELEFONO_CONTACTO) setTelefono(dir.TELEFONO_CONTACTO);
  }

  function limpiarFormDireccion() {
    setDireccion("");
    setBarrio("");
    setCiudad("");
    setDepartamento("");
    setCodigoPostal("");
  }

  const seleccionarDireccion = (dir: Direccion) => {
    setSelectedDirId(dir.ID_DIRECCION);
    setEditandoDirId(null);
    setAgregandoNueva(false);
    setCompletarPrincipal(false);
    llenarFormConDireccion(dir);
  };

  const guardarDireccion = async (dir: Direccion) => {
    setGuardandoDir(true);
    try {
      const body = {
        direccion, barrio, ciudad, departamento,
        codigo_postal: codigoPostal,
        telefono_contacto: telefono,
        es_principal: dir.ES_PRINCIPAL === 1,
        etiqueta: dir.ETIQUETA || nuevaEtiqueta
      };
      await axios.put(`/api/direcciones/${dir.ID_DIRECCION}`, body, { withCredentials: true });
      setEditandoDirId(null);
      setCompletarPrincipal(false);
      fetchDirecciones();
    } catch (err) {
      console.error("Error al guardar dirección:", err);
    } finally {
      setGuardandoDir(false);
    }
  };

  const eliminarDireccion = async (id: number) => {
    const result = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar dirección?",
      text: "Esta acción no se puede deshacer.",
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e63946",
      reverseButtons: true,
      background: "#1a1a1a",
      color: "#fff",
    });
    if (!result.isConfirmed) return;
    try {
      await axios.delete(`/api/direcciones/${id}`, { withCredentials: true });
      if (selectedDirId === id) setSelectedDirId(null);
      fetchDirecciones();
    } catch (err) {
      console.error("Error al eliminar dirección:", err);
    }
  };

  const crearNuevaDireccion = async () => {
    if (!direccion || !ciudad || !departamento) return;
    setGuardandoDir(true);
    try {
      const body = {
        direccion, barrio, ciudad, departamento,
        codigo_postal: codigoPostal,
        telefono_contacto: telefono,
        es_principal: direcciones.length === 0,
        etiqueta: nuevaEtiqueta
      };
      const res = await axios.post("/api/direcciones", body, { withCredentials: true });
      setAgregandoNueva(false);
      setNuevaEtiqueta("");
      await fetchDirecciones();
      setSelectedDirId(res.data.id);
    } catch (err) {
      console.error("Error al crear dirección:", err);
    } finally {
      setGuardandoDir(false);
    }
  };

  const cancelarEdicion = () => {
    setEditandoDirId(null);
    setAgregandoNueva(false);
    setCompletarPrincipal(false);
    if (selectedDirId) {
      const dir = direcciones.find(d => d.ID_DIRECCION === selectedDirId);
      if (dir) llenarFormConDireccion(dir);
    }
  };

  const guardarDireccionEnPerfil = async () => {
    if (!direccion.trim() || !ciudad.trim() || !departamento.trim()) return;
    const body = {
      direccion: direccion.trim(),
      barrio,
      ciudad: ciudad.trim(),
      departamento: departamento.trim(),
      codigo_postal: codigoPostal,
      telefono_contacto: telefono,
    };
    try {
      const seleccionada = selectedDirId ? direcciones.find((d) => d.ID_DIRECCION === selectedDirId) : undefined;
      if (seleccionada) {
        await axios.put(`/api/direcciones/${seleccionada.ID_DIRECCION}`, {
          ...body,
          es_principal: seleccionada.ES_PRINCIPAL === 1,
          etiqueta: seleccionada.ETIQUETA || "",
        }, { withCredentials: true });
      } else if (direcciones.length > 0) {
        const principal = direcciones.find((d) => d.ES_PRINCIPAL === 1) || direcciones[0];
        await axios.put(`/api/direcciones/${principal.ID_DIRECCION}`, {
          ...body,
          es_principal: principal.ES_PRINCIPAL === 1,
          etiqueta: principal.ETIQUETA || "",
        }, { withCredentials: true });
      } else {
        await axios.post("/api/direcciones", { ...body, es_principal: true, etiqueta: "Principal" }, { withCredentials: true });
      }
      fetchDirecciones();
    } catch (err) {
      console.error("No se pudo guardar la dirección:", err);
    }
  };

  const siguientePaso = () => {
    guardarDireccionEnPerfil();
    irAPaso("pago");
  };

  const aplicarCupon = async () => {
    if (!cuponCodigo.trim()) return;
    setCuponLoading(true);
    setCuponError("");
    try {
      const res = await axios.post("/api/cupones/validar", { codigo: cuponCodigo.trim() });
      if (res.data.ok) {
        setCuponAplicado(res.data.descuento);
        setCuponError("");
      }
    } catch (err: any) {
      setCuponAplicado(null);
      setCuponError(err.response?.data?.msg || "Cupón inválido");
    } finally {
      setCuponLoading(false);
    }
  };

  const handleCheckout = async () => {
    if (!isFormValid) return;
    setCheckoutLoading(true);
    try {
      const res = await axios.post("/api/checkout/procesar", {
        metodoPago,
        paymentData,
        cuponCodigo: cuponAplicado ? cuponCodigo : "",
        descuentoAplicado: descuento,
        totalFinal: total,
        nombre,
        correo,
        telefono,
        direccion,
        barrio,
        ciudad,
        departamento,
        codigoPostal,
        observaciones,
      }, { withCredentials: true });

      if (res.data.ok) {
        // Guardar método de pago si el usuario lo solicitó
        if (guardarMetodoCheck) {
          const idMetodoMap: Record<string, number> = { tarjeta: 2, pse: 7, nequi: 4, daviplata: 5 };
          await axios.post("/api/usuarios/metodos-pago", {
            id_metodo: idMetodoMap[metodoPago] || 2,
            titular: paymentData.titular || null,
            telefono: paymentData.telefono || null,
            banco: paymentData.banco || null,
          }, { withCredentials: true }).catch(() => {});
        }
        clearCart();
        navigate(`/compra-exitosa/${res.data.ventaId}`, {
          state: {
            total,
            referencia: res.data.referencia,
            productos: [...cart],
            planGenerado: res.data.planGenerado,
          },
        });
      }
    } catch (err: any) {
      Swal.fire({
        icon: "error",
        title: "NO SE PUDO PROCESAR",
        text: err.response?.data?.error || "Error al procesar la compra. Intenta de nuevo.",
        background: "#1a1a1a",
        color: "#fff",
        confirmButtonColor: "#e63946",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const inputClass = (val: string) => `form-control${val.trim() ? "" : " is-invalid"}`;
  const selectClass = (val: string) => `form-select${val.trim() ? "" : " is-invalid"}`;

  const departamentosList = Object.keys(DEPARTAMENTOS);
  const deptosParaSelect = departamento && !departamentosList.includes(departamento)
    ? [departamento, ...departamentosList]
    : departamentosList;
  const ciudadesDept = (departamento && DEPARTAMENTOS[departamento]) || [];
  const ciudadesParaSelect = ciudad && !ciudadesDept.includes(ciudad)
    ? [ciudad, ...ciudadesDept]
    : ciudadesDept;

  return (
    <>
      <Navbar />

      <div className="checkout-steps mb-5">
        <div className="step active">
          <i className="fas fa-shopping-cart"></i>
          <span>Carrito</span>
        </div>
        <div className="line"></div>
        <div className={`step${paso === "envio" || paso === "pago" ? " active" : ""}`}>
          <i className="fas fa-truck"></i>
          <span>Envío</span>
        </div>
        <div className="line"></div>
        <div className={`step${paso === "pago" ? " active" : ""}`}>
          <i className="fas fa-credit-card"></i>
          <span>Pago</span>
        </div>
        <div className="line"></div>
        <div className="step">
          <i className="fas fa-check"></i>
          <span>Confirmación</span>
        </div>
      </div>

      <div className="container py-4">
        <button className="btn-back-checkout" onClick={() => (paso === "pago" ? navigate("/") : navigate(-1))}>
          {paso === "pago" ? <FaHome /> : <FaArrowLeft />} {paso === "pago" ? "Inicio" : "Volver"}
        </button>

        <h1 className="fw-bold mb-5 text-center titulo-finalizar">
          <i className="fas fa-receipt me-2"></i>
          FINALIZAR COMPRA
        </h1>

        <div className="row g-4 align-items-start">
          <div className="col-lg-7">
            {paso === "envio" && (
            <div className="card shadow-sm border-0 p-4 mb-4 card-seccion card-seccion-envio">
              <div className="card-header-custom">
                <i className="fas fa-map-marker-alt me-2"></i>Información de envío <span className="text-danger ms-1">*</span>
              </div>

              {direcciones.length > 0 && !agregandoNueva && (
                <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                  {direcciones.map((dir) => {
                    const isSelected = selectedDirId === dir.ID_DIRECCION;
                    const isEditing = editandoDirId === dir.ID_DIRECCION;
                    return (
                      <div
                        key={dir.ID_DIRECCION}
                        className={`dir-chip ${isSelected ? "selected" : ""} ${isEditing ? "editing" : ""}`}
                        onClick={() => !isEditing && seleccionarDireccion(dir)}
                        style={{ cursor: isEditing ? "default" : "pointer" }}
                      >
                        <div className="d-flex align-items-center gap-2">
                          <span className="dir-chip-label">{dir.ETIQUETA || `Dir. #${dir.ID_DIRECCION}`}</span>
                          {dir.ES_PRINCIPAL === 1 && <span className="dir-badge-sm">Principal</span>}
                        </div>
                        <div className="dir-chip-actions mt-1" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <div className="d-flex gap-1">
                              <button className="btn btn-success btn-sm" onClick={() => guardarDireccion(dir)} disabled={guardandoDir}>
                                <FaSave /> Guardar
                              </button>
                              <button className="btn btn-outline-secondary btn-sm" onClick={cancelarEdicion}>Cancelar</button>
                            </div>
                          ) : (
                            <div className="d-flex gap-1">
                              <button className="btn btn-outline-primary btn-sm" onClick={() => { setEditandoDirId(dir.ID_DIRECCION); setAgregandoNueva(false); setCompletarPrincipal(false); }}>
                                <FaEdit /> Editar
                              </button>
                              <button className="btn btn-outline-danger btn-sm" onClick={() => eliminarDireccion(dir.ID_DIRECCION)}>
                                <FaTrash />
                              </button>
                            </div>
                          )}
                        </div>
                        {isEditing && (
                          <small className="text-muted d-block mt-1" style={{ fontSize: "0.75rem" }}>{dir.DIRECCION}</small>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!agregandoNueva && (
                <div className="mt-3">
                  <button className="btn btn-outline-danger" onClick={() => {
                    const principal = direcciones.find((d) => d.ES_PRINCIPAL === 1) || direcciones[0];
                    // Si la principal es la creada en el registro (incompleta), se completa, no se crea otra
                    if (principal && direccionIncompleta(principal)) {
                      llenarFormConDireccion(principal);
                      setSelectedDirId(principal.ID_DIRECCION);
                      setEditandoDirId(principal.ID_DIRECCION);
                      setCompletarPrincipal(true);
                      setAgregandoNueva(false);
                    } else {
                      setAgregandoNueva(true); setEditandoDirId(null); setSelectedDirId(null); setNuevaEtiqueta(""); limpiarFormDireccion(); setCompletarPrincipal(false);
                    }
                  }}>
                    <FaPlus /> {direcciones.some((d) => d.ES_PRINCIPAL === 1 && direccionIncompleta(d)) ? "Completar mi dirección" : "Agregar dirección"}
                  </button>
                </div>
              )}

              {agregandoNueva && (
                <div className="nueva-direccion-form mt-3 p-3 border rounded">
                  <h6 className="fw-bold mb-2"><FaMapMarkerAlt className="me-1" /> Nueva dirección</h6>
                  <div className="mb-2">
                    <input type="text" className="form-control" placeholder="Etiqueta (ej: Casa, Trabajo)" value={nuevaEtiqueta} onChange={(e) => setNuevaEtiqueta(e.target.value)} />
                  </div>
                </div>
              )}

              {(editandoDirId || agregandoNueva) && (
              <div className="row mt-3">
                <div className="col-12">
                  {completarPrincipal ? (
                    <small className="text-muted fst-italic d-block mb-2">
                      <i className="fas fa-question-circle me-1"></i> Tu dirección de registro está incompleta. Completa estos campos y se guardará como tu dirección principal.
                    </small>
                  ) : (
                    <small className="text-muted fst-italic d-block mb-2">
                      <i className="fas fa-plus-circle me-1"></i> Los datos de contacto se guardan en tu dirección principal.
                    </small>
                  )}
                </div>
                {!completarPrincipal && (
                <>
                <div className="col-md-6 mb-3">
                  <label className="form-label"><i className="fas fa-user me-1"></i> Nombre completo <span className="text-danger">*</span></label>
                  <input type="text" className={inputClass(nombre)} placeholder="Tu nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  {!nombre.trim() && <small className="text-danger">Requerido</small>}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label"><i className="fas fa-phone me-1"></i> Teléfono <span className="text-danger">*</span></label>
                  <input type="text" className={inputClass(telefono)} placeholder="Tu teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                  {!telefono.trim() && <small className="text-danger">Requerido</small>}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label"><i className="fas fa-envelope me-1"></i> Correo electrónico <span className="text-danger">*</span></label>
                  <input type="email" className={`${inputClass(correo)}${correo && !emailRegex.test(correo) ? " is-invalid" : ""}`} placeholder="tu@correo.com" value={correo} onChange={(e) => setCorreo(e.target.value)} />
                  {!correo.trim() && <small className="text-danger">Requerido</small>}
                  {correo.trim() && !emailRegex.test(correo) && <small className="text-danger">Email inválido</small>}
                </div>
                </>
                )}
                <div className="col-12 mb-3">
                  <label className="form-label"><i className="fas fa-road me-1"></i> Dirección <span className="text-danger">*</span></label>
                  <input type="text" className={inputClass(direccion)} placeholder="Cra 45 # 23-12" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                  {!direccion.trim() && <small className="text-danger">Requerido</small>}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label"><i className="fas fa-map me-1"></i> Departamento <span className="text-danger">*</span></label>
                  <select className={selectClass(departamento)} value={departamento} onChange={(e) => { setDepartamento(e.target.value); setCiudad(""); }}>
                    <option value="">Selecciona tu departamento</option>
                    {deptosParaSelect.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {!departamento.trim() && <small className="text-danger">Requerido</small>}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label"><i className="fas fa-city me-1"></i> Ciudad <span className="text-danger">*</span></label>
                  <select className={selectClass(ciudad)} value={ciudad} onChange={(e) => setCiudad(e.target.value)} disabled={!departamento}>
                    <option value="">{departamento ? "Selecciona tu ciudad" : "Primero elige departamento"}</option>
                    {ciudadesParaSelect.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {!ciudad.trim() && <small className="text-danger">Requerido</small>}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label"><i className="fas fa-home me-1"></i> Barrio</label>
                  <input type="text" className="form-control" placeholder="Barrio" value={barrio} onChange={(e) => setBarrio(e.target.value)} />
                </div>
                {!completarPrincipal && (
                <>
                <div className="col-md-6 mb-3">
                  <label className="form-label"><i className="fas fa-id-card me-1"></i> Tipo de documento</label>
                  <select className="form-select" value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value)}>
                    <option value="CC">Cédula de ciudadanía</option>
                    <option value="TI">Tarjeta de identidad</option>
                    <option value="CE">Cédula de extranjería</option>
                    <option value="PAS">Pasaporte</option>
                  </select>
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label"><i className="fas fa-hashtag me-1"></i> Número de documento</label>
                  <input type="text" className="form-control" placeholder="Número de documento (opcional)" value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} />
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label"><i className="fas fa-mailbox me-1"></i> Código postal</label>
                  <input type="text" className="form-control" placeholder="Código postal" value={codigoPostal} onChange={(e) => setCodigoPostal(e.target.value)} />
                </div>
                </>
                )}
                <div className="col-12 mb-3">
                  <label className="form-label"><i className="fas fa-comment me-1"></i> Observaciones</label>
                  <textarea className="form-control" rows={3} placeholder="Indicaciones para la entrega..." value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />
                </div>
              </div>
              )}

              {agregandoNueva && (
                <div className="d-flex gap-2 mt-2">
                  <button className="btn btn-danger" onClick={crearNuevaDireccion} disabled={guardandoDir || !direccion || !ciudad || !departamento}>
                    {guardandoDir ? "Guardando..." : "Guardar dirección"}
                  </button>
                  <button className="btn btn-outline-secondary" onClick={cancelarEdicion}>Cancelar</button>
                </div>
              )}

              {departamento.trim() ? (
                <div className="d-flex justify-content-between align-items-center mt-4 p-3 border rounded envio-precio-box">
                  <span className="fw-semibold"><i className="fas fa-truck me-2"></i>Costo de envío</span>
                  {envioCargando ? (
                    <strong className="text-muted"><i className="fas fa-spinner fa-spin me-1"></i> Calculando...</strong>
                  ) : costoEnvio > 0 ? (
                    <strong>${costoEnvio.toLocaleString("es-CO")}</strong>
                  ) : (
                    <strong className="text-success"><i className="fas fa-gift me-1"></i> Gratis</strong>
                  )}
                </div>
              ) : (
                <div className="alert alert-light border mt-4 mb-0 small py-2">
                  <i className="fas fa-info-circle me-1"></i> Selecciona tu departamento para calcular el costo de envío.
                </div>
              )}

              <div className="d-flex justify-content-end mt-3">
                {!formOk && <small className="text-danger align-self-center me-3">Completa los campos obligatorios para continuar</small>}
                <button className="btn btn-danger px-5 py-2 fw-bold" onClick={siguientePaso} disabled={!formOk}>
                  Siguiente <i className="fas fa-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            )}

            {paso === "pago" && (
            <div className="card shadow-sm border-0 p-4 card-seccion">
              <div className="card-header-custom">
                <i className="fas fa-credit-card me-2"></i>
                Método de pago <span className="text-danger ms-1">*</span>
              </div>
              <div className="mt-3">
                {[
                  { id: "tarjeta", icon: "fa-credit-card", label: "Tarjeta de crédito / débito" },
                  { id: "pse", icon: "fa-university", label: "PSE" },
                  { id: "nequi", icon: "fa-mobile-alt", label: "Nequi" },
                  { id: "daviplata", icon: "fa-mobile", label: "Daviplata" },
                ].map(({ id, icon, label }) => (
                  <div
                    className={`metodo-pago-item${metodoPago === id ? " seleccionado" : ""}`}
                    key={id}
                    onClick={() => setMetodoPago(id)}
                  >
                    <input className="form-check-input" type="radio" name="pago" id={`pago-${id}`} checked={metodoPago === id} onChange={() => setMetodoPago(id)} />
                    <label className="form-check-label" htmlFor={`pago-${id}`}>
                      <i className={`fas ${icon} me-2`}></i> {label}
                    </label>
                  </div>
                ))}

                {metodosGuardados.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>
                      <i className="fas fa-credit-card me-1"></i> Tus métodos guardados
                    </label>
                    <div className="d-flex flex-wrap gap-2">
                      {metodosGuardados.map((m) => (
                        <button
                          key={m.ID}
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          style={m.ES_PRINCIPAL ? { background: "#e63946", color: "#fff", borderColor: "#e63946" } : {}}
                          onClick={() => cargarMetodoGuardado(m)}
                        >
                          <i className="fas fa-credit-card me-1"></i>
                          {m.NOMBRE_METODO}
                          {m.TITULAR ? ` - ${m.TITULAR}` : ""}
                          {m.TELEFONO ? ` - ${m.TELEFONO}` : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="payment-fields mt-3">
                  {metodoPago === "tarjeta" && (
                    <div className="row">
                      <div className="col-12 mb-3">
                        <label className="form-label">Titular de la tarjeta <span className="text-danger">*</span></label>
                        <input type="text" className={paymentData.titular ? "form-control" : "form-control is-invalid"} placeholder="Nombre del titular" value={paymentData.titular || ""} onChange={(e) => updatePayment("titular", e.target.value)} />
                      </div>
                      <div className="col-12 mb-3">
                        <label className="form-label">Número de tarjeta <span className="text-danger">*</span></label>
                        <input type="text" className={paymentData.numero ? "form-control" : "form-control is-invalid"} placeholder="1234 5678 9012 3456" maxLength={19} value={paymentData.numero || ""} onChange={(e) => updatePayment("numero", e.target.value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim())} />
                      </div>
                      <div className="col-6 mb-3">
                        <label className="form-label">Vencimiento <span className="text-danger">*</span></label>
                        <input type="text" className={paymentData.vencimiento ? "form-control" : "form-control is-invalid"} placeholder="MM/AA" maxLength={5} value={paymentData.vencimiento || ""} onChange={(e) => {
                          let v = e.target.value.replace(/\D/g, "");
                          if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                          updatePayment("vencimiento", v);
                        }} />
                      </div>
                      <div className="col-6 mb-3">
                        <label className="form-label">CVV <span className="text-danger">*</span></label>
                        <input type="text" className={paymentData.cvv ? "form-control" : "form-control is-invalid"} placeholder="123" maxLength={4} value={paymentData.cvv || ""} onChange={(e) => updatePayment("cvv", e.target.value.replace(/\D/g, ""))} />
                      </div>
                    </div>
                  )}

                  {metodoPago === "nequi" && (
                    <div className="mb-3">
                      <label className="form-label">Número de celular Nequi <span className="text-danger">*</span></label>
                      <input type="text" className={paymentData.telefono ? "form-control" : "form-control is-invalid"} placeholder="300 123 4567" value={paymentData.telefono || ""} onChange={(e) => { updatePayment("telefono", e.target.value.replace(/\D/g, "")); setUsarMismoTelefono(false); }} />
                      {usuario?.TELEFONO && usuario.TELEFONO !== "N/A" && (
                        <div className="form-check mt-2">
                          <input className="form-check-input" type="checkbox" id="mismo-tel-nequi" checked={usarMismoTelefono} onChange={(e) => setUsarMismoTelefono(e.target.checked)} />
                          <label className="form-check-label" htmlFor="mismo-tel-nequi" style={{ fontSize: "0.9rem" }}>
                            Usar mi número de teléfono registrado ({usuario.TELEFONO})
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {metodoPago === "daviplata" && (
                    <div className="mb-3">
                      <label className="form-label">Número de celular Daviplata <span className="text-danger">*</span></label>
                      <input type="text" className={paymentData.telefono ? "form-control" : "form-control is-invalid"} placeholder="300 123 4567" value={paymentData.telefono || ""} onChange={(e) => { updatePayment("telefono", e.target.value.replace(/\D/g, "")); setUsarMismoTelefono(false); }} />
                      {usuario?.TELEFONO && usuario.TELEFONO !== "N/A" && (
                        <div className="form-check mt-2">
                          <input className="form-check-input" type="checkbox" id="mismo-tel-daviplata" checked={usarMismoTelefono} onChange={(e) => setUsarMismoTelefono(e.target.checked)} />
                          <label className="form-check-label" htmlFor="mismo-tel-daviplata" style={{ fontSize: "0.9rem" }}>
                            Usar mi número de teléfono registrado ({usuario.TELEFONO})
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {metodoPago === "pse" && (
                    <div className="mb-3">
                      <label className="form-label">Banco <span className="text-danger">*</span></label>
                      <select className={paymentData.banco ? "form-select" : "form-select is-invalid"} value={paymentData.banco || ""} onChange={(e) => updatePayment("banco", e.target.value)}>
                        <option value="">Selecciona tu banco</option>
                        {["Bancolombia", "BBVA", "Davivienda", "Banco de Bogotá", "Nequi", "Banco Popular", "Colpatria", "AV Villas"].map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-check mt-3">
                  <input className="form-check-input" type="checkbox" id="guardar-metodo" checked={guardarMetodoCheck} onChange={(e) => setGuardarMetodoCheck(e.target.checked)} />
                  <label className="form-check-label" htmlFor="guardar-metodo" style={{ fontSize: "0.85rem" }}>
                    <i className="fas fa-save me-1"></i> Guardar este método para futuras compras
                  </label>
                </div>

                <div className="d-flex justify-content-start mt-4">
                  <button className="btn btn-outline-dark px-4 py-2 fw-bold" onClick={() => irAPaso("envio")}>
                    <i className="fas fa-arrow-left me-1"></i> Atrás
                  </button>
                </div>
              </div>
            </div>
            )}
          </div>

          <div className="col-lg-5">
            <div className="card shadow-sm border-0 p-4 resumen-card">
              <div className="card-header-custom">
                <i className="fas fa-shopping-bag me-2"></i>
                Resumen del pedido
              </div>
              <div className="productos-lista mt-3">
                {cart.map((item) => (
                  <div className="producto-resumen" key={item.ID_CARRITO}>
                    <div className="producto-img-wrapper">
                      <img src={item.IMAGEN} alt={item.NOMBRE} loading="lazy" onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }} />
                      <span className="producto-cantidad-badge">{item.CANTIDAD}</span>
                    </div>
                    <div className="producto-info">
                      <h5>{item.NOMBRE}</h5>
                      {(item.COLOR || item.ATRIBUTO) && (
                        <small className="text-muted">
                          {item.COLOR && `Color: ${item.COLOR}`}
                          {item.COLOR && item.ATRIBUTO && " | "}
                          {item.ATRIBUTO && `${item.ATRIBUTO}`}
                        </small>
                      )}
                      {Number(item.STOCK) > 0 && Number(item.STOCK) <= 10 && (
                        <small className="text-warning d-block" style={{ fontWeight: 600 }}>
                          <i className="fas fa-exclamation-triangle me-1"></i>
                          Solo quedan {item.STOCK} unidades
                        </small>
                      )}
                      <div className="producto-qty-controls">
                        <button className="qty-btn" onClick={() => decreaseQuantity(item.ID_CARRITO)}>
                          <FaMinus />
                        </button>
                        <span>{item.CANTIDAD}</span>
                        <button className="qty-btn" onClick={() => increaseQuantity(item.ID_CARRITO)}>
                          <FaPlus />
                        </button>
                      </div>
                    </div>
                    <div className="producto-right">
                      {item.ID_DESCUENTO != null && Number(descuentosMap[item.ID_DESCUENTO]) > 0 ? (
                        <>
                          <div className="text-muted" style={{ fontSize: "0.8rem", textDecoration: "line-through" }}>
                            ${(Number(item.PRECIO) * item.CANTIDAD).toLocaleString("es-CO")}
                          </div>
                          <div className="producto-precio">
                            ${(Number(item.PRECIO) * (1 - Number(descuentosMap[item.ID_DESCUENTO]) / 100) * item.CANTIDAD).toLocaleString("es-CO")}
                          </div>
                          <span className="badge bg-danger" style={{ fontSize: "0.7rem" }}>-{descuentosMap[item.ID_DESCUENTO]}%</span>
                        </>
                      ) : (
                        <div className="producto-precio">
                          ${(item.PRECIO * item.CANTIDAD).toLocaleString("es-CO")}
                        </div>
                      )}
                      <button className="btn-remove-item" onClick={() => removeFromCart(item.ID_CARRITO)} title="Eliminar">
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="text-center mt-2">
                <button className="btn-add-more" onClick={() => navigate("/catalogo")}>
                  <FaPlus /> Agregar más productos
                </button>
              </div>

              <div className="cupon-section mt-4">
                <h5><i className="fas fa-tag me-1"></i> Cupón de descuento</h5>
                <div className="input-group mt-2">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Ingresa tu cupón"
                    value={cuponCodigo}
                    onChange={(e) => { setCuponCodigo(e.target.value); setCuponAplicado(null); setCuponError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && aplicarCupon()}
                  />
                  <button className="btn btn-outline-danger" onClick={aplicarCupon} disabled={cuponLoading}>
                    {cuponLoading ? "..." : "Aplicar"}
                  </button>
                </div>
                {cuponError && <small className="text-danger">{cuponError}</small>}
                {cuponAplicado && (
                  <small className="text-success">
                    ✅ Cupón aplicado: {cuponAplicado.descripcion} ({cuponAplicado.porcentaje}% OFF)
                  </small>
                )}
              </div>

              <hr />

              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Precio base</span>
                <strong>${subtotalBase.toLocaleString("es-CO")}</strong>
              </div>

              <div className="d-flex justify-content-between mb-2">
                <span className={descuentoProductos > 0 ? "text-success" : "text-muted"}>Descuento de productos</span>
                <strong className={descuentoProductos > 0 ? "text-success" : "text-muted"} style={{ fontWeight: descuentoProductos > 0 ? 700 : 400 }}>
                  -${descuentoProductos.toLocaleString("es-CO")}
                </strong>
              </div>

              <div className="d-flex justify-content-between mb-2 subtotal-jadda">
                <span className="fw-semibold">Subtotal</span>
                <strong>${subtotal.toLocaleString("es-CO")}</strong>
              </div>

              <div className="d-flex justify-content-between mb-2">
                <span className={descuento > 0 ? "text-success" : "text-muted"}>
                  Descuento cupón{cuponAplicado ? ` (${cuponAplicado.porcentaje}%)` : ""}
                </span>
                <strong className={descuento > 0 ? "text-success" : "text-muted"} style={{ fontWeight: descuento > 0 ? 600 : 400 }}>
                  -${descuento.toLocaleString("es-CO")}
                </strong>
              </div>

              <div className="d-flex justify-content-between mb-2">
                <span className="text-muted">Envío</span>
                {envioCargando ? (
                  <strong className="text-muted"><i className="fas fa-spinner fa-spin me-1"></i> Calculando...</strong>
                ) : costoEnvio > 0 ? (
                  <strong>${costoEnvio.toLocaleString("es-CO")}</strong>
                ) : (
                  <strong className="text-success"><i className="fas fa-truck me-1"></i> Gratis</strong>
                )}
              </div>
              <small className="text-muted d-block mb-2" style={{ fontSize: "0.75rem" }}>
                {departamento.trim() ? "El costo se calcula según tu departamento." : "Selecciona tu departamento para calcular el envío."}
                {subtotal < 800000 && <span> Envío gratis en compras desde $800.000.</span>}
              </small>

              <hr />

              <div className="d-flex justify-content-between total-jadda">
                <span>Total</span>
                <span>${total.toLocaleString("es-CO")}</span>
              </div>

              {paso === "envio" && !formOk && (
                <small className="text-danger d-block mt-2 text-center">Completa todos los campos obligatorios de envío</small>
              )}
              {paso === "pago" && formOk && !paymentOk() && (
                <small className="text-danger d-block mt-2 text-center">Completa los datos del método de pago</small>
              )}

              {paso === "pago" && (
                <button className={`btn btn-danger w-100 py-3 fw-bold mt-4 btn-pagar${isFormValid ? "" : " disabled-btn"}`} onClick={handleCheckout} disabled={!isFormValid || checkoutLoading}>
                  <i className={`fas ${checkoutLoading ? "fa-spinner fa-spin" : "fa-lock"} me-2`}></i>
                  {checkoutLoading ? "CONFIRMANDO COMPRA..." : isFormValid ? "PAGAR AHORA" : "COMPLETA LOS CAMPOS"}
                </button>
              )}

              <p className="text-center text-muted mt-2 mb-0 small">
                <i className="fas fa-shield-alt me-1"></i>
                Pago seguro con encriptación SSL
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default ResumenCompra;
