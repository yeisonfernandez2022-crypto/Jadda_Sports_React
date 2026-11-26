import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { server } from '../setup';
import {
  DETALLE_VENDEDOR_PENDIENTE_ADMIN, HANDLERS_ADMIN, handlersVendedoresAdmin,
  type ApiAdmin, type RequestHandler,
} from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import DetalleVendedorAdmin from '../../../frontend/src/admin/DetalleVendedorAdmin.tsx';

/**
 * DetalleVendedorAdmin — segunda capa de cobertura.
 *
 * Complementa DetalleVendedorAdmin.test.tsx con la solicitud rechazada sin
 * datos, la tienda aprobada sin resumen ni catálogo, los estados de
 * publicación desconocidos, el validador del motivo de rechazo, las
 * confirmaciones canceladas, los errores del procesado y el reintento.
 */

const { swalFire } = vi.hoisted(() => ({ swalFire: vi.fn() }));

vi.mock('sweetalert2', () => ({
  default: { fire: swalFire },
}));

let api: ApiAdmin;
let handlers: RequestHandler[];

const renderDetalle = (ruta = '/admin/vendedores/35') =>
  renderAdmin(
    <Routes>
      <Route path="/admin/vendedores/:id" element={<DetalleVendedorAdmin />} />
      <Route path="/admin/vendedores" element={<p>lista-vendedores</p>} />
      <Route path="/admin/usuarios/:id" element={<p>detalle-usuario</p>} />
    </Routes>,
    { ruta },
  );

const servirDetalle = (detalle: Record<string, unknown>) =>
  server.use(http.get(/\/api\/vendedor\/admin\/\d+$/, () => HttpResponse.json(detalle)));

const SOLICITUD_BASE = {
  ID_SOLICITUD: 35, ID_USUARIO: 64, NOMBRE_EMPRESA: 'Tienda Huecos ADMIN-TEST',
  NIT: '900111', NOMBRE_REPRESENTANTE: 'Representante', EMAIL_EMPRESA: 'huecos@test.local',
  TELEFONO: '3001112222', DEPARTAMENTO: 'Antioquia', CIUDAD: 'Medellín',
  DIRECCION: 'Calle 1', CATEGORIAS: 'Fútbol', DESCRIPCION: 'Descripción',
  ESTADO: 'APROBADA', OBSERVACION_ADMIN: null,
  FECHA_CREACION: '2026-10-20T10:00:00.000Z', FECHA_PROCESADA: null,
  SOLICITANTE_NOMBRE: 'Solicitante', SOLICITANTE_EMAIL: 'huecos@test.local',
  SOLICITANTE_USUARIO: 'huecos', SOLICITANTE_TELEFONO: '3001112222',
};

const VENDEDOR_BASE = {
  ID_VENDEDOR: 70, ID_USUARIO: 64, NOMBRE_EMPRESA: 'Tienda Huecos ADMIN-TEST',
  NIT: '900111', EMAIL_VENDEDOR: 'huecos@test.local', TELEFONO: '3001112222',
  DEPARTAMENTO: 'Antioquia', CIUDAD: 'Medellín', DIRECCION: 'Calle 1',
  CATEGORIAS: 'Fútbol', ESTADO: 'ACTIVO', FECHA_REGISTRO: '2026-10-21T10:00:00.000Z',
  VENDEDOR_NOMBRE: 'Solicitante', VENDEDOR_APELLIDO: 'Prueba', VENDEDOR_EMAIL: 'huecos@test.local',
};

beforeEach(() => {
  ({ api, handlers } = handlersVendedoresAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
  swalFire.mockReset().mockResolvedValue({ isConfirmed: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DetalleVendedorAdmin — solicitudes sin datos', () => {
  it('una solicitud rechazada y vacía usa todos los valores por defecto', async () => {
    servirDetalle({
      solicitud: {
        ...SOLICITUD_BASE,
        NOMBRE_EMPRESA: null, NIT: null, NOMBRE_REPRESENTANTE: null,
        TELEFONO: null, DIRECCION: null, CATEGORIAS: null, DESCRIPCION: null,
        ESTADO: 'RECHAZADA', OBSERVACION_ADMIN: 'Rechazo ADMIN-TEST',
        FECHA_CREACION: '', FECHA_PROCESADA: '2026-00-00',
        SOLICITANTE_NOMBRE: null, SOLICITANTE_EMAIL: null,
        SOLICITANTE_USUARIO: null, SOLICITANTE_TELEFONO: '3009998877',
      },
      vendedor: null, resumen: null, productos: [], ventasRecientes: [],
    });
    renderDetalle();

    expect(await screen.findByRole('heading', { level: 1, name: 'Vendedor informal' })).toBeInTheDocument();
    expect(screen.getByText('RECHAZADA')).toHaveClass('au-badge-no');
    expect(screen.getByText('Rechazo ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('— (vendedor informal)')).toBeInTheDocument();
    expect(screen.getByText(/3009998877/)).toBeInTheDocument();
    expect(screen.getByText('Solicitud pendiente: todavía no tiene tienda aprobada')).toBeInTheDocument();
    expect(document.querySelector('.adp-header-subtitulo')).toBeNull();
    expect(screen.queryByText('Categorías')).not.toBeInTheDocument();
    expect(screen.queryByText('Descripción del negocio')).not.toBeInTheDocument();
    expect(screen.queryByText('Cuenta de vendedor')).not.toBeInTheDocument();
  });

  it('sin datos de solicitud usa el mensaje por defecto', async () => {
    server.use(http.get(/\/api\/vendedor\/admin\/\d+$/, () => HttpResponse.json({})));
    renderDetalle();

    expect(await screen.findByText('No se pudo cargar la solicitud.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('el botón Reintentar vuelve a pedir el detalle y lo pinta', async () => {
    let lecturas = 0;
    server.use(http.get(/\/api\/vendedor\/admin\/\d+$/, () => {
      lecturas += 1;
      return HttpResponse.json({ ok: false, msg: 'Falla temporal ADMIN-TEST' }, { status: 500 });
    }));
    renderDetalle();

    expect(await screen.findByText('Falla temporal ADMIN-TEST')).toBeInTheDocument();
    expect(lecturas).toBe(1);

    server.use(http.get(/\/api\/vendedor\/admin\/\d+$/, () => {
      lecturas += 1;
      return HttpResponse.json(DETALLE_VENDEDOR_PENDIENTE_ADMIN);
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('heading', { level: 1, name: /Tienda Pendiente ADMIN-TEST/i })).toBeInTheDocument();
    expect(lecturas).toBe(2);
  });
});

describe('DetalleVendedorAdmin — tienda aprobada', () => {
  it('sin resumen, productos ni ventas muestra los vacíos y ceros', async () => {
    servirDetalle({
      solicitud: SOLICITUD_BASE,
      vendedor: {
        ...VENDEDOR_BASE, EMAIL_VENDEDOR: null, VENDEDOR_EMAIL: null, TELEFONO: null,
        CIUDAD: null, DEPARTAMENTO: null, CATEGORIAS: null, FECHA_REGISTRO: null,
      },
      resumen: null, productos: [], ventasRecientes: [],
    });
    renderDetalle();

    expect(await screen.findByRole('heading', { level: 2, name: /Cuenta de vendedor/ })).toBeInTheDocument();
    expect(screen.getByText('Esta tienda aún no tiene productos publicados.')).toBeInTheDocument();
    expect(screen.getByText('Sin ventas registradas para esta tienda.')).toBeInTheDocument();
    expect(screen.getAllByText('$ 0').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Categorías')).toHaveLength(1);
    expect(screen.getAllByText('—', { selector: 'strong' }).length).toBeGreaterThanOrEqual(1);
  });

  it('pinta estados de publicación desconocidos, imagen rota y venta sin cliente', async () => {
    servirDetalle({
      solicitud: SOLICITUD_BASE,
      vendedor: VENDEDOR_BASE,
      resumen: { productosPublicados: 2, unidadesVendidas: 1, totalVentas: 1, totalIngresos: 10000, ticketPromedio: 10000 },
      productos: [
        {
          ID: 1, NOMBRE: 'Producto Roto ADMIN-TEST', PRECIO: 10000, ESTADO_PUBLICACION: null,
          STOCK: 1, IMAGEN: 'https://test.local/roto.png', UNIDADES: 0, INGRESOS: 0, PEDIDOS: 0,
        },
        {
          ID: 2, NOMBRE: 'Producto Rechazado ADMIN-TEST', PRECIO: 20000, ESTADO_PUBLICACION: 'RECHAZADO',
          STOCK: 0, IMAGEN: null, UNIDADES: 1, INGRESOS: 20000, PEDIDOS: 1,
        },
      ],
      ventasRecientes: [{
        ID_VENTA: 90, FECHA_VENTA: null, ESTADO: 'COMPLETADA',
        CLIENTE: null, CLIENTE_APELLIDO: null, IMPORTE: 0,
      }],
    });
    renderDetalle();

    expect(await screen.findByText('Sin estado')).toHaveClass('au-badge-no');
    expect(screen.getByText('RECHAZADO')).toHaveClass('au-badge-no');
    const filaVenta = screen.getByRole('row', { name: /#90/ });
    expect(within(filaVenta).getByText('Cliente')).toBeInTheDocument();
    expect(within(filaVenta).getByText('$ 0')).toBeInTheDocument();

    const rota = screen.getByAltText('Producto Roto ADMIN-TEST');
    fireEvent.error(rota);
    expect(rota.getAttribute('src')).toContain('data:image/svg+xml');
  });
});

describe('DetalleVendedorAdmin — rechazo y errores', () => {
  it('valida el motivo, confirma el rechazo y no envía si se cancela', async () => {
    const configuraciones: Record<string, unknown>[] = [];
    swalFire.mockImplementation((config: Record<string, unknown>) => {
      configuraciones.push(config);
      return Promise.resolve(configuraciones.length === 1
        ? { isConfirmed: true, value: 'Motivo ADMIN-TEST' }
        : { isConfirmed: false });
    });
    renderDetalle('/admin/vendedores/34');
    await screen.findByText('Solicitud pendiente: todavía no tiene tienda aprobada');

    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));
    await waitFor(() => expect(configuraciones.length).toBeGreaterThanOrEqual(2));

    const validador = configuraciones[0].inputValidator as (v: string | null) => string | undefined;
    expect(validador('')).toBe('Debes indicar el motivo del rechazo');
    expect(validador(null)).toBe('Debes indicar el motivo del rechazo');
    expect(validador('x'.repeat(501))).toBe('Máximo 500 caracteres');
    expect(validador('Motivo válido')).toBeUndefined();

    expect(configuraciones[1]).toMatchObject({ title: '¿Confirmar rechazo?' });
    expect(api.peticiones.filter((p) => p.metodo === 'POST')).toHaveLength(0);
    expect(screen.getByRole('button', { name: /rechazar/i })).toBeInTheDocument();
  });

  it('un rechazo confirmado sin texto envía la observación vacía', async () => {
    swalFire.mockResolvedValueOnce({ isConfirmed: true });
    renderDetalle('/admin/vendedores/34');
    await screen.findByText('Solicitud pendiente: todavía no tiene tienda aprobada');

    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/vendedor/admin/34/procesar', cuerpo: { estado: 'RECHAZADA' },
    })));
  });

  it('cancelar la confirmación de aprobación no emite el POST', async () => {
    swalFire.mockResolvedValueOnce({ isConfirmed: false });
    renderDetalle('/admin/vendedores/34');
    await screen.findByText('Solicitud pendiente: todavía no tiene tienda aprobada');

    fireEvent.click(screen.getByRole('button', { name: /aprobar y enviar credenciales/i }));

    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Aprobar solicitud?' })));
    expect(api.peticiones.filter((p) => p.metodo === 'POST')).toHaveLength(0);
  });

  it('advierte sin mensaje del backend y ante un fallo de red', async () => {
    server.use(http.post(/\/api\/vendedor\/admin\/\d+\/procesar$/, () =>
      HttpResponse.json({ ok: false }, { status: 500 })));
    renderDetalle('/admin/vendedores/34');
    await screen.findByText('Solicitud pendiente: todavía no tiene tienda aprobada');

    fireEvent.click(screen.getByRole('button', { name: /aprobar y enviar credenciales/i }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning', title: 'No se pudo procesar la solicitud',
    })));

    server.use(http.post(/\/api\/vendedor\/admin\/\d+\/procesar$/, () => HttpResponse.error()));
    fireEvent.click(screen.getByRole('button', { name: /aprobar y enviar credenciales/i }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'Error al procesar la solicitud',
    })));
    expect(screen.getByRole('button', { name: /aprobar y enviar credenciales/i })).toBeEnabled();
  });
});
