import { Link } from "react-router-dom";
import { FaChevronRight } from "react-icons/fa";
import "../css/Breadcrumb.css";

export interface BreadcrumbItem {
  label: string;
  to?: string;
  onClick?: (e: React.MouseEvent) => void;
}

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="admin-breadcrumb" aria-label="breadcrumb">
      {items.map((item, i) => {
        const esUltimo = i === items.length - 1;
        return (
          <span key={i} className="admin-breadcrumb-item">
            {i > 0 && <FaChevronRight className="admin-breadcrumb-sep" />}
            {item.to && !esUltimo ? (
              <Link to={item.to} onClick={item.onClick} className="admin-breadcrumb-link">
                {item.label}
              </Link>
            ) : (
              <span className={esUltimo ? "admin-breadcrumb-actual" : "admin-breadcrumb-link"}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}