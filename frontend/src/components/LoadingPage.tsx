const LoadingPage = ({ mensaje = "Cargando..." }: { mensaje?: string }) => {
  return (
    <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: "80vh" }}>
      <div className="spinner-border text-danger" role="status" style={{ width: "4rem", height: "4rem" }} />
      <p className="mt-3 text-muted fw-bold">{mensaje}</p>
    </div>
  );
};

export default LoadingPage;
