/**
 * Valida el formato de correo (Sonar S8786: el regex tenía backtracking
 * superlineal; esta función es lineal y con la MISMA semántica — verificada
 * diferencialmente): exactamente un @, sin espacios en todo el string, parte
 * local ≥1 y un punto en el dominio con ≥1 carácter antes y ≥1 después
 * (dominio.tld). Una sola definición en el proyecto — antes estaba duplicada
 * literal en footer, checkout y edición de perfil.
 */
export function emailValido(valor: string): boolean {
  const email = String(valor || "");
  if (/\s/.test(email)) return false;
  const partes = email.split("@");
  if (partes.length !== 2 || !partes[0]) return false;
  return partes[1].slice(1, -1).includes(".");
}
