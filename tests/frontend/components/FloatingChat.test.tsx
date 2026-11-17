import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { FloatingChat } from '../../../frontend/src/components/FloatingChat';

/**
 * FloatingChat: botón flotante de chats solo para usuarios logueados, con
 * badge de no leídos (sondeo cada 12 s) y toggle del widget.
 */

const { estadoWidget, estadoAuth } = vi.hoisted(() => ({
  estadoWidget: { isOpen: false, setIsOpen: vi.fn() },
  estadoAuth: { usuarioLogueado: true },
}));

vi.mock('../../../frontend/src/context/ChatWidgetContext', () => ({
  useChatWidget: () => estadoWidget,
}));

vi.mock('../../../frontend/src/context/AuthContext', () => ({
  useAuth: () => estadoAuth,
}));

const llamadas: string[] = [];

const instalarNoLeidos = (total: number, status?: number) => {
  llamadas.length = 0;
  server.use(
    http.get('*/api/chat/no-leidos', () => {
      llamadas.push('/api/chat/no-leidos');
      if (status) return new HttpResponse(null, { status });
      return HttpResponse.json({ total });
    }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  estadoWidget.isOpen = false;
  estadoAuth.usuarioLogueado = true;
  instalarNoLeidos(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('FloatingChat — visibilidad', () => {
  it('sin sesión no renderiza nada', () => {
    estadoAuth.usuarioLogueado = false;

    render(<FloatingChat />);

    expect(document.getElementById('flotante-chat')).toBeNull();
  });

  it('con sesión renderiza el botón flotante', () => {
    render(<FloatingChat />);

    expect(document.getElementById('flotante-chat')).not.toBeNull();
    expect(screen.getByTitle('Chats')).toBeInTheDocument();
  });

  it('sin conexión al sondear no revienta ni muestra badge', async () => {
    instalarNoLeidos(0, 500);

    render(<FloatingChat />);

    expect(screen.getByTitle('Chats')).toBeInTheDocument();
    expect(screen.queryByText('99+')).not.toBeInTheDocument();
  });
});

describe('FloatingChat — badge de no leídos', () => {
  it('muestra el total de chats sin leer', async () => {
    instalarNoLeidos(4);

    render(<FloatingChat />);

    await waitFor(() => expect(screen.getByText('4')).toBeInTheDocument());
  });

  it('más de 99 muestra 99+', async () => {
    instalarNoLeidos(150);

    render(<FloatingChat />);

    await waitFor(() => expect(screen.getByText('99+')).toBeInTheDocument());
  });

  it('con total 0 no hay badge', async () => {
    render(<FloatingChat />);

    await waitFor(() => expect(llamadas).toHaveLength(1));
    expect(screen.queryByText('99+')).not.toBeInTheDocument();
  });

  it('el color del botón cambia con el widget abierto', () => {
    estadoWidget.isOpen = true;

    render(<FloatingChat />);

    // jsdom normaliza el hex a rgb (lección 25).
    expect(document.getElementById('flotante-chat')).toHaveStyle({ backgroundColor: 'rgb(30, 58, 95)' });
  });
});

describe('FloatingChat — interacción y sondeo', () => {
  it('el click alterna el estado del widget', () => {
    const primera = render(<FloatingChat />);

    fireEvent.click(document.getElementById('flotante-chat') as HTMLElement);
    expect(estadoWidget.setIsOpen).toHaveBeenCalledWith(true);

    // El componente es memo: los cambios del contexto exigen remontaje.
    estadoWidget.isOpen = true;
    primera.unmount();
    render(<FloatingChat />);
    fireEvent.click(document.getElementById('flotante-chat') as HTMLElement);
    expect(estadoWidget.setIsOpen).toHaveBeenCalledWith(false);
  });

  it('sondea cada 12 s mientras esté logueado', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    instalarNoLeidos(2);

    render(<FloatingChat />);
    await waitFor(() => expect(llamadas.length).toBeGreaterThanOrEqual(1));
    const base = llamadas.length;

    await vi.advanceTimersByTimeAsync(12000);

    await waitFor(() => expect(llamadas.length).toBeGreaterThan(base));
  });

  it('dejar de estar logueado detiene el sondeo (limpieza al desmontar)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    const vista = render(<FloatingChat />);
    await waitFor(() => expect(llamadas.length).toBeGreaterThanOrEqual(1));
    const base = llamadas.length;

    vista.unmount();
    await vi.advanceTimersByTimeAsync(24000);

    expect(llamadas.length).toBe(base);
  });
});
