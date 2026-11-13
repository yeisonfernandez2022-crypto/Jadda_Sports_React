import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { ChatWidgetProvider, useChatWidget } from '../../../frontend/src/context/ChatWidgetContext.tsx';
import { server } from '../setup.ts';

/**
 * ChatWidgetContext: los 3 tipos de arranque de chat (producto/vendedor,
 * devolución, soporte) contra MSW — abre el widget con el chat activo o
 * muestra el mensaje del backend (no logueado / producto JADDA).
 */

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

function Sonda() {
  const { isOpen, activeChatId, abrirChatProducto, abrirChatDevolucion, abrirChatSoporte, setPendingProductId } = useChatWidget();
  return (
    <div>
      <span data-testid="open">{String(isOpen)}</span>
      <span data-testid="chat">{String(activeChatId)}</span>
      <button data-testid="prod" onClick={() => { void abrirChatProducto(33); }}>prod</button>
      <button data-testid="devol" onClick={() => { void abrirChatDevolucion(77); }}>devol</button>
      <button data-testid="soporte" onClick={() => { void abrirChatSoporte(); }}>soporte</button>
      <button data-testid="pending" onClick={() => setPendingProductId(88)}>pending</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  server.resetHandlers();
});

describe('ChatWidgetContext', () => {
  it('abrirChatProducto con chat creado: abre el widget con el id activo', async () => {
    server.use(http.post('*/api/chat/iniciar', () => HttpResponse.json({ ok: true, id_chat: 42 })));
    render(<ChatWidgetProvider><Sonda /></ChatWidgetProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('prod')); });
    await waitFor(() => expect(screen.getByTestId('open').textContent).toBe('true'));
    expect(screen.getByTestId('chat').textContent).toBe('42');
  });

  it('chat existente (200 sin crear): mismo comportamiento', async () => {
    server.use(http.post('*/api/chat/iniciar', () => HttpResponse.json({ ok: true, id_chat: 7 })));
    render(<ChatWidgetProvider><Sonda /></ChatWidgetProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('devol')); });
    await waitFor(() => expect(screen.getByTestId('chat').textContent).toBe('7'));
  });

  it('respuesta con msg (no logueado / JADDA): Swal informativo y widget cerrado', async () => {
    server.use(http.post('*/api/chat/iniciar', () => HttpResponse.json({ ok: false, msg: 'Debes iniciar sesión para usar el chat.' })));
    render(<ChatWidgetProvider><Sonda /></ChatWidgetProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('soporte')); });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Chat' }));
    expect(screen.getByTestId('open').textContent).toBe('false');
  });

  it('fallo de red: catch silencioso sin reventar', async () => {
    server.use(http.post('*/api/chat/iniciar', () => HttpResponse.error()));
    render(<ChatWidgetProvider><Sonda /></ChatWidgetProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('prod')); });
    expect(screen.getByTestId('open').textContent).toBe('false');
  });
});
