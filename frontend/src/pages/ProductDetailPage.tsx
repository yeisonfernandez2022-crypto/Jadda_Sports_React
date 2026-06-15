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
}

interface Caracteristica {
  NOMBRE_ATRIBUTO: string;
  VALOR_ATRIBUTO: string;
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
  const [tallaSeleccionada, setTallaSeleccionada] = useState<string>("");
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

  const handleAgregarCarrito = async () => {
    if (!producto) return;
    if (!tallaSeleccionada) {
      Swal.fire({ 
        title: 'SELECCIONA UNA TALLA', 
        text: 'Por favor, elige tu talla.', 
        icon: 'warning', 
        background: '#121212', 
        color: '#ffffff', 
        confirmButtonColor: '#e73737' 
      });
      return;
    }
    await addToCart(producto.ID, cantidad);
    setAgregadoAnimacion(true);
    setTimeout(() => setAgregadoAnimacion(false), 2000);
  };

  if (loading) return <div className="text-center py-5">Cargando...</div>;
  if (error || !producto) return <div className="text-center py-5">Error: {error}</div>;

  return (
    <div className="bg-white text-dark min-vh-100">
      <Navbar />
      <main className="container py-5" style={{ marginTop: "100px" }}>
        <button onClick={() => navigate(-1)} className="btn p-0 mb-4 text-dark fw-bold text-uppercase">
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
            <div className="mb-4">
              {producto.STOCK > 10 ? (
                <div>
                  <p className="text-success fw-bold small m-0"><FaCheck /> ¡Disponible para envío inmediato!</p>
                  <span className="text-muted small">Stock disponible: {producto.STOCK} unidades</span>
                </div>
              ) : producto.STOCK > 0 ? (
                <p className="text-warning fw-bold small">⚠️ ¡Quedan pocas unidades ({producto.STOCK} disponibles)!</p>
              ) : (
                <p className="text-danger fw-bold small">Agotado temporalmente</p>
              )}
            </div>

            {/* Selector de tallas (Ejemplo visual rápido para que funcione tu validación de SweetAlert) */}
            <div className="mb-4">
              <span className="fw-bold d-block mb-2">Talla:</span>
              <div className="d-flex gap-2">
                {["S", "M", "L", "XL"].map((talla) => (
                  <button 
                    key={talla} 
                    onClick={() => setTallaSeleccionada(talla)} 
                    className={`btn btn-sm ${tallaSeleccionada === talla ? 'btn-danger' : 'btn-outline-dark'}`}
                  >
                    {talla}
                  </button>
                ))}
              </div>
            </div>

            {/* Botón agregar */}
            <button 
              onClick={handleAgregarCarrito} 
              disabled={producto.STOCK <= 0}
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