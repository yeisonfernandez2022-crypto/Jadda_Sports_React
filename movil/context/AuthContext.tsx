import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

interface Usuario {
  ID_USUARIO: number;
  NOMBRE_USUARIO: string;
  foto_url?: string | null;
}

interface AuthContextType {
  usuario: Usuario | null;
  login: (user: Usuario) => void;
  logout: () => void;
  estaLogueado: boolean;
}

const AuthContext =
  createContext<AuthContextType>(
    {} as AuthContextType
  );

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [usuario, setUsuario] =
    useState<Usuario | null>(null);

  function login(user: Usuario) {
    setUsuario(user);
  }

  function logout() {
    setUsuario(null);
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        login,
        logout,
        estaLogueado: !!usuario,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}