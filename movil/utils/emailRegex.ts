/**
 * Regex compartida para validar formato de correo (Sonar S8786: una sola
 * definición en el proyecto — antes estaba duplicada literal en footer,
 * checkout y edición de perfil).
 */
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
