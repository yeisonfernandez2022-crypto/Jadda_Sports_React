import Navbar from "../components/Navbar";
import "../css/ResumenCompra.css";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import { FaTrash, FaPlus, FaMinus, FaEdit, FaSave, FaMapMarkerAlt, FaHome } from "react-icons/fa";
import { DEPARTAMENTOS } from "../data/colombia";
import { textoCondicionesCupon } from "../utils/reglasCupon";
import { escapeHtml } from "../utils/escapeHtml";
import BarraEnvioGratis from "../components/BarraEnvioGratis";

function detectCardBrand(number: string) {
  const clean = number.replace(/\s/g, "");
  if (/^4/.test(clean)) return "Visa";
  if (/^5[1-5]/.test(clean)) return "Mastercard";
  if (/^3[47]/.test(clean)) return "American Express";
  if (/^6/.test(clean)) return "Discover";
  return "Desconocida";
}

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
  const { cart, removeFromCart, decreaseQuantity, increaseQuantity, updateQuantity, clearCart, loadingCart } = useCart();
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

  // Sin método preseleccionado: el usuario elige (gris = sin elegir, rojo = elegido).
  // Se inicializa vacío y el método principal del perfil lo precarga si existe
  // (fetchMetodosGuardados → cargarMetodoGuardado).
  const [metodoPago, setMetodoPago] = useState("");
  const [paymentData, setPaymentData] = useState<PaymentData>({});
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Persistencia del paso y del formulario de envío en sessionStorage:
  // refrescar la página NO devuelve al paso de envío y conserva lo tecleado.
  const CLAVE_PASO_CHECKOUT = "jadda_checkout_paso";
  const CLAVE_ENVIO_CHECKOUT = "jadda_checkout_envio";
  const CLAVE_METODO_CHECKOUT = "jadda_checkout_metodo";

  const [paso, setPaso] = useState<"envio" | "pago" | "confirmacion">(() => {
    const guardado = sessionStorage.getItem(CLAVE_PASO_CHECKOUT);
    return guardado === "pago" || guardado === "confirmacion" ? guardado : "envio";
  });
  useEffect(() => {
    sessionStorage.setItem(CLAVE_PASO_CHECKOUT, paso);
  }, [paso]);
  const [agregandoMetodo, setAgregandoMetodo] = useState(false);

  const irAPaso = (p: "envio" | "pago" | "confirmacion") => {
    setPaso(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [cuponCodigo, setCuponCodigo] = useState("");
  const [cuponAplicado, setCuponAplicado] = useState<any>(null);
  const [cuponError, setCuponError] = useState("");
  const [cuponLoading, setCuponLoading] = useState(false);
  const [guardarMetodoCheck, setGuardarMetodoCheck] = useState(true);
  const [metodosGuardados, setMetodosGuardados] = useState<any[]>([]);
  const [metodoGuardadoId, setMetodoGuardadoId] = useState<number | null>(null);
  const [verMasProductos, setVerMasProductos] = useState(false);
  const [verResumenCompleto, setVerResumenCompleto] = useState(false);

  const [direcciones, setDirecciones] = useState<Direccion[]>([]);
  const [selectedDirId, setSelectedDirId] = useState<number | null>(null);
  // Ref espejo de selectedDirId para que los fetch asíncronos (fetchDirecciones)
  // no pisen la sesión restaurada al refrescar la página.
  const dirSelRef = useRef<number | null>(null);
  const setDirSel = (id: number | null) => {
    dirSelRef.current = id;
    setSelectedDirId(id);
  };
  const [editandoDirId, setEditandoDirId] = useState<number | null>(null);
  const [agregandoNueva, setAgregandoNueva] = useState(false);
  const [completarPrincipal, setCompletarPrincipal] = useState(false);
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState("");
  const [guardandoDir, setGuardandoDir] = useState(false);

  const [costoEnvio, setCostoEnvio] = useState(0);
  const [envioCargando, setEnvioCargando] = useState(false);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});


  // ---- DESPUÉS: useMemo para memoizar cálculos y evitar recálculos innecesarios ----
  const subtotalBase = useMemo(() =>
    (cart || []).reduce((acc, item) => acc + Number(item.PRECIO) * (Number(item.CANTIDAD) || 0), 0),
    [cart]
  );

  const descuentoProductos = useMemo(() =>
    (cart || []).reduce((acc, item) => {
      const pct = item.ID_DESCUENTO != null ? Number(descuentosMap[item.ID_DESCUENTO]) || 0 : 0;
      return acc + (pct > 0 ? Number(item.PRECIO) * (pct / 100) * (Number(item.CANTIDAD) || 0) : 0);
    }, 0),
    [cart, descuentosMap]
  );

  const subtotal = useMemo(() => subtotalBase - descuentoProductos, [subtotalBase, descuentoProductos]);
  const cuponCumpleMinimo = useMemo(
    () => !cuponAplicado?.monto_minimo || subtotal >= Number(cuponAplicado.monto_minimo),
    [cuponAplicado, subtotal]
  );
  const descuento = useMemo(
    () => cuponAplicado && cuponCumpleMinimo ? subtotal * (cuponAplicado.porcentaje / 100) : 0,
    [cuponAplicado, cuponCumpleMinimo, subtotal]
  );
  const total = useMemo(() => subtotal - descuento + costoEnvio, [subtotal, descuento, costoEnvio]);

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

  // Pasarela de pagos (Fase 6): si el backend la tiene activa, el checkout salta
  // al widget de la pasarela en vez de pedir tarjeta/Nequi aquí.
  const [gateway, setGateway] = useState<string | null>(null);
  const conPasarela = gateway === "wompi";

  useEffect(() => {
    axios
      .get("/api/pagos/config")
      .then((res) => setGateway(res.data.gateway || null))
      .catch(() => setGateway(null));
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

  // ---- ANTES: Validaciones inline en render ----
  // const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // const formOk =
  //   nombre.trim() !== "" &&
  //   correo.trim() !== "" && emailRegex.test(correo) &&
  //   telefono.trim() !== "" &&
  //   direccion.trim() !== "" &&
  //   ciudad.trim() !== "" &&
  //   departamento.trim() !== "";
  //
  // const paymentOk = () => {
  //   if (metodoPago === "tarjeta") {
  //     return !!paymentData.titular && !!paymentData.numero && !!paymentData.vencimiento && !!paymentData.cvv;
  //   }
  //   if (metodoPago === "nequi" || metodoPago === "daviplata") {
  //     return !!paymentData.telefono;
  //   }
  //   if (metodoPago === "pse") {
  //     return !!paymentData.banco;
  //   }
  //   return true;
  // };

  // ---- DESPUÉS: Funciones puras de validación separadas para testabilidad ----
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validarFormularioEnvio(): boolean {
    // El relleno "Sin especificar" (filas de registro parcial) NO cuenta como
    // lleno: es exactamente el caso del usuario con la casilla con texto.
    const esRelleno = (v: string) => v.trim().toLowerCase() === "sin especificar";
    return (
      nombre.trim() !== "" &&
      correo.trim() !== "" && emailRegex.test(correo) &&
      telefono.trim() !== "" &&
      direccion.trim() !== "" && !esRelleno(direccion) &&
      ciudad.trim() !== "" && !esRelleno(ciudad) &&
      departamento.trim() !== "" && !esRelleno(departamento)
    );
  }

  function validarMetodoPago(): boolean {
    // Sin selección NO hay método válido: los items sin elegir se ven grises
    // y la pantalla manda el aviso "Selecciona tu método de pago".
    if (!metodoPago) return false;
    // Tarjeta de crédito/débito (alias histórico "tarjeta"): exige datos completos.
    if (metodoPago === "credito" || metodoPago === "debito" || metodoPago === "tarjeta") {
      return !!paymentData.titular && !!paymentData.numero && !!paymentData.vencimiento && !!paymentData.cvv;
    }
    // Wompi: sin datos de pago en la app (el método concreto se elige dentro
    // del checkout seguro de Wompi, después de confirmar la compra).
    if (metodoPago === "wompi") return true;
    return false;
  }

  const isFormValid = validarFormularioEnvio() && validarMetodoPago() && cart.length > 0;

  // Guard: sin productos en el carrito la página NO es accesible y se devuelve
  // al inicio. saleRef evita el disparo justo después de crear la venta (el
  // carrito se limpia ANTES de navegar a compra-exitosa) y loadingCart evita
  // redirigir mientras el carrito aún se está trayendo del servidor.
  const salidaRef = useRef(false);
  useEffect(() => {
    if (loadingCart || salidaRef.current) return;
    if (cart.length === 0) {
      sessionStorage.removeItem(CLAVE_PASO_CHECKOUT);
      sessionStorage.removeItem(CLAVE_ENVIO_CHECKOUT);
      sessionStorage.removeItem(CLAVE_METODO_CHECKOUT);
      navigate("/", { replace: true });
    }
  }, [cart, loadingCart]);

  const updatePayment = (field: string, value: string) => {
    setPaymentData((prev) => ({ ...prev, [field]: value }));
  };

  // Al cambiar de método de pago se limpia el formulario de pago, PERO no cuando
  // la selección llega con datos ya cargados: precarga del método principal del
  // perfil, click en un chip guardado (cargarMetodoGuardado setea método + datos
  // juntos) ni restauración de sessionStorage. En esos casos el efecto solo
  // consume la bandera saltandoLimpiezaRef y conserva los datos (antes los
  // borraba justo después de precargarlos y el botón quedaba deshabilitado).
  const metodoPagoPrevioRef = useRef(metodoPago);
  const saltandoLimpiezaRef = useRef(false);
  useEffect(() => {
    if (metodoPago === metodoPagoPrevioRef.current) {
      saltandoLimpiezaRef.current = false;
      return;
    }
    metodoPagoPrevioRef.current = metodoPago;
    if (saltandoLimpiezaRef.current) {
      saltandoLimpiezaRef.current = false;
      return;
    }
    setPaymentData({});
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

  // Cada cambio del formulario de envío se guarda en sessionStorage. Al volver
  // a montar (refresh estando en el paso pago) se recupera DESPUÉS del prefill
  // del perfil, de modo que lo tecleado por el usuario siempre gana.
  useEffect(() => {
    // No se guarda hasta que la restauración inicial haya terminado (si se
    // guardara antes, escribiría en blanco y borraría el estado del refresh).
    if (!restauradoCheckoutRef.current) return;
    const datos = { direccion, barrio, ciudad, departamento, codigoPostal, telefono, selectedDirId };
    sessionStorage.setItem(CLAVE_ENVIO_CHECKOUT, JSON.stringify(datos));
  }, [direccion, barrio, ciudad, departamento, codigoPostal, telefono, selectedDirId]);

  // El método seleccionado (y sus datos, SIN el CVV) también se persiste: salir
  // del checkout y volver a entrar desde el carrito conserva la elección y el
  // avance — el botón de confirmar nace habilitado si todo ya estaba completo.
  useEffect(() => {
    if (!restauradoCheckoutRef.current) return;
    const { cvv: _cvv, ...sinCvv } = paymentData;
    sessionStorage.setItem(
      CLAVE_METODO_CHECKOUT,
      JSON.stringify({ metodoPago, metodoGuardadoId, paymentData: sinCvv })
    );
  }, [metodoPago, metodoGuardadoId, paymentData]);

  const restauradoCheckoutRef = useRef(false);
  // True cuando la restauración trajo un método: bloquea la precarga del
  // principal del perfil para no pisar la elección del usuario.
  const restauroMetodoRef = useRef(false);
  useEffect(() => {
    if (restauradoCheckoutRef.current || !usuario) return;
    restauradoCheckoutRef.current = true;
    try {
      const bruto = sessionStorage.getItem(CLAVE_ENVIO_CHECKOUT);
      if (bruto) {
        const d = JSON.parse(bruto);
        if (typeof d.direccion === "string") setDireccion(d.direccion);
        if (typeof d.barrio === "string") setBarrio(d.barrio);
        if (typeof d.ciudad === "string") setCiudad(d.ciudad);
        if (typeof d.departamento === "string") setDepartamento(d.departamento);
        if (typeof d.codigoPostal === "string") setCodigoPostal(d.codigoPostal);
        if (typeof d.telefono === "string" && d.telefono) setTelefono(d.telefono);
        if (d.selectedDirId != null) {
          dirSelRef.current = d.selectedDirId;
          setSelectedDirId(d.selectedDirId);
        }
      }
      const metodoBruto = sessionStorage.getItem(CLAVE_METODO_CHECKOUT);
      if (metodoBruto) {
        const m = JSON.parse(metodoBruto);
        if (m.metodoPago) setMetodoPago(m.metodoPago);
        if (m.metodoGuardadoId != null) setMetodoGuardadoId(m.metodoGuardadoId);
        if (m.paymentData && typeof m.paymentData === "object") {
          const { cvv: _cvvRest, ...restoSinCvv } = m.paymentData;
          setPaymentData(restoSinCvv);
        }
        // El efecto de limpieza de formulario no debe borrar lo restaurado:
        // sincronizar su ref con el valor restaurado.
        metodoPagoPrevioRef.current = m.metodoPago || "";
        restauroMetodoRef.current = true;
      }
    } catch { /* JSON corrupto: se ignora */ }
  }, [usuario]);

  // Etiqueta legible del método de pago activo para el resumen completo.
  const etiquetaMetodoSeleccionado = () => {
    // Con nada seleccionado el chip de confirmación no puede mostrarse vacío.
    if (!metodoPago && !metodoGuardadoId) return "Sin método seleccionado";
    const guardado = metodosGuardados.find((m: any) => m.ID === metodoGuardadoId);
    if (guardado) {
      const extra = guardado.TITULAR || guardado.TELEFONO ? ` - ${guardado.TITULAR || guardado.TELEFONO}` : "";
      return `${guardado.NOMBRE_METODO}${extra}`;
    }
    const nombres: Record<string, string> = {
      credito: "Tarjeta de crédito",
      debito: "Tarjeta de débito",
      wompi: "Wompi (método se elige dentro)",
      tarjeta: "Tarjeta",
    };
    const detalles: Record<string, string> = {
      credito: paymentData.titular ? ` · ${paymentData.titular}` : "",
      debito: paymentData.titular ? ` · ${paymentData.titular}` : "",
      tarjeta: paymentData.titular ? ` · ${paymentData.titular}` : "",
    };
    return `${nombres[metodoPago] || metodoPago}${detalles[metodoPago] || ""}`;
  };

  const fetchMetodosGuardados = async () => {
    try {
      const res = await axios.get("/api/usuarios/metodos-pago", { withCredentials: true });
      // La app solo ofrece tarjeta débito/crédito (+ la pasarela Wompi): los
      // métodos guardados del catálogo viejo (Nequi, Daviplata, PSE, etc.) ya
      // no se ofrecen en el checkout ni como chips.
      const visibles = (res.data || []).filter(
        (m: any) => Number(m.ID_METODO) === 2 || Number(m.ID_METODO) === 3
      );
      setMetodosGuardados(visibles);
      const principal = visibles.find((m: any) => m.ES_PRINCIPAL);
      // La precarga del principal NO pisa una selección restaurada de
      // sessionStorage (restauroMetodoRef).
      if (principal && !restauroMetodoRef.current) {
        cargarMetodoGuardado(principal);
      }
    } catch {
      /* sin métodos guardados: el usuario ingresa uno nuevo */
    }
  };

  function cargarMetodoGuardado(m: any) {
    const mapMetodo: Record<number, string> = { 2: "debito", 3: "credito" };
    const metodoKey = Object.entries(mapMetodo).find(([id]) => Number(id) === m.ID_METODO)?.[1];
    if (!metodoKey) return;
    saltandoLimpiezaRef.current = true;
    setMetodoPago(metodoKey);
    setMetodoGuardadoId(m.ID);
    const data: PaymentData = {};
    if (m.TITULAR) data.titular = m.TITULAR;
    if (m.TELEFONO) data.telefono = m.TELEFONO;
    if (m.BANCO) data.banco = m.BANCO;
    setPaymentData(data);
  }

  // Borrado de un método guardado desde el paso de pago (con confirmación).
  // Si se elimina el seleccionado se pasa al principal restante; si no queda
  // ninguno vuelve la lista de métodos (radio) con el formulario en blanco.
  // Selección de método guardado con DESELECCIÓN: un segundo click en el chip
  // activo lo quita (vuelve a "nada seleccionado") y la pantalla vuelve a pedir
  // elegir método con el aviso pequeño.
  function seleccionarMetodoGuardado(m: any) {
    if (m.ID === metodoGuardadoId) {
      setMetodoGuardadoId(null);
      setMetodoPago("");
      setPaymentData({});
      setAgregandoMetodo(false);
      return;
    }
    cargarMetodoGuardado(m);
    setAgregandoMetodo(false);
  }

  const eliminarMetodoGuardado = async (m: any, e?: { stopPropagation: () => void }) => {
    e?.stopPropagation();
    const r = await Swal.fire({
      icon: "warning",
      title: "¿Eliminar este método?",
      html: `<strong>${escapeHtml(m.NOMBRE_METODO || "Método")}${m.TITULAR ? ` – ${escapeHtml(m.TITULAR)}` : ""}</strong> ya no estará disponible en tus próximas compras. Esta acción no se puede deshacer.`,
      showCancelButton: true,
      confirmButtonText: "Sí, eliminar",
      confirmButtonColor: "#e63946",
      cancelButtonText: "Cancelar",
      reverseButtons: true,
      focusCancel: true,
    });
    if (!r.isConfirmed) return;
    try {
      await axios.delete(`/api/usuarios/metodos-pago/${m.ID}`, { withCredentials: true });
      const queda = metodosGuardados.filter((x: any) => x.ID !== m.ID);
      setMetodosGuardados(queda);
      if (m.ID === metodoGuardadoId) {
        if (queda.length > 0) {
          const principal = queda.find((x: any) => x.ES_PRINCIPAL) || queda[0];
          cargarMetodoGuardado(principal);
        } else {
          setMetodoGuardadoId(null);
          setMetodoPago("");
          setPaymentData({});
        }
      }
      Swal.fire({ icon: "success", title: "Método eliminado", timer: 1500, showConfirmButton: false });
    } catch {
      Swal.fire({ icon: "error", title: "No se pudo eliminar el método", text: "Inténtalo de nuevo.", confirmButtonColor: "#e63946" });
    }
  };

  const fetchDirecciones = async () => {
    try {
      const res = await axios.get("/api/direcciones", { withCredentials: true });
      setDirecciones(res.data);
      const principal = res.data.find((d: Direccion) => d.ES_PRINCIPAL === 1) || res.data[0];
      if (principal && dirSelRef.current === null) {
        setDirSel(principal.ID_DIRECCION);
        llenarFormConDireccion(principal);
        // Si la principal viene incompleta (creada en el registro), se abre directa en modo
        // "completar": el usuario solo ve dirección, barrio, ciudad, departamento y observaciones.
        if (direccionIncompleta(principal)) {
          setEditandoDirId(principal.ID_DIRECCION);
          setCompletarPrincipal(true);
        }
      } else if (res.data.length === 0 && dirSelRef.current === null && !agregandoNueva && editandoDirId === null) {
        // Sin direcciones guardadas (recién registrado): el formulario de envío SE ABRE SOLO
        // para que llenar los campos obligatorios sea una obligación visible de una.
        setAgregandoNueva(true);
      }
    } catch { /* sin direcciones */ }
  };

  function direccionIncompleta(dir: Direccion) {
    return !dir.DIRECCION || dir.DIRECCION.includes("@") || dir.CIUDAD === 'Sin especificar' || !dir.CIUDAD ||
           dir.DEPARTAMENTO === 'Sin especificar' || !dir.DEPARTAMENTO;
  }

  function llenarFormConDireccion(dir: Direccion) {
    // Dirección de correo (autofill viejo) y relleno "Sin especificar" (registro
    // parcial) se muestran EN BLANCO: los campos obligatorios deben empezar
    // vacíos para que la validación de envío los exija de verdad.
    const esCorreo = (dir.DIRECCION || "").includes("@");
    const esRelleno = (v: string | null | undefined) => !v || v.trim().toLowerCase() === "sin especificar";
    setDireccion(esCorreo || esRelleno(dir.DIRECCION) ? "" : dir.DIRECCION);
    setBarrio(dir.BARRIO && !esRelleno(dir.BARRIO) ? dir.BARRIO : "");
    setCiudad(esRelleno(dir.CIUDAD) ? "" : dir.CIUDAD || "");
    setDepartamento(esRelleno(dir.DEPARTAMENTO) ? "" : dir.DEPARTAMENTO || "");
    setCodigoPostal(dir.CODIGO_POSTAL && !esRelleno(dir.CODIGO_POSTAL) ? dir.CODIGO_POSTAL : "");
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
    // Con un segundo click sobre la dirección activa se DESELECCIONA (vuelve a
    // "nada elegido" y reaparece el aviso de seleccionar dirección).
    if (selectedDirId === dir.ID_DIRECCION && editandoDirId === null) {
      setDirSel(null);
      return;
    }
    setDirSel(dir.ID_DIRECCION);
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
      if (selectedDirId === id) setDirSel(null);
      fetchDirecciones();
    } catch (err) {
      console.error("Error al eliminar dirección:", err);
    }
  };

  const crearNuevaDireccion = async () => {
    if (!direccion || !ciudad || !departamento) return;
    if (!completarPrincipal && (!nombre.trim() || !telefono.trim() || !correo.trim() || !emailRegex.test(correo))) return;
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
      setDirSel(res.data.id);
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

  const aplicarCupon = async (codigoArg?: string) => {
    const code = (codigoArg ?? cuponCodigo).trim();
    if (!code) return;
    if (codigoArg) setCuponCodigo(codigoArg);
    setCuponLoading(true);
    setCuponError("");
    try {
      const res = await axios.post("/api/cupones/validar", { codigo: code });
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

  // ===== Panel de cupones disponibles (tienda + personales del usuario) =====
  const [mostrarCupones, setMostrarCupones] = useState(false);
  const [listaCupones, setListaCupones] = useState<{ tienda: any[]; personales: any[] } | null>(null);
  const [cargandoLista, setCargandoLista] = useState(false);

  const toggleVerCupones = async () => {
    const abrir = !mostrarCupones;
    setMostrarCupones(abrir);
    if (abrir && !listaCupones) {
      setCargandoLista(true);
      try {
        const res = await axios.get("/api/cupones/disponibles", { withCredentials: true });
        if (res.data.ok) setListaCupones({ tienda: res.data.tienda || [], personales: res.data.personales || [] });
      } catch {
        setListaCupones({ tienda: [], personales: [] });
      } finally {
        setCargandoLista(false);
      }
    }
  };

  const cuponUsable = (c: any) => !c.usado && !c.expirado;
  const faltantePara = (c: any) =>
    c.monto_minimo != null && subtotal < Number(c.monto_minimo)
      ? Number(c.monto_minimo) - subtotal
      : 0;

  const renderCuponItem = (c: any, esPersonal: boolean) => {
    const usable = cuponUsable(c);
    const faltan = faltantePara(c);
    return (
      <div key={c.codigo} className="d-flex align-items-start justify-content-between gap-2 border rounded-3 p-2 mb-2">
        <div style={{ minWidth: 0 }}>
          <div className="fw-bold" style={{ fontSize: "0.85rem" }}>{c.codigo}</div>
          <small className="text-muted d-block">
            {textoCondicionesCupon(c.codigo, c.porcentaje, c.monto_minimo, c.fecha_fin)}
            {esPersonal && c.reto_titulo ? ` · reto: ${c.reto_titulo}` : ""}
          </small>
          {usable && faltan > 0 && (
            <small className="text-warning d-block">Te faltan ${faltan.toLocaleString("es-CO")} para alcanzar el mínimo</small>
          )}
        </div>
        {usable ? (
          <button
            className="btn btn-sm btn-outline-danger flex-shrink-0"
            onClick={() => aplicarCupon(c.codigo)}
          >
            Usar
          </button>
        ) : (
          <span className="badge bg-secondary flex-shrink-0">{c.usado ? "Ya usado" : "Expirado"}</span>
        )}
      </div>
    );
  };

  const handleCheckout = async () => {
    if (!isFormValid) return;
    setCheckoutLoading(true);
    try {
      // Dos vías de pago:
      // - Wompi: la venta nace PENDIENTE_PAGO y al confirmar se abre el widget;
      //   aquí NO se piden datos de pago.
      // - Tarjeta (credito/débito): la app simula el pago internamente; se
      //   tokenizan los datos localmente (sin CVV/número completos al backend)
      //   y la venta nace COMPLETADA.
      const esTarjeta = metodoPago === "credito" || metodoPago === "debito" || metodoPago === "tarjeta";
      let paymentToken = null;
      let paymentLast4 = null;
      let paymentBrand = null;

      if (esTarjeta && paymentData.numero) {
        const cleanNumber = paymentData.numero.replace(/\s/g, "");
        paymentLast4 = cleanNumber.slice(-4);
        // Simular tokenización (en producción: token = await gateway.tokenize(cardData))
        paymentToken = `tok_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        paymentBrand = detectCardBrand(cleanNumber);
      }

      // Preparar paymentData seguro para el backend (sin CVV, sin número completo)
      const safePaymentData = {
        ...paymentData,
        // No enviar CVV ni número completo al backend
        cvv: undefined,
        numero: undefined,
        // Solo datos tokenizados
        token: paymentToken,
        last4: paymentLast4,
        brand: paymentBrand,
      };

      const res = await axios.post("/api/checkout/procesar", {
        metodoPago,
        paymentData: safePaymentData,
        cuponCodigo: cuponAplicado && cuponCumpleMinimo ? cuponCodigo : "",
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
        // Guardar método de pago si el usuario lo solicitó (solo tarjetas:
        // Wompi no guarda datos propios en la app).
        if (guardarMetodoCheck && esTarjeta) {
          const idMetodoMap: Record<string, number> = { credito: 3, debito: 2, tarjeta: 2 };
          await axios.post("/api/usuarios/metodos-pago", {
            id_metodo: idMetodoMap[metodoPago] || 2,
            titular: paymentData.titular || null,
            telefono: paymentData.telefono || null,
            banco: paymentData.banco || null,
          }, { withCredentials: true }).catch(() => {});
        }
        // La venta ya se creó: el guard de carrito vacío queda suspendido hasta
        // la navegación a compra-exitosa.
        salidaRef.current = true;
        clearCart();
        sessionStorage.removeItem(CLAVE_PASO_CHECKOUT);
        sessionStorage.removeItem(CLAVE_ENVIO_CHECKOUT);
        sessionStorage.removeItem(CLAVE_METODO_CHECKOUT);

        // Solo la vía Wompi abre el checkout externo: la venta nace
        // PENDIENTE_PAGO y el cobro ocurre en el widget. Con tarjeta la venta
        // ya quedó COMPLETADA (simulación interna) y se navega normal.
        if (conPasarela && metodoPago === "wompi") {
          try {
            const rPago = await axios.post("/api/pagos/pagar", { idVenta: res.data.ventaId }, { withCredentials: true });
            if (rPago.data?.urlCheckout) {
              window.location.href = rPago.data.urlCheckout;
              return;
            }
          } catch (pagoErr: any) {
            const msg = pagoErr?.response?.data?.message || "No se pudo iniciar el pago. Vuelve a intentarlo desde el pedido";
            Swal.fire({
              icon: "warning",
              title: "Tu pedido quedó pendiente de pago",
              text: msg,
              confirmButtonColor: "#e63946",
              confirmButtonText: "VER MI PEDIDO",
            }).then(() => {
                navigate(`/compra-exitosa/${res.data.ventaId}`);
            });
            return;
          }
          navigate(`/compra-exitosa/${res.data.ventaId}`);
          return;
        }

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

  // Bloque de cupón compartido: el mismo formulario se muestra en el resumen
  // completo del panel y en la tarjeta de confirmación (desde 2026-10-26 el
  // cupón también se aplica desde ahí).
  const bloqueCupon = (
    <div className="cupon-section">
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
        <button className="btn btn-outline-danger" onClick={() => aplicarCupon()} disabled={cuponLoading}>
          {cuponLoading ? "..." : "Aplicar"}
        </button>
      </div>
      {cuponError && <small className="text-danger d-block mt-1">{cuponError}</small>}
      {cuponAplicado && (
        <div className="mt-2">
          <small className="text-success d-block">
            ✅ Cupón aplicado: {cuponAplicado.descripcion} ({cuponAplicado.porcentaje}% OFF)
          </small>
          <small className="text-muted d-block mt-1">
            Condiciones: {textoCondicionesCupon(cuponAplicado.descripcion, cuponAplicado.porcentaje, cuponAplicado.monto_minimo, cuponAplicado.fecha_fin)}
          </small>
          {!cuponCumpleMinimo && (
            <small className="text-danger d-block mt-1 fw-bold">
              ⚠️ Tu carrito no alcanza el mínimo: este cupón aplica en compras superiores a ${Number(cuponAplicado.monto_minimo).toLocaleString("es-CO")} (llevas ${subtotal.toLocaleString("es-CO")}). Agrega más productos para activarlo.
            </small>
          )}
        </div>
      )}

      <button
        className="btn btn-sm btn-link text-decoration-none px-0 mt-2 fw-bold"
        onClick={toggleVerCupones}
      >
        {mostrarCupones ? "▲ Ocultar cupones disponibles" : "▼ Ver cupones disponibles y los tuyos"}
      </button>

      {mostrarCupones && (
        <div className="border rounded-3 p-2 mt-2 bg-light">
          {cargandoLista ? (
            <div className="text-center text-muted py-2"><small>Cargando cupones…</small></div>
          ) : (
            <>
              {(listaCupones?.personales?.length ?? 0) > 0 && (
                <>
                  <div className="fw-bold small text-uppercase text-muted mb-2">🎟️ Tus cupones ganados en retos</div>
                  {listaCupones!.personales.map((c: any) => renderCuponItem(c, true))}
                </>
              )}
              {(listaCupones?.tienda?.length ?? 0) > 0 ? (
                <>
                  <div className="fw-bold small text-uppercase text-muted mb-2 mt-3">🏷️ Promociones de la tienda</div>
                  {listaCupones!.tienda.map((c: any) => renderCuponItem(c, false))}
                </>
              ) : (listaCupones?.personales?.length ?? 0) === 0 ? (
                <div className="text-center text-muted py-2"><small>No hay cupones disponibles por ahora. Completa un reto para ganar el tuyo.</small></div>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      <Navbar />

      <div className="checkout-steps mb-2">
        <div className="step active">
          <i className="fas fa-shopping-cart"></i>
          <span>Carrito</span>
        </div>
        <div className="line"></div>
        <div className={`step${paso === "envio" || paso === "pago" || paso === "confirmacion" ? " active" : ""}`}>
          <i className="fas fa-truck"></i>
          <span>Envío</span>
        </div>
        <div className="line"></div>
        <div className={`step${paso === "pago" || paso === "confirmacion" ? " active" : ""}`}>
          <i className="fas fa-credit-card"></i>
          <span>Pago</span>
        </div>
        <div className="line"></div>
        <div className={`step${paso === "confirmacion" ? " active" : ""}`}>
          <i className="fas fa-check"></i>
          <span>Confirmación</span>
        </div>
      </div>

      <div className="container py-2">
        <div className="btn-back-row-checkout">
          <button className="btn-back-checkout" onClick={() => navigate("/")} title="Volver al inicio">
            <FaHome /> Inicio
          </button>
        </div>

        <h1 className="fw-bold mb-3 text-center titulo-finalizar">
          <i className="fas fa-receipt me-2"></i>
          FINALIZAR COMPRA
        </h1>

        <div className="row g-4 align-items-start">
          <div className={paso === "confirmacion" ? "col-lg-12" : "col-lg-7"}>
            {paso === "envio" && (
            <div className="card shadow-sm border-0 p-4 mb-4 card-seccion card-seccion-envio">
              <div className="card-header-custom">
                <i className="fas fa-map-marker-alt me-2"></i>Información de envío <span className="text-danger ms-1">*</span>
              </div>

              {direcciones.length > 0 && !agregandoNueva && (
                <div className="d-flex flex-wrap align-items-center gap-2 mt-3">
                  {direcciones.map((dir: Direccion) => {
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

              {direcciones.length > 0 && !agregandoNueva && editandoDirId === null && !selectedDirId && (
                <small className="dir-seleccion-hint">
                  <i className="fas fa-hand-pointer me-1"></i>
                  Selecciona una dirección de envío
                </small>
              )}

              {!agregandoNueva && (
                <div className="mt-3">
                  <button className="btn btn-outline-danger" onClick={() => {
                    const principal = direcciones.find((d) => d.ES_PRINCIPAL === 1) || direcciones[0];
                    // Si la principal es la creada en el registro (incompleta), se completa, no se crea otra
                    if (principal && direccionIncompleta(principal)) {
                      llenarFormConDireccion(principal);
                      setDirSel(principal.ID_DIRECCION);
                      setEditandoDirId(principal.ID_DIRECCION);
                      setCompletarPrincipal(true);
                      setAgregandoNueva(false);
                    } else {
                      setAgregandoNueva(true); setEditandoDirId(null); setDirSel(null); setNuevaEtiqueta(""); limpiarFormDireccion(); setCompletarPrincipal(false);
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
                    {deptosParaSelect.map((d: string) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {!departamento.trim() && <small className="text-danger">Requerido</small>}
                </div>
                <div className="col-md-6 mb-3">
                  <label className="form-label"><i className="fas fa-city me-1"></i> Ciudad <span className="text-danger">*</span></label>
                  <select className={selectClass(ciudad)} value={ciudad} onChange={(e) => setCiudad(e.target.value)} disabled={!departamento}>
                    <option value="">{departamento ? "Selecciona tu ciudad" : "Primero elige departamento"}</option>
                    {ciudadesParaSelect.map((c: string) => <option key={c} value={c}>{c}</option>)}
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
                <div className="d-flex gap-2 mt-2 align-items-center">
                  <button
                    className="btn btn-danger"
                    onClick={crearNuevaDireccion}
                    disabled={guardandoDir || !direccion.trim() || !ciudad.trim() || !departamento.trim() || (!completarPrincipal && (!nombre.trim() || !telefono.trim() || !correo.trim() || !emailRegex.test(correo)))}
                  >
                    {guardandoDir ? "Guardando..." : "Guardar dirección"}
                  </button>
                  {!direccion.trim() || !ciudad.trim() || !departamento.trim() || (!completarPrincipal && (!nombre.trim() || !telefono.trim() || !correo.trim() || !emailRegex.test(correo))) ? (
                    <small className="text-danger">Completa los campos obligatorios para guardar</small>
                  ) : null}
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
                {!validarFormularioEnvio() && <small className="text-danger align-self-center me-3">Completa los campos obligatorios para continuar</small>}
                <button className="btn btn-danger px-5 py-2 fw-bold" onClick={siguientePaso} disabled={!validarFormularioEnvio()}>
                  Siguiente <i className="fas fa-arrow-right ms-1"></i>
                </button>
              </div>
            </div>
            )}

            {paso === "pago" && (
            <div className="card shadow-sm border-0 p-4 card-seccion">
              <div className="card-header-custom">
                <i className="fas fa-credit-card me-2"></i>
                Selecciona tu método de pago <span className="text-danger ms-1">*</span>
              </div>
              <div className="mt-3">
                {(metodosGuardados.length === 0 || agregandoMetodo) && (
                  <>
                    <div className="mb-2 fw-semibold" style={{ fontSize: "0.85rem" }}>
                      <i className="fas fa-credit-card me-1"></i> Nuevos métodos disponibles
                    </div>
                    {[
                      { id: "credito", icon: "fa-credit-card", label: "Tarjeta de crédito" },
                      { id: "debito", icon: "fa-credit-card", label: "Tarjeta de débito" },
                      { id: "wompi", icon: "fa-shield-alt", label: "Wompi (pago seguro externo)" },
                    ].map(({ id, icon, label }: { id: string; icon: string; label: string }) => (
                      <div
                        className={`metodo-pago-item${metodoPago === id ? " seleccionado" : ""}`}
                        key={id}
                        onClick={() => {
                          // Toggle: click sobre el método activo lo deselecciona.
                          if (metodoPago === id) {
                            setMetodoPago("");
                            if (metodosGuardados.length > 0) setAgregandoMetodo(false);
                            return;
                          }
                          setMetodoPago(id);
                          // Con métodos guardados el formulario de datos vive plegado:
                          // se abre solo cuando el usuario quiere ingresar un método nuevo.
                          if (metodosGuardados.length > 0) setAgregandoMetodo(true);
                        }}
                      >
                        <input className="form-check-input" type="radio" name="pago" id={`pago-${id}`} checked={metodoPago === id} onChange={() => setMetodoPago(id)} />
                        <label className="form-check-label" htmlFor={`pago-${id}`}>
                          <i className={`fas ${icon} me-2`}></i> {label}
                        </label>
                        <i className={`fas fa-check-circle metodo-check${metodoPago === id ? " activo" : ""}`} aria-hidden="true"></i>
                      </div>
                    ))}
                  </>
                )}

                {metodosGuardados.length > 0 && (
                  <div className="mb-3">
                    <label className="form-label fw-semibold" style={{ fontSize: "0.85rem" }}>
                      <i className="fas fa-credit-card me-1"></i> Tus métodos guardados
                    </label>
                    <div className="d-flex flex-wrap gap-2">
                      {metodosGuardados.map((m: any) => (
                        <div
                          key={m.ID}
                          role="button"
                          tabIndex={0}
                          className={`chip-metodo-guardado${m.ID === metodoGuardadoId ? " seleccionado" : ""}`}
                          onClick={() => seleccionarMetodoGuardado(m)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); seleccionarMetodoGuardado(m); } }}
                        >
                          <i className="fas fa-credit-card"></i>
                          <span>
                            {m.NOMBRE_METODO}
                            {m.TITULAR ? ` - ${m.TITULAR}` : ""}
                            {m.TELEFONO ? ` - ${m.TELEFONO}` : ""}
                          </span>
                          {m.ID === metodoGuardadoId ? (
                            <i className="fas fa-check-circle chip-check" aria-hidden="true"></i>
                          ) : m.ES_PRINCIPAL ? (
                            <i className="fas fa-star chip-principal" title="Método principal"></i>
                          ) : null}
                          <button
                            type="button"
                            className="btn-quitar-metodo"
                            title="Eliminar método"
                            aria-label={`Eliminar ${m.NOMBRE_METODO}`}
                            onClick={(ev) => eliminarMetodoGuardado(m, ev)}
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>
                      ))}
                      {!agregandoMetodo && (
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => { setPaymentData({}); setAgregandoMetodo(true); }}
                        >
                          <i className="fas fa-plus me-1"></i> Agregar método de pago
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {!metodoPago && !metodoGuardadoId && (
                  <small className="pago-seleccion-hint">
                    <i className="fas fa-hand-pointer me-1"></i>
                    Selecciona tu método de pago
                  </small>
                )}

                {(metodosGuardados.length === 0 || agregandoMetodo) && (
                <>
                <div className="payment-fields mt-3">
                  {metodoPago === "wompi" && (
                    <div className="wompi-aviso">
                      <div className="wompi-aviso-titulo">
                        <i className="fas fa-shield-alt"></i> Métodos disponibles en Wompi
                      </div>
                      <div className="wompi-aviso-lista">
                        <span><i className="fas fa-credit-card"></i> Tarjeta de crédito</span>
                        <span><i className="fas fa-credit-card"></i> Tarjeta de débito</span>
                        <span><i className="fas fa-mobile-alt"></i> Nequi</span>
                        <span><i className="fas fa-university"></i> PSE</span>
                        <span><i className="fas fa-university"></i> Bancolombia</span>
                      </div>
                      <p className="wompi-aviso-nota">
                        No pedimos datos de pago en la app: estos métodos se eligen DENTRO del checkout
                        seguro de Wompi, después de confirmar tu compra.
                      </p>
                    </div>
                  )}

                  {(metodoPago === "credito" || metodoPago === "debito") && (
                    <div className="row">
                      <div className="col-12 mb-3">
                        <label className="form-label">Titular de la tarjeta {metodoPago === "credito" ? "de crédito" : "de débito"} <span className="text-danger">*</span></label>
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
                        <input type="password" className={paymentData.cvv ? "form-control" : "form-control is-invalid"} placeholder="123" maxLength={4} value={paymentData.cvv || ""} onChange={(e) => updatePayment("cvv", e.target.value.replace(/\D/g, ""))} />
                        <div className="form-text text-muted small">El CVV no se almacena; solo se usa para tokenizar el pago.</div>
                      </div>
                    </div>
                  )}
                </div>

                {(metodoPago === "credito" || metodoPago === "debito") && (
                  <div className="form-check mt-3">
                    <input className="form-check-input" type="checkbox" id="guardar-metodo" checked={guardarMetodoCheck} onChange={(e) => setGuardarMetodoCheck(e.target.checked)} />
                    <label className="form-check-label" htmlFor="guardar-metodo" style={{ fontSize: "0.85rem" }}>
                      <i className="fas fa-save me-1"></i> Guardar este método para futuras compras
                    </label>
                  </div>
                )}
                </>
                )}

                <div className="d-flex gap-2 mt-4">
                  <button className="btn btn-outline-dark px-3 px-md-4 py-3 fw-bold" onClick={() => irAPaso("envio")} title="Volver al paso de envío">
                    <i className="fas fa-arrow-left me-1"></i> Atrás
                  </button>
                  <button
                    className="btn btn-danger px-3 px-md-4 py-3 fw-bold flex-grow-1"
                    onClick={() => irAPaso("confirmacion")}
                    disabled={!validarMetodoPago()}
                  >
                    <i className="fas fa-arrow-right me-1"></i> Revisar pedido
                  </button>
                </div>
              </div>
            </div>
            )}

            {paso === "confirmacion" && (
              <div className="card shadow-sm border-0 p-4 mb-4 card-seccion card-seccion-confirmacion">
                <div className="card-header-custom">
                  <i className="fas fa-clipboard-check me-2"></i> Último paso: revisa tu compra <span className="text-danger ms-1">*</span>
                </div>

                {/* Productos */}
                <div className="revision-seccion mt-3">
                  <h5><i className="fas fa-box me-2"></i>Productos ({cart.length})</h5>
                  {cart.map((item: any) => {
                    const pct = item.ID_DESCUENTO != null && Number(descuentosMap[item.ID_DESCUENTO]) > 0 ? Number(descuentosMap[item.ID_DESCUENTO]) : 0;
                    return (
                      <div className="revision-prod" key={item.ID_CARRITO}>
                        <img src={item.IMAGEN} alt={item.NOMBRE} className="rev-img" loading="lazy" onError={(e) => { e.currentTarget.src = "https://placehold.co/400x400?text=JADDA"; }} />
                        <div className="rev-info">
                          <div className="rev-nombre">{item.NOMBRE}</div>
                          {(item.COLOR || item.ATRIBUTO) && (
                            <small className="text-muted">
                              {item.COLOR && `Color: ${item.COLOR}`}
                              {item.COLOR && item.ATRIBUTO && " | "}
                              {item.ATRIBUTO}
                            </small>
                          )}
                          <small className="rev-cant">
                            {pct > 0 && <span className="rev-desc">-{pct}%</span>}
                            ${Math.round(Number(item.PRECIO) * (1 - pct / 100)).toLocaleString("es-CO")} c/u · Cantidad: {item.CANTIDAD}
                          </small>
                        </div>
                        <div className="rev-subtotal">
                          ${Math.round(Number(item.PRECIO) * (1 - pct / 100) * item.CANTIDAD).toLocaleString("es-CO")}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Envío + Pago + Cupón */}
                <div className="revision-grid mt-3">
                  <div className="revision-seccion">
                    <div className="rev-seccion-head">
                      <h5 className="mb-0"><i className="fas fa-user me-2"></i>Contacto y envío</h5>
                      <button className="btn-rev-editar" onClick={() => irAPaso("envio")} title="Cambiar o agregar datos de envío">
                        <FaEdit /> Editar
                      </button>
                    </div>
                    <div className="rev-dato"><span>Nombre</span><strong>{nombre || "—"}</strong></div>
                    <div className="rev-dato"><span>Correo</span><strong>{correo || "—"}</strong></div>
                    <div className="rev-dato"><span>Teléfono</span><strong>{telefono || "—"}</strong></div>
                    <div className="rev-dato"><span>Dirección</span><strong>{direccion || "—"}{barrio ? `, ${barrio}` : ""}</strong></div>
                    <div className="rev-dato"><span>Ciudad</span><strong>{ciudad || "—"}{departamento ? `, ${departamento}` : ""}{codigoPostal ? ` · CP ${codigoPostal}` : ""}</strong></div>
                    {observaciones.trim() && <div className="rev-dato"><span>Observaciones</span><strong>{observaciones}</strong></div>}
                  </div>

                  <div className="revision-seccion">
                    <div className="rev-seccion-head">
                      <h5 className="mb-0"><i className="fas fa-credit-card me-2"></i>Método de pago</h5>
                      <button className="btn-rev-editar" onClick={() => irAPaso("pago")} title="Cambiar el método de pago">
                        <FaEdit /> Cambiar método
                      </button>
                    </div>
                    <div className="revision-pago-chip">
                      <i className="fas fa-check-circle"></i>
                      <span>{etiquetaMetodoSeleccionado()}</span>
                    </div>
                    {metodoPago === "wompi" && conPasarela ? (
                      <small className="text-muted d-block mt-2">
                        <i className="fas fa-shield-alt me-1"></i>
                        El pago se procesa con la pasarela <strong>Wompi</strong>: al confirmar se abrirá su checkout seguro, donde eliges cómo pagar (tarjeta, Nequi, PSE o Bancolombia). El método Wompi queda guardado con tu pedido. Si el pago no se completa, el pedido se cancela automático y el stock vuelve a la tienda.
                      </small>
                    ) : metodoPago === "credito" || metodoPago === "debito" ? (
                      <small className="text-muted d-block mt-2">
                        <i className="fas fa-credit-card me-1"></i> El pago con tarjeta se procesa dentro de la app: al confirmar, la compra se queda registrada como pagada.
                      </small>
                    ) : (
                      <small className="text-muted d-block mt-2">
                        <i className="fas fa-info-circle me-1"></i> El pago se registra con el método seleccionado al confirmar la compra.
                      </small>
                    )}
                  </div>

                  <div className="revision-seccion">
                    <h5><i className="fas fa-tag me-2"></i>Cupón</h5>
                    {cuponAplicado && cuponCumpleMinimo ? (
                      <div className="revision-cupon-activo">
                        <i className="fas fa-check-circle"></i>
                        <span>{cuponCodigo.trim().toUpperCase()} · {cuponAplicado.porcentaje}% OFF</span>
                      </div>
                    ) : (
                      <strong className="text-muted">Sin cupón aplicado</strong>
                    )}
                    {/* El cupón también se puede aplicar desde este paso (antes solo en el panel) */}
                    <div className="cupon-en-confirmacion">{bloqueCupon}</div>
                  </div>
                </div>

                {/* Desglose */}
                <div className="revision-seccion mt-3 revision-desglose">
                  <h5><i className="fas fa-calculator me-2"></i>Cómo se calcula el total</h5>
                  <div className="d-flex justify-content-between mb-2"><span className="text-muted">Precio base</span><strong>${subtotalBase.toLocaleString("es-CO")}</strong></div>
                  <div className="d-flex justify-content-between mb-2"><span className={descuentoProductos > 0 ? "text-success" : "text-muted"}>Descuento de productos</span><strong className={descuentoProductos > 0 ? "text-success" : "text-muted"}>-${descuentoProductos.toLocaleString("es-CO")}</strong></div>
                  <div className="d-flex justify-content-between mb-2 subtotal-jadda"><span className="fw-semibold">Subtotal</span><strong>${subtotal.toLocaleString("es-CO")}</strong></div>
                  <div className="d-flex justify-content-between mb-2"><span className={descuento > 0 ? "text-success" : "text-muted"}>Descuento cupón{cuponAplicado && cuponCumpleMinimo ? ` (${cuponAplicado.porcentaje}%)` : ""}</span><strong className={descuento > 0 ? "text-success" : "text-muted"}>-${descuento.toLocaleString("es-CO")}</strong></div>
                  {cuponAplicado && !cuponCumpleMinimo && (
                    <small className="text-danger d-block mb-2">Cupón inactivo hasta alcanzar la compra mínima de ${Number(cuponAplicado.monto_minimo).toLocaleString("es-CO")}</small>
                  )}
                  <BarraEnvioGratis subtotal={subtotal} />
                  <div className="d-flex justify-content-between mb-2">
                    <span className="text-muted">Envío</span>
                    {envioCargando ? <strong className="text-muted"><i className="fas fa-spinner fa-spin me-1"></i> Calculando...</strong> : costoEnvio > 0 ? <strong>${costoEnvio.toLocaleString("es-CO")}</strong> : <strong className="text-success"><i className="fas fa-truck me-1"></i> Gratis</strong>}
                  </div>
                  <div className="d-flex justify-content-between rev-total">
                    <span>TOTAL A PAGAR</span>
                    <span>${total.toLocaleString("es-CO")}</span>
                  </div>
                </div>

                {paso === "confirmacion" && !validarFormularioEnvio() && (
                  <small className="text-danger d-block mt-3 text-center">Completa los datos de envío para confirmar</small>
                )}
                {paso === "confirmacion" && validarFormularioEnvio() && !validarMetodoPago() && (
                  <small className="text-danger d-block mt-3 text-center">
                    {!metodoPago ? "Selecciona un método de pago" : metodoPago === "wompi" ? "Con Wompi completas el pago dentro de su checkout" : "Completa los datos del método de pago para confirmar"}
                  </small>
                )}

                <div className="revision-botones mt-4">
                  <button
                    className="btn btn-outline-dark px-3 px-md-4 py-3 fw-bold"
                    onClick={() => irAPaso("pago")}
                    title="Volver al paso de pago"
                  >
                    <i className="fas fa-arrow-left me-1"></i> Volver
                  </button>
                  <button
                    className={`btn btn-danger py-3 px-4 fw-bold btn-pagar${isFormValid ? "" : " disabled-btn"}`}
                    onClick={handleCheckout}
                    disabled={!isFormValid || checkoutLoading}
                  >
                    <i className={`fas ${checkoutLoading ? "fa-spinner fa-spin" : "fa-lock"} me-2`}></i>
                    {checkoutLoading ? "CONFIRMANDO COMPRA..." : conPasarela && metodoPago === "wompi" ? "CONFIRMAR E IR A PAGAR" : "CONFIRMAR COMPRA"}
                  </button>
                </div>

                <p className="text-center text-muted mt-2 mb-0 small">
                  <i className="fas fa-shield-alt me-1"></i>
                  Pago seguro con encriptación SSL
                </p>
              </div>
            )}
          </div>

          {paso !== "confirmacion" && (
          <div className="col-lg-5">
            <div className="card shadow-sm border-0 p-4 resumen-card">
              <div className="card-header-custom">
                <i className="fas fa-shopping-bag me-2"></i>
                Resumen del pedido
              </div>
              {!verResumenCompleto && (
                <>
                  <div className="productos-lista mt-3 product-linea">
                    {(verMasProductos ? cart : cart.slice(0, 2)).map((item: any) => (
                      <div className="producto-linea" key={item.ID_CARRITO}>
                        <img className="pl-img" src={item.IMAGEN} alt={item.NOMBRE} loading="lazy" onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }} />
                        <div className="pl-info">
                          <div className="pl-nombre" title={item.NOMBRE}>{item.NOMBRE}</div>
                          <div className="pl-qty">
                            <button type="button" className="qty-btn" onClick={() => decreaseQuantity(item.ID_CARRITO)} aria-label="Quitar una"><FaMinus /></button>
                            <span className="pl-cant">{item.CANTIDAD}</span>
                            <button type="button" className="qty-btn" onClick={() => increaseQuantity(item.ID_CARRITO)} aria-label="Agregar una"><FaPlus /></button>
                          </div>
                        </div>
                        <div className="pl-total">
                          ${(Number(item.PRECIO) * item.CANTIDAD * (item.ID_DESCUENTO != null && Number(descuentosMap[item.ID_DESCUENTO]) > 0 ? 1 - Number(descuentosMap[item.ID_DESCUENTO]) / 100 : 1)).toLocaleString("es-CO")}
                        </div>
                        <button type="button" className="btn-remove-item" onClick={() => removeFromCart(item.ID_CARRITO)} title="Eliminar">
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                  {cart.length > 2 && (
                    <button type="button" className="btn btn-sm btn-link text-decoration-none px-0 fw-bold" onClick={() => setVerMasProductos(!verMasProductos)}>
                      {verMasProductos ? "▲ Ver menos" : `▼ Ver más (${cart.length - 2} producto${cart.length - 2 > 1 ? "s" : ""})`}
                    </button>
                  )}
                </>
              )}

              <div className="productos-lista mt-3" style={verResumenCompleto ? undefined : { display: "none" }}>
                {cart.map((item: any) => (
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
                        <input
                          type="number"
                          min={1}
                          max={item.STOCK}
                          value={item.CANTIDAD}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") return;
                            const val = parseInt(raw, 10);
                            if (isNaN(val)) return;
                            if (val < 1) {
                              updateQuantity(item.ID_CARRITO, 1);
                              return;
                            }
                            if (val > item.STOCK) {
                              Swal.fire({
                                icon: "warning",
                                title: "Stock limitado",
                                text: `Solo hay ${item.STOCK} unidades disponibles de "${item.NOMBRE}".`,
                                background: "#1a1a1a",
                                color: "#fff",
                                confirmButtonColor: "#e63946",
                              });
                              updateQuantity(item.ID_CARRITO, item.STOCK);
                              return;
                            }
                            updateQuantity(item.ID_CARRITO, val);
                          }}
                          onBlur={(e) => {
                            const val = parseInt((e.target as HTMLInputElement).value, 10);
                            if (isNaN(val) || val < 1) updateQuantity(item.ID_CARRITO, 1);
                            else if (val > item.STOCK) updateQuantity(item.ID_CARRITO, item.STOCK);
                          }}
                          style={{ width: "44px", height: "28px", border: "1px solid #ccc", borderRadius: "6px", textAlign: "center", fontWeight: 600, fontSize: "13px" }}
                        />
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

              <button
                type="button"
                className="btn-resumen-toggle w-100 mt-3"
                onClick={() => setVerResumenCompleto(!verResumenCompleto)}
              >
                <i className={`fas ${verResumenCompleto ? "fa-chevron-up" : "fa-chevron-down"} me-2`}></i>
                {verResumenCompleto ? "Ocultar resumen completo" : "Ver resumen completo"}
              </button>

              {verResumenCompleto && (
              <div className="resumen-detalle-completo mt-3">
                {bloqueCupon}

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
                  Descuento cupón{cuponAplicado && cuponCumpleMinimo ? ` (${cuponAplicado.porcentaje}%)` : ""}
                </span>
                <strong className={descuento > 0 ? "text-success" : "text-muted"} style={{ fontWeight: descuento > 0 ? 600 : 400 }}>
                  -${descuento.toLocaleString("es-CO")}
                </strong>
              </div>
              {cuponAplicado && !cuponCumpleMinimo && (
                <small className="text-danger d-block mb-2">
                  Cupón inactivo hasta alcanzar la compra mínima de ${Number(cuponAplicado.monto_minimo).toLocaleString("es-CO")}
                </small>
              )}

              <BarraEnvioGratis subtotal={subtotal} />

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

              <div className="d-flex justify-content-between mb-2 resumen-metodo-seleccionado">
                <span className="text-muted">Método de pago</span>
                <strong style={{ maxWidth: "60%", textAlign: "right" }}>{etiquetaMetodoSeleccionado()}</strong>
              </div>
              </div>
              )}

              <hr />

              <div className="d-flex justify-content-between total-jadda">
                <span>Total</span>
                <span>${total.toLocaleString("es-CO")}</span>
              </div>

              {paso === "envio" && !validarFormularioEnvio() && (
                <small className="text-danger d-block mt-2 text-center">Completa todos los campos obligatorios de envío</small>
              )}
              {paso === "pago" && validarFormularioEnvio() && !validarMetodoPago() && (
                <small className="text-danger d-block mt-2 text-center">
                  {!metodoPago ? "Selecciona un método de pago" : metodoPago === "wompi" ? "Con Wompi completas el pago dentro de su checkout" : "Completa los datos del método de pago"}
                </small>
              )}

              <p className="text-center text-muted mt-2 mb-0 small">
                <i className="fas fa-shield-alt me-1"></i>
                Pago seguro con encriptación SSL
              </p>
            </div>
          </div>
          )}
        </div>
      </div>
    </>
  );
}

export default ResumenCompra;
