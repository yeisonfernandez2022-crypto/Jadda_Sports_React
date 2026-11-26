import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { server } from '../setup';
import { ChatWidget } from '../../../frontend/src/components/ChatWidget';

/**
 * Segunda capa de ChatWidget: respuestas no-OK de lista/hilo/POST, sondeos
 * periódicos, títulos de vendedor y devoluciones para admin, partes de una
 * devolución, imágenes rotas, autores sin nombre, mensajes ausentes y
 * envíos bloqueados por texto vacío o conversación cerrada.
 */

const ctx = {
  isOpen: false,
  setIsOpen: vi.fn(),
  activeChatId: null as number | null,
  setActiveChatId: vi.fn(),
  abrirChatSoporte: vi.fn(),
};

const auth = { usuarioLogueado: true, esVendedor: false, esAdmin: false };
const navegarMock = vi.fn();

vi.mock('../../../frontend/src/context/ChatWidgetContext.tsx', () => ({
  useChatWidget: () => ctx,
}));

vi.mock('../../../frontend/src/context/AuthContext.tsx', () => ({
  useAuth: () => auth,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navegarMock };
});

const conv = (extra: Record<string, unknown>) => ({
  ID_CHAT: 1,
  TIPO: 'SOPORTE',
  ESTADO: 'ABIERTA',
  ID_CLIENTE: 3,
  CLIENTE_NOMBRE: 'Ana Cliente',
  VENDEDOR_EMPRESA: null,
  PRODUCTO_NOMBRE: null,
  PRODUCTO_IMAGEN: null,
  ID_DEVOLUCION: null,
  PARTE: null,
  DEVOLUCION_ESTADO: null,
  ULTIMO_MENSAJE: 'Hola',
  NO_LEIDOS: 0,
  ULTIMA_ACTIVIDAD: '2026-11-15T10:00:00Z',
  ...extra,
});

const baseConvs = [
  conv({
    ID_CHAT: 5, TIPO: 'VENDEDOR', ID_CLIENTE: 3, CLIENTE_NOMBRE: 'Ana Cliente',
    VENDEDOR_EMPRESA: 'Deportes Extra', PRODUCTO_NOMBRE: 'Balón Extra',
    PRODUCTO_IMAGEN: 'https://test.local/balon-extra.png', NO_LEIDOS: 2,
  }),
  conv({
    ID_CHAT: 7, TIPO: 'DEVOLUCION', ID_CLIENTE: 3, CLIENTE_NOMBRE: 'Ana Cliente',
    ESTADO: 'CERRADA', PRODUCTO_NOMBRE: 'Camiseta Extra', ID_DEVOLUCION: 44,
    DEVOLUCION_ESTADO: 'APROBADA', ULTIMO_MENSAJE: 'Caso cerrado',
  }),
  conv({ ID_CHAT: 9, TIPO: 'SOPORTE', CLIENTE_NOMBRE: 'Ana Cliente' }),
];

const mensajesChat5 = [
  { ID_MENSAJE: 1, ROL_AUTOR: 'SISTEMA', AUTOR_NOMBRE: null, MENSAJE: 'Chat iniciado EXTRA', FECHA: '2026-11-15T10:00:00Z' },
  { ID_MENSAJE: 2, ROL_AUTOR: 'ADMIN', AUTOR_NOMBRE: 'Soporte', MENSAJE: 'Hola equipo JADDA', FECHA: '2026-11-15T10:01:00Z' },
  { ID_MENSAJE: 3, ROL_AUTOR: 'CLIENTE', AUTOR_NOMBRE: 'Ana', MENSAJE: 'Mi mensaje del cliente', FECHA: '2026-11-15T10:02:00Z' },
];

const chat5 = {
  ID_CHAT: 5, TIPO: 'VENDEDOR', ESTADO: 'ABIERTA', ID_CLIENTE: 3,
  PRODUCTO: { NOMBRE: 'Balón Extra', IMAGEN: 'https://test.local/balon-extra.png' },
  VENDEDOR_EMPRESA: 'Deportes Extra',
};

let api: { metodo: string; ruta: string; cuerpo?: unknown }[] = [];

const handlersChat = () => {
  api = [];
  return [
    http.get('*/api/chat/conversaciones', () => {
      api.push({ metodo: 'GET', ruta: '/api/chat/conversaciones' });
      return HttpResponse.json(baseConvs);
    }),
    http.get('*/api/chat/:id/mensajes', ({ params }) => {
      const id = Number(params.id);
      api.push({ metodo: 'GET', ruta: `/api/chat/${id}/mensajes` });
      if (id === 5) return HttpResponse.json({ mensajes: mensajesChat5, chat: chat5, mi_rol: 'CLIENTE' });
      if (id === 7) return HttpResponse.json({
        mensajes: [{ ID_MENSAJE: 70, ROL_AUTOR: 'SISTEMA', AUTOR_NOMBRE: null, MENSAJE: 'Devolución abierta', FECHA: '2026-11-14T10:00:00Z' }],
        chat: { ID_CHAT: 7, TIPO: 'DEVOLUCION', ESTADO: 'CERRADA', ID_CLIENTE: 3, PRODUCTO: null, VENDEDOR_EMPRESA: null },
        mi_rol: 'CLIENTE',
      });
      return HttpResponse.json({
        mensajes: [{ ID_MENSAJE: 90, ROL_AUTOR: 'SISTEMA', AUTOR_NOMBRE: null, MENSAJE: 'Bienvenido EXTRA', FECHA: '2026-11-13T10:00:00Z' }],
        chat: { ID_CHAT: 9, TIPO: 'SOPORTE', ESTADO: 'ABIERTA', ID_CLIENTE: 3, PRODUCTO: null, VENDEDOR_EMPRESA: null },
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

const raizPanel = (container: HTMLElement) =>
  container.querySelector('div[style*="position: fixed"]') as HTMLElement;

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  ctx.isOpen = true;
  ctx.activeChatId = null;
  auth.esAdmin = false;
  auth.esVendedor = false;
  server.use(...handlersChat());
});

describe('ChatWidget.extra — respuestas no-OK y sondeos', () => {
  it('una lista no-OK cae al vacío y un hilo no-OK deja el hilo vacío', async () => {
    server.use(http.get('*/api/chat/conversaciones', () => HttpResponse.json({ error: 'caída' }, { status: 500 })));
    const primero = montar();
    expect(await screen.findByText('No tienes chats aún', {}, { timeout: 3000 })).toBeInTheDocument();
    primero.unmount();

    server.use(http.get('*/api/chat/5/mensajes', () => {
      api.push({ metodo: 'GET', ruta: '/api/chat/5/mensajes' });
      return HttpResponse.json({ error: 'caída' }, { status: 500 });
    }));
    ctx.activeChatId = 5;
    montar();
    await waitFor(() => expect(api).toContainEqual(expect.objectContaining({ ruta: '/api/chat/5/mensajes' })));
    await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
    expect(screen.getByText('Sin mensajes todavía. ¡Escribe el primero!')).toBeInTheDocument();
  });

  it('los sondeos de 4 s y 12 s vuelven a pedir hilo y lista', async () => {
    const setIntervalOriginal = globalThis.setInterval;
    const intervalos: Array<{ fn: () => void; ms: number }> = [];
    const espia = vi.spyOn(globalThis, 'setInterval').mockImplementation(((fn: () => void, ms?: number) => {
      if (ms === 4000 || ms === 12000) {
        intervalos.push({ fn, ms });
        return 1 as unknown as ReturnType<typeof setInterval>;
      }
      return setIntervalOriginal(fn, ms);
    }) as unknown as typeof setInterval);

    try {
      ctx.activeChatId = 5;
      montar();
      await screen.findByText('Mi mensaje del cliente', {}, { timeout: 3000 });

      const hilos = () => api.filter((p) => p.metodo === 'GET' && p.ruta === '/api/chat/5/mensajes').length;
      const listas = () => api.filter((p) => p.metodo === 'GET' && p.ruta === '/api/chat/conversaciones').length;
      const hilosAntes = hilos();
      const listasAntes = listas();

      await act(async () => { intervalos.find((i) => i.ms === 4000)?.fn(); });
      await waitFor(() => expect(hilos()).toBeGreaterThan(hilosAntes));

      await act(async () => { intervalos.find((i) => i.ms === 12000)?.fn(); });
      await waitFor(() => expect(listas()).toBeGreaterThan(listasAntes));
    } finally {
      espia.mockRestore();
    }
  });

  it('mousedown dentro del panel y sobre los botones flotantes no cierra', async () => {
    const { container } = montar();
    await screen.findByText('Soporte JADDA', {}, { timeout: 3000 });
    const panel = raizPanel(container);

    fireEvent.mouseDown(panel);

    for (const id of ['flotante-chat', 'flotante-carrito']) {
      const boton = document.createElement('div');
      boton.id = id;
      const hijo = document.createElement('span');
      boton.appendChild(hijo);
      document.body.appendChild(boton);
      fireEvent.mouseDown(hijo);
      boton.remove();
    }

    expect(ctx.setIsOpen).not.toHaveBeenCalled();
    expect(screen.getByText('Soporte JADDA')).toBeInTheDocument();
  });
});

describe('ChatWidget.extra — listas por rol', () => {
  it('el vendedor sin chats ve su propio vacío', async () => {
    auth.esVendedor = true;
    server.use(http.get('*/api/chat/conversaciones', () => HttpResponse.json([])));
    montar();

    expect(await screen.findByText('No tienes chats con clientes', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Cuando un cliente te escriba desde uno de tus productos, verás la conversación aquí.')).toBeInTheDocument();
  });

  it('el vendedor compone los títulos con el nombre del cliente y sus fallbacks', async () => {    auth.esVendedor = true;
    server.use(http.get('*/api/chat/conversaciones', () => HttpResponse.json([
      conv({ ID_CHAT: 5, TIPO: 'VENDEDOR', CLIENTE_NOMBRE: 'Ana Cliente', PRODUCTO_NOMBRE: 'Balón Extra' }),
      conv({ ID_CHAT: 6, TIPO: 'VENDEDOR', CLIENTE_NOMBRE: null, PRODUCTO_NOMBRE: 'Guante Extra' }),
      conv({ ID_CHAT: 7, TIPO: 'DEVOLUCION', CLIENTE_NOMBRE: 'Ana Cliente', PRODUCTO_NOMBRE: 'Camiseta Extra', ID_DEVOLUCION: 44 }),
      conv({ ID_CHAT: 8, TIPO: 'DEVOLUCION', CLIENTE_NOMBRE: null, PRODUCTO_NOMBRE: 'Taco Extra', ID_DEVOLUCION: 45 }),
    ])));
    montar();

    expect(await screen.findByText('chat Balón Extra - Ana Cliente', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('chat Guante Extra - cliente')).toBeInTheDocument();
    expect(screen.getByText('chat devolucion Camiseta Extra - Ana Cliente')).toBeInTheDocument();
    expect(screen.getByText('chat devolucion Taco Extra - cliente')).toBeInTheDocument();
  });

  it('el cliente sin vendedor usa el fallback "vendedor" en ambos tipos', async () => {
    server.use(http.get('*/api/chat/conversaciones', () => HttpResponse.json([
      conv({ ID_CHAT: 5, TIPO: 'VENDEDOR', CLIENTE_NOMBRE: 'Ana Cliente', VENDEDOR_EMPRESA: null, PRODUCTO_NOMBRE: 'Balón Extra' }),
      conv({ ID_CHAT: 7, TIPO: 'DEVOLUCION', CLIENTE_NOMBRE: 'Ana Cliente', VENDEDOR_EMPRESA: null, PRODUCTO_NOMBRE: 'Camiseta Extra', ID_DEVOLUCION: 44 }),
    ])));
    montar();

    expect(await screen.findByText('chat Balón Extra - JADDA SPORTS', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('chat devolucion Camiseta Extra - JADDA SPORTS')).toBeInTheDocument();
  });

  it('badge 99+, imagen rota y tipo sin imagen en la lista', async () => {
    server.use(http.get('*/api/chat/conversaciones', () => HttpResponse.json([
      conv({ ID_CHAT: 5, TIPO: 'VENDEDOR', PRODUCTO_NOMBRE: 'Balón Extra', PRODUCTO_IMAGEN: 'https://test.local/rota.png', NO_LEIDOS: 150 }),
      conv({ ID_CHAT: 6, TIPO: 'VENDEDOR', PRODUCTO_NOMBRE: 'Guante sin foto', PRODUCTO_IMAGEN: null }),
      conv({ ID_CHAT: 7, TIPO: 'DEVOLUCION', PRODUCTO_NOMBRE: 'Camiseta sin foto', PRODUCTO_IMAGEN: null }),
      conv({ ID_CHAT: 8, TIPO: 'VENDEDOR', PRODUCTO_NOMBRE: null, PRODUCTO_IMAGEN: 'https://test.local/sin-nombre.png' }),
    ])));
    const { container } = montar();

    await screen.findByText('chat Balón Extra - JADDA SPORTS', {}, { timeout: 3000 });
    expect(screen.getByText('99+')).toBeInTheDocument();
    const img = screen.getByAltText('Balón Extra') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.src).toContain('placehold.co');
    // Tipos sin imagen: vendedor (FaStore) y devolución (FaUndoAlt).
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(0);
  });
});

describe('ChatWidget.extra — títulos del admin', () => {
  it('vendedor y devoluciones con parte en la lista', async () => {
    auth.esAdmin = true;
    server.use(http.get('*/api/chat/conversaciones', () => HttpResponse.json([
      conv({ ID_CHAT: 5, TIPO: 'VENDEDOR', CLIENTE_NOMBRE: 'Ana Cliente', VENDEDOR_EMPRESA: 'Deportes Extra', PRODUCTO_NOMBRE: 'Balón Extra' }),
      conv({ ID_CHAT: 7, TIPO: 'DEVOLUCION', PARTE: 'CLIENTE', ID_DEVOLUCION: 44, PRODUCTO_NOMBRE: 'Camiseta Extra' }),
      conv({ ID_CHAT: 8, TIPO: 'DEVOLUCION', PARTE: 'VENDEDOR', ID_DEVOLUCION: 45, PRODUCTO_NOMBRE: 'Taco Extra' }),
      conv({ ID_CHAT: 10, TIPO: 'DEVOLUCION', PARTE: null, ID_DEVOLUCION: 46, PRODUCTO_NOMBRE: 'Guante Extra' }),
      conv({ ID_CHAT: 12, TIPO: 'SOPORTE', CLIENTE_NOMBRE: null }),
      conv({ ID_CHAT: 13, TIPO: 'VENDEDOR', CLIENTE_NOMBRE: null, VENDEDOR_EMPRESA: null, PRODUCTO_NOMBRE: 'Balón Extra' }),
    ])));
    montar();

    expect(await screen.findByText('Ana Cliente ↔ Deportes Extra', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Dev #44 · comprador')).toBeInTheDocument();
    expect(screen.getByText('Dev #45 · vendedor')).toBeInTheDocument();
    expect(screen.getByText('Devolución · Guante Extra')).toBeInTheDocument();
    expect(screen.getByText('Usuario · Soporte')).toBeInTheDocument();
    expect(screen.getByText('Cliente ↔ JADDA SPORTS')).toBeInTheDocument();
  });

  it('el encabezado del hilo cambia según tipo y parte', async () => {
    auth.esAdmin = true;
    server.use(http.get('*/api/chat/:id/mensajes', ({ params }) => {
      const id = Number(params.id);
      const datos: Record<number, unknown> = {
        5: { ID_CHAT: 5, TIPO: 'VENDEDOR', ESTADO: 'ABIERTA', ID_CLIENTE: 3, VENDEDOR_EMPRESA: 'Deportes Extra', PRODUCTO: null },
        7: { ID_CHAT: 7, TIPO: 'DEVOLUCION', ESTADO: 'CERRADA', ID_CLIENTE: 3, PARTE: 'CLIENTE', ID_DEVOLUCION: 44, PRODUCTO: null },
        8: { ID_CHAT: 8, TIPO: 'DEVOLUCION', ESTADO: 'CERRADA', ID_CLIENTE: 3, PARTE: 'VENDEDOR', ID_DEVOLUCION: 45, PRODUCTO: null },
        10: { ID_CHAT: 10, TIPO: 'DEVOLUCION', ESTADO: 'CERRADA', ID_CLIENTE: 3, PARTE: null, ID_DEVOLUCION: 46, PRODUCTO_NOMBRE: 'Guante Extra', PRODUCTO: null },
        11: { ID_CHAT: 11, TIPO: 'OTRO', ESTADO: 'ABIERTA', ID_CLIENTE: 3, PRODUCTO_NOMBRE: 'Producto Raro', PRODUCTO: null },
        12: { ID_CHAT: 12, TIPO: 'OTRO', ESTADO: 'ABIERTA', ID_CLIENTE: 3, PRODUCTO_NOMBRE: null, PRODUCTO: null },
        13: { ID_CHAT: 13, TIPO: 'VENDEDOR', ESTADO: 'ABIERTA', ID_CLIENTE: 3, VENDEDOR_EMPRESA: null, PRODUCTO: null },
        14: { ID_CHAT: 14, TIPO: 'DEVOLUCION', ESTADO: 'CERRADA', ID_CLIENTE: 3, PARTE: null, ID_DEVOLUCION: 46, PRODUCTO_NOMBRE: null, PRODUCTO: null },
      };
      return HttpResponse.json({ mensajes: [], chat: datos[id], mi_rol: 'ADMIN' });
    }));

    const casos: Array<[number, string, string]> = [
      [5, 'Ana Cliente', '· Deportes Extra'],
      [7, 'Ana Cliente', '· Dev #44 · comprador'],
      [8, 'Usuario', '· Dev #45 · vendedor'],
      [10, 'Usuario', '· Devolución · Guante Extra'],
      [11, 'Usuario', '· Producto Raro'],
      [12, 'Usuario', '· producto #'],
      [13, 'Usuario', '· JADDA SPORTS'],
      [14, 'Usuario', '· Devolución · solicitud #46'],
    ];

    for (const [id, nombre, esperado] of casos) {
      ctx.activeChatId = id;
      const { unmount } = montar();
      expect(await screen.findByText(esperado, {}, { timeout: 3000 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument();
      unmount();
    }
  });
});

describe('ChatWidget.extra — hilo y envío', () => {
  it('producto e imágenes rotas, vendedor por defecto y autores sin nombre', async () => {
    server.use(http.get('*/api/chat/5/mensajes', () => HttpResponse.json({
      mensajes: [
        { ID_MENSAJE: 1, ROL_AUTOR: 'SISTEMA', AUTOR_NOMBRE: null, MENSAJE: 'Inicio', FECHA: '2026-11-15T10:00:00Z' },
        { ID_MENSAJE: 2, ROL_AUTOR: 'VENDEDOR', AUTOR_NOMBRE: null, MENSAJE: 'Mensaje sin nombre', FECHA: '2026-11-15T10:01:00Z' },
        { ID_MENSAJE: 3, ROL_AUTOR: 'VENDEDOR', AUTOR_NOMBRE: 'Pepe', MENSAJE: 'Mensaje con nombre', FECHA: '2026-11-15T10:02:00Z' },
      ],
      chat: { ID_CHAT: 5, TIPO: 'VENDEDOR', ESTADO: 'ABIERTA', ID_CLIENTE: 3, PRODUCTO: { NOMBRE: 'Balón Roto', IMAGEN: 'https://test.local/roto.png' }, VENDEDOR_EMPRESA: null },
      mi_rol: 'CLIENTE',
    })));
    ctx.activeChatId = 5;
    montar();

    expect(await screen.findByText('Mensaje sin nombre', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('VENDEDOR')).toBeInTheDocument();
    expect(screen.getByText('Pepe')).toBeInTheDocument();
    expect(screen.getByText('JADDA SPORTS')).toBeInTheDocument();
    const img = screen.getByAltText('Balón Roto') as HTMLImageElement;
    fireEvent.error(img);
    expect(img.src).toContain('placehold.co');
  });

  it('sin campo mensajes el hilo queda vacío', async () => {
    server.use(http.get('*/api/chat/5/mensajes', () => HttpResponse.json({
      chat: { ID_CHAT: 5, TIPO: 'VENDEDOR', ESTADO: 'ABIERTA', ID_CLIENTE: 3, PRODUCTO: { NOMBRE: 'Producto Sin Mensajes', IMAGEN: '/x.png' }, VENDEDOR_EMPRESA: 'Deportes Extra' },
      mi_rol: 'CLIENTE',
    })));
    ctx.activeChatId = 5;
    montar();

    expect(await screen.findByText('Producto Sin Mensajes', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Sin mensajes todavía. ¡Escribe el primero!')).toBeInTheDocument();
  });

  it('Enter con texto vacío y chat cerrado no envían', async () => {
    ctx.activeChatId = 5;
    const primero = montar();
    await screen.findByText('Mi mensaje del cliente', {}, { timeout: 3000 });
    const textarea = screen.getByPlaceholderText('Escribe un mensaje...');
    fireEvent.keyDown(textarea, { key: 'Enter' });
    expect(api.filter((p) => p.metodo === 'POST')).toHaveLength(0);
    primero.unmount();

    ctx.activeChatId = 7;
    montar();
    await screen.findByText('Devolución abierta', {}, { timeout: 3000 });
    const cerrada = screen.getByPlaceholderText('Conversación cerrada');
    fireEvent.change(cerrada, { target: { value: 'no debería salir' } });
    fireEvent.keyDown(cerrada, { key: 'Enter' });
    expect(api.filter((p) => p.metodo === 'POST')).toHaveLength(0);
  });

  it('un POST no-OK conserva el borrador y reactiva el botón', async () => {
    server.use(http.post('*/api/chat/5/mensajes', async ({ request }) => {
      const cuerpo = (await request.json()) as { mensaje: string };
      api.push({ metodo: 'POST', ruta: '/api/chat/5/mensajes', cuerpo });
      return HttpResponse.json({ error: 'caída' }, { status: 500 });
    }));
    ctx.activeChatId = 5;
    const { container } = montar();
    await screen.findByText('Mi mensaje del cliente', {}, { timeout: 3000 });

    const textarea = screen.getByPlaceholderText('Escribe un mensaje...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'mensaje que falla' } });
    fireEvent.click(container.querySelector('div[style*="border-top"] button') as HTMLButtonElement);

    await waitFor(() => expect(api).toContainEqual(expect.objectContaining({ metodo: 'POST', cuerpo: { mensaje: 'mensaje que falla' } })));
    await waitFor(() => expect(textarea.value).toBe('mensaje que falla'));
    expect(textarea).not.toBeDisabled();
  });

  it('un POST lento bloquea el segundo envío mientras está en curso', async () => {
    server.use(http.post('*/api/chat/5/mensajes', async ({ request }) => {
      const cuerpo = (await request.json()) as { mensaje: string };
      api.push({ metodo: 'POST', ruta: '/api/chat/5/mensajes', cuerpo });
      await delay(100);
      return HttpResponse.json({ ok: true });
    }));
    ctx.activeChatId = 5;
    montar();
    await screen.findByText('Mi mensaje del cliente', {}, { timeout: 3000 });

    const textarea = screen.getByPlaceholderText('Escribe un mensaje...') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'uno' } });
    fireEvent.keyDown(textarea, { key: 'Enter' });
    fireEvent.keyDown(textarea, { key: 'Enter' });

    await waitFor(() => expect(api.filter((p) => p.metodo === 'POST')).toHaveLength(1));
  });

  it('el panel se recoloca en pantallas diminutas', async () => {
    const ancho = vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(300);
    const alto = vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(100);
    try {
      const { container } = montar();
      await screen.findByText('Soporte JADDA', {}, { timeout: 3000 });
      const panel = raizPanel(container);
      expect(panel.style.left).toBe('10px');
      expect(panel.style.top).toBe('10px');
    } finally {
      ancho.mockRestore();
      alto.mockRestore();
    }
  });
});
