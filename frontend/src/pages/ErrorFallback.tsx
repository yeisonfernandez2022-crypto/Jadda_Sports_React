const ErrorFallback = ({ onRefresh }: { onRefresh: () => void }) => {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
      <div className="text-center">
        <h1 className="display-4 fw-bold text-danger mb-3">¡Oops!</h1>
        <h3 className="fw-bold mb-3">Algo salió mal</h3>
        <p className="text-muted mb-4">Ocurrió un error inesperado. Intenta de nuevo.</p>
        <button className="btn btn-danger btn-lg fw-bold px-5" onClick={onRefresh}>
          Reintentar
        </button>
      </div>
    </div>
  );
};

export default ErrorFallback;
