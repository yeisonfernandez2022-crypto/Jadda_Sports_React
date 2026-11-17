import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { ChatWidget } from '../../../frontend/src/components/ChatWidget';

/**
 * ChatWidget contra su código REAL: lista de conversaciones (filtrada por
 * tipo, con títulos por rol), hilo de mensajes con sugerencias rápidas,
 * envío con Enter/botón, chat cerrado y cierre de sondeos.
 *
 * El estado del widget vive en el mock del contexto (mutado por test) y las
 * respuestas de chat llegan por MSW inline.
 */

const ctx = {
  isOpen: false,
  setIsOpen: vi.fn(),
  activeChatId: null as number | null,
  setActiveChatId: vi.fn(),
  abrirChatSoporte: vi.fn(),
};

vi.mock('../../../frontend/src/context/ChatWidgetContext.tsx', () => ({
  useChatWidget: () => ctx,
}));

vi.mock('../../../frontend/src/context/AuthContext.tsx', () => ({
  useAuth: () => ({ usuarioLogueado: true, esVendedor: false }),
}));

const convs = [
  {
    ID_CHAT: 5, TIPO: 'VENDEDOR', ESTADO: 'ABIERTA', ID_CLIENTE: 3, CLIENTE_NOMBRE: 'Ana Cliente',
    VENDEDOR_EMPRESA: 'Deportes Andes ADMIN-TEST', PRODUCTO_NOMBRE: 'Balón Chat-Test',
    PRODUCTO_IMAGEN: 'https://test.local/balon.png', ID_DEVOLUCION: null, PARTE: null,
    DEVOLUCION_ESTADO: null, ULTIMO_MENSAJE: 'Hola, ¿tienes talla 40?', NO_LEIDOS: 2,
    ULTIMA_ACTIVIDAD: '2026-11-15T10:00:00Z',
  },
  {
    ID_CHAT: 7, TIPO: 'DEVOLUCION', ESTADO: 'CERRADA', ID_CLIENTE: 3, CLIENTE_NOMBRE: 'Ana Cliente',
    VENDEDOR_EMPRESA: null, PRODUCTO_NOMBRE: 'Camiseta Chat-Test', PRODUCTO_IMAGEN: null,
    ID_DEVOLUCION: 44, PARTE: null, DEVOLUCION_ESTADO: 'APROBADA', ULTIMO_MENSAJE: 'Caso cerrado',
    NO_LEIDOS: 0, ULTIMA_ACTIVIDAD: '2026-11-14T10:00:00Z',
  },
  {
    ID_CHAT: 9, TIPO: 'SOPORTE', ESTADO: 'ABIERTA', ID_CLIENTE: 3, CLIENTE_NOMBRE: null,
    VENDEDOR_EMPRESA: null, PRODUCTO_NOMBRE: null, PRODUCTO_IMAGEN: null, ID_DEVOLUCION: null,
    PARTE: null, DEVOLUCION_ESTADO: null, ULTIMO_MENSAJE: null, NO_LEIDOS: 0,
    ULTIMA_ACTIVIDAD: '2026-11-13T10:00:00Z',
  },
  {
    ID_CHAT: 11, TIPO: 'OTRO', ESTADO: 'ABIERTA', ID_CLIENTE: 3, CLIENTE_NOMBRE: null,
    VENDEDOR_EMPRESA: null, PRODUCTO_NOMBRE: 'Intruso Chat-Test', PRODUCTO_IMAGEN: null,
    ID_DEVOLUCION: null, PARTE: null, DEVOLUCION_ESTADO: null, ULTIMO_MENSAJE: 'x',
    NO_LEIDOS: 0, ULTIMA_ACTIVIDAD: '2026-11-12T10:00:00Z',
  },
];

const mensajesChat5 = [
  { ID_MENSAJE: 1, ROL_AUTOR: 'SISTEMA', AUTOR_NOMBRE: null, MENSAJE: 'Chat iniciado ADMIN-TEST', FECHA: '2026-11-15T10:00:00Z' },
  { ID_MENSAJE: 2, ROL_AUTOR: 'ADMIN', AUTOR_NOMBRE: 'Soporte', MENSAJE: 'Hola equipo JADDA', FECHA: '2026-11-15T10:01:00Z' },
  { ID_MENSAJE: 3, ROL_AUTOR: 'CLIENTE', AUTOR_NOMBRE: 'Ana', MENSAJE: 'Mi mensaje del cliente', FECHA: '2026-11-15T10:02:00Z' },
];

const chat5 = {
  ID_CHAT: 5, TIPO: 'VENDEDOR', ESTADO: 'ABIERTA',
  PRODUCTO: { NOMBRE: 'Balón Chat-Test', IMAGEN: 'https://test.local/balon.png' },
  VENDEDOR_EMPRESA: 'Deportes Andes ADMIN-TEST',
};

let api: { metodo: string; ruta: string; cuerpo?: unknown }[] = [];

const handlersChat = () => {
  api = [];
  return [
    http.get('*/api/chat/conversaciones', () => {
      api.push({ metodo: 'GET', ruta: '/api/chat/conversaciones' });
      return HttpResponse.json(convs);
    }),
    http.get('*/api/chat/:id/mensajes', ({ params }) => {
      const id = Number(params.id);
      api.push({ metodo: 'GET', ruta: `/api/chat/${id}/mensajes` });
      if (id === 5) return HttpResponse.json({ mensajes: mensajesChat5, chat: chat5, mi_rol: 'CLIENTE' });
      if (id === 7) return HttpResponse.json({
        mensajes: [
          { ID_MENSAJE: 70, ROL_AUTOR: 'SISTEMA', AUTOR_NOMBRE: null, MENSAJE: 'Devolución abierta', FECHA: '2026-11-14T10:00:00Z' },
          { ID_MENSAJE: 71, ROL_AUTOR: 'CLIENTE', AUTOR_NOMBRE: 'Ana', MENSAJE: 'Necesito el reembolso', FECHA: '2026-11-14T11:00:00Z' },
        ],
        chat: { ID_CHAT: 7, TIPO: 'DEVOLUCION', ESTADO: 'CERRADA', VENDEDOR_EMPRESA: null, PRODUCTO: null },
        mi_rol: 'CLIENTE',
      });
      return HttpResponse.json({
        mensajes: [{ ID_MENSAJE: 90, ROL_AUTOR: 'SISTEMA', AUTOR_NOMBRE: null, MENSAJE: 'Bienvenido a soporte ADMIN-TEST', FECHA: '2026-11-13T10:00:00Z' }],
        chat: { ID_CHAT: 9, TIPO: 'SOPORTE', ESTADO: 'ABIERTA', VENDEDOR_EMPRESA: null, PRODUCTO: null },
        mi_rol: 'CLIENTE',
      });
    }),
    http.post('*/api/chat/:id/mensajes', async ({ request, params }) => {
      const cuerpo = (await request.json()) as { mensaje: string };
      api.push({ metodo: 'POST', ruta: `/api/chat/${String(params.id)}/mensajes`, cuerpo });
      return HttpResponse.json({ ok: true });
    }),
  ];
};

const montar = () => render(<ChatWidget />);

/** Raíz del panel flotante (única capa con position: fixed). */
const raizPanel = (container: HTMLElement) =>
  container.querySelector('div[style*="position: fixed"]') as HTMLElement;

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  ctx.isOpen = true;
  ctx.activeChatId = null;
  server.use(...handlersChat());
});

describe('ChatWidget — widget cerrado', () => {
  it('isOpen false no renderiza nada', () => {
    ctx.isOpen = false;
    const { container } = montar();
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ChatWidget — lista de conversaciones', () => {
  it('sin chats: mensaje vacío y botón que abre soporte', async () => {
    server.use(http.get('*/api/chat/conversaciones', () => HttpResponse.json([])));
    montar();

    expect(await screen.findByText('No tienes chats aún', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Inicia uno desde un producto (JADDA o tienda) o escríbele al equipo de soporte.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Chatear con soporte de JADDA' }));
    expect(ctx.abrirChatSoporte).toHaveBeenCalledTimes(1);
  });

  it('lista los chats por tipo con título, último mensaje y badge de no leídos', async () => {
    montar();

    // El título del chat de vendedor compone producto + vendedor (vista cliente).
    expect(await screen.findByText('chat Balón Chat-Test - Deportes Andes ADMIN-TEST', {}, { timeout: 3000 })).toBeInTheDocument();
    // Devolución sin vendedor: JADDA SPORTS por defecto.
    expect(screen.getByText('chat devolucion Camiseta Chat-Test - JADDA SPORTS')).toBeInTheDocument();
    // Soporte tiene título fijo.
    expect(screen.getByText('Soporte JADDA')).toBeInTheDocument();
    // El tipo desconocido se filtra.
    expect(screen.queryByText('Intruso Chat-Test')).not.toBeInTheDocument();
    // Último mensaje y badge NO_LEIDOS.
    expect(screen.getByText('Hola, ¿tienes talla 40?')).toBeInTheDocument();
    expect(screen.getByText('Sin mensajes')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    // Imagen del producto y badge "CERRADA" del estado (dos ABIERTA: vendedor y soporte).
    expect(screen.getByAltText('Balón Chat-Test')).toHaveAttribute('src', 'https://test.local/balon.png');
    expect(screen.getAllByText(/• ABIERTA/)).toHaveLength(2);
    expect(screen.getByText(/• CERRADA/)).toBeInTheDocument();
  });

  it('click en una conversación activa su hilo', async () => {
    montar();
    fireEvent.click(await screen.findByText('Soporte JADDA', {}, { timeout: 3000 }).then((el) => el.closest('button') as HTMLElement));
    await waitFor(() => expect(ctx.setActiveChatId).toHaveBeenCalledWith(9));
  });
});

describe('ChatWidget — hilo de mensajes', () => {
  it('carga el hilo: cabecera con producto, burbujas por rol y botón atrás', async () => {
    ctx.activeChatId = 5;
    const { container } = montar();

    // GET del hilo.
    expect(await screen.findByText('Hola equipo JADDA', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Mi mensaje del cliente')).toBeInTheDocument();
    // Cabecera del hilo con el producto y botón atrás (texto ←).
    const botonAtras = screen.getByText('←');
    expect(screen.getByText('chat Balón Chat-Test - Deportes Andes ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByAltText('Balón Chat-Test')).toBeInTheDocument();
    expect(screen.getByText('Deportes Andes ADMIN-TEST')).toBeInTheDocument();
    // Chip del SISTEMA y etiqueta del ADMIN (equipo JADDA).
    expect(screen.getByText('Chat iniciado ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Equipo JADDA')).toBeInTheDocument();
    // El botón atrás desactiva el chat activo.
    fireEvent.click(botonAtras);
    await waitFor(() => expect(ctx.setActiveChatId).toHaveBeenCalledWith(null));
  });

  it('Enter envía el mensaje: POST con el texto y recarga de hilo + lista', async () => {
    ctx.activeChatId = 5;
    const { container } = montar();
    await screen.findByText('Mi mensaje del cliente', {}, { timeout: 3000 });

    // Botón de envío: deshabilitado con el borrador vacío.
    const botonEnviar = container.querySelector('div[style*="border-top"] button') as HTMLButtonElement;
    expect(botonEnviar).toBeDisabled();

    const textarea = screen.getByPlaceholderText('Escribe un mensaje...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hola desde el test ADMIN-TEST' } });
    expect(botonEnviar).not.toBeDisabled();

    fireEvent.keyDown(textarea, { key: 'Enter' });

    await waitFor(() => expect(api).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/chat/5/mensajes', cuerpo: { mensaje: 'Hola desde el test ADMIN-TEST' },
    })));
    // Refetch del hilo y de la lista tras el envío.
    await waitFor(() => expect(api.filter((p) => p.metodo === 'GET')).toHaveLength(4));
    // El borrador se limpia → botón deshabilitado de nuevo.
    expect(textarea.value).toBe('');
    await waitFor(() => expect(botonEnviar).toBeDisabled());
  });

  it('Shift+Enter no envía y el botón está deshabilitado sin texto', async () => {
    ctx.activeChatId = 5;
    const { container } = montar();
    await screen.findByText('Mi mensaje del cliente', {}, { timeout: 3000 });

    const textarea = screen.getByPlaceholderText('Escribe un mensaje...') as HTMLTextAreaElement;
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(api.filter((p) => p.metodo === 'POST')).toHaveLength(0);

    const botonEnviar = container.querySelector('div[style*="border-top"] button') as HTMLButtonElement;
    expect(botonEnviar).toBeDisabled();
  });

  it('chat CERRADA: textarea deshabilitado con placeholder de conversación cerrada', async () => {
    ctx.activeChatId = 7;
    const { container } = montar();

    expect(await screen.findByText('Necesito el reembolso', {}, { timeout: 3000 })).toBeInTheDocument();
    const textarea = screen.getByPlaceholderText('Conversación cerrada') as HTMLTextAreaElement;
    expect(textarea).toBeDisabled();
    const botonEnviar = container.querySelector('div[style*="border-top"] button') as HTMLButtonElement;
    expect(botonEnviar).toBeDisabled();
  });

  it('sugerencias rápidas en hilo sin mensajes del usuario y click las escribe', async () => {
    ctx.activeChatId = 9;
    montar();

    // Solo hay SISTEMA → sugerencias de SOPORTE visibles.
    expect(await screen.findByText('¿Recibieron mi solicitud?', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('¿Cómo rastreo mi envío?')).toBeInTheDocument();

    fireEvent.click(screen.getByText('¿Cómo rastreo mi envío?'));
    const textarea = screen.getByPlaceholderText('Escribe un mensaje...') as HTMLTextAreaElement;
    expect(textarea.value).toBe('¿Cómo rastreo mi envío?');

    // Con borrador lleno las sugerencias se ocultan.
    expect(screen.queryByText('¿Recibieron mi solicitud?')).not.toBeInTheDocument();
  });

  it('sugerencias ocultas cuando el hilo ya tiene mensajes del usuario', async () => {
    ctx.activeChatId = 5;
    montar();
    await screen.findByText('Mi mensaje del cliente', {}, { timeout: 3000 });
    expect(screen.queryByText('¿Recibieron mi solicitud?')).not.toBeInTheDocument();
  });

  it('mousedown afuera no cierra el widget (el cierre va por el botón X)', async () => {
    montar();
    await screen.findByText('Soporte JADDA', {}, { timeout: 3000 });

    fireEvent.mouseDown(document.body);

    expect(ctx.setIsOpen).not.toHaveBeenCalled();
    expect(screen.getByText('Soporte JADDA')).toBeInTheDocument();
  });

  it('el botón X cierra el widget', async () => {
    const { container } = montar();
    await screen.findByText('Soporte JADDA', {}, { timeout: 3000 });

    const botonX = within(raizPanel(container)).getByRole('button', { name: '' });
    fireEvent.click(botonX);
    expect(ctx.setIsOpen).toHaveBeenCalledWith(false);
  });
});
