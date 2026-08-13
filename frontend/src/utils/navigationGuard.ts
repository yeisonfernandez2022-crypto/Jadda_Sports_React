type Guardia = () => Promise<boolean>;

let guardia: Guardia | null = null;

export const setGuardiaNavegacion = (fn: Guardia | null) => {
  guardia = fn;
};

export const puedeNavegar = async (): Promise<boolean> => {
  if (!guardia) return true;
  return guardia();
};

export const navegarConGuardia = async (path: string, navigate: (p: string) => void) => {
  if (!(await puedeNavegar())) return;
  navigate(path);
};
