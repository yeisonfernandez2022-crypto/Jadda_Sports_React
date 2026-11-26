import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import ScrollToTop from '../../../frontend/src/components/ScrollToTop';

/**
 * ScrollToTop: vuelve al inicio en cada cambio de pathname. Se usa un botón
 * que navega dentro de MemoryRouter para disparar el segundo efecto.
 */

function Navegador() {
  const navegar = useNavigate();
  return <button type="button" onClick={() => navegar('/otra')}>Ir</button>;
}

beforeEach(() => {
  (window.scrollTo as ReturnType<typeof vi.fn>).mockClear();
});

describe('ScrollToTop', () => {
  it('hace scroll al inicio al montar y en cada navegación', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <ScrollToTop />
        <Navegador />
      </MemoryRouter>,
    );

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' });

    fireEvent.click(screen.getByRole('button', { name: 'Ir' }));
    expect(window.scrollTo).toHaveBeenCalledTimes(2);
  });
});
