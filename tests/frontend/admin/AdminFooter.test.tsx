import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AdminFooter from '../../../frontend/src/admin/AdminFooter.tsx';

/**
 * Humo del pie del panel admin: render estático con el año vigente.
 */

describe('AdminFooter (humo)', () => {
  it('muestra la marca del panel y el año en curso', () => {
    render(<AdminFooter />);
    const texto = screen.getByText(/JADDA SPORTS/);
    expect(texto).toBeInTheDocument();
    expect(texto.textContent).toContain(String(new Date().getFullYear()));
    expect(screen.getByText(/Panel Administrativo/)).toBeInTheDocument();
  });
});
