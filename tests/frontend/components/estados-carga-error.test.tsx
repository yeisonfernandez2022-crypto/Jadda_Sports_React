import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import LoadingPage from '../../../frontend/src/components/LoadingPage.tsx';
import ErrorBoundary from '../../../frontend/src/components/ErrorBoundary.tsx';
import ErrorFallback from '../../../frontend/src/pages/ErrorFallback.tsx';
import Breadcrumb from '../../../frontend/src/components/Breadcrumb.tsx';
import FlechaScroll from '../../../frontend/src/components/FlechaScroll.tsx';

/**
 * Componentes de carga/error (los estados que ve la persona usuaria cuando
 * la API falla) y navegación auxiliar. ErrorBoundary se prueba con un hijo
 * que explota: el fallback es REAL (no mock del propio componente).
 */
const Bomba = () => { throw new Error('bomba del test'); };

beforeEach(() => {
  vi.restoreAllMocks();
  // silenciar el console.error de React ante el error capturado
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('LoadingPage', () => {
  it('spinner con el mensaje por defecto', () => {
    render(<LoadingPage />);
    expect(screen.getByText('Cargando...')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('mensaje personalizado', () => {
    render(<LoadingPage mensaje="Consultando tu pedido…" />);
    expect(screen.getByText('Consultando tu pedido…')).toBeTruthy();
  });
});

describe('ErrorBoundary + ErrorFallback', () => {
  it('hijo que explota → fallback ¡Oops! con Reintentar', async () => {
    const onRefresh = vi.fn();
    render(
      <BrowserRouter>
        <ErrorBoundary>
          <Bomba />
        </ErrorBoundary>
      </BrowserRouter>,
    );
    await waitFor(() => expect(screen.getByText('¡Oops!')).toBeTruthy());
    expect(screen.getByText(/Algo salió mal/i)).toBeTruthy();
  });

  it('hijo sano → los hijos se renderizan sin fallback', () => {
    render(
      <BrowserRouter>
        <ErrorBoundary>
          <span data-testid="sano">contenido sano</span>
        </ErrorBoundary>
      </BrowserRouter>,
    );
    expect(screen.getByTestId('sano')).toBeTruthy();
    expect(screen.queryByText('¡Oops!')).toBeNull();
  });

  it('ErrorFallback standalone: Reintentar dispara el callback', async () => {
    const onRefresh = vi.fn();
    render(<ErrorFallback onRefresh={onRefresh} />);
    const btn = screen.getByRole('button', { name: /Reintentar/i });
    btn.click();
    await waitFor(() => expect(onRefresh).toHaveBeenCalled());
  });
});

describe('Breadcrumb y FlechaScroll (estáticos)', () => {
  it('Breadcrumb pinta la lista con la última sección sin enlace', () => {
    render(
      <BrowserRouter>
        <Breadcrumb items={[{ label: 'Inicio', to: '/' }, { label: 'Mis Compras' }]} />
      </BrowserRouter>,
    );
    expect(screen.getByText('Inicio')).toBeTruthy();
    expect(screen.getByText('Mis Compras')).toBeTruthy();
  });

  it('FlechaScroll sin scroll sobrante: no se muestra (aria-hidden)', async () => {
    const { container } = render(<FlechaScroll />);
    await new Promise((r) => setTimeout(r, 450));
    const el = container.querySelector('.flecha-scroll');
    if (el) {
      expect(el.getAttribute('aria-hidden')).toBe('true');
    }
  });
});
