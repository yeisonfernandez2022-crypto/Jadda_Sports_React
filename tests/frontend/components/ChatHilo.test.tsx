import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import ChatHilo from '../../../frontend/src/components/ChatHilo';

/**
 * ChatHilo: chat embebible por conversación con polling de 4 s. Se usa en la
 * página de devoluciones, así que no depende de contextos: probamos el fetch
 * de mensajes, el envío con Enter, el estado CERRADA y el refresco.
 */

const llamadas: { metodo: string; ruta: string; cuerpo?: unknown }[] = [];

type Mensaje = {
  ID_MENSAJE: number;
  ROL_AUTOR: 'CLIENTE' | 'VENDEDOR' | 'ADMIN' | 'SISTEMA';
  AUTOR_NOMBRE: string | null;
  MENSAJE: string;
  FECHA: string;
};

const msg = (sobre: Partial<Mensaje> & { ID_MENSAJE: number; MENSAJE: string }): Mensaje => ({
  ROL_AUTOR: 'CLIENTE',
  AUTOR_NOMBRE: 'Cliente Nav-Test',
  FECHA: '2026-11-15T09:15:00Z',
  ...sobre,
});

const instalarHandlers = (opciones: {
  mensajes?: Mensaje[];
  miRol?: string;
  estado?: string;
  statusGet?: number;
  statusPost?: number;
} = {}) => {
  llamadas.length = 0;
  server.use(
    http.get('*/api/chat/7/mensajes', () => {
      llamadas.push({ metodo: 'GET', ruta: '/api/chat/7/mensajes' });
      if (opciones.statusGet) return new HttpResponse(null, { status: opciones.statusGet });
      return HttpResponse.json({
        mensajes: opciones.mensajes ?? [],
        mi_rol: opciones.miRol ?? 'CLIENTE',
        chat: { ESTADO: opciones.estado ?? 'ABIERTA' },
      });
    }),
    http.post('*/api/chat/7/mensajes', async ({ request }) => {
      llamadas.push({ metodo: 'POST', ruta: '/api/chat/7/mensajes', cuerpo: await request.json() });
      if (opciones.statusPost) return new HttpResponse(null, { status: opciones.statusPost });
      return HttpResponse.json({ ok: true });
    }),
  );
};

const montar = (props: { idChat?: number; altura?: number } = {}) =>
  render(<ChatHilo idChat={props.idChat ?? 7} altura={props.altura} />);

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  Element.prototype.scrollIntoView = vi.fn();
  instalarHandlers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ChatHilo — carga del hilo', () => {
  it('pinta burbujas por rol: SISTEMA, propio (mio) y Equipo JADDA para ADMIN', async () => {
    instalarHandlers({
      mensajes: [
        msg({ ID_MENSAJE: 1, ROL_AUTOR: 'SISTEMA', MENSAJE: 'Devolución creada', AUTOR_NOMBRE: null }),
        msg({ ID_MENSAJE: 2, ROL_AUTOR: 'CLIENTE', MENSAJE: 'Hola, necesito ayuda' }),
        msg({ ID_MENSAJE: 3, ROL_AUTOR: 'ADMIN', AUTOR_NOMBRE: 'Andrés Admin', MENSAJE: 'Con gusto le ayudamos' }),
      ],
      miRol: 'CLIENTE',
    });
    montar();

    expect(await screen.findByText('Devolución creada', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Hola, necesito ayuda')).toBeInTheDocument();
    expect(screen.getByText('Equipo JADDA')).toBeInTheDocument();

    const burbujas = document.querySelectorAll('.msg');
    expect(burbujas).toHaveLength(2);
    expect(burbujas[0]).toHaveClass('mio');
    expect(burbujas[1]).toHaveClass('otro');
    // El scroll al final se disparó al cargar.
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('con miRol VENDEDOR el mensaje del vendedor es mio y el del cliente muestra su nombre', async () => {
    instalarHandlers({
      mensajes: [
        msg({ ID_MENSAJE: 2, ROL_AUTOR: 'CLIENTE', MENSAJE: 'Consulta del cliente' }),
        msg({ ID_MENSAJE: 3, ROL_AUTOR: 'VENDEDOR', AUTOR_NOMBRE: 'Vendedor Ana', MENSAJE: 'Respuesta del vendedor' }),
      ],
      miRol: 'VENDEDOR',
    });
    montar();

    await screen.findByText('Consulta del cliente', {}, { timeout: 3000 });
    expect(screen.getByText('Cliente Nav-Test')).toBeInTheDocument();
    const burbujas = document.querySelectorAll('.msg');
    expect(burbujas[0]).toHaveClass('otro');
    expect(burbujas[1]).toHaveClass('mio');
    // El vendedor no ve su propio nombre como autor.
    expect(screen.queryByText('Vendedor Ana')).not.toBeInTheDocument();
  });

  it('hilo vacío muestra "Sin mensajes todavía"', async () => {
    montar();

    expect(await screen.findByText('Sin mensajes todavía', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('la altura del área de mensajes usa la prop', () => {
    montar({ altura: 200 });
    const area = document.querySelector('.chat-inline-mensajes') as HTMLElement;
    expect(area.style.height).toBe('200px');
  });

  it('si el GET falla (500) el hilo queda vacío sin reventar', async () => {
    instalarHandlers({ statusGet: 500 });
    montar();

    expect(await screen.findByText('Sin mensajes todavía', {}, { timeout: 3000 })).toBeInTheDocument();
  });
});

describe('ChatHilo — envío de mensajes', () => {
  it('Enter envía el mensaje, limpia el borrador y recarga el hilo', async () => {
    instalarHandlers({ mensajes: [msg({ ID_MENSAJE: 1, MENSAJE: 'Primer mensaje' })] });
    montar();
    await screen.findByText('Primer mensaje', {}, { timeout: 3000 });
    llamadas.length = 0;

    const textarea = screen.getByPlaceholderText('Escribe un mensaje…') as HTMLTextAreaElement;
    expect(screen.getByRole('button', { name: '' })).toBeDisabled();
    fireEvent.change(textarea, { target: { value: 'Nuevo mensaje Hilo-Test' } });
    expect(screen.getByRole('button', { name: '' })).toBeEnabled();

    fireEvent.keyDown(textarea, { key: 'Enter' });

    await waitFor(() => expect(llamadas).toContainEqual({
      metodo: 'POST', ruta: '/api/chat/7/mensajes', cuerpo: { mensaje: 'Nuevo mensaje Hilo-Test' },
    }));
    // El borrador se limpia y el hilo se refresca (un GET adicional).
    await waitFor(() => expect(textarea.value).toBe(''));
    await waitFor(() => expect(llamadas.filter((p) => p.metodo === 'GET')).toHaveLength(1));
  });

  it('Shift+Enter no envía (permite el salto de línea)', async () => {
    instalarHandlers({ mensajes: [msg({ ID_MENSAJE: 1, MENSAJE: 'Base' })] });
    montar();
    await screen.findByText('Base', {}, { timeout: 3000 });
    llamadas.length = 0;

    const textarea = screen.getByPlaceholderText('Escribe un mensaje…') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Con salto' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    await new Promise((r) => setTimeout(r, 30));
    expect(llamadas.some((p) => p.metodo === 'POST')).toBe(false);
    expect(textarea.value).toBe('Con salto');
  });

  it('con el chat CERRADA el input queda deshabilitado y no se puede enviar', async () => {
    instalarHandlers({ estado: 'CERRADA', mensajes: [msg({ ID_MENSAJE: 1, MENSAJE: 'Fin' })] });
    montar();
    await screen.findByText('Fin', {}, { timeout: 3000 });

    const textarea = screen.getByPlaceholderText('Conversación cerrada') as HTMLTextAreaElement;
    expect(textarea).toBeDisabled();
    expect(screen.getByRole('button', { name: '' })).toBeDisabled();
  });

  it('POST fallido (500) conserva el borrador', async () => {
    instalarHandlers({ statusPost: 500, mensajes: [msg({ ID_MENSAJE: 1, MENSAJE: 'Base' })] });
    montar();
    await screen.findByText('Base', {}, { timeout: 3000 });

    const textarea = screen.getByPlaceholderText('Escribe un mensaje…') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'No pasa nada' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await waitFor(() => expect(llamadas.some((p) => p.metodo === 'POST')).toBe(true));
    await new Promise((r) => setTimeout(r, 20));
    expect(textarea.value).toBe('No pasa nada');
  });
});

describe('ChatHilo — polling', () => {
  it('refresca el hilo cada 4 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    instalarHandlers({ mensajes: [msg({ ID_MENSAJE: 1, MENSAJE: 'Inicial' })] });
    montar();
    await screen.findByText('Inicial', {}, { timeout: 3000 });
    await waitFor(() => expect(llamadas.filter((p) => p.metodo === 'GET')).toHaveLength(1));

    await vi.advanceTimersByTimeAsync(8000);

    await waitFor(() => expect(llamadas.filter((p) => p.metodo === 'GET')).toHaveLength(3));
  });
});
