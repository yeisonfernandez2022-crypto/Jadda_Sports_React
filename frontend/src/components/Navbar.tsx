import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom"; // 👈 1. Importamos useLocation
import { useAuth } from "../context/AuthContext"; 
import { 
  FaUser, FaBox, FaHeart, FaHistory, FaHeadset, FaCog, FaSearch,
  FaSignOutAlt
} from 'react-icons/fa';

function Navbar() {
  const { usuario, usuarioLogueado, logoutGlobal } = useAuth();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation(); // 👈 2. Capturamos la página actual (ej: /catalogo o /producto/3)
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickAfuera = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickAfuera);
    return () => document.removeEventListener("mousedown", handleClickAfuera);
  }, []);

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

  // 3. Búsqueda en vivo (Corregida la URL para evitar el 404)
  useEffect(() => {
    const buscarEnVivo = async () => {
      if (searchTerm.trim().length > 1) {
        try {
          // 🚀 CORRECCIÓN: Le pegamos al puerto 5000 que es tu backend real
          const response = await fetch(`http://localhost:5000/api/productos?search=${encodeURIComponent(searchTerm)}`);
          if (!response.ok) throw new Error("Error en el servidor");
          
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
            src="https://i.postimg.cc/tJD692JP/Logo-Jadda-Sports-removebg-preview.png" 
            alt="Logo JADDA" 
            className="logo-img" 
          />
        </Link>
        <ul className="menu-nav-list">
          <li><Link to="/">INICIO</Link></li>
          <li><Link to="/catalogo">CATÁLOGO</Link></li>
          <li><a href="#categorias">CATEGORÍAS</a></li>
          <li><Link to="/sobre-nosotros">SOBRE NOSOTROS</Link></li>
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

        {/* SECCIÓN REACTIVA DE AUTENTICACIÓN */}
        <div className="auth-group">
          {usuarioLogueado && usuario ? (
            <div className="relative" ref={menuRef}>
              <div onClick={() => setIsMenuOpen(!isMenuOpen)} className="user-profile-trigger">
                <div className="profile-avatar">
                  <img 
                    src={usuario.foto_url || "https://via.placeholder.com/150"} 
                    alt="Perfil" 
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://via.placeholder.com/150";
                    }}
                  />
                </div>
                <div className="user-info-text">
                  <span className="user-welcome-label">HOLA,</span>
                  <span className="user-name-label">
                    {usuario.NOMBRE_USUARIO ? usuario.NOMBRE_USUARIO.split(" ")[0].toUpperCase() : "USUARIO"}
                  </span>
                </div>
                <FaCog className={`gear-icon ${isMenuOpen ? 'rotate' : ''}`} />
              </div>

              {isMenuOpen && (
                <div className="profile-dropdown-menu">
                  <div className="dropdown-header">
                    <p className="user-full-name">{usuario.NOMBRE_USUARIO}</p>
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
                    <button 
  className="btn-logout-dropdown"
  onClick={() => {
    logoutGlobal();       // Esto limpia el estado y recarga la página
    setIsMenuOpen(false); // Cierra el menú desplegable
  }} 
>
  <FaSignOutAlt /> CERRAR SESIÓN
</button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons-flex">
              {/* 🚀 4. REDIRECCIÓN INTELIGENTE: Pasamos la ubicación actual en el state para el Login.tsx */}
              <Link 
                to="/login" 
                state={{ from: location }} 
                className="btn-login-new"
              >
                INICIAR SESIÓN
              </Link>
              <Link to="/registro" className="btn-register-new">REGISTRO</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;