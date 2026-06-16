import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaShoppingCart, FaArrowLeft, FaCheck } from "react-icons/fa";
import Navbar from "../components/Navbar";
import { useCart } from "../context/CartContext";
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

  useEffect(() => {
    fetch(`http://localhost:5000/api/productos/${id}/resenas`)
      .then(res => res.json())
      .then(data => setResenas(data));
  }, [id]);

  useEffect(() => {
    const fetchRelacionados = async () => {
      const res = await fetch(`http://localhost:5000/api/productos/relacionados/${id}`);
      const data = await res.json();
      setRelacionados(data);
    };
    if (id) fetchRelacionados();
  }, [id]);

  useEffect(() => {
    const obtenerProducto = async () => {
      try {
        setLoading(true);
        const response = await fetch(`http://localhost:5000/api/productos/${id}`);
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
    const agregado = await addToCart(producto.ID, cantidad);

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

const nombreAtributo =
  producto.VARIANTES[0]?.NOMBRE_ATRIBUTO || "Atributo";

const atributos = colorSeleccionado
  ? [
      ...new Set(
        producto.VARIANTES
          .filter(v => v.COLOR === colorSeleccionado)
          .map(v => v.ATRIBUTO)
      )
    ]
  : [
      ...new Set(
        producto.VARIANTES.map(v => v.ATRIBUTO)
      )
    ];

const varianteSeleccionada = producto.VARIANTES.find(
  v =>
    v.COLOR === colorSeleccionado &&
    v.ATRIBUTO === atributoSeleccionado
);

const stockActual = varianteSeleccionada?.STOCK || 0;
  
  return (
    <div className="bg-white text-dark min-vh-100">
      <Navbar />
      <main className="container py-5" style={{ marginTop: "100px" }}>
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
                  <img src={img.url} className="w-100 h-100 object-fit-cover" alt="" />
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
  }
}}


        className={`btn btn-sm ${
          colorSeleccionado === color
            ? "btn-danger"
            : "btn-outline-dark"
        }`}
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

    {atributos.map(opcion => (

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
        }
      }}
    >
      +
    </button>
  </div>
</div>


            {/* Botón agregar */}
            <button 
              onClick={handleAgregarCarrito} 
              disabled={
  !colorSeleccionado ||
  !atributoSeleccionado ||
  stockActual <= 0
}
              className={`btn w-100 py-3 ${agregadoAnimacion ? "btn-success" : "btn-danger"}`}
            >
              {agregadoAnimacion ? <><FaCheck /> Añadido</> : <><FaShoppingCart /> Añadir al carrito</>}
            </button>

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
            {resenas.map((r) => (
              <div key={r.ID_RESENA} className="p-3 border bg-light mb-2">
                <p className="fw-bold text-danger m-0">{r.NOMBRE} - {"⭐".repeat(r.CALIFICACION)}</p>
                <p className="small m-0 mt-1">{r.COMENTARIO}</p>
              </div>
            ))}
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