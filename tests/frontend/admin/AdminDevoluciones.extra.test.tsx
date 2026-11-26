import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersDevolucionesAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminDevoluciones from '../../../frontend/src/admin/AdminDevoluciones.tsx';

/**
 * AdminDevoluciones — segunda capa de cobertura.
 *
 * Complementa AdminDevoluciones.test.tsx con el cierre del modal por overlay,
 * teclado y ✕, las decisiones de reembolso, la cancelación y los errores del
 * procesado, los validadores del textarea, el acceso al chat, las evidencias
 * de vídeo, la imagen rota, el vendedor sin chat, los estados desconocidos y
 * los datos incompletos de la solicitud.
 */

const { swalFire } = vi.hoisted(() => ({ swalFire: vi.fn() }));

vi.mock('sweetalert2', () => ({
  default: { fire: swalFire },
}));

let api: ApiAdmin;
let handlers: RequestHandler[];

const montar = () =>
  renderAdmin(
    <Routes>
      <Route path="/admin/devoluciones" element={<AdminDevoluciones />} />
      <Route path="/admin" element={<div data-testid="sonda-admin" />} />
      <Route path="/admin/chats" element={<div data-testid="sonda-chats" />} />
    </Routes>,
    { ruta: '/admin/devoluciones' },
  );

const DEV_BASE = {
  ID_USUARIO: 80, NOMBRE_USUARIO: 'Carla', EMAIL: 'carla@test.local', USUARIO_LOGIN: 'carla',
  TELEFONO: '3009998888', ID_VENTA: 701, VENTA_TOTAL: 150000, FECHA_VENTA: '2026-11-05T10:00:00.000Z',
  METODO_PAGO: 'Wompi', ENVIO_DIRECCION: 'Cra 45 #12-30', ENVIO_CIUDAD: 'Medellín',
  ENVIO_BARRIO: 'Belén', ENVIO_DEPARTAMENTO: 'Antioquia', ENVIO_CODIGO_POSTAL: '050001',
  PRODUCTO_NOMBRE: 'Producto Dev', IMAGEN: null, CANTIDAD: 1, MOTIVO: 'Talla incorrecta',
  DESCRIPCION: 'Descripción de prueba', TIPO: 'DEVOLUCION', OBSERVACION: null, ESTADO: 'SOLICITADA',
  FECHA_CREACION: '2026-11-12T10:00:00.000Z', FECHA_PROCESADA: null, EVIDENCIAS: null,
  ID_VENDEDOR: null, VENDEDOR_NOMBRE: null, ID_CHAT: null, PARTE_CHAT: null,
};

const dev = (id: number, extra: Record<string, unknown> = {}) =>
  ({ ...DEV_BASE, ID_DEVOLUCION: id, ...extra });

const servirDevoluciones = (lista: unknown[]) =>
  server.use(http.get(/\/api\/devoluciones\/admin$/, () => HttpResponse.json(lista)));

const abrirGestion = async (indice = 0) => {
  const botones = await screen.findAllByRole('button', { name: 'Gestionar' });
  fireEvent.click(botones[indice]);
  return screen.findByRole('button', { name: '✕' });
};

const modalAbierto = () => document.querySelector('.au-modal');

beforeEach(() => {
  ({ api, handlers } = handlersDevolucionesAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
  swalFire.mockReset().mockResolvedValue({ isConfirmed: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminDevoluciones — listado y filtros', () => {
  it('muestra el vacío del listado y registra el fallo de red', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    servirDevoluciones([]);
    const primera = montar();

    expect(await screen.findByText('No hay solicitudes de devolución', {}, { timeout: 3000 })).toBeInTheDocument();
    primera.unmount();

    server.use(http.get(/\/api\/devoluciones\/admin$/, () => HttpResponse.error()));
    montar();
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Error al cargar devoluciones'));
    expect(await screen.findByText('No hay solicitudes de devolución', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('distingue el vacío de cada filtro de tipo', async () => {
    montar();
    await screen.findByText('Guayos Dev ADMIN-TEST');

    fireEvent.change(screen.getByPlaceholderText('Buscar por cliente, correo, pedido o producto...'), { target: { value: 'zzz' } });
    expect(await screen.findByText(/No hay solicitudes\s*$/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reembolsos (1)' }));
    expect(await screen.findByText('No hay solicitudes de reembolso')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Devoluciones (4)' }));
    expect(await screen.findByText('No hay solicitudes de devolución')).toBeInTheDocument();
  });

  it('pinta estados desconocidos y oculta la imagen de producto rota', async () => {
    servirDevoluciones([
      dev(90, { ESTADO: 'EN_PROCESO', IMAGEN: 'https://test.local/producto.png' }),
    ]);
    const { container } = montar();
    await screen.findByText('Producto Dev');

    const badge = screen.getByText('EN_PROCESO');
    expect(badge.className).toContain('bg-secondary');
    const imagen = container.querySelector('.ad-prod img') as HTMLImageElement;
    fireEvent.error(imagen);
    expect(imagen.style.display).toBe('none');
  });

  it('el botón Volver al inicio regresa al dashboard', async () => {
    montar();
    await screen.findByText('Guayos Dev ADMIN-TEST');

    fireEvent.click(screen.getByRole('button', { name: /Volver al inicio/ }));

    expect(await screen.findByTestId('sonda-admin')).toBeInTheDocument();
  });
});

describe('AdminDevoluciones — modal', () => {
  it('cierra por overlay, ✕, Enter y Espacio sin cerrar con clic dentro', async () => {
    const { container } = montar();
    await abrirGestion();

    fireEvent.click(modalAbierto() as Element);
    expect(modalAbierto()).not.toBeNull();

    fireEvent.keyDown(container.querySelector('.evidencia-overlay') as Element, { key: 'x' });
    expect(modalAbierto()).not.toBeNull();

    // Enter y Espacio en el modal burbujean al overlay y lo cierran.
    fireEvent.keyDown(modalAbierto() as Element, { key: 'Enter' });
    await waitFor(() => expect(modalAbierto()).toBeNull());

    await abrirGestion();
    fireEvent.keyDown(modalAbierto() as Element, { key: ' ' });
    await waitFor(() => expect(modalAbierto()).toBeNull());

    await abrirGestion();
    fireEvent.keyDown(container.querySelector('.evidencia-overlay') as Element, { key: 'Enter' });
    await waitFor(() => expect(modalAbierto()).toBeNull());

    await abrirGestion();
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    await waitFor(() => expect(modalAbierto()).toBeNull());

    await abrirGestion();
    fireEvent.click(container.querySelector('.evidencia-overlay') as Element);
    await waitFor(() => expect(modalAbierto()).toBeNull());
  }, 30000);

  it('muestra los huecos de una solicitud sin datos opcionales', async () => {
    servirDevoluciones([
      dev(91, {
        NOMBRE_USUARIO: '', EMAIL: 'sin-datos@test.local', USUARIO_LOGIN: null, TELEFONO: null,
        VENTA_TOTAL: null, FECHA_VENTA: null, METODO_PAGO: null, ENVIO_DIRECCION: null,
        MOTIVO: null, DESCRIPCION: null, EVIDENCIAS: null, ID_VENDEDOR: 55, VENDEDOR_NOMBRE: null,
      }),
    ]);
    const { container } = montar();
    await abrirGestion();

    const modal = modalAbierto() as HTMLElement;
    expect(within(modal).getByText('@usuario · sin-datos@test.local')).toBeInTheDocument();
    expect(within(modal).getByText('Tienda: Vendedor')).toBeInTheDocument();
    expect(within(modal).getByText('Sin motivo especificado')).toBeInTheDocument();
    expect(within(modal).getAllByText('-').length).toBeGreaterThanOrEqual(3);
    expect(within(modal).queryByText('Descripción del cliente:')).not.toBeInTheDocument();
    expect(within(modal).queryByText(/Evidencias del cliente/)).not.toBeInTheDocument();
    expect(within(modal).queryByText('Dirección de envío')).not.toBeInTheDocument();
    expect(modal.querySelector('.adp-header-icon svg')).not.toBeNull();
    expect(container.querySelector('.au-modal h2')).toHaveTextContent('');
  });

  it('una solicitud abierta con observación la muestra al admin', async () => {
    servirDevoluciones([dev(92, { OBSERVACION: 'Nota interna ADMIN-TEST' })]);
    montar();
    await abrirGestion();

    expect(document.querySelector('.ad-obs-admin')).toHaveTextContent('Nota interna ADMIN-TEST');
    expect(screen.getByRole('button', { name: 'Aceptar devolución' })).toBeInTheDocument();
  });

  it('el historial cerrado sin fecha ni observación solo muestra el aviso', async () => {
    servirDevoluciones([dev(93, { ESTADO: 'RECHAZADA', FECHA_PROCESADA: null, OBSERVACION: null })]);
    montar();
    await abrirGestion();

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Historial de solo lectura');
    expect(banner).not.toHaveTextContent('Procesada el');
    expect(banner).not.toHaveTextContent('Observación:');
  });

  it('accede al chat con el título según la parte de la conversación', async () => {
    servirDevoluciones([
      dev(94, { ID_CHAT: 9, PARTE_CHAT: null }),
      dev(95, { ID_CHAT: 10, PARTE_CHAT: 'CLIENTE' }),
      dev(96, { ID_CHAT: 11, PARTE_CHAT: 'VENDEDOR' }),
    ]);
    montar();

    await abrirGestion(0);
    expect(screen.getByTitle('Conversación del acuerdo cliente↔vendedor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    await waitFor(() => expect(modalAbierto()).toBeNull());

    await abrirGestion(1);
    expect(screen.getByTitle('Conversación de la parte cliente con JADDA')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    await waitFor(() => expect(modalAbierto()).toBeNull());

    await abrirGestion(2);
    expect(screen.getByTitle('Conversación de la parte vendedor con JADDA')).toBeInTheDocument();
    fireEvent.click(within(modalAbierto() as HTMLElement).getByRole('button', { name: /Ver conversación/ }));
    expect(await screen.findByTestId('sonda-chats')).toBeInTheDocument();
  });

  it('renderiza evidencias de vídeo, foto y el aviso solo cuando hay fotos', async () => {
    servirDevoluciones([
      dev(97, { EVIDENCIAS: 'https://test.local/video/upload/v1.mp4|https://test.local/foto.jpg' }),
      dev(98, { EVIDENCIAS: 'https://test.local/video/upload/v2.mp4' }),
    ]);
    const { container } = montar();

    await abrirGestion(0);
    expect(container.querySelector('video')).toHaveAttribute('src', 'https://test.local/video/upload/v1.mp4');
    expect(screen.getByAltText('Evidencia 2')).toHaveAttribute('src', 'https://test.local/foto.jpg');
    expect(screen.getByText(/Haz clic en una foto para verla completa/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    await waitFor(() => expect(modalAbierto()).toBeNull());

    await abrirGestion(1);
    expect(container.querySelector('video')).toBeInTheDocument();
    expect(screen.queryByText(/Haz clic en una foto/)).not.toBeInTheDocument();
  });

  it('un producto de vendedor sin chat con JADDA se informa y no ofrece decisiones', async () => {
    servirDevoluciones([
      dev(99, { ID_VENDEDOR: 55, VENDEDOR_NOMBRE: 'DeporteX ADMIN-TEST', PARTE_CHAT: null, ESTADO: 'SOLICITADA' }),
    ]);
    montar();
    await abrirGestion();

    expect(screen.getByText(/la está negociando el vendedor con el cliente/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aceptar devolución' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Rechazar' })).not.toBeInTheDocument();
  });
});

describe('AdminDevoluciones — decisiones', () => {
  it('acepta el reembolso dedicado y el reembolso sin devolución', async () => {
    montar();
    const filaReembolso = await screen.findByRole('row', { name: /Balón Dev ADMIN-TEST/ });
    fireEvent.click(within(filaReembolso).getByRole('button', { name: 'Gestionar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aceptar reembolso' }));

    expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Aceptar este reembolso?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/devoluciones/admin/82/procesar', cuerpo: { decision: 'reembolsar', observacion: undefined },
    })));
    await waitFor(() => expect(modalAbierto()).toBeNull());

    const filaDevolucion = await screen.findByRole('row', { name: /Guayos Dev ADMIN-TEST/ });
    fireEvent.click(within(filaDevolucion).getByRole('button', { name: 'Gestionar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reembolsar sin devolver' }));

    expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Reembolsar sin devolver?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/devoluciones/admin/81/procesar', cuerpo: { decision: 'reembolsar', observacion: undefined },
    })));
  });

  it('cancelar la confirmación de una decisión no emite el POST', async () => {
    montar();
    await abrirGestion();

    swalFire.mockResolvedValueOnce({ isConfirmed: false });
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar devolución' }));

    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Aceptar esta devolución?' })));
    expect(api.peticiones).toHaveLength(0);
    expect(modalAbierto()).not.toBeNull();
  });

  it('valida el textarea y procesa con observación vacía como undefined', async () => {
    const capturados: Record<string, unknown>[] = [];
    swalFire.mockImplementation((config: Record<string, unknown>) => {
      capturados.push(config);
      return Promise.resolve({ value: '   ' });
    });
    montar();
    await abrirGestion();

    fireEvent.click(screen.getByRole('button', { name: 'Pedir más pruebas' }));
    await waitFor(() => expect(capturados.some((c) => typeof c.inputValidator === 'function')).toBe(true));

    const config = capturados.find((c) => typeof c.inputValidator === 'function') as Record<string, unknown>;
    const validador = config.inputValidator as (v: string | null) => string | undefined;
    expect(validador('x'.repeat(501))).toBe('Máximo 500 caracteres');
    expect(validador('x'.repeat(500))).toBeUndefined();
    expect(validador(null)).toBeUndefined();

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/devoluciones/admin/81/procesar', cuerpo: { decision: 'mas_pruebas' },
    })));
  });

  it('advierte sin mensaje del backend y ante un fallo de red', async () => {
    server.use(http.post(/\/api\/devoluciones\/admin\/\d+\/procesar$/, () =>
      HttpResponse.json({ ok: false }, { status: 500 })));
    montar();
    await abrirGestion();

    fireEvent.click(screen.getByRole('button', { name: 'Aceptar devolución' }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning', title: 'No se pudo procesar',
    })));

    server.use(http.post(/\/api\/devoluciones\/admin\/\d+\/procesar$/, () => HttpResponse.error()));
    fireEvent.click(screen.getByRole('button', { name: 'Aceptar devolución' }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'Error al procesar la solicitud',
    })));
  });
});
