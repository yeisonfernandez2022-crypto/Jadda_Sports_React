import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import Breadcrumb from "../components/Breadcrumb";

/**
 * Cabecera compartida de las páginas de detalle del panel admin.
 *
 * Sustituye al hero azul oscuro de los modales por una cabecera clara. La
 * variante `compacto` se usa dentro de modales: oculta volver y breadcrumb y
 * baja el título a h2 para no competir con el encabezado de la página.
 */
export interface EncabezadoDetalleProps {
  icono: ReactNode;
  titulo: string;
  subtitulo?: string;
  volver?: { to: string; label: string };
  breadcrumb?: { label: string; to?: string }[];
  badges?: ReactNode;
  acciones?: ReactNode;
  compacto?: boolean;
}

export default function EncabezadoDetalle({
  icono,
  titulo,
  subtitulo,
  volver,
  breadcrumb,
  badges,
  acciones,
  compacto = false,
}: EncabezadoDetalleProps) {
  const Titulo = compacto ? "h2" : "h1";

  return (
    <header className={`adp-header${compacto ? " adp-header--compacto" : ""}`}>
      {!compacto && breadcrumb && breadcrumb.length > 0 && <Breadcrumb items={breadcrumb} />}

      {!compacto && volver && (
        <Link to={volver.to} className="adp-header-volver">
          <FaArrowLeft aria-hidden="true" /> {volver.label}
        </Link>
      )}

      <div className="adp-header-main">
        <div className="adp-header-icon">{icono}</div>

        <div className="adp-header-info">
          <Titulo className="adp-header-titulo">{titulo}</Titulo>
          {subtitulo && <p className="adp-header-subtitulo">{subtitulo}</p>}
        </div>

        {badges && <div className="adp-header-badges">{badges}</div>}
        {acciones && <div className="adp-header-actions">{acciones}</div>}
      </div>
    </header>
  );
}
