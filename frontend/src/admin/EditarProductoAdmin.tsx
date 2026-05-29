import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminProductoCaracteristicas from "./AdminProductoCaracteristicas";
import Swal from "sweetalert2";
import '../css/EditarProducto.css'; // Asegúrate de que esta ruta sea la correcta en tu proyecto

const EditarProductoAdmin = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [prod, setProd] = useState({ NOMBRE: '', PRECIO: '', DESCRIPCION: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`http://localhost:5000/api/productos/${id}`)
      .then(res => res.json())
      .then(data => {
        setProd({ 
          NOMBRE: data.NOMBRE || '', 
          PRECIO: data.PRECIO || '', 
          DESCRIPCION: data.DESCRIPCION || '' 
        });
      })
      .catch(() => Swal.fire("Error", "No se pudo cargar el producto", "error"));
  }, [id]);

  const guardarCambios = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/productos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prod)
      });
      
      if (res.ok) {
        Swal.fire({ 
          icon: 'success', 
          title: '¡Actualizado!', 
          text: 'Los cambios se guardaron correctamente', 
          timer: 2000,
          showConfirmButton: false 
        });
      } else {
        throw new Error();
      }
    } catch (error) {
      Swal.fire("Error", "No se pudo actualizar el producto", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="editar-producto-wrapper">
      <div className="container py-4">
        <button className="btn btn-outline-secondary btn-sm mb-3" onClick={() => navigate('/admin')}>
          <i className="bi bi-arrow-left"></i> Volver al panel
        </button>
        
        <div className="row">
          {/* Formulario Principal */}
          <div className="col-md-5">
            <div className="card shadow-sm border-0">
              <div className="card-body p-4">
                <h5 className="mb-4 text-primary">Información General</h5>
                
                <div className="mb-3">
                  <label className="form-label small text-muted text-uppercase fw-bold">Nombre</label>
                  <input 
                    className="form-control" 
                    value={prod.NOMBRE} 
                    onChange={e => setProd({...prod, NOMBRE: e.target.value})} 
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small text-muted text-uppercase fw-bold">Precio</label>
                  <div className="input-group">
                    <span className="input-group-text">$</span>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={prod.PRECIO} 
                      onChange={e => setProd({...prod, PRECIO: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label small text-muted text-uppercase fw-bold">Descripción</label>
                  <textarea 
                    className="form-control" 
                    rows={4} 
                    value={prod.DESCRIPCION} 
                    onChange={e => setProd({...prod, DESCRIPCION: e.target.value})} 
                  />
                </div>

                <button 
                  className="btn btn-primary w-100 fw-bold" 
                  onClick={guardarCambios} 
                  disabled={loading}
                >
                  {loading ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </div>
          </div>

          {/* Sección de Características */}
          <div className="col-md-7">
           <AdminProductoCaracteristicas />
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditarProductoAdmin;