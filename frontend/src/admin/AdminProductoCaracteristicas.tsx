import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Swal from "sweetalert2";

interface Caracteristica {
  ID_CARACTERISTICA?: number;
  NOMBRE_ATRIBUTO: string;
  VALOR_ATRIBUTO: string;
}

const AdminProductoCaracteristicas = () => {
  // Captura el ID de la URL sea cual sea el nombre del parámetro
  const params = useParams<{ idProducto?: string; id?: string }>();
  const idProducto = params.idProducto || params.id;
  
  const [lista, setLista] = useState<Caracteristica[]>([]);
  const [nueva, setNueva] = useState({ NOMBRE_ATRIBUTO: '', VALOR_ATRIBUTO: '' });

  // Cargar lista desde el servidor
  const cargarLista = async () => {
    if (!idProducto) return;
    try {
      const res = await fetch(`http://localhost:5000/api/productos/${idProducto}/caracteristicas`);
      const data = await res.json();
      setLista(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error al cargar características:", err);
    }
  };

  useEffect(() => {
    cargarLista();
  }, [idProducto]);

  const agregar = async () => {
    if (!nueva.NOMBRE_ATRIBUTO || !nueva.VALOR_ATRIBUTO || !idProducto) return;

    try {
      const res = await fetch(`http://localhost:5000/api/productos/${idProducto}/caracteristicas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nueva)
      });

      if (res.ok) {
        setNueva({ NOMBRE_ATRIBUTO: '', VALOR_ATRIBUTO: '' });
        await cargarLista(); // Recargamos para obtener el ID real desde la DB
        Swal.fire("Éxito", "Característica añadida", "success");
      }
    } catch (err) {
      Swal.fire("Error", "No se pudo conectar con el servidor", "error");
    }
  };

  const eliminarCaracteristica = async (idCaracteristica?: number) => {
    if (!idCaracteristica) return;

    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "No podrás revertir esto",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
      try {
        const res = await fetch(`http://localhost:5000/api/caracteristicas/${idCaracteristica}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          setLista(lista.filter(item => item.ID_CARACTERISTICA !== idCaracteristica));
          Swal.fire("Eliminado", "La característica fue eliminada", "success");
        }
      } catch (err) {
        Swal.fire("Error", "No se pudo eliminar", "error");
      }
    }
  };

  return (
    <div className="card p-3 shadow-sm mt-4">
      <h5>Gestionar Características</h5>
      <div className="d-flex gap-2 mb-3">
        <input 
          placeholder="Ej: Material" 
          value={nueva.NOMBRE_ATRIBUTO}
          onChange={(e) => setNueva({...nueva, NOMBRE_ATRIBUTO: e.target.value})}
          className="form-control"
        />
        <input 
          placeholder="Ej: Algodón" 
          value={nueva.VALOR_ATRIBUTO}
          onChange={(e) => setNueva({...nueva, VALOR_ATRIBUTO: e.target.value})}
          className="form-control"
        />
        <button className="btn btn-primary" onClick={agregar}>+</button>
      </div>

      <ul className="list-group">
        {lista.map((c, i) => (
          <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
            <span><strong>{c.NOMBRE_ATRIBUTO}:</strong> {c.VALOR_ATRIBUTO}</span>
            <button 
              className="btn btn-sm btn-danger" 
              onClick={() => eliminarCaracteristica(c.ID_CARACTERISTICA)}
            >
              X
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AdminProductoCaracteristicas;