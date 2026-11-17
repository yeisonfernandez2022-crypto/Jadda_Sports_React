import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import TarjetaPlan from '../../../frontend/src/components/TarjetaPlan';

/**
 * TarjetaPlan: tarjeta del beneficio "plan gratis" con modal informativo de
 * 4 pasos y acceso a /mis-planes (requiere sesión; si no, ofrece login).
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
        <Route path="/mis-planes" element={<div data-testid="sonda">MIS-PLANES</div>} />
      </Routes>
      <TarjetaPlan />
    </BrowserRouter>,
  );

const abrirModal = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Más información' }));
  // role="dialog" no toma nombre del contenido (ARIA name-from-author): el
  // accessible name queda vacío → consultar el rol y el título por separado.
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.getByText('¿Cómo funciona tu plan?')).toBeInTheDocument();
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFire.mockResolvedValue({ isConfirmed: true });
  estadoAuth.usuarioLogueado = false;
});

describe('TarjetaPlan — tarjeta y modal', () => {
  it('muestra la tarjeta con su copia y el botón abre el modal', () => {
    montar();

    expect(screen.getByText('Plan de entrenamiento GRATIS')).toBeInTheDocument();
    expect(screen.getByText(/Compra cualquier producto y recibe un plan personalizado/)).toBeInTheDocument();
    expect(screen.queryByText('¿Cómo funciona tu plan?')).not.toBeInTheDocument();

    abrirModal();
  });

  it('el modal lista los 4 pasos numerados y las reglas', () => {
    montar();
    abrirModal();

    expect(screen.getByText('Compra cualquier producto')).toBeInTheDocument();
    expect(screen.getByText('Recibes tu plan gratis')).toBeInTheDocument();
    expect(screen.getByText('Ábrelo desde tu perfil')).toBeInTheDocument();
    expect(screen.getByText('Entrena y registra')).toBeInTheDocument();
    expect(screen.getByText(/Beneficio exclusivo de JADDA SPORTS/)).toBeInTheDocument();
    expect(document.querySelectorAll('.promo-modal-paso')).toHaveLength(4);
  });

  it('cierra con la × y con el overlay', () => {
    const { container } = montar();
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Reabrir para probar el cierre por overlay.
    fireEvent.click(screen.getByRole('button', { name: 'Más información' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(container.querySelector('.promo-modal-overlay') as HTMLElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('click dentro del modal (dialog) no lo cierra', () => {
    const { container } = montar();
    abrirModal();

    fireEvent.click(container.querySelector('.promo-modal') as HTMLElement);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});

describe('TarjetaPlan — acceso a mis planes', () => {
  it('sin sesión: cierra el modal, avisa y al confirmar abre el login', async () => {
    montar();
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: 'Ir a mis planes' }));

    // El modal se cierra ANTES de pedir sesión; el aviso vive en el Swal mock.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Inicia sesión',
      text: 'Debes iniciar sesión para ver tu plan de entrenamiento.',
      confirmButtonText: 'Iniciar sesión',
      cancelButtonText: 'Después',
    })));
    expect(openLoginMock).toHaveBeenCalledTimes(1);
  });

  it('sin sesión y respondiendo "Después" no abre el login', async () => {
    mockFire.mockResolvedValue({ isConfirmed: false });
    montar();
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: 'Ir a mis planes' }));

    await waitFor(() => expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Inicia sesión' })));
    await new Promise((r) => setTimeout(r, 30));
    expect(openLoginMock).not.toHaveBeenCalled();
  });

  it('con sesión navega a /mis-planes y cierra el modal', () => {
    estadoAuth.usuarioLogueado = true;
    montar();
    abrirModal();

    fireEvent.click(screen.getByRole('button', { name: 'Ir a mis planes' }));

    expect(screen.getByTestId('sonda')).toHaveTextContent('MIS-PLANES');
    expect(mockFire).not.toHaveBeenCalled();
  });
});
