import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
      <div className="text-center">
        <h1 className="display-1 fw-bold text-danger" style={{ fontSize: "8rem" }}>404</h1>
        <h2 className="fw-bold mb-3">Página no encontrada</h2>
        <p className="text-muted mb-4">La página que buscas no existe o ha sido movida.</p>
        <button className="btn btn-danger btn-lg fw-bold px-5" onClick={() => navigate("/")}>
          Volver al inicio
        </button>
      </div>
    </div>
  );
};

export default NotFound;
