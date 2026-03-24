import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

function Navbar() {
  const [userName, setUserName] = useState<string | null>(null);
  const location = useLocation();

  const cargarUsuario = () => {
    const storedName = localStorage.getItem("userName");
    if (storedName && storedName !== "Invitado") {
      setUserName(storedName.split(" ")[0].toUpperCase());
    } else {
      setUserName(null);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userFromURL = params.get("user");

    if (userFromURL) {
      const nombreDecodificado = decodeURIComponent(userFromURL);
      localStorage.setItem("userName", nombreDecodificado);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    cargarUsuario();
    window.addEventListener("storage", cargarUsuario);
    return () => window.removeEventListener("storage", cargarUsuario);
  }, [location]);

  const cerrarSesion = () => {
  // Limpias el almacenamiento
  localStorage.clear();
  setUserName(null);
};
  return (
    <nav className="navbar">
      <div className="nav-left-section">
        <Link className="navbar-brand" to="/">
          <img 
            src="https://i.postimg.cc/SxjSR241/Black-And-White-Flat-Style-Running-Club-Logo.png" 
            alt="Logo JADDA" 
            className="logo-img" 
          />
        </Link>
        <ul className="menu-nav-list">
          <li><Link to="/">INICIO</Link></li>
          <li><Link to="/catalogo">CATÁLOGO</Link></li>
          <li><a href="#categorias">CATEGORÍAS</a></li>
        </ul>
      </div>

      <div className="nav-right-section">
        <div className="search-wrapper">
          <input type="text" placeholder="BUSCAR PRODUCTO..." />
          <i className="fas fa-search"></i>
        </div>

        <div className="auth-group">
          {userName ? (
            <div className="user-logged-flex">
              <span className="user-welcome">HOLA, {userName}</span>
              <button onClick={cerrarSesion} className="btn-logout">SALIR</button>
            </div>
          ) : (
            <div className="auth-buttons-flex">
              <Link to="/login" className="btn-login-new">INICIAR SESIÓN</Link>
              <Link to="/registro" className="btn-register-new">REGISTRO</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
