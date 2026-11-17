import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthModalProvider, useAuthModal } from '../../../frontend/src/context/AuthModalContext';

const leerAuthModal = useAuthModal;

/**
 * AuthModalContext: openLogin/openRegister montan el AuthModal en el modo
 * pedido y onClose lo desmonta. El modal pesado se reemplaza por una sonda
 * (aquí se prueba el PROVIDER, el modal vive en su propia suite); fuera del
 * provider el contexto por defecto responde con funciones vacías.
 */

vi.mock('../../../frontend/src/components/AuthModal', () => ({
  default: ({ mode, onClose }: { mode: string; onClose: () => void }) => (
    <div data-testid="modal-falso">
      MODO:{mode}
      <button data-testid="cerrar-modal" onClick={onClose}>cerrar</button>
    </div>
  ),
}));

function Sonda() {
  const { openLogin, openRegister } = useAuthModal();
  return (
    <div>
      <button data-testid="abrir-login" onClick={openLogin}>login</button>
      <button data-testid="abrir-registro" onClick={openRegister}>registro</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthModalContext', () => {
  it('sin provider: las funciones por defecto no montan nada ni revientan', () => {
    render(<Sonda />);

    fireEvent.click(screen.getByTestId('abrir-login'));
    fireEvent.click(screen.getByTestId('abrir-registro'));

    expect(screen.queryByTestId('modal-falso')).not.toBeInTheDocument();
  });

  it('openLogin monta el modal en modo login', () => {
    render(
      <AuthModalProvider>
        <Sonda />
      </AuthModalProvider>,
    );

    fireEvent.click(screen.getByTestId('abrir-login'));

    expect(screen.getByTestId('modal-falso')).toHaveTextContent('MODO:login');
  });

  it('openRegister monta el modal en modo registro', () => {
    render(
      <AuthModalProvider>
        <Sonda />
      </AuthModalProvider>,
    );

    fireEvent.click(screen.getByTestId('abrir-registro'));

    expect(screen.getByTestId('modal-falso')).toHaveTextContent('MODO:register');
  });

  it('el onClose del modal lo desmonta y el flujo se puede repetir', () => {
    render(
      <AuthModalProvider>
        <Sonda />
      </AuthModalProvider>,
    );

    fireEvent.click(screen.getByTestId('abrir-login'));
    fireEvent.click(screen.getByTestId('cerrar-modal'));
    expect(screen.queryByTestId('modal-falso')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('abrir-registro'));
    expect(screen.getByTestId('modal-falso')).toHaveTextContent('MODO:register');
    fireEvent.click(screen.getByTestId('cerrar-modal'));
    expect(screen.queryByTestId('modal-falso')).not.toBeInTheDocument();
  });

  it('el contexto por defecto expone funciones vacías reales (sin provider)', () => {
    let fuera: ReturnType<typeof leerAuthModal> | null = null;
    function Lectora() {
      fuera = leerAuthModal();
      return null;
    }
    render(<Lectora />);

    expect(() => fuera!.openLogin()).not.toThrow();
    expect(() => fuera!.openRegister()).not.toThrow();
  });
});
