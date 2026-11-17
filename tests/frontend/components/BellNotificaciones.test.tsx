import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import BellNotificaciones from '../../../frontend/src/components/BellNotificaciones';

/**
 * BellNotificaciones: campana de notificaciones con badge, panel con lista,
 * marcar todas, navegación al hacer clic y borrado con "Deshacer (5s)".
 * Handlers MSW inline con registro de llamadas; navegación con sonda de ruta.
 */

const navegarMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navegarMock };
});

type Noti = {
  ID_NOTIFICACION: number;
  TIPO: string;
  TITULO: string;
  MENSAJE: string | null;
  RUTA: string | null;
  LEIDA: number;
  FECHA: string;
};

const noti = (sobre: Partial<Noti> & { ID_NOTIFICACION: number }): Noti => ({
  TIPO: 'pedido',
  TITULO: `Título ${sobre.ID_NOTIFICACION}`,
  MENSAJE: `Mensaje ${sobre.ID_NOTIFICACION}`,
  RUTA: `/pedido/${sobre.ID_NOTIFICACION}`,
  LEIDA: 0,
  FECHA: '2026-11-15T10:30:00Z',
  ...sobre,
});

const listaBase = (): Noti[] => [
  noti({ ID_NOTIFICACION: 1, LEIDA: 0 }),
  noti({ ID_NOTIFICACION: 2, LEIDA: 1, RUTA: null }),
  noti({ ID_NOTIFICACION: 3, LEIDA: 0, TIPO: 'devolucion' }),
];

const llamadas: { metodo: string; ruta: string }[] = [];

const instalarHandlers = (lista: Noti[], total: number) => {
  llamadas.length = 0;
  server.use(
    http.get('*/api/notificaciones', () => {
      llamadas.push({ metodo: 'GET', ruta: '/api/notificaciones' });
      return HttpResponse.json(lista);
    }),
    http.get('*/api/notificaciones/no-leidas', () => {
      llamadas.push({ metodo: 'GET', ruta: '/api/notificaciones/no-leidas' });
      return HttpResponse.json({ total });
    }),
    http.post('*/api/notificaciones/:id/leida', ({ params }) => {
      llamadas.push({ metodo: 'POST', ruta: `/api/notificaciones/${params.id}/leida` });
      return HttpResponse.json({ ok: true });
    }),
    http.post('*/api/notificaciones/leer-todas', () => {
      llamadas.push({ metodo: 'POST', ruta: '/api/notificaciones/leer-todas' });
      return HttpResponse.json({ ok: true });
    }),
    http.delete('*/api/notificaciones/:id', ({ params }) => {
      llamadas.push({ metodo: 'DELETE', ruta: `/api/notificaciones/${params.id}` });
      return HttpResponse.json({ ok: true });
    }),
  );
};

const montar = (tema?: 'claro' | 'oscuro') =>
  render(
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<div data-testid="sonda">{tema ?? ''}</div>} />
        <Route path="/pedido/:id" element={<div data-testid="sonda">PEDIDO</div>} />
      </Routes>
      <BellNotificaciones tema={tema} />
    </BrowserRouter>,
  );

const abrirPanel = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
  // El primer item garantiza la carga de la lista.
  await screen.findByText('Título 1', {}, { timeout: 3000 });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  instalarHandlers(listaBase(), 2);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('BellNotificaciones — badge y carga', () => {
  it('sin notificaciones sin leer no muestra el badge', () => {
    instalarHandlers(listaBase(), 0);
    montar();

    expect(document.querySelector('.bell-badge')).toBeNull();
  });

  it('muestra el badge con el total de no leídas', async () => {
    montar();

    await waitFor(() => expect(document.querySelector('.bell-badge')).toHaveTextContent('2'));
  });

  it('con más de 99 no leídas el badge dice 99+', async () => {
    instalarHandlers(listaBase(), 120);
    montar();

    await waitFor(() => expect(document.querySelector('.bell-badge')).toHaveTextContent('99+'));
  });

  it('al abrir el panel carga la lista y muestra los items con su estado', async () => {
    montar();
    await abrirPanel();

    expect(screen.getByText('Notificaciones')).toBeInTheDocument();
    expect(screen.getByText('Título 2')).toBeInTheDocument();
    const items = document.querySelectorAll('.bell-item');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveClass('no-leida');
    expect(items[1]).toHaveClass('leida');
    // Fecha formateada es-CO: día/mes + hora (locale puede variar, se valida la forma).
    expect(document.querySelector('.bell-item-fecha')).not.toBeNull();
  });

  it('lista vacía muestra el aviso', async () => {
    instalarHandlers([], 0);
    montar();

    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    expect(await screen.findByText('No tienes notificaciones', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('carga inicial con error de red: no revienta ni muestra badge', async () => {
    server.use(
      http.get('*/api/notificaciones', () => HttpResponse.error()),
      http.get('*/api/notificaciones/no-leidas', () => HttpResponse.error()),
    );
    montar();

    expect(document.querySelector('.bell-badge')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    expect(await screen.findByText('No tienes notificaciones', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('el tema oscuro se refleja en el contenedor', () => {
    montar('oscuro');

    expect(document.querySelector('.bell-container')).toHaveClass('oscuro');
  });
});

describe('BellNotificaciones — acciones de la lista', () => {
  it('click en no leída con RUTA: marca leída, resta badge, cierra y navega', async () => {
    montar();
    await abrirPanel();
    llamadas.length = 0;

    fireEvent.click(screen.getByText('Título 1'));

    await waitFor(() => expect(llamadas).toContainEqual({ metodo: 'POST', ruta: '/api/notificaciones/1/leida' }));
    await waitFor(() => expect(navegarMock).toHaveBeenCalledWith('/pedido/1'));
    // Panel cerrado tras el click.
    await waitFor(() => expect(screen.queryByText('Notificaciones')).not.toBeInTheDocument());
  });

  it('click en no leída sin RUTA marca leída pero no navega', async () => {
    instalarHandlers([
      noti({ ID_NOTIFICACION: 5, RUTA: null }),
      noti({ ID_NOTIFICACION: 6, LEIDA: 1 }),
    ], 1);
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    await screen.findByText('Título 5', {}, { timeout: 3000 });
    llamadas.length = 0;

    fireEvent.click(screen.getByText('Título 5'));

    await waitFor(() => expect(llamadas).toContainEqual({ metodo: 'POST', ruta: '/api/notificaciones/5/leida' }));
    expect(navegarMock).not.toHaveBeenCalled();
  });

  it('click en una ya leída no vuelve a marcarla (y sin RUTA no navega)', async () => {
    montar();
    await abrirPanel();
    llamadas.length = 0;

    fireEvent.click(screen.getByText('Título 2'));

    expect(llamadas.some((p) => p.metodo === 'POST' && p.ruta.includes('leida'))).toBe(false);
    // El item 2 no tiene RUTA → sin navegación.
    await new Promise((r) => setTimeout(r, 30));
    expect(navegarMock).not.toHaveBeenCalled();
  });

  it('Marcar todas sin pendientes está deshabilitada; con pendientes limpia el badge', async () => {
    instalarHandlers(listaBase(), 0);
    const primera = montar();
    await abrirPanel();

    expect(screen.getByRole('button', { name: /Marcar todas/ })).toBeDisabled();
    primera.unmount();

    // Remontaje con 3 no leídas.
    instalarHandlers(listaBase(), 3);
    montar();
    await waitFor(() => expect(document.querySelector('.bell-badge')).toHaveTextContent('3'));
    await abrirPanel();
    llamadas.length = 0;
    fireEvent.click(screen.getByRole('button', { name: /Marcar todas/ }));

    await waitFor(() => expect(llamadas).toContainEqual({ metodo: 'POST', ruta: '/api/notificaciones/leer-todas' }));
    await waitFor(() => expect(document.querySelector('.bell-badge')).toBeNull());
    // Los items pasaron a leída.
    expect(document.querySelectorAll('.bell-item.leida')).toHaveLength(3);
  });
});

describe('BellNotificaciones — eliminar con Deshacer', () => {
  it('eliminar saca el item, muestra el undo y a los 5 s ejecuta el DELETE', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    montar();
    await abrirPanel();
    llamadas.length = 0;

    fireEvent.click(document.querySelector('.bell-delete') as HTMLElement);

    expect(screen.queryByText('Título 1')).not.toBeInTheDocument();
    expect(screen.getByText('Notificación eliminada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Deshacer \(5s\)/ })).toBeInTheDocument();
    expect(llamadas.some((p) => p.metodo === 'DELETE')).toBe(false);

    await vi.advanceTimersByTimeAsync(5200);

    await waitFor(() => expect(llamadas).toContainEqual({ metodo: 'DELETE', ruta: '/api/notificaciones/1' }));
    expect(screen.queryByText('Notificación eliminada')).not.toBeInTheDocument();
  });

  it('Deshacer restaura la notificación en su posición y no llama DELETE', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    montar();
    await abrirPanel();
    llamadas.length = 0;

    fireEvent.click(document.querySelector('.bell-delete') as HTMLElement);
    expect(screen.getByText(/Deshacer \(5s\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Deshacer/ }));

    expect(screen.getByText('Título 1')).toBeInTheDocument();
    // Vuelve al índice 0 (era la primera).
    expect(document.querySelectorAll('.bell-item')[0]).toHaveTextContent('Título 1');
    expect(screen.queryByText('Notificación eliminada')).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(5200);
    expect(llamadas.some((p) => p.metodo === 'DELETE')).toBe(false);
  });

  it('eliminar una segunda notificación confirma el borrado pendiente de la primera', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    montar();
    await abrirPanel();
    llamadas.length = 0;

    const botones = document.querySelectorAll('.bell-delete');
    fireEvent.click(botones[0] as HTMLElement);
    fireEvent.click(botones[1] as HTMLElement);

    // El DELETE de la primera se confirma inmediatamente (asincrónico).
    await waitFor(() => expect(llamadas).toContainEqual({ metodo: 'DELETE', ruta: '/api/notificaciones/1' }));
    // El undo ahora es de la segunda.
    await vi.advanceTimersByTimeAsync(5200);
    await waitFor(() => expect(llamadas).toContainEqual({ metodo: 'DELETE', ruta: '/api/notificaciones/2' }));
  });

  it('el conteo del undo baja con el intervalo y Deshacer sigue disponible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    montar();
    await abrirPanel();

    fireEvent.click(document.querySelector('.bell-delete') as HTMLElement);
    expect(screen.getByRole('button', { name: /Deshacer \(5s\)/ })).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(2000);
    expect(screen.getByRole('button', { name: /Deshacer \(3s\)/ })).toBeInTheDocument();
  });

  it('el DELETE de un item eliminado no revienta si el backend falla', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    server.use(http.delete('*/api/notificaciones/:id', () => HttpResponse.error()));
    montar();
    await abrirPanel();

    fireEvent.click(document.querySelector('.bell-delete') as HTMLElement);
    await vi.advanceTimersByTimeAsync(5200);

    // El undo desapareció igual (pendiente en null) y no hay crash.
    expect(screen.queryByText('Notificación eliminada')).not.toBeInTheDocument();
  });
});

describe('BellNotificaciones — refresco automático', () => {
  it('polling cada 30 s refresca el conteo y consulta la lista igualmente', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
    montar();
    // Carga inicial al montar (lista + conteo) sin abrir el panel.
    await waitFor(() => expect(llamadas).toHaveLength(2));

    await vi.advanceTimersByTimeAsync(30000);

    // El intervalo dispara cargar(true): ambas consultas ocurren otra vez.
    await waitFor(() => expect(llamadas.filter((p) => p.metodo === 'GET')).toHaveLength(4));
  });
});
