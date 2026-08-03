import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAuthModal } from "../context/AuthModalContext"; 
import { 
  FaBox, FaHeart, FaHeadset, FaCog, FaSearch,
  FaSignOutAlt, FaTrophy, FaDumbbell, FaTachometerAlt, FaTag, FaClipboardList, FaUsers, FaTrophy as FaTrophyAdmin
} from 'react-icons/fa';
import BellNotificaciones from './BellNotificaciones';

interface CategoriaMenu {
  ID_CATEGORIA: number;
  NOMBRE_CATEGORIA: string;
}

interface ProductoMenu {
  ID: number;
  NOMBRE: string;
  PRECIO: number;
  CATEGORIA?: string;
  ID_DESCUENTO?: number | null;
}

function Navbar() {
  const { usuario, usuarioLogueado, esAdmin, logoutGlobal } = useAuth();
  const { openLogin, openRegister } = useAuthModal();
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [mostrarDropdown, setMostrarDropdown] = useState(false);
  const [showMegaMenu, setShowMegaMenu] = useState(false);
  const [showOfertasMenu, setShowOfertasMenu] = useState(false);
  const [categoriasMenu, setCategoriasMenu] = useState<CategoriaMenu[]>([]);
  const [productosMenu, setProductosMenu] = useState<ProductoMenu[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<number | null>(null);
  const [descuentosMenu, setDescuentosMenu] = useState<Record<number, number>>({});
  
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const megaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ofertasTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const [cats, prods, dcts] = await Promise.all([
          fetch("/api/productos/categorias").then(r => r.json()),
          fetch("/api/productos").then(r => r.json()),
          fetch("/api/productos/descuentos").then(r => r.json()),
        ]);
        setCategoriasMenu(cats);
        setProductosMenu(prods);
        const map: Record<number, number> = {};
        (dcts as { ID_DESCUENTO: number; PORCENTAJE: number }[]).forEach((d) => {
          map[d.ID_DESCUENTO] = d.PORCENTAJE;
        });
        setDescuentosMenu(map);
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
              if (ofertasTimer.current) clearTimeout(ofertasTimer.current);
              setShowOfertasMenu(false);
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
                <div className="mega-menu-cabecera">
                  <span className="mega-menu-titulo">Explora por categoría</span>
                </div>
                <div className="mega-menu-cuerpo">
                  <div className="mega-categorias">
                    {categoriasMenu.map((cat) => (
                      <div
                        key={cat.ID_CATEGORIA}
                        className={`mega-cat-item ${categoriaActiva === cat.ID_CATEGORIA ? "activo" : ""}`}
                        onMouseEnter={() => setCategoriaActiva(cat.ID_CATEGORIA)}
                        onClick={() => {
                          setShowMegaMenu(false);
                          navigate(`/catalogo?cat=${encodeURIComponent(cat.NOMBRE_CATEGORIA)}`);
                        }}
                      >
                        <span className="mega-cat-nombre">{cat.NOMBRE_CATEGORIA}</span>
                        <span className="mega-cat-flecha">›</span>
                      </div>
                    ))}
                  </div>
                  <div className="mega-productos">
                    {(() => {
                      const cat = categoriasMenu.find((c) => c.ID_CATEGORIA === categoriaActiva);
                      const prods = cat
                        ? productosMenu.filter((p) => p.CATEGORIA === cat.NOMBRE_CATEGORIA).slice(0, 4)
                        : [];
                      return (
                        <>
                          <div className="mega-productos-titulo">
                            {cat ? cat.NOMBRE_CATEGORIA : "Productos"}
                          </div>
                          {prods.length > 0 ? (
                            prods.map((p) => (
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
                            ))
                          ) : (
                            <div className="mega-prod-vacio">
                              Pasa el mouse sobre una categoría para ver sus productos.
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="mega-menu-pie">
                  <span
                    className="mega-ver-todo"
                    onClick={() => {
                      setShowMegaMenu(false);
                      navigate("/catalogo");
                    }}
                  >
                    Ver todo el catálogo →
                  </span>
                </div>
              </div>
            )}
          </li>
          <li
            className="nav-item-catalog"
            onMouseEnter={() => {
              if (megaTimer.current) clearTimeout(megaTimer.current);
              if (ofertasTimer.current) clearTimeout(ofertasTimer.current);
              setShowMegaMenu(false);
              setShowOfertasMenu(true);
            }}
            onMouseLeave={() => {
              ofertasTimer.current = setTimeout(() => setShowOfertasMenu(false), 200);
            }}
          >
            <Link to="/catalogo?descuento=true">OFERTAS</Link>
            {showOfertasMenu && (
              <div
                className="mega-menu mega-menu-ofertas"
                onMouseEnter={() => { if (ofertasTimer.current) clearTimeout(ofertasTimer.current); }}
                onMouseLeave={() => { ofertasTimer.current = setTimeout(() => setShowOfertasMenu(false), 200); }}
              >
                <div className="mega-menu-cabecera">
                  <span className="mega-menu-titulo">🔥 Ofertas destacadas</span>
                </div>
                <div className="mega-ofertas-lista">
                  {productosMenu.filter((p) => p.ID_DESCUENTO != null).slice(0, 8).map((p) => (
                    <div
                      key={p.ID}
                      className="mega-prod-item"
                      onClick={() => {
                        setShowOfertasMenu(false);
                        navigate(`/producto/${p.ID}`);
                      }}
                    >
                      <span className="mega-prod-name">{p.NOMBRE}</span>
                      <span className="mega-prod-price">
                        {p.ID_DESCUENTO != null && descuentosMenu[p.ID_DESCUENTO]
                          ? `-${descuentosMenu[p.ID_DESCUENTO]}%`
                          : `$${Number(p.PRECIO).toLocaleString()}`}
                      </span>
                    </div>
                  ))}
                  {productosMenu.filter((p) => p.ID_DESCUENTO != null).length === 0 && (
                    <div className="mega-prod-vacio">
                      No hay ofertas disponibles por el momento.
                    </div>
                  )}
                </div>
                <div className="mega-menu-pie">
                  <span
                    className="mega-ver-todo"
                    onClick={() => {
                      setShowOfertasMenu(false);
                      navigate("/catalogo?descuento=true");
                    }}
                  >
                    Ver todas las ofertas →
                  </span>
                </div>
              </div>
            )}
          </li>
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

        {/* CAMPANA DE NOTIFICACIONES — a la derecha del buscador */}
        {usuarioLogueado && (
          <BellNotificaciones />
        )}

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
                    {esAdmin && <span className="admin-badge">ADMIN</span>}
                  </span>
                </div>
                <FaCog className={`gear-icon ${isMenuOpen ? 'rotate' : ''}`} />
              </div>

              {isMenuOpen && (
                <div className="profile-dropdown-menu">
                  <Link
                    to="/perfil"
                    className="dropdown-header dropdown-header-link"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <img
                      src={
                        usuario.foto_url ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.NOMBRE_USUARIO)}`
                      }
                      alt="Perfil"
                      className="dropdown-header-avatar"
                      onError={(e) => {
                        e.currentTarget.src =
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(usuario.NOMBRE_USUARIO)}`;
                      }}
                    />
                    <div className="dropdown-header-text">
                      <p className="user-full-name">{usuario.NOMBRE_USUARIO}</p>
                      <p className="user-status">Ver perfil <i className="fas fa-chevron-right ms-1" style={{ fontSize: "0.6rem" }}></i></p>
                    </div>
                  </Link>
                  <div className="dropdown-body">
                    {esAdmin ? (
                      <>
                        {/* Sección exclusiva del administrador */}
                        <div className="dropdown-admin-section">
                          <span className="dropdown-admin-title"><FaTachometerAlt /> Panel Admin</span>
                          <Link to="/admin" className="dropdown-item dropdown-admin-item" onClick={() => setIsMenuOpen(false)}>
                            <FaTachometerAlt className="icon-red" /> Dashboard
                          </Link>
                          <Link to="/admin/productos" className="dropdown-item dropdown-admin-item" onClick={() => setIsMenuOpen(false)}>
                            <FaTag className="icon-red" /> Productos
                          </Link>
                          <Link to="/admin/ordenes" className="dropdown-item dropdown-admin-item" onClick={() => setIsMenuOpen(false)}>
                            <FaClipboardList className="icon-red" /> Órdenes
                          </Link>
                          <Link to="/admin/usuarios" className="dropdown-item dropdown-admin-item" onClick={() => setIsMenuOpen(false)}>
                            <FaUsers className="icon-red" /> Usuarios
                          </Link>
                          <Link to="/admin/retos" className="dropdown-item dropdown-admin-item" onClick={() => setIsMenuOpen(false)}>
                            <FaTrophyAdmin className="icon-red" /> Retos
                          </Link>
                        </div>
                        <Link to="/ayuda_soporte" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                          <FaHeadset className="icon-red" /> Ayuda y Soporte
                        </Link>
                      </>
                    ) : (
                      <>
                        <Link to="/perfil/compras" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                          <FaBox className="icon-red" /> Mis Pedidos
                        </Link>
                        <Link to="/favoritos" className="dropdown-item" onClick={() => setIsMenuOpen(false)}>
                          <FaHeart className="icon-red" /> Favoritos
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
                      </>
                    )}
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