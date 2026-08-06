import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaShoppingCart, FaArrowLeft, FaCheck, FaHeart, FaRegHeart, FaChevronLeft, FaChevronRight, FaShareAlt, FaBell, FaWhatsapp, FaFacebookF, FaTwitter, FaLink } from "react-icons/fa";
import ImageZoom from "../components/ImageZoom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import Swal from "sweetalert2";
import "../css/productDetail.css";

interface ImagenProducto {
  url: string;
  orden: number;
}

interface Producto {
  ID: number;
  NOMBRE: string;
  DESCRIPCION: string;
  PRECIO: number;
  IMAGENES: ImagenProducto[];
  CATEGORIA: string;
  STOCK: number;
  MARCA: string;
  ID_DESCUENTO: number | null;
  ID_VARIANTE_POR_DEFECTO?: number | null;
  CARACTERISTICAS: Caracteristica[];
  VARIANTES: Variante[];
}

interface Caracteristica {
  NOMBRE_ATRIBUTO: string;
  VALOR_ATRIBUTO: string;
}

interface Variante {
  ID_VARIANTE: number;
  COLOR: string;
  NOMBRE_ATRIBUTO: string;
  ATRIBUTO: string;
  STOCK: number;
}

function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { usuario, usuarioLogueado, esAdmin } = useAuth();
  const [tabActiva, setTabActiva] = useState<string>("descripcion");
  const [producto, setProducto] = useState<Producto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [indiceImagen, setIndiceImagen] = useState<number>(0);
  const [colorSeleccionado, setColorSeleccionado] = useState("");
  const [atributoSeleccionado, setAtributoSeleccionado] = useState("");
  const [cantidad, setCantidad] = useState<number>(1);
  const [agregadoAnimacion, setAgregadoAnimacion] = useState<boolean>(false);
  const [descuentosMap, setDescuentosMap] = useState<Record<number, number>>({});

  const [relacionados, setRelacionados] = useState<any[]>([]);
  const [resenas, setResenas] = useState<any[]>([]);
  const [nuevaResenaComentario, setNuevaResenaComentario] = useState("");
  const [nuevaResenaCalificacion, setNuevaResenaCalificacion] = useState(0);
  const [enviandoResena, setEnviandoResena] = useState(false);
  const [hoverEstrella, setHoverEstrella] = useState(0);
  const [esFavorito, setEsFavorito] = useState(false);
  const [idFavorito, setIdFavorito] = useState<number | null>(null);
  const [mostrarCompartir, setMostrarCompartir] = useState(false);
  const [avisoSuscrito, setAvisoSuscrito] = useState(false);

  useEffect(() => {
    if (!usuarioLogueado || !id) return;
    fetch("/api/favoritos", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        const fav = data.find((f: any) => f.ID === Number(id));
        if (fav) {
          setEsFavorito(true);
          setIdFavorito(fav.ID_FAVORITO);
        }
      })
      .catch(() => {});
  }, [id, usuarioLogueado]);

  // Meta tags Open Graph para compartir el producto en redes (RF-037)
  useEffect(() => {
    if (!producto) return;
    const tituloPrevio = document.title;
    const origen = window.location.origin;
    const imagen = producto.IMAGENES?.[0]?.url;
    const imagenAbs = imagen && imagen.startsWith("/") ? origen + imagen : imagen;
    const precioOG = producto.ID_DESCUENTO != null && descuentosMap[producto.ID_DESCUENTO]
      ? (Number(producto.PRECIO) * (1 - Number(descuentosMap[producto.ID_DESCUENTO]) / 100)).toFixed(2)
      : Number(producto.PRECIO).toFixed(2);
    const tagsOG: Array<[string, string]> = [
      ["og:title", `${producto.NOMBRE} | JADDA SPORTS`],
      ["og:description", producto.DESCRIPCION || `Compra ${producto.NOMBRE} en JADDA SPORTS`],
      ["og:url", window.location.href],
      ["og:price:amount", precioOG],
      ["og:price:currency", "COP"],
    ];
    if (imagenAbs) tagsOG.push(["og:image", imagenAbs]);
    document.title = `${producto.NOMBRE} | JADDA SPORTS`;
    const creados: HTMLElement[] = [];
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
        creados.push(el);
      }
      el.setAttribute("content", content);
    };
    tagsOG.forEach(([k, v]) => setMeta("property", k, v));
    setMeta("name", "twitter:card", "summary_large_image");
    return () => {
      document.title = tituloPrevio;
      creados.forEach((el) => el.remove());
    };
  }, [producto, descuentosMap]);

  // Estado de suscripción al aviso de reposición de stock (RF-035)
  useEffect(() => {
    if (!usuarioLogueado || !producto) {
      setAvisoSuscrito(false);
      return;
    }
    const variante = producto.VARIANTES.find(
      v => v.COLOR === colorSeleccionado && v.ATRIBUTO === atributoSeleccionado
    );
    if (!variante) {
      setAvisoSuscrito(false);
      return;
    }
    fetch(`/api/productos/variantes/${variante.ID_VARIANTE}/suscripcion`, { credentials: "include" })
      .then(res => res.json())
      .then((d) => setAvisoSuscrito(!!d.suscrito))
      .catch(() => setAvisoSuscrito(false));
  }, [id, usuarioLogueado, producto, colorSeleccionado, atributoSeleccionado]);

  const toggleFavorito = async () => {
    if (!usuarioLogueado) {
      Swal.fire({
        title: "INICIA SESIÓN",
        text: "Debes iniciar sesión para guardar favoritos.",
        icon: "warning",
        background: '#121212',
        color: '#ffffff',
        confirmButtonColor: '#e73737'
      });
      return;
    }
    const Toast = Swal.mixin({ toast: true, position: "bottom", showConfirmButton: false, timer: 2000, timerProgressBar: true });
    try {
      if (esFavorito && idFavorito) {
        await fetch(`/api/favoritos/${idFavorito}`, {
          method: "DELETE",
          credentials: "include"
        });
        setEsFavorito(false);
        setIdFavorito(null);
        Toast.fire({ icon: "success", title: "Se quitó de favoritos" });
      } else {
        const res = await fetch("/api/favoritos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id_producto: Number(id) })
        });
        if (!res.ok) {
          const data = await res.json();
          Toast.fire({ icon: "warning", title: data.msg || "Error al agregar" });
          return;
        }
        const favRes = await fetch("/api/favoritos", { credentials: "include" });
        const data = await favRes.json();
        const fav = data.find((f: any) => f.ID === Number(id));
        if (fav) {
          setEsFavorito(true);
          setIdFavorito(fav.ID_FAVORITO);
        }
        Toast.fire({ icon: "success", title: "Se agregó a favoritos" });
      }
    } catch (err) {
      console.error("Error al toggle favorito:", err);
    }
  };

  const handleAgregarResena = async () => {
    if (!nuevaResenaComentario.trim() || nuevaResenaCalificacion === 0) return;
    setEnviandoResena(true);
    try {
      const res = await fetch(`/api/productos/${id}/resenas`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comentario: nuevaResenaComentario.trim(),
          calificacion: nuevaResenaCalificacion,
        }),
      });
      if (res.ok) {
        setResenas(prev => [...prev, { NOMBRE_USUARIO: usuario?.NOMBRE_USUARIO, COMENTARIO: nuevaResenaComentario.trim(), CALIFICACION: nuevaResenaCalificacion }]);
        setNuevaResenaComentario("");
        setNuevaResenaCalificacion(0);
        Swal.fire({ icon: "success", title: "Opinión enviada", text: "Gracias por tu feedback.", timer: 2000, showConfirmButton: false });
      }
    } catch (err) {
      console.error("Error al enviar reseña:", err);
    } finally {
      setEnviandoResena(false);
    }
  };

  useEffect(() => {
    fetch(`/api/productos/${id}/resenas`)
      .then(res => res.json())
      .then(data => setResenas(data));
  }, [id]);

  useEffect(() => {
    const fetchRelacionados = async () => {
      const res = await fetch(`/api/productos/relacionados/${id}`);
      const data = await res.json();
      setRelacionados(data);
    };
    if (id) fetchRelacionados();
  }, [id]);

  useEffect(() => {
    const obtenerProducto = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/productos/${id}`);
        if (!response.ok) throw new Error("Producto no encontrado.");
        const data = await response.json();
        setProducto(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (id) obtenerProducto();
  }, [id]);

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
  setCantidad(1);
}, [colorSeleccionado, atributoSeleccionado]);

  useEffect(() => {
    if (!producto) return;
    const historial = JSON.parse(localStorage.getItem("historial") || "[]");
    const sinDuplicado = historial.filter((h: any) => h.ID !== producto.ID);
    const entrada = {
      ID: producto.ID,
      NOMBRE: producto.NOMBRE,
      PRECIO: producto.PRECIO,
      MARCA: producto.MARCA,
      IMAGEN: producto.IMAGENES?.[0]?.url || "",
      ID_DESCUENTO: producto.ID_DESCUENTO ?? null,
      STOCK: producto.STOCK ?? 0,
      ID_VARIANTE_POR_DEFECTO: producto.ID_VARIANTE_POR_DEFECTO ?? null
    };
    sinDuplicado.unshift(entrada);
    if (sinDuplicado.length > 30) sinDuplicado.pop();
    localStorage.setItem("historial", JSON.stringify(sinDuplicado));
    if (usuarioLogueado) {
      fetch("/api/historial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id_producto: producto.ID })
      }).catch(() => {});
    }
  }, [producto, usuarioLogueado]);

  const handleAgregarCarrito = async () => {
    if (!producto) return;
    if (!colorSeleccionado || !atributoSeleccionado) {
      Swal.fire({ 
        title: 'SELECCIONA LAS OPCIONES', 
        text: "Debes elegir color y " + nombreAtributo.toLowerCase () + " para agregar al carrito.",
        icon: 'warning', 
        background: '#121212', 
        color: '#ffffff', 
        confirmButtonColor: '#e73737' 
      });
      return;
    }
    const variante = producto.VARIANTES.find(
      v => v.COLOR === colorSeleccionado && v.ATRIBUTO === atributoSeleccionado
    );
    if (!variante) return;
    const agregado = await addToCart(producto.ID, variante.ID_VARIANTE, cantidad);

if (agregado) {
  setAgregadoAnimacion(true);

  setTimeout(() => {
    setAgregadoAnimacion(false);
  }, 2000);
}
  };

  if (loading) return <div className="text-center py-5">Cargando...</div>;
  if (error || !producto) return <div className="text-center py-5">Error: {error}</div>;

const colores = [
  ...new Set(producto.VARIANTES.map(v => v.COLOR))
];

const nombreAtributo = producto.VARIANTES[0]?.NOMBRE_ATRIBUTO || "Atributo";

const abrirGuiaTallas = () => {
  Swal.fire({
    title: "GUÍA DE TALLAS",
    html: `
      <div style="text-align:left;font-size:0.9rem">
        <p class="fw-bold mb-2">Zapatos (talla colombiana)</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
          <thead><tr style="background:#f5f5f5"><th style="padding:6px;border:1px solid #ddd;color:#222">Talla</th><th style="padding:6px;border:1px solid #ddd;color:#222">36</th><th style="padding:6px;border:1px solid #ddd;color:#222">37</th><th style="padding:6px;border:1px solid #ddd;color:#222">38</th><th style="padding:6px;border:1px solid #ddd;color:#222">39</th><th style="padding:6px;border:1px solid #ddd;color:#222">40</th><th style="padding:6px;border:1px solid #ddd;color:#222">41</th><th style="padding:6px;border:1px solid #ddd;color:#222">42</th><th style="padding:6px;border:1px solid #ddd;color:#222">43</th></tr></thead>
          <tbody><tr><td style="padding:6px;border:1px solid #ddd">Largo (cm)</td><td style="padding:6px;border:1px solid #ddd;text-align:center">22.5</td><td style="padding:6px;border:1px solid #ddd;text-align:center">23</td><td style="padding:6px;border:1px solid #ddd;text-align:center">24</td><td style="padding:6px;border:1px solid #ddd;text-align:center">24.5</td><td style="padding:6px;border:1px solid #ddd;text-align:center">25</td><td style="padding:6px;border:1px solid #ddd;text-align:center">26</td><td style="padding:6px;border:1px solid #ddd;text-align:center">27</td><td style="padding:6px;border:1px solid #ddd;text-align:center">28</td></tr></tbody>
        </table>
        <p class="fw-bold mt-3 mb-2">Ropa (medidas en cm)</p>
        <table style="width:100%;border-collapse:collapse;font-size:0.85rem">
          <thead><tr style="background:#f5f5f5"><th style="padding:6px;border:1px solid #ddd;color:#222">Talla</th><th style="padding:6px;border:1px solid #ddd;color:#222">Pecho</th><th style="padding:6px;border:1px solid #ddd;color:#222">Cintura</th><th style="padding:6px;border:1px solid #ddd;color:#222">Cadera</th></tr></thead>
          <tbody>
            <tr><td style="padding:6px;border:1px solid #ddd">XS</td><td style="padding:6px;border:1px solid #ddd;text-align:center">82-86</td><td style="padding:6px;border:1px solid #ddd;text-align:center">64-68</td><td style="padding:6px;border:1px solid #ddd;text-align:center">88-92</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd">S</td><td style="padding:6px;border:1px solid #ddd;text-align:center">88-92</td><td style="padding:6px;border:1px solid #ddd;text-align:center">70-74</td><td style="padding:6px;border:1px solid #ddd;text-align:center">94-98</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd">M</td><td style="padding:6px;border:1px solid #ddd;text-align:center">94-98</td><td style="padding:6px;border:1px solid #ddd;text-align:center">76-80</td><td style="padding:6px;border:1px solid #ddd;text-align:center">100-104</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd">L</td><td style="padding:6px;border:1px solid #ddd;text-align:center">100-104</td><td style="padding:6px;border:1px solid #ddd;text-align:center">82-86</td><td style="padding:6px;border:1px solid #ddd;text-align:center">106-110</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd">XL</td><td style="padding:6px;border:1px solid #ddd;text-align:center">106-110</td><td style="padding:6px;border:1px solid #ddd;text-align:center">88-92</td><td style="padding:6px;border:1px solid #ddd;text-align:center">112-116</td></tr>
            <tr><td style="padding:6px;border:1px solid #ddd">XXL</td><td style="padding:6px;border:1px solid #ddd;text-align:center">112-116</td><td style="padding:6px;border:1px solid #ddd;text-align:center">94-98</td><td style="padding:6px;border:1px solid #ddd;text-align:center">118-122</td></tr>
          </tbody>
        </table>
        <p class="mt-2 mb-0" style="font-size:0.75rem;color:#888">Mide el largo de tu pie desde el talón hasta el dedo más largo. Si estás entre tallas, elige la mayor.</p>
      </div>`,
    background: "#1a1a1a",
    color: "#fff",
    confirmButtonText: "Entendido",
    confirmButtonColor: "#e63946",
    width: "90%",
    customClass: { container: "swal-guia-tallas" },
  });
};

const atributosDisponibles = colorSeleccionado 
  ? [...new Set(producto.VARIANTES.filter(v => v.COLOR === colorSeleccionado).map(v => v.ATRIBUTO))]
  : [...new Set(producto.VARIANTES.map(v => v.ATRIBUTO))];

const esAtributoTalla =
  nombreAtributo.toLowerCase().includes("talla") ||
  nombreAtributo.toLowerCase().includes("número") ||
  (atributosDisponibles.length > 0 && atributosDisponibles.every(o => /^(\d+(\.\d+)?|S|M|L|XL|XXL|XS|S\/M|M\/L)$/i.test(o)));


const varianteSeleccionada = producto.VARIANTES.find(
  v =>
    v.COLOR === colorSeleccionado &&
    v.ATRIBUTO === atributoSeleccionado
);

const stockActual = varianteSeleccionada?.STOCK || 0;

const totalStock = producto.VARIANTES.reduce((acc, v) => acc + Number(v.STOCK || 0), 0);

const precioFinal =
  producto.ID_DESCUENTO != null && descuentosMap[producto.ID_DESCUENTO]
    ? Number(producto.PRECIO) * (1 - Number(descuentosMap[producto.ID_DESCUENTO]) / 100)
    : Number(producto.PRECIO);

const promedioResenas = resenas.length
  ? resenas.reduce((acc, r) => acc + Number(r.CALIFICACION || 0), 0) / resenas.length
  : 0;

const urlProducto = window.location.href;
const textoCompartir = `${producto.NOMBRE} - $${precioFinal.toLocaleString("es-CO")} | JADDA SPORTS`;

const abrirCompartir = (red: "whatsapp" | "facebook" | "x") => {
  const url = encodeURIComponent(urlProducto);
  const texto = encodeURIComponent(textoCompartir);
  const destinos: Record<string, string> = {
    whatsapp: `https://wa.me/?text=${texto}%20${url}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    x: `https://twitter.com/intent/tweet?text=${texto}&url=${url}`,
  };
  window.open(destinos[red], "_blank", "noopener,width=600,height=500");
  setMostrarCompartir(false);
};

const copiarEnlace = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href);
    Swal.fire({
      icon: "success",
      title: "Enlace copiado",
      text: "Comparte este producto con quien quieras.",
      timer: 2000,
      showConfirmButton: false,
      background: "#1a1a1a",
      color: "#fff",
    });
  } catch {
    Swal.fire({
      icon: "error",
      title: "No se pudo copiar",
      text: "Copia el enlace manualmente desde la barra del navegador.",
      background: "#1a1a1a",
      color: "#fff",
      confirmButtonColor: "#e63946",
    });
  }
  setMostrarCompartir(false);
};

const suscribirAviso = async () => {
  if (!varianteSeleccionada) return;
  try {
    const res = await fetch(`/api/productos/variantes/${varianteSeleccionada.ID_VARIANTE}/suscribir`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      setAvisoSuscrito(true);
      Swal.fire({
        icon: "success",
        title: "¡Listo!",
        text: "Te avisaremos por correo y notificaciones cuando vuelva a estar disponible.",
        timer: 2500,
        showConfirmButton: false,
        background: "#121212",
        color: "#fff",
      });
    }
  } catch {
    Swal.fire({
      icon: "error",
      title: "Error",
      text: "No se pudo guardar el aviso. Intenta de nuevo.",
      background: "#121212",
      color: "#fff",
      confirmButtonColor: "#e73737",
    });
  }
};

const cancelarAviso = async () => {
  if (!varianteSeleccionada) return;
  try {
    await fetch(`/api/productos/variantes/${varianteSeleccionada.ID_VARIANTE}/suscribir`, {
      method: "DELETE",
      credentials: "include",
    });
    setAvisoSuscrito(false);
    Swal.fire({
      icon: "info",
      title: "Aviso cancelado",
      timer: 1500,
      showConfirmButton: false,
      background: "#121212",
      color: "#fff",
    });
  } catch {
    setAvisoSuscrito(false);
  }
};

const pedirLoginAviso = () => {
  Swal.fire({
    title: "INICIA SESIÓN",
    text: "Debes iniciar sesión para que te avisemos cuando vuelva a estar disponible.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "Iniciar sesión",
    cancelButtonText: "Ahora no",
    background: "#121212",
    color: "#ffffff",
    confirmButtonColor: "#e73737",
  }).then((r) => {
    if (r.isConfirmed) navigate("/login");
  });
};
  
  return (
    <div className="bg-white text-dark min-vh-100">
      <main className="container pt-3 pb-5 flex-grow-1">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <button onClick={() => navigate("/catalogo")} className="btn p-0 text-dark fw-bold text-uppercase">
            <FaArrowLeft className="text-danger" /> Volver
          </button>
          <div className="position-relative">
            <button className="btn btn-sm btn-outline-dark" onClick={() => setMostrarCompartir(!mostrarCompartir)}>
              <FaShareAlt className="me-1" /> Compartir
            </button>
            {mostrarCompartir && (
              <>
                <div className="position-fixed top-0 start-0 w-100 h-100" style={{ zIndex: 1040 }} onClick={() => setMostrarCompartir(false)} />
                <div className="dropdown-menu show position-absolute end-0 shadow" style={{ zIndex: 1050, minWidth: "220px" }}>
                  <button className="dropdown-item" onClick={() => abrirCompartir("whatsapp")}>
                    <FaWhatsapp className="me-2 text-success" /> WhatsApp
                  </button>
                  <button className="dropdown-item" onClick={() => abrirCompartir("facebook")}>
                    <FaFacebookF className="me-2 text-primary" /> Facebook
                  </button>
                  <button className="dropdown-item" onClick={() => abrirCompartir("x")}>
                    <FaTwitter className="me-2" /> X (Twitter)
                  </button>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item" onClick={copiarEnlace}>
                    <FaLink className="me-2 text-secondary" /> Copiar enlace
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <nav className="detalle-breadcrumb mb-3" aria-label="breadcrumb">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Inicio</a>
          <span className="sep">›</span>
          <a href="/catalogo" onClick={(e) => { e.preventDefault(); navigate("/catalogo"); }}>Catálogo</a>
          {producto.CATEGORIA && (
            <>
              <span className="sep">›</span>
              <span className="actual">{producto.CATEGORIA}</span>
            </>
          )}
          <span className="sep">›</span>
          <span className="actual text-truncate">{producto.NOMBRE}</span>
        </nav>

        <div className="row g-4">
          {/* GALERÍA DE IMÁGENES */}
          <div className="col-lg-6">
            <div className="product-image-container bg-white rounded shadow-sm border mb-3" style={{ padding: "15px", position: "relative" }}>
              {totalStock <= 0 && (
                <span className="agotado-badge">
                  <i className="fas fa-ban me-1"></i>AGOTADO
                </span>
              )}
              <ImageZoom
                src={producto?.IMAGENES?.[indiceImagen]?.url || "https://via.placeholder.com/600"}
                alt={producto?.NOMBRE || "Producto"}
              />
              {producto?.IMAGENES?.length > 1 && (
                <>
                  <button
                    className="galeria-flecha flecha-izq"
                    title="Imagen anterior"
                    onClick={() => setIndiceImagen((producto.IMAGENES.length + indiceImagen - 1) % producto.IMAGENES.length)}
                  >
                    <FaChevronLeft />
                  </button>
                  <button
                    className="galeria-flecha flecha-der"
                    title="Siguiente imagen"
                    onClick={() => setIndiceImagen((indiceImagen + 1) % producto.IMAGENES.length)}
                  >
                    <FaChevronRight />
                  </button>
                  <span className="galeria-contador">{indiceImagen + 1}/{producto.IMAGENES.length}</span>
                </>
              )}
            </div>
            <div className="d-flex gap-2">
              {producto?.IMAGENES?.map((img, index) => (
                <button 
                  key={index} 
                  onClick={() => setIndiceImagen(index)} 
                  className={`border-0 p-0 ${index === indiceImagen ? 'border border-danger border-2' : ''}`} 
                  style={{ width: "80px", height: "80px" }}
                >
                  <img src={img.url} className="w-100 h-100 object-fit-cover" alt="" loading="lazy" onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }} />
                </button>
              ))}
            </div>

            {/* Tabs de Información */}
            <div className="mt-4">
              <div className="d-flex border-bottom">
                <button 
                  className={`btn rounded-0 ${tabActiva === 'descripcion' ? 'border-bottom border-danger border-2 fw-bold' : ''}`} 
                  onClick={() => setTabActiva('descripcion')}
                >
                  Descripción
                </button>
                <button 
                  className={`btn rounded-0 ${tabActiva === 'caracteristicas' ? 'border-bottom border-danger border-2 fw-bold' : ''}`} 
                  onClick={() => setTabActiva('caracteristicas')}
                >
                  Características
                </button>
                <button 
                  className={`btn rounded-0 ${tabActiva === 'envios' ? 'border-bottom border-danger border-2 fw-bold' : ''}`} 
                  onClick={() => setTabActiva('envios')}
                >
                  Envíos y devoluciones
                </button>
              </div>

              <div className="p-3 border-start border-end border-bottom">
                {tabActiva === 'descripcion' ? (
                  <p className="mb-0">{producto.DESCRIPCION}</p>
                ) : tabActiva === 'caracteristicas' ? (
                  producto.CARACTERISTICAS && producto.CARACTERISTICAS.length > 0 ? (
                    <table className="table table-hover m-0">
                      <tbody>
                        {producto.CARACTERISTICAS.map((item: Caracteristica, index: number) => (
                          <tr key={index}>
                            <td className="fw-bold text-secondary" style={{ width: "40%" }}>{item.NOMBRE_ATRIBUTO}</td>
                            <td>{item.VALOR_ATRIBUTO}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-muted small text-center my-2 mb-0">No hay características especificadas para este producto.</p>
                  )
                ) : (
                  <div className="envios-info">
                    <p><i className="fas fa-truck me-2 text-danger"></i><strong>Envío gratis</strong> en compras desde $200.000. Para pedidos menores, el costo se calcula según tu departamento al finalizar la compra.</p>
                    <p><i className="fas fa-clock me-2 text-danger"></i><strong>Tiempos de entrega:</strong> 2 a 5 días hábiles después de confirmado el pago.</p>
                    <p><i className="fas fa-rotate-left me-2 text-danger"></i><strong>Cambios y devoluciones:</strong> tienes hasta 30 días para solicitar un cambio de talla o la devolución del producto.</p>
                    <p className="mb-0"><i className="fas fa-shield-alt me-2 text-danger"></i><strong>Compra protegida:</strong> tus datos viajan con encriptación SSL y el pago es 100% seguro.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DETALLES DEL PRODUCTO */}
          <div className="col-lg-6">
            <span className="badge bg-danger mb-3">{producto.CATEGORIA}</span>
            <h1 className="fw-bold text-uppercase text-dark">{producto.NOMBRE}</h1>

            <div className="d-flex align-items-center gap-2 mb-3">
              <span className="small" style={{ color: "#666" }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span key={s} style={{ color: s <= Math.round(promedioResenas) ? "#e63946" : "#ccc", fontSize: "0.95rem" }}>★</span>
                ))}
              </span>
              <span className="fw-bold text-dark">{promedioResenas ? promedioResenas.toFixed(1) : "Sin valoraciones"}</span>
              <span className="text-muted small">({resenas.length} {resenas.length === 1 ? "opinión" : "opiniones"})</span>
            </div>
            {producto.ID_DESCUENTO != null && descuentosMap[producto.ID_DESCUENTO] ? (
              <>
                <span className="badge bg-danger mb-2 fs-6">-{descuentosMap[producto.ID_DESCUENTO]}%</span>
                <h2 className="text-danger fw-bold mb-0">
                  ${(Number(producto.PRECIO) - (Number(producto.PRECIO) * descuentosMap[producto.ID_DESCUENTO] / 100)).toLocaleString("es-CO")}
                </h2>
                <p className="text-muted mb-4" style={{ fontSize: "0.9rem", textDecoration: "line-through" }}>
                  ${Number(producto.PRECIO).toLocaleString("es-CO")}
                </p>
              </>
            ) : (
              <h2 className="text-danger fw-bold mb-4">${Number(producto.PRECIO).toLocaleString("es-CO")}</h2>
            )}
            
            {producto.MARCA && (
              <p className="text-muted mb-4" style={{ fontSize: "0.9rem" }}>
                Marca: <strong className="text-dark">{producto.MARCA}</strong>
              </p>
            )}

            {/* SE QUITA LA DESCRIPCIÓN REPETIDA DE AQUÍ */}
            
            {/* Stock Dinámico en Tiempo Real */}
            {colorSeleccionado && atributoSeleccionado && (

  <div className="mb-4">

    {stockActual > 0 ? (
      <span className="text-success fw-bold">
        Stock disponible: {stockActual} unidades
      </span>
    ) : (
      <span className="text-danger fw-bold">
        Agotado por el momento
      </span>
    )}

  </div>

)}

{/* Avísame cuando vuelva a estar disponible (RF-035) */}
{!esAdmin && colorSeleccionado && atributoSeleccionado && stockActual <= 0 && (
  <div className="mb-4">
    {usuarioLogueado ? (
      avisoSuscrito ? (
        <button className="btn btn-outline-success w-100" onClick={cancelarAviso}>
          <FaBell className="me-2" /> Te avisaremos cuando vuelva — quitar aviso
        </button>
      ) : (
        <button className="btn btn-outline-danger w-100" onClick={suscribirAviso}>
          <FaBell className="me-2" /> Avísame cuando vuelva a estar disponible
        </button>
      )
    ) : (
      <button className="btn btn-outline-danger w-100" onClick={pedirLoginAviso}>
        <FaBell className="me-2" /> Avísame cuando vuelva a estar disponible
      </button>
    )}
  </div>
)}
<div className="mb-4">

  <span className="fw-bold d-block mb-2">
    Color:
  </span>

  <div className="d-flex gap-2 flex-wrap">

    {colores.map(color => (

      <button
  key={color}
  onClick={() => {
    if (colorSeleccionado === color) {
      setColorSeleccionado("");
    } else {
      setColorSeleccionado(color);
      const atributosDelNuevoColor = [...new Set(producto.VARIANTES.filter(v => v.COLOR === color).map(v => v.ATRIBUTO))];
      if (!atributosDelNuevoColor.includes(atributoSeleccionado)) {
        setAtributoSeleccionado("");
      }
    }
  }}
  className={`btn btn-sm ${colorSeleccionado === color ? "btn-danger" : "btn-outline-dark"}`}
>
  {color}
</button>

    ))}

  </div>

</div>

<div className="mb-4">

  <span className="fw-bold d-block mb-2">
    {nombreAtributo}:
    {esAtributoTalla && (
      <button
        type="button"
        className="btn btn-link btn-sm p-0 ms-2"
        style={{ fontSize: "0.78rem", color: "#e63946" }}
        onClick={abrirGuiaTallas}
      >
        <i className="fas fa-ruler me-1"></i>Guía de tallas
      </button>
    )}
  </span>

  <div className="d-flex gap-2 flex-wrap">

    {atributosDisponibles.map(opcion => (

      <button
        key={opcion}
        onClick={() => {
          if (atributoSeleccionado === opcion) {
            setAtributoSeleccionado("");
          } else {
            setAtributoSeleccionado(opcion);
          }
        }}
        className={`btn btn-sm ${
          atributoSeleccionado === opcion
            ? "btn-danger"
            : "btn-outline-dark"
        }`}
        style={{
          minWidth: "50px"
        }}
      >
        {opcion}
      </button>

    ))}

  </div>

</div>

{!esAdmin && (
<div className="mb-4">
  <span className="fw-bold d-block mb-2">
    Cantidad:
  </span>

  <div
    className="d-flex align-items-center border rounded overflow-hidden"
    style={{ width: "140px" }}
  >
    <button
      className="btn btn-light"
      onClick={() => {
        if (cantidad > 1) {
          setCantidad(cantidad - 1);
        }
      }}
    >
      -
    </button>

    <div
      className="flex-grow-1 text-center fw-bold"
      style={{ userSelect: "none" }}
    >
      {cantidad}
    </div>

    <button
      className="btn btn-light"
      onClick={() => {
        if (!colorSeleccionado || !atributoSeleccionado) {
          Swal.fire({
            icon: "info",
            title: "Selecciona las opciones",
            text: "Elige un color y " + nombreAtributo.toLowerCase() + " primero.",
            background: '#121212',
            color: '#ffffff',
            confirmButtonColor: '#e73737'
          });
          return;
        }
        if (cantidad < stockActual) {
          setCantidad(cantidad + 1);
        } else {
          Swal.fire({
            icon: "warning",
            title: "Stock limitado",
            text: "No hay más unidades disponibles.",
            background: '#121212',
            color: '#ffffff',
            confirmButtonColor: '#e73737'
          });
        }
      }}
    >
      +
    </button>
  </div>

    <small className="text-muted d-block mt-2" style={{ fontSize: "0.85rem" }}>
      Subtotal: <strong className="text-dark">${(precioFinal * cantidad).toLocaleString("es-CO")}</strong>
    </small>
</div>
)}


            {/* Botón agregar + Favoritos — oculto para el admin (solo visualiza) */}
            {!esAdmin && (
            <div className="d-flex gap-2">
              <button 
                onClick={handleAgregarCarrito} 
                disabled={
  !colorSeleccionado ||
  !atributoSeleccionado ||
  stockActual <= 0
}
                className={`btn flex-grow-1 py-3 ${agregadoAnimacion ? "btn-success" : "btn-danger"}`}
              >
                {agregadoAnimacion ? <><FaCheck /> Añadido</> : <><FaShoppingCart /> Añadir al carrito</>}
              </button>
              <button
                onClick={toggleFavorito}
                className={`btn btn-outline-danger d-flex align-items-center justify-content-center`}
                style={{ width: "54px", minWidth: "54px", borderRadius: "12px" }}
                title={esFavorito ? "Quitar de favoritos" : "Agregar a favoritos"}
              >
                {esFavorito ? <FaHeart style={{ color: "#e73737" }} /> : <FaRegHeart />}
              </button>
            </div>
            )}

            <div className="beneficios-strip mt-4">
              <div className="beneficio-item">
                <i className="fas fa-truck"></i>
                <span>Envío gratis desde $200.000</span>
              </div>
              <div className="beneficio-item">
                <i className="fas fa-shield-alt"></i>
                <span>Pago seguro SSL</span>
              </div>
              <div className="beneficio-item">
                <i className="fas fa-rotate-left"></i>
                <span>Devoluciones y cambios</span>
              </div>
            </div>

          </div>
        </div>
        
        {/* RESEÑAS Y RELACIONADOS */}
        <hr className="my-4" />
        <div className="row g-4">
          <div className="col-md-6">
            <h3>Opiniones ({resenas.length})</h3>

            {resenas.length > 0 && (
              <div className="resumen-resenas p-3 bg-light border rounded mb-4">
                <div className="text-center">
                  <span className="fs-2 fw-bold text-danger">{promedioResenas.toFixed(1)}</span>
                  <div className="small">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span key={s} style={{ color: s <= Math.round(promedioResenas) ? "#e63946" : "#ccc" }}>★</span>
                    ))}
                  </div>
                  <small className="text-muted">{resenas.length} {resenas.length === 1 ? "opinión" : "opiniones"}</small>
                </div>
                <div className="flex-grow-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = resenas.filter((r) => Number(r.CALIFICACION) === star).length;
                    const pct = resenas.length ? (count / resenas.length) * 100 : 0;
                    return (
                      <div className="rating-bar-row" key={star}>
                        <span>{star}★</span>
                        <div className="rating-bar-track">
                          <div className="rating-bar-fill" style={{ width: `${pct}%` }}></div>
                        </div>
                        <span className="rating-bar-count">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {resenas.length === 0 && (
              <p className="text-muted">Este producto aún no tiene opiniones. Sé el primero en opinar.</p>
            )}
            {resenas.map((r, i) => (
              <div key={r.ID_RESENA || i} className="p-3 border bg-light mb-2">
                <div className="d-flex align-items-center gap-2 mb-1">
                  <div className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: "32px", height: "32px", fontSize: "0.85rem" }}>
                    {((r.NOMBRE_USUARIO || r.NOMBRE || "A")[0]).toUpperCase()}
                  </div>
                  <span className="fw-bold text-danger">{r.NOMBRE_USUARIO || r.NOMBRE}</span>
                  {r.FECHA && (
                    <span className="text-muted small">
                      {new Date(r.FECHA).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                  <span className="ms-auto" style={{ color: "#e63946" }}>{"★".repeat(r.CALIFICACION)}{"☆".repeat(5 - r.CALIFICACION)}</span>
                </div>
                <p className="small m-0 mt-1">{r.COMENTARIO}</p>
              </div>
            ))}

            {usuarioLogueado ? (
              <>
                <hr className="my-4" />
                <h5>Deja tu opinión</h5>
                <div className="d-flex align-items-center gap-2 mb-3">
                  <div className="rounded-circle bg-danger text-white d-flex align-items-center justify-content-center fw-bold" style={{ width: "32px", height: "32px", fontSize: "0.85rem" }}>
                    {(usuario?.NOMBRE_USUARIO || "U")[0].toUpperCase()}
                  </div>
                  <span className="fw-bold">{usuario?.NOMBRE_USUARIO}</span>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Calificación</label>
                  <div className="d-flex gap-1 fs-4">
                    {[1, 2, 3, 4, 5].map(star => (
                      <span
                        key={star}
                        style={{ cursor: "pointer", color: star <= (hoverEstrella || nuevaResenaCalificacion) ? "#e63946" : "#ccc", transition: "color 0.15s" }}
                        onClick={() => setNuevaResenaCalificacion(star)}
                        onMouseEnter={() => setHoverEstrella(star)}
                        onMouseLeave={() => setHoverEstrella(0)}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label fw-bold">Comentario</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Escribe tu opinión..."
                    value={nuevaResenaComentario}
                    onChange={(e) => setNuevaResenaComentario(e.target.value)}
                  />
                </div>
                <button
                  className="btn btn-danger"
                  onClick={handleAgregarResena}
                  disabled={!nuevaResenaComentario.trim() || nuevaResenaCalificacion === 0 || enviandoResena}
                >
                  {enviandoResena ? "Enviando..." : "Enviar opinión"}
                </button>
              </>
            ) : (
              <div className="mt-4 p-3 bg-light border rounded text-center">
                <p className="mb-2 fw-bold">¿Quieres dejar tu opinión?</p>
                <p className="text-muted small">Inicia sesión para calificar y comentar este producto.</p>
                <button className="btn btn-danger btn-sm" onClick={() => navigate("/login")}>Iniciar sesión</button>
              </div>
            )}
          </div>
          
          <div className="col-md-6">
            <h3>También te puede interesar</h3>
            <div className="row row-cols-2 g-3">
              {relacionados.map((item, index) => (
                <div key={`${item.ID}-${index}`} className="col">
                  <div 
                    className="card h-100 border-0 shadow-sm" 
                    style={{ cursor: "pointer", transition: "transform 0.2s" }}
                    onMouseOver={(e) => e.currentTarget.style.transform = "scale(1.03)"}
                    onMouseOut={(e) => e.currentTarget.style.transform = "scale(1)"}
                    onClick={() => {
                        navigate(`/producto/${item.ID}`);
                        window.scrollTo(0, 0);
                    }}
                  >
                    <img 
                      src={item.URL_IMAGEN || "https://via.placeholder.com/200"} 
                      className="card-img-top" 
                      alt={item.NOMBRE} 
                      style={{ height: "150px", objectFit: "cover" }} 
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }}
                    />
                    <div className="p-2">
                      <h6 className="small fw-bold m-0 text-truncate">{item.NOMBRE}</h6>
                      {item.ID_DESCUENTO != null && descuentosMap[item.ID_DESCUENTO] ? (
                        <>
                          <p className="text-danger small fw-bold m-0">
                            ${(Number(item.PRECIO) - (Number(item.PRECIO) * descuentosMap[item.ID_DESCUENTO] / 100)).toLocaleString("es-CO")}
                          </p>
                          <p className="text-muted m-0" style={{ fontSize: "0.7rem", textDecoration: "line-through" }}>
                            ${Number(item.PRECIO).toLocaleString("es-CO")}
                          </p>
                        </>
                      ) : (
                        <p className="text-danger small fw-bold m-0">${Number(item.PRECIO).toLocaleString("es-CO")}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ProductDetailPage;