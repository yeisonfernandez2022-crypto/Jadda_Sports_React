import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../../../frontend/src/context/AuthContext.tsx';

/**
 * Utilidades compartidas por las suites del panel administrativo.
 *
 * renderAdmin monta el árbol con el AuthProvider REAL (patrón de
 * tests/frontend/context/AuthContext.test.tsx: el rol admin viene del handler
 * MSW de /api/auth/perfil en msw-handlers-admin.ts) y un MemoryRouter porque
 * los paneles usan useNavigate/useLocation.
 *
 * Nota: AuthProvider oculta los hijos hasta resolver /api/auth/perfil
 * (loadingAuth), así que las suites deben usar findBy o waitFor para ver el
 * panel. Las suites activan HANDLERS_ADMIN con server.use en beforeEach.
 */

interface OpcionesAdmin extends Omit<RenderOptions, 'wrapper'> {
  /** Ruta inicial del panel (por defecto /admin). */
  ruta?: string;
}

export const renderAdmin = (ui: React.ReactElement, opciones: OpcionesAdmin = {}) => {
  const { ruta = '/admin', ...resto } = opciones;
  return render(ui, {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={[ruta]}>
        <AuthProvider>{children}</AuthProvider>
      </MemoryRouter>
    ),
    ...resto,
  });
};
