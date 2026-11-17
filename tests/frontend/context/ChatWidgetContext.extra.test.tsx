import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { ChatWidgetProvider, useChatWidget } from '../../../frontend/src/context/ChatWidgetContext.tsx';
import { server } from '../setup.ts';

/**
 * ChatWidgetContext.extra: respuestas ilegibles (json catch → {}), el msg del
 * backend en abrirChatProducto, soporte con éxito, fallos de red por tipo y
 * el error de useChatWidget fuera del provider.
 */

const { fireMock } = vi.hoisted(() => ({ fireMock: vi.fn().mockResolvedValue({ isConfirmed: true }) }));
vi.mock('sweetalert2', () => ({ default: { fire: fireMock } }));

function Sonda() {
  const { isOpen, activeChatId, pendingProductId, abrirChatProducto, abrirChatDevolucion, abrirChatSoporte, setPendingProductId, setActiveChatId } = useChatWidget();
  return (
    <div>
      <span data-testid="open">{String(isOpen)}</span>
      <span data-testid="chat">{String(activeChatId)}</span>
      <span data-testid="pending">{String(pendingProductId)}</span>
      <button data-testid="prod" onClick={() => { void abrirChatProducto(33); }}>prod</button>
      <button data-testid="devol" onClick={() => { void abrirChatDevolucion(77); }}>devol</button>
      <button data-testid="soporte" onClick={() => { void abrirChatSoporte(); }}>soporte</button>
      <button data-testid="set-pending" onClick={() => setPendingProductId(88)}>pending</button>
      <button data-testid="chat-directo" onClick={() => setActiveChatId(55)}>chat-directo</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fireMock.mockResolvedValue({ isConfirmed: true });
});

afterEach(() => {
  server.resetHandlers();
});

describe('ChatWidgetContext.extra', () => {
  it('abrirChatProducto con msg del backend (producto JADDA): Swal informativo', async () => {
    server.use(http.post('*/api/chat/iniciar', () => HttpResponse.json({ ok: false, msg: 'Los productos JADDA no abren chat CHW-EXTRA' })));
    render(<ChatWidgetProvider><Sonda /></ChatWidgetProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('prod')); });
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'info', title: 'Chat', text: 'Los productos JADDA no abren chat CHW-EXTRA',
    }));
    expect(screen.getByTestId('open').textContent).toBe('false');
  });

  it('abrirChatProducto ok:true pero sin id_chat: no abre nada', async () => {
    server.use(http.post('*/api/chat/iniciar', () => HttpResponse.json({ ok: true })));
    render(<ChatWidgetProvider><Sonda /></ChatWidgetProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('prod')); });
    expect(screen.getByTestId('open').textContent).toBe('false');
    expect(screen.getByTestId('chat').textContent).toBe('null');
  });

  it('respuesta ilegible (no JSON): el json catch la convierte en {} sin abrir', async () => {
    server.use(http.post('*/api/chat/iniciar', () => new HttpResponse('texto-ilegible', { headers: { 'Content-Type': 'application/json' } })));
    render(<ChatWidgetProvider><Sonda /></ChatWidgetProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('prod')); });
    await act(async () => { fireEvent.click(screen.getByTestId('soporte')); });
    expect(screen.getByTestId('open').textContent).toBe('false');
    expect(fireMock).not.toHaveBeenCalled();
  });

  it('abrirChatDevolucion: fallo de red con catch silencioso', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.post('*/api/chat/iniciar', () => HttpResponse.error()));
    render(<ChatWidgetProvider><Sonda /></ChatWidgetProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('devol')); });
    expect(errorSpy).toHaveBeenCalledWith('Error al abrir chat devolucion:', expect.anything());
    expect(screen.getByTestId('open').textContent).toBe('false');
    errorSpy.mockRestore();
  });

  it('abrirChatSoporte con éxito: abre el widget con el chat activo', async () => {
    server.use(http.post('*/api/chat/iniciar', () => HttpResponse.json({ ok: true, id_chat: 99 })));
    render(<ChatWidgetProvider><Sonda /></ChatWidgetProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('soporte')); });
    await waitFor(() => expect(screen.getByTestId('open').textContent).toBe('true'));
    expect(screen.getByTestId('chat').textContent).toBe('99');
  });

  it('abrirChatSoporte: fallo de red con catch silencioso', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.post('*/api/chat/iniciar', () => HttpResponse.error()));
    render(<ChatWidgetProvider><Sonda /></ChatWidgetProvider>);
    await act(async () => { fireEvent.click(screen.getByTestId('soporte')); });
    expect(errorSpy).toHaveBeenCalledWith('Error al abrir chat soporte:', expect.anything());
    errorSpy.mockRestore();
  });

  it('pendingProductId se expone y setActiveChatId actualiza el estado', async () => {
    render(<ChatWidgetProvider><Sonda /></ChatWidgetProvider>);
    fireEvent.click(screen.getByTestId('set-pending'));
    expect(screen.getByTestId('pending').textContent).toBe('88');
    fireEvent.click(screen.getByTestId('chat-directo'));
    expect(screen.getByTestId('chat').textContent).toBe('55');
  });

  it('useChatWidget fuera del provider lanza el error de contexto', () => {
    function Sola() {
      useChatWidget();
      return null;
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Sola />)).toThrow('useChatWidget debe usarse dentro de ChatWidgetProvider');
    errorSpy.mockRestore();
  });
});
