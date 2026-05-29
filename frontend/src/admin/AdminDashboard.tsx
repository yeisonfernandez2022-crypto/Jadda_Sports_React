import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

const AdminDashboard = () => {
  const [productos, setProductos] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Aquí usamos el endpoint que ya tienes: obtenerProductos
    fetch("http://localhost:5000/api/productos")
      .then((res) => res.json())
      .then((data) => setProductos(data));
  }, []);

  return (
    <div className="container mt-5 pt-5">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1>Dashboard de Productos</h1>
        <button className="btn btn-success">+ Nuevo Producto</button>
      </div>

      <table className="table table-hover shadow-sm bg-white">
        <thead className="table-dark">
          <tr>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Categoría</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {productos.map((prod) => (
            <tr key={prod.ID}>
              <td>{prod.NOMBRE}</td>
              <td>${Number(prod.PRECIO).toLocaleString()}</td>
              <td>{prod.CATEGORIA}</td>
              <td>
                <button 
                  className="btn btn-primary btn-sm me-2"
                  onClick={() => navigate(`/admin/editar/${prod.ID}`)}
                >
                  Editar
                </button>
                <button className="btn btn-danger btn-sm">Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AdminDashboard;