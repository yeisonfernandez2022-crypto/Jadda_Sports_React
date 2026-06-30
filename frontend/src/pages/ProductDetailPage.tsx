import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaShoppingCart, FaArrowLeft, FaCheck, FaHeart, FaRegHeart } from "react-icons/fa";
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
  const { usuario, usuarioLogueado } = useAuth();
  const [tabActiva, setTabActiva] = useState<string>("descripcion");
  const [producto, setProducto] = useState<Producto | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [indiceImagen, setIndiceImagen] = useState<number>(0);
  const [colorSeleccionado, setColorSeleccionado] = useState("");
  const [atributoSeleccionado, setAtributoSeleccionado] = useState("");
  const [cantidad, setCantidad] = useState<number>(1);
  const [agregadoAnimacion, setAgregadoAnimacion] = useState<boolean>(false);

  const [relacionados, setRelacionados] = useState<any[]>([]);
  const [resenas, setResenas] = useState<any[]>([]);
  const [nuevaResenaComentario, setNuevaResenaComentario] = useState("");
  const [nuevaResenaCalificacion, setNuevaResenaCalificacion] = useState(0);
  const [enviandoResena, setEnviandoResena] = useState(false);
  const [hoverEstrella, setHoverEstrella] = useState(0);
  const [esFavorito, setEsFavorito] = useState(false);
  const [idFavorito, setIdFavorito] = useState<number | null>(null);

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
      IMAGEN: producto.IMAGENES?.[0]?.url || ""
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

const atributosDisponibles = colorSeleccionado 
  ? [...new Set(producto.VARIANTES.filter(v => v.COLOR === colorSeleccionado).map(v => v.ATRIBUTO))]
  : [...new Set(producto.VARIANTES.map(v => v.ATRIBUTO))];


const varianteSeleccionada = producto.VARIANTES.find(
  v =>
    v.COLOR === colorSeleccionado &&
    v.ATRIBUTO === atributoSeleccionado
);

const stockActual = varianteSeleccionada?.STOCK || 0;
  
  return (
    <div className="bg-white text-dark min-vh-100">
      <main className="container py-5 flex-grow-1">
        <button onClick={() => navigate("/catalogo")} className="btn p-0 mb-4 text-dark fw-bold text-uppercase">
          <FaArrowLeft className="text-danger" /> Volver
        </button>

        <div className="row g-5">
          {/* GALERÍA DE IMÁGENES */}
          <div className="col-lg-6">
            <div className="product-image-container bg-white rounded shadow-sm border mb-3">
              <img 
                src={producto?.IMAGENES?.[indiceImagen]?.url || "https://via.placeholder.com/600"} 
                className="img-fluid w-100 object-fit-cover" 
                style={{ maxHeight: "500px" }} 
                alt={producto?.NOMBRE || "Producto"}
                loading="lazy"
                onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }}
              />
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
          </div>

          {/* DETALLES DEL PRODUCTO */}
          <div className="col-lg-6">
            <span className="badge bg-danger mb-3">{producto.CATEGORIA}</span>
            <h1 className="fw-bold text-uppercase text-dark">{producto.NOMBRE}</h1>
            <h2 className="text-danger fw-bold mb-4">${Number(producto.PRECIO).toLocaleString()}</h2>
            
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
</div>


            {/* Botón agregar + Favoritos */}
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

            {/* Tabs de Información */}
            <div className="mt-5">
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
              </div>

              <div className="p-3 border-start border-end border-bottom">
                {tabActiva === 'descripcion' ? (
                  <p>{producto.DESCRIPCION}</p>
                ) : (
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
                    <p className="text-muted small text-center my-2">No hay características especificadas para este producto.</p>
                  )
                )}
              </div>
            </div>
            
          </div>
        </div>
        
        {/* RESEÑAS Y RELACIONADOS */}
        <hr className="my-5" />
        <div className="row g-5">
          <div className="col-md-6">
            <h3>Opiniones ({resenas.length})</h3>

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
                      <p className="text-danger small fw-bold m-0">${Number(item.PRECIO).toLocaleString()}</p>
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