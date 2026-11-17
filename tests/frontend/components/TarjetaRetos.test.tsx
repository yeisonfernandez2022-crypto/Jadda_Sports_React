import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TarjetaRetos from '../../../frontend/src/components/TarjetaRetos';

/**
 * TarjetaRetos: tarjeta del beneficio "retos" con modal informativo y acceso
 * a /retos (requiere sesión; si no, ofrece login con SweetAlert).
 */

const { mockFire } = vi.hoisted(() => ({ mockFire: vi.fn() }));
vi.mock('sweetalert2', () => ({ default: { fire: mockFire } }));

const { estadoAuth, openLoginMock } = vi.hoisted(() => ({
  estadoAuth: { usuarioLogueado: false },
  openLoginMock: vi.fn(),
}));

vi.mock('../../../frontend/src/context/AuthContext', () => ({ useAuth: () => estadoAuth }));
vi.mock('../../../frontend/src/context/AuthModalContext', () => ({ useAuthModal: () => ({ openLogin: openLoginMock }) }));

const montar = () =>
  render(
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<div data-testid="sonda" />} />
        <Route path="/retos" element={<div data-testid="sonda">RETOS</div>} />
      </Routes>
      <TarjetaRetos />
    </BrowserRouter>,
  );

const abrirModal = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Más información' }));
  // role="dialog" no toma nombre del contenido (ARIA name-from-author).
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('¿Cómo funcionan los retos?')).toBeInTheDocument();
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFire.mockResolvedValue({ isConfirmed: true });
  estadoAuth.usuarioLogueado = false;
});

describe('TarjetaRetos — tarjeta y modal', () => {
  it('muestra la tarjeta con su copia y el botón abre el modal', () => {
    montar();

    expect(screen.getByText('Retos con los mejores descuentos')).toBeInTheDocument();
    expect(screen.getByText(/Completa retos deportivos y desbloquea descuentos/)).toBeInTheDocument();

    abrirModal();
  });

  it('el modal lista los 4 pasos y las reglas del cupón', () => {
    montar();
    abrirModal();

    expect(screen.getByText('Únete a un reto')).toBeInTheDocument();
    expect(screen.getByText('Reporta tu avance')).toBeInTheDocument();
    expect(screen.getByText('Revisión del equipo')).toBeInTheDocument();
    expect(screen.getByText('Gana tu cupón')).toBeInTheDocument();
    expect(screen.getByText(/El cupón es personal e intransferible/)).toBeInTheDocument();
    expect(screen.getByText(/Si se rechaza un avance puedes reenviarlo/)).toBeInTheDocument();
  });

  it('cierra con la × y con el overlay', () => {
    const { container } = montar();
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    abrirModal();
    fireEvent.click(container.querySelector('.promo-modal-overlay') as HTMLElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('click dentro del modal no lo cierra', () => {
    const { container } = montar();
    abrirModal();

    fireEvent.click(container.querySelector('.promo-modal') as HTMLElement);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('TarjetaRetos — acceso a retos', () => {
  it('sin sesión: cierra el modal, avisa y al confirmar abre el login', async () => {
    montar();
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: 'Ver retos' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Inicia sesión',
      text: 'Debes iniciar sesión para ver los retos disponibles.',
    })));
    expect(openLoginMock).toHaveBeenCalledTimes(1);
  });

  it('sin sesión y respondiendo "Después" no abre el login', async () => {
    mockFire.mockResolvedValue({ isConfirmed: false });
    montar();
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: 'Ver retos' }));

    await waitFor(() => expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Inicia sesión' })));
    await new Promise((r) => setTimeout(r, 30));
    expect(openLoginMock).not.toHaveBeenCalled();
  });

  it('con sesión navega a /retos', () => {
    estadoAuth.usuarioLogueado = true;
    montar();
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: 'Ver retos' }));

    expect(screen.getByTestId('sonda')).toHaveTextContent('RETOS');
    expect(mockFire).not.toHaveBeenCalled();
  });
});
