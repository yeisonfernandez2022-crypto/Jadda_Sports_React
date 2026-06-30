import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext"; 
import { 
  FaUser, FaBox, FaHeart, FaHistory, FaHeadset, FaCog, FaSearch,
  FaSignOutAlt, FaTrophy, FaDumbbell
} from 'react-icons/fa';

interface CategoriaMenu {
  ID_CATEGORIA: number;
  NOMBRE_CATEGORIA: string;
}

interface ProductoMenu {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  CATEGORIA?: string;
}

function Navbar() {
  const { usuario, usuarioLogueado, logoutGlobal } = useAuth();
  const { openLogin, openRegister } = useAuthModal();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [showMegaMenu, setShowMegaMenu] = useState(false);
  const [categoriasMenu, setCategoriasMenu] = useState<CategoriaMenu[]>([]);
  const [productosMenu, setProductosMenu] = useState<ProductoMenu[]>([]);
  
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const fetchMenuData = async () => {
      try {
        const [cats, prods] = await Promise.all([
          fetch("/api/productos/categorias").then(r => r.json()),
          fetch("/api/productos").then(r => r.json()),
        ]);
        setCategoriasMenu(cats);
        setProductosMenu(prods);
      } catch (e) {
        console.error("Error al cargar mega-menú", e);
      }
    };
    fetchMenuData();
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
          const response = await fetch(`/api/productos?search=${encodeURIComponent(searchTerm)}`);
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
    navigate(`/producto/${prod.ID}`);
    setMostrarDropdown(false);
    setSearchTerm("");
  };


  return (
    <nav className="navbar">
      <div className="nav-left-section">
        <Link className="navbar-brand" to="/">
          <img 
            src="https://i.postimg.cc/jdqFW4Lj/Logo-Jadda.png" 
            alt="Logo JADDA" 
            className="logo-img" 
          />
        </Link>
        <ul className="menu-nav-list">
          <li><Link to="/">INICIO</Link></li>
          <li
            className="nav-item-catalog"
            onMouseEnter={() => {
              if (megaTimer.current) clearTimeout(megaTimer.current);
              setShowMegaMenu(true);
            }}
            onMouseLeave={() => {
              megaTimer.current = setTimeout(() => setShowMegaMenu(false), 200);
            }}
          >
            <Link to="/catalogo">CATÁLOGO</Link>
            {showMegaMenu && categoriasMenu.length > 0 && (
              <div
                className="mega-menu"
                onMouseEnter={() => { if (megaTimer.current) clearTimeout(megaTimer.current); }}
                onMouseLeave={() => { megaTimer.current = setTimeout(() => setShowMegaMenu(false), 200); }}
              >
                <div className="mega-menu-grid">
                  {categoriasMenu.map((cat) => {
                    const prods = productosMenu.filter((p) => p.CATEGORIA === cat.NOMBRE_CATEGORIA).slice(0, 3);
                    return (
                      <div key={cat.ID_CATEGORIA} className="mega-col">
                        <div
                          className="mega-cat-title"
                          onClick={() => {
                            setShowMegaMenu(false);
                            navigate(`/catalogo?categoria=${encodeURIComponent(cat.NOMBRE_CATEGORIA)}`);
                          }}
                        >
                          {cat.NOMBRE_CATEGORIA}
                        </div>
                        {prods.map((p) => (
                          <div
                            key={p.ID}
                            className="mega-prod-item"
                            onClick={() => {
                              setShowMegaMenu(false);
                              navigate(`/producto/${p.ID}`);
                            }}
                          >
                            <span className="mega-prod-name">{p.NOMBRE}</span>
                            <span className="mega-prod-price">${Number(p.PRECIO).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </li>
          <li><Link to="/catalogo?descuento=true">OFERTAS</Link></li>
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
                    <img src={prod.IMAGEN} alt={prod.NOMBRE} className="dropdown-img" loading="lazy" onError={(e) => { e.currentTarget.src = 'https://placehold.co/400x400?text=JADDA'; }} />
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
  src={
    usuario.foto_url ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.NOMBRE_USUARIO)}`
  }
  alt="Perfil"
  onError={(e) => {
    e.currentTarget.src =
      `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.NOMBRE_USUARIO)}`;
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
                    <Link to="/perfil/compras" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
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
                    <Link to="/retos" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                      <FaTrophy className="icon-red" /> Retos
                    </Link>
                    <Link to="/mis-planes" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                      <FaDumbbell className="icon-red" /> Planes
                    </Link>
                    <Link to="/ayuda_soporte" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                      <FaHeadset className="icon-red" /> Ayuda y Soporte
                    </Link>
                  </div>
                  <div className="dropdown-footer">
                    <button 
  className="btn-logout-dropdown"
  onClick={() => {
    logoutGlobal();
    setIsMenuOpen(false);
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
              <button onClick={openLogin} className="btn-login-new">INICIAR SESIÓN</button>
              <button onClick={openRegister} className="btn-register-new">REGISTRO</button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;