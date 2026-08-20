import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";

interface AvisoLoginContextType {
  aviso: { mensaje: string } | null;
  mostrarAvisoLogin: (mensaje: string) => void;
  ocultarAvisoLogin: () => void;
}

const AvisoLoginContext = createContext<AvisoLoginContextType | undefined>(undefined);

export function AvisoLoginProvider({ children }: { children: ReactNode }) {
  const [aviso, setAviso] = useState<{ mensaje: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ocultarAvisoLogin = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setAviso(null);
  }, []);

  const mostrarAvisoLogin = useCallback((mensaje: string) => {
    if (timer.current) clearTimeout(timer.current);
    setAviso({ mensaje });
    timer.current = setTimeout(() => setAviso(null), 4000);
  }, []);

  return (
    <AvisoLoginContext.Provider value={{ aviso, mostrarAvisoLogin, ocultarAvisoLogin }}>
      {children}
    </AvisoLoginContext.Provider>
  );
}

export const useAvisoLogin = () => {
  const ctx = useContext(AvisoLoginContext);
  if (!ctx) throw new Error("useAvisoLogin debe usarse dentro de AvisoLoginProvider");
  return ctx;
};
