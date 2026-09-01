import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { usuarioLogueado, esAdmin, loadingAuth } = useAuth();

  if (loadingAuth) return null;

  if (!usuarioLogueado) return <Navigate to="/" replace />;

  if (!esAdmin) return <Navigate to="/" replace />;

  return <>{children}</>;
}
