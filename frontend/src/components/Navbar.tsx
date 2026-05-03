import { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  FaUser, FaBox, FaHeart, FaHistory, FaHeadset, FaCog, FaSearch,
  FaSignOutAlt
} from 'react-icons/fa';

function Navbar() {
  const [userName, setUserName] = useState<string | null>(null);
  const [userPhoto, setUserPhoto] = useState<string>("https://via.placeholder.com/150");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

  const cargarUsuario = () => {
    const storedName = localStorage.getItem("userName");
    const storedPhoto = localStorage.getItem("userPhoto");
    

    if (storedName && storedName !== "Invitado") {
      setUserName(storedName.split(" ")[0].toUpperCase());
    } else {
      setUserName(null);
    }

    if (storedPhoto && storedPhoto !== "null" && storedPhoto !== "undefined") {
      setUserPhoto(storedPhoto);
    } else {
      setUserPhoto("https://via.placeholder.com/150");
    }
  };

  useEffect(() => {
    const handleClickAfuera = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAfuera);
    return () => document.removeEventListener("mousedown", handleClickAfuera);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userFromURL = params.get("user");
    const photoFromURL = params.get("photo");

    if (userFromURL) {
      localStorage.setItem("userName", decodeURIComponent(userFromURL));
      if (photoFromURL) {
        localStorage.setItem("userPhoto", decodeURIComponent(photoFromURL));
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    cargarUsuario();
    window.addEventListener("storage", cargarUsuario);
    return () => window.removeEventListener("storage", cargarUsuario);
  }, [location]);

  const cerrarSesion = () => {
    localStorage.clear();
    setUserName(null);
    setUserPhoto("https://via.placeholder.com/150");
    setIsMenuOpen(false);
    navigate("/");
  };

  const manejarBusqueda = (e: React.FormEvent | React.KeyboardEvent) => {
    if ("key" in e && e.key !== "Enter") return;
    
    if (e.type === 'submit' || ("key" in e && e.key === 'Enter')) {
        e.preventDefault();
        if (searchTerm.trim()) {
            navigate(`/catalogo?search=${encodeURIComponent(searchTerm.trim())}`);
            setMostrarDropdown(false);
            setSearchTerm("");
        }
    }
  };

  useEffect(() => {
    const buscarEnVivo = async () => {
      if (searchTerm.trim().length > 1) {
        try {
          const response = await fetch(`/api/productos?search=${encodeURIComponent(searchTerm)}`);
          const data = await response.json();
          setSugerencias(data.slice(0, 5));
          setMostrarDropdown(true);
        } catch (error) {
          console.error("Error en búsqueda en vivo:", error);
        }
      } else {
        setSugerencias([]);
        setMostrarDropdown(false);
      }
    };

    const timeoutId = setTimeout(buscarEnVivo, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const manejarSeleccion = (prod: any) => {
  navigate(`/catalogo?search=${encodeURIComponent(prod.NOMBRE)}`);
  setMostrarDropdown(false);
  setSearchTerm("");
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
        {/* BUSCADOR UNIFICADO CON DROPDOWN */}
        <div className="search-wrapper" style={{ position: 'relative' }}>
          <input 
            type="text" 
            placeholder="BUSCAR PRODUCTO..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={manejarBusqueda} 
          />
          <FaSearch 
            className="search-icon" 
            style={{ cursor: 'pointer' }}
            onClick={() => {
                if (searchTerm.trim()) {
                    navigate(`/catalogo?search=${encodeURIComponent(searchTerm.trim())}`);
                    setMostrarDropdown(false);
                    setSearchTerm("");
                }
            }} 
          />

          {mostrarDropdown && (
  <ul className="search-dropdown">
    {sugerencias.length > 0 ? (
      sugerencias.map((prod) => (
        <li key={prod.ID} onClick={() => manejarSeleccion(prod)}>
          <img src={prod.IMAGEN} alt={prod.NOMBRE} className="dropdown-img" />
          <div className="dropdown-info">
            <span className="dropdown-name">{prod.NOMBRE}</span>
            <span className="dropdown-price">${Number(prod.PRECIO).toLocaleString()}</span>
          </div>
        </li>
      ))
    ) : (
      <li style={{ justifyContent: 'center', color: '#888', fontSize: '0.8rem' }}>
        No se encontraron productos
      </li>
    )}
  </ul>
)}
        </div>

        <div className="auth-group">
          {userName ? (
            <div className="relative" ref={menuRef}>
              <div onClick={() => setIsMenuOpen(!isMenuOpen)} className="user-profile-trigger">
                <div className="profile-avatar">
                  <img 
                    src={userPhoto} 
                    alt="Perfil" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://via.placeholder.com/150";
                    }}
                  />
                </div>
                <div className="user-info-text">
                  <span className="user-welcome-label">HOLA,</span>
                  <span className="user-name-label">{userName}</span>
                </div>
                <FaCog className={`gear-icon ${isMenuOpen ? 'rotate' : ''}`} />
              </div>

              {isMenuOpen && (
                <div className="profile-dropdown-menu">
                  <div className="dropdown-header">
                    <p className="user-full-name">{userName}</p>
                    <p className="user-status">Miembro JADDA</p>
                  </div>
                  <div className="dropdown-body">
                    <Link to="/pedidos" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                      <FaBox className="icon-red" /> Mis Pedidos
                    </Link>
                    <Link to="/favoritos" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                      <FaHeart className="icon-red" /> Favoritos
                    </Link>
                    <Link to="/perfil" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                      <FaUser className="icon-red" /> Mi Perfil
                    </Link>
                    <Link to="/historial" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                      <FaHistory className="icon-red" /> Mi Historial
                    </Link>
                    <Link to="/soporte" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                      <FaHeadset className="icon-red" /> Ayuda y Soporte
                    </Link>
                  </div>
                  <div className="dropdown-footer">
                    <button onClick={cerrarSesion} className="btn-logout-dropdown">
                      <FaSignOutAlt /> CERRAR SESIÓN
                    </button>
                  </div>
                </div>
              )}
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