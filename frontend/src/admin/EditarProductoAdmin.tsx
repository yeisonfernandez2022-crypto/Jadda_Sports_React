import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const EditarProductoAdmin = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [prod, setProd] = useState({ NOMBRE: '', PRECIO: '', DESCRIPCION: '' });
  const [caracteristicas, setCaracteristicas] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [nuevaCar, setNuevaCar] = useState({ NOMBRE_ATRIBUTO: '', VALOR_ATRIBUTO: '' });

  useEffect(() => {
    if (!id) return;
    
    Promise.all([
      fetch(`http://localhost:5000/api/productos/${id}`).then(res => res.json()),
      fetch(`http://localhost:5000/api/productos/${id}/caracteristicas`).then(res => res.json())
    ]).then(([prodData, carData]) => {
      setProd({ NOMBRE: prodData.NOMBRE, PRECIO: prodData.PRECIO, DESCRIPCION: prodData.DESCRIPCION });
      setCaracteristicas(Array.isArray(carData) ? carData : []);
    }).catch(() => console.error("Error al cargar datos"));
  }, [id]);

  const guardarCambios = async () => {
    setLoading(true);
    const res = await fetch(`http://localhost:5000/api/productos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prod)
    });
    setLoading(false);
    if (res.ok) Swal.fire("¡Éxito!", "Producto actualizado", "success");
    else Swal.fire("Error", "No se pudo actualizar", "error");
  };

  const agregarCaracteristica = async () => {
    if (!nuevaCar.NOMBRE_ATRIBUTO || !nuevaCar.VALOR_ATRIBUTO) return;
    
    const res = await fetch(`http://localhost:5000/api/productos/${id}/caracteristicas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nuevaCar)
    });
    
    if (res.ok) {
      const data = await res.json();
      setCaracteristicas([...caracteristicas, data]);
      setNuevaCar({ NOMBRE_ATRIBUTO: '', VALOR_ATRIBUTO: '' });
      Swal.fire("¡Agregado!", "", "success");
    }
  };

  const eliminarCaracteristica = async (idCaracteristica: number) => {
    await fetch(`http://localhost:5000/api/productos/caracteristicas/${idCaracteristica}`, { method: 'DELETE' });
    setCaracteristicas(caracteristicas.filter(c => c.ID_CARACTERISTICA !== idCaracteristica));
  };

  return (
    <div className="container py-4">
      <button className="btn btn-outline-secondary mb-3" onClick={() => navigate('/admin')}>← Volver</button>
      
      <div className="row">
        {/* Formulario Producto */}
        <div className="col-md-6">
          <div className="card p-4 shadow-sm">
            <h5 className="text-primary">Información General</h5>
            <input className="form-control mb-2" value={prod.NOMBRE} onChange={e => setProd({...prod, NOMBRE: e.target.value})} />
            <input className="form-control mb-2" type="number" value={prod.PRECIO} onChange={e => setProd({...prod, PRECIO: e.target.value})} />
            <textarea className="form-control mb-3" rows={4} value={prod.DESCRIPCION} onChange={e => setProd({...prod, DESCRIPCION: e.target.value})} />
            <button className="btn btn-primary w-100" onClick={guardarCambios} disabled={loading}>
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>

        {/* Panel Características */}
        <div className="col-md-6">
          <div className="card p-4 shadow-sm">
            <h5 className="text-primary">Características</h5>
            {caracteristicas.map((car) => (
              <div key={car.ID_CARACTERISTICA} className="input-group mb-2">
                <span className="input-group-text">{car.NOMBRE_ATRIBUTO}</span>
                <input className="form-control" value={car.VALOR_ATRIBUTO} readOnly />
                <button className="btn btn-outline-danger" onClick={() => eliminarCaracteristica(car.ID_CARACTERISTICA)}>X</button>
              </div>
            ))}
            
            <hr />
            <h6 className="text-muted">Agregar nueva</h6>
            <input className="form-control mb-1" placeholder="Nombre" value={nuevaCar.NOMBRE_ATRIBUTO} onChange={e => setNuevaCar({...nuevaCar, NOMBRE_ATRIBUTO: e.target.value})} />
            <input className="form-control mb-2" placeholder="Valor" value={nuevaCar.VALOR_ATRIBUTO} onChange={e => setNuevaCar({...nuevaCar, VALOR_ATRIBUTO: e.target.value})} />
            <button className="btn btn-outline-success w-100" onClick={agregarCaracteristica}>+ Agregar</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditarProductoAdmin;