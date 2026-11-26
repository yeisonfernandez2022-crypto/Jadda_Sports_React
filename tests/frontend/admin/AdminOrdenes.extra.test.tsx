import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersOrdenesAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminOrdenes from '../../../frontend/src/admin/AdminOrdenes.tsx';
import { numeroPedido } from '../../../frontend/src/utils/numeroPedido.ts';

/**
 * AdminOrdenes — segunda capa de cobertura.
 *
 * Complementa AdminOrdenes.test.tsx con los filtros por envío/fecha, KPIs
 * restantes, paginación, grupos vacíos, detalle de envíos cancelados y
 * entregados, productos con variantes parciales o imágenes rotas, la orden
 * ENVIADA de vendedor sin nombre y todos los caminos de error de estado,
 * envío y eliminación.
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
      <Route path="/admin/ordenes" element={<AdminOrdenes />} />
      <Route path="/admin" element={<div data-testid="sonda-admin" />} />
    </Routes>,
    { ruta: '/admin/ordenes' },
  );

const ORDEN_BASE = {
  FECHA_VENTA: '2026-11-10T10:00:00.000Z',
  NOMBRE_USUARIO: 'Cliente', APELLIDO_USUARIO: 'Prueba', EMAIL: 'cliente@test.local',
  ESTADO: 'PENDIENTE', ESTADO_ENVIO: null, TOTAL: 50000, TOTAL_ARTICULOS: 1, TOTAL_UNIDADES: 1,
  METODO_PAGO: 'Wompi', COSTO_ENVIO: 0, DIRECCION_ENVIO: 'Calle 1', BARRIO: null,
  CIUDAD: 'Cali', DEPARTAMENTO: 'Valle', CODIGO_POSTAL: null, TELEFONO_CONTACTO: null,
  OBSERVACIONES: null, FECHA_ENVIO: null, ES_DE_VENDEDOR: 0, VENDEDORES: null,
  productos: [],
};

const ordenExtra = (id: number, extra: Record<string, unknown> = {}) =>
  ({ ...ORDEN_BASE, ID_VENTA: id, ...extra });

const servirOrdenes = (lista: unknown[]) =>
  server.use(http.get(/\/api\/admin\/compras$/, () => HttpResponse.json(lista)));

const filaDe = (idVenta: number) => {
  const celda = screen.getByText(`Pedido ${numeroPedido(idVenta)}`);
  return celda.closest('tr') as HTMLTableRowElement;
};

const expandir = async (idVenta: number) => {
  const fila = await screen.findByText(`Pedido ${numeroPedido(idVenta)}`);
  fireEvent.click(within(fila.closest('tr') as HTMLElement).getByRole('button', { name: 'Gestionar' }));
  await screen.findByRole('button', { name: 'Cerrar' });
};

const titulosSwal = (titulo: string) =>
  swalFire.mock.calls.filter(([config]) => (config as { title?: string })?.title === titulo).length;

beforeEach(() => {
  ({ api, handlers } = handlersOrdenesAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
  swalFire.mockReset().mockResolvedValue({ isConfirmed: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminOrdenes — filtros y KPIs', () => {
  it('los KPIs de pendientes, en camino y entregadas aplican su filtro', async () => {
    montar();
    await screen.findByText(`Pedido ${numeroPedido(701)}`);

    fireEvent.click(screen.getByRole('button', { name: /Pendientes/ }));
    await waitFor(() => expect(screen.getByText('1 órdenes')).toBeInTheDocument(), { timeout: 3000 });
    expect(screen.getByText(`Pedido ${numeroPedido(701)}`)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Órdenes totales/ }));
    await waitFor(() => expect(screen.getByText('6 órdenes')).toBeInTheDocument(), { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: /En camino/ }));
    expect(await screen.findByText(`Pedido ${numeroPedido(706)}`, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText(`Pedido ${numeroPedido(701)}`)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Órdenes totales/ }));
    await waitFor(() => expect(screen.getByText('6 órdenes')).toBeInTheDocument(), { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: /Entregadas/ }));
    await waitFor(() => expect(screen.getByText('1 órdenes')).toBeInTheDocument(), { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: /Procesadas/ }));
    expect(await screen.findByText(`Pedido ${numeroPedido(703)}`)).toBeInTheDocument();
  });

  it('los selectores de estado de venta y de envío filtran el listado', async () => {
    montar();
    await screen.findByText(`Pedido ${numeroPedido(701)}`);

    fireEvent.change(screen.getByDisplayValue('Estado: todos'), { target: { value: 'CANCELADA' } });
    await waitFor(() => expect(screen.getByText('2 órdenes')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('CANCELADA'), { target: { value: '' } });
    await waitFor(() => expect(screen.getByText('6 órdenes')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Envío: todos'), { target: { value: 'CANCELADO' } });
    await waitFor(() => expect(screen.getByText('1 órdenes')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Procesadas/ }));
    expect(await screen.findByText(`Pedido ${numeroPedido(705)}`)).toBeInTheDocument();
  });

  it('busca por id aunque falten nombre y correo, y filtra por últimos 7 y 30 días', async () => {
    const ahora = Date.now();
    servirOrdenes([
      ordenExtra(901, {
        NOMBRE_USUARIO: null, APELLIDO_USUARIO: null, EMAIL: null,
        FECHA_VENTA: new Date(ahora - 3 * 86400000).toISOString(),
      }),
      ordenExtra(902, { FECHA_VENTA: new Date(ahora - 10 * 86400000).toISOString() }),
      ordenExtra(903, { FECHA_VENTA: new Date(ahora - 40 * 86400000).toISOString() }),
    ]);
    montar();
    await screen.findByText(`Pedido ${numeroPedido(901)}`);
    expect(screen.getByText('3 órdenes')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por # orden, cliente o correo...'), { target: { value: '901' } });
    await waitFor(() => expect(screen.getByText('1 órdenes')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Buscar por # orden, cliente o correo...'), { target: { value: '' } });
    await waitFor(() => expect(screen.getByText('3 órdenes')).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue('Todas las fechas'), { target: { value: '7' } });
    await waitFor(() => expect(screen.getByText('1 órdenes')).toBeInTheDocument());
    expect(screen.queryByText(`Pedido ${numeroPedido(902)}`)).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Últimos 7 días'), { target: { value: '30' } });
    await waitFor(() => expect(screen.getByText('2 órdenes')).toBeInTheDocument());
    expect(screen.getByText(`Pedido ${numeroPedido(902)}`)).toBeInTheDocument();
    expect(screen.queryByText(`Pedido ${numeroPedido(903)}`)).not.toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Últimos 30 días'), { target: { value: '' } });
    await waitFor(() => expect(screen.getByText('3 órdenes')).toBeInTheDocument());
  });

  it('un listado que no es arreglo deja el estado vacío', async () => {
    server.use(http.get(/\/api\/admin\/compras$/, () => HttpResponse.json({ ordenes: [] })));
    montar();

    expect(await screen.findByText('No hay órdenes con estos filtros')).toBeInTheDocument();
    expect(screen.getByText('0 órdenes')).toBeInTheDocument();
  });

  it('registra en consola el fallo de red al cargar las órdenes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get(/\/api\/admin\/compras$/, () => HttpResponse.error()));
    montar();

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Error al cargar órdenes'));
    expect(await screen.findByText('No hay órdenes con estos filtros')).toBeInTheDocument();
  });
});

describe('AdminOrdenes — detalle de envíos', () => {
  it('un envío cancelado muestra su aviso y permite eliminar el registro', async () => {
    montar();
    await screen.findByText(`Pedido ${numeroPedido(701)}`);
    fireEvent.click(screen.getByRole('button', { name: /Procesadas/ }));
    await expandir(705);

    expect(screen.getByText('Este envío fue cancelado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Avanzar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar envío' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Eliminar registro/ })).toBeInTheDocument();
    expect(screen.getByText('Costo envío: Gratis')).toBeInTheDocument();
    expect(screen.getAllByText('Gratis').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByText('Este envío fue cancelado')).not.toBeInTheDocument());
    expect(screen.getByText(`Pedido ${numeroPedido(705)}`)).toBeInTheDocument();
  });

  it('una orden entregada muestra la fecha de envío y no ofrece avanzar', async () => {
    montar();
    await screen.findByText(`Pedido ${numeroPedido(701)}`);
    fireEvent.click(screen.getByRole('button', { name: /Procesadas/ }));
    await expandir(703);

    expect(screen.getByText(/Fecha de envío:/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Avanzar/ })).not.toBeInTheDocument();
    expect(screen.getByText('Costo envío: Gratis')).toBeInTheDocument();
  });

  it('pinta variantes parciales, imagen rota y totales sin costo de envío', async () => {
    servirOrdenes([
      ordenExtra(910, {
        TOTAL: 50000, COSTO_ENVIO: null, METODO_PAGO: null, TOTAL_ARTICULOS: 3,
        productos: [
          { ID: 1, NOMBRE: 'Solo color', IMAGEN: 'https://test.local/imagen.png', COLOR: 'Rojo', CANTIDAD: 2, SUBTOTAL: 20000 },
          { ID: 2, NOMBRE: 'Solo atributo', IMAGEN: null, NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: 'M', CANTIDAD: 1, SUBTOTAL: 30000 },
          { ID: 3, NOMBRE: 'Sin variantes', IMAGEN: null, CANTIDAD: 1, SUBTOTAL: 0 },
        ],
      }),
    ]);
    montar();
    await expandir(910);

    expect(screen.getByText('Rojo')).toBeInTheDocument();
    expect(screen.getByText('Talla: M')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.getAllByText('$50.000').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Costo envío:/)).not.toBeInTheDocument();

    const rota = screen.getByAltText('Sin variantes');
    expect(rota).toHaveAttribute('src', 'https://placehold.co/400x400?text=JADDA');
    fireEvent.error(rota);
    expect(rota).toHaveAttribute('src', 'https://placehold.co/400x400?text=JADDA');
  });

  it('la venta ENVIADA de un vendedor sin nombre queda en solo lectura', async () => {
    servirOrdenes([
      ordenExtra(911, {
        ESTADO: 'ENVIADA', ESTADO_ENVIO: 'EN_CAMINO', ES_DE_VENDEDOR: 1,
        VENDEDORES: null, CIUDAD: null, DEPARTAMENTO: 'Valle',
      }),
    ]);
    montar();
    await expandir(911);

    expect(screen.getByText('ENVIADA', { selector: '.ao-badge-venta' })).toHaveClass('ao-bv-enviada');
    expect(screen.getByText(/Gestión del vendedor — el estado del pedido/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('ENVIADA')).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Avanzar/ })).not.toBeInTheDocument();
    expect(screen.getByText('Valle')).toBeInTheDocument();
  });
});

describe('AdminOrdenes — errores de estado y envío', () => {
  it('el cambio de estado maneja reembolso, error sin mensaje, JSON inválido y red', async () => {
    montar();
    await expandir(702);

    server.use(http.put(/\/api\/admin\/compras\/\d+\/estado$/, () =>
      HttpResponse.json({ ok: true, reembolso: true, msg: 'Reembolso ADMIN-TEST' })));
    fireEvent.change(screen.getByDisplayValue('CONFIRMADA'), { target: { value: 'COMPLETADA' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Pedido cancelado', text: 'Reembolso ADMIN-TEST', timer: 4000,
    })));

    server.use(http.put(/\/api\/admin\/compras\/\d+\/estado$/, () =>
      HttpResponse.json({}, { status: 500 })));
    fireEvent.change(screen.getByDisplayValue('CONFIRMADA'), { target: { value: 'CANCELADA' } });
    await waitFor(() => expect(titulosSwal('No se pudo actualizar el estado')).toBe(1));

    server.use(http.put(/\/api\/admin\/compras\/\d+\/estado$/, () =>
      new HttpResponse('no-json', { status: 200 })));
    fireEvent.change(screen.getByDisplayValue('CONFIRMADA'), { target: { value: 'ENVIADA' } });
    await waitFor(() => expect(titulosSwal('Estado actualizado')).toBe(1));

    server.use(http.put(/\/api\/admin\/compras\/\d+\/estado$/, () => HttpResponse.error()));
    fireEvent.change(screen.getByDisplayValue('CONFIRMADA'), { target: { value: 'COMPLETADA' } });
    await waitFor(() => expect(titulosSwal('Error al actualizar')).toBe(1));
  });

  it('el envío maneja error del servidor, red, JSON inválido y respuesta sin cambios', async () => {
    let lecturas = 0;
    server.use(http.get(/\/api\/admin\/compras$/, () => {
      lecturas += 1;
      return HttpResponse.json([ordenExtra(950, { ESTADO_ENVIO: 'PENDIENTE' })]);
    }));
    montar();
    await expandir(950);
    expect(lecturas).toBe(1);

    server.use(http.put(/\/api\/admin\/compras\/\d+\/envio$/, () =>
      HttpResponse.json({ ok: false }, { status: 500 })));
    fireEvent.click(screen.getByRole('button', { name: 'Avanzar: marcar como por empaquetar' }));
    await waitFor(() => expect(titulosSwal('No se pudo actualizar el envío')).toBe(1));

    server.use(http.put(/\/api\/admin\/compras\/\d+\/envio$/, () => HttpResponse.error()));
    fireEvent.click(screen.getByRole('button', { name: 'Avanzar: marcar como por empaquetar' }));
    await waitFor(() => expect(titulosSwal('Error al actualizar el envío')).toBe(1));

    server.use(http.put(/\/api\/admin\/compras\/\d+\/envio$/, () =>
      new HttpResponse('no-json', { status: 200 })));
    fireEvent.click(screen.getByRole('button', { name: 'Avanzar: marcar como por empaquetar' }));
    await waitFor(() => expect(titulosSwal('Envío actualizado')).toBe(1));

    server.use(http.put(/\/api\/admin\/compras\/\d+\/envio$/, () =>
      HttpResponse.json({ ok: true, sinCambios: true })));
    const antes = lecturas;
    fireEvent.click(screen.getByRole('button', { name: 'Avanzar: marcar como por empaquetar' }));
    await waitFor(() => expect(lecturas).toBe(antes + 1));
    expect(titulosSwal('Envío actualizado')).toBe(1);
  });

  it('cancelar el envío sin confirmar no emite la petición', async () => {
    montar();
    await screen.findByText(`Pedido ${numeroPedido(701)}`);
    fireEvent.click(screen.getByRole('button', { name: /Procesadas/ }));
    await expandir(704);

    swalFire.mockResolvedValueOnce({ isConfirmed: false });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar envío' }));

    await waitFor(() => expect(titulosSwal('¿Cancelar el envío?')).toBe(1));
    expect(api.peticiones).toHaveLength(0);
  });

  it('avanzar desde un paso futuro del stepper emite el PUT y enfoca la factura', async () => {
    const focus = vi.fn();
    const abrir = vi.spyOn(window, 'open').mockReturnValue({ focus } as unknown as Window);
    montar();
    await expandir(701);

    fireEvent.click(screen.getByRole('button', { name: 'Empacado' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'PUT', ruta: '/api/admin/compras/701/envio', cuerpo: { estado_envio: 'EMPACADO' },
    })));
    await waitFor(() => expect(titulosSwal('Envío actualizado')).toBe(1));

    fireEvent.click(screen.getByRole('button', { name: /Factura PDF/ }));
    expect(abrir).toHaveBeenCalledWith('/api/admin/compras/701/factura', '_blank');
    expect(focus).toHaveBeenCalled();
  });
});

describe('AdminOrdenes — eliminación', () => {
  it('cancelar, fallar con y sin mensaje y fallar por red conservan la fila', async () => {
    montar();
    await expandir(704);

    swalFire.mockResolvedValueOnce({ isConfirmed: false });
    fireEvent.click(screen.getByRole('button', { name: /Eliminar registro/ }));
    await waitFor(() => expect(titulosSwal('¿Eliminar registro?')).toBe(1));
    expect(api.peticiones).toHaveLength(0);

    server.use(http.delete(/\/api\/admin\/compras\/\d+$/, () =>
      HttpResponse.json({ msg: 'No pudo ADMIN-TEST' }, { status: 500 })));
    fireEvent.click(screen.getByRole('button', { name: /Eliminar registro/ }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'NO SE PUDO ELIMINAR', text: 'No pudo ADMIN-TEST',
    })));

    server.use(http.delete(/\/api\/admin\/compras\/\d+$/, () =>
      new HttpResponse('no-json', { status: 500 })));
    fireEvent.click(screen.getByRole('button', { name: /Eliminar registro/ }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      title: 'NO SE PUDO ELIMINAR', text: 'No se pudo eliminar',
    })));

    server.use(http.delete(/\/api\/admin\/compras\/\d+$/, () => HttpResponse.error()));
    fireEvent.click(screen.getByRole('button', { name: /Eliminar registro/ }));
    await waitFor(() => expect(titulosSwal('NO SE PUDO ELIMINAR')).toBe(3));
    expect(screen.getByText(`Pedido ${numeroPedido(704)}`)).toBeInTheDocument();
  });

  it('mientras elimina muestra el estado Eliminando y luego vuelve a habilitarse', async () => {
    let liberar: (() => void) | undefined;
    server.use(http.delete(/\/api\/admin\/compras\/\d+$/, async () => {
      await new Promise<void>((resolve) => { liberar = resolve; });
      return HttpResponse.json({ ok: true });
    }));
    montar();
    await expandir(704);

    fireEvent.click(screen.getByRole('button', { name: /Eliminar registro/ }));

    const enProceso = await screen.findByRole('button', { name: /Eliminando/ });
    expect(enProceso).toBeDisabled();

    liberar?.();
    await waitFor(() => expect(titulosSwal('REGISTRO ELIMINADO')).toBe(1));
    expect(screen.queryByRole('button', { name: /Eliminando/ })).not.toBeInTheDocument();
    expect(screen.getByText(`Pedido ${numeroPedido(704)}`)).toBeInTheDocument();
  });
});

describe('AdminOrdenes — paginación y grupos', () => {
  it('pagina los grupos de diez en diez con siguiente, número y anterior', async () => {
    const lista = Array.from({ length: 12 }, (_, i) => ordenExtra(801 + i));
    servirOrdenes(lista);
    montar();

    expect(await screen.findByText('12 órdenes')).toBeInTheDocument();
    expect(screen.getByText(`Pedido ${numeroPedido(801)}`)).toBeInTheDocument();
    expect(screen.queryByText(`Pedido ${numeroPedido(811)}`)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
    await waitFor(() => expect(screen.getByText(`Pedido ${numeroPedido(811)}`)).toBeInTheDocument());
    expect(screen.queryByText(`Pedido ${numeroPedido(801)}`)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '1' }));
    await waitFor(() => expect(screen.getByText(`Pedido ${numeroPedido(801)}`)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Siguiente →' }));
    await screen.findByText(`Pedido ${numeroPedido(812)}`);
    fireEvent.click(screen.getByRole('button', { name: '← Anterior' }));
    await waitFor(() => expect(screen.getByText(`Pedido ${numeroPedido(801)}`)).toBeInTheDocument());
  });

  it('los grupos vacíos muestran su mensaje y el encabezado pliega el contenido', async () => {
    servirOrdenes([ordenExtra(920, { ESTADO: 'COMPLETADA', ESTADO_ENVIO: 'ENTREGADO' })]);
    const primera = montar();

    expect(await screen.findByText('No hay órdenes sin procesar')).toBeInTheDocument();
    primera.unmount();

    servirOrdenes([ordenExtra(921)]);
    montar();
    await screen.findByText(`Pedido ${numeroPedido(921)}`);
    fireEvent.click(screen.getByRole('button', { name: /Procesadas/ }));
    expect(await screen.findByText('No hay órdenes procesadas')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Sin procesar/ }));
    await waitFor(() => expect(screen.queryByText(`Pedido ${numeroPedido(921)}`)).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Sin procesar/ }));
    expect(await screen.findByText(`Pedido ${numeroPedido(921)}`)).toBeInTheDocument();
  });

  it('el botón Volver al inicio regresa al dashboard', async () => {
    montar();
    await screen.findByText(`Pedido ${numeroPedido(701)}`);

    fireEvent.click(screen.getByRole('button', { name: /Volver al inicio/ }));

    expect(await screen.findByTestId('sonda-admin')).toBeInTheDocument();
  });
});
