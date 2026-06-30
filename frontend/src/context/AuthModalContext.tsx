import { createContext, useContext, useState, type ReactNode } from "react";
import AuthModal from "../components/AuthModal";

interface AuthModalContextType {
  openLogin: () => void;
  openRegister: () => void;
}

const AuthModalContext = createContext<AuthModalContextType>({
  openLogin: () => {},
  openRegister: () => {},
});

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'login' | 'register' | null>(null);

  return (
    <AuthModalContext.Provider
      value={{
        openLogin: () => setMode('login'),
        openRegister: () => setMode('register'),
      }}
    >
      {children}
      {mode && <AuthModal mode={mode} onClose={() => setMode(null)} />}
    </AuthModalContext.Provider>
  );
}

export const useAuthModal = () => useContext(AuthModalContext);
