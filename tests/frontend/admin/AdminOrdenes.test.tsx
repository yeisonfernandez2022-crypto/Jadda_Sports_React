import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersOrdenesAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminOrdenes from '../../../frontend/src/admin/AdminOrdenes.tsx';
import { numeroPedido } from '../../../frontend/src/utils/numeroPedido.ts';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Panel de órdenes contra su código REAL: KPIs que filtran, grupos
 * sin procesar / procesadas, detalle expandible con stepper de envío,
 * cambio de estado de venta, cancelación de envío y eliminación de registro.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

beforeEach(() => {
  ({ api, handlers } = handlersOrdenesAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

/** Fila de la tabla de una orden: la celda "Pedido {n}" la identifica de forma única. */
const filaDe = (idVenta: number) => {
  const celda = screen.getByText(`Pedido ${numeroPedido(idVenta)}`);
  return celda.closest('tr') as HTMLTableRowElement;
};

const expandir = async (idVenta: number) => {
  const fila = await screen.findByText(`Pedido ${numeroPedido(idVenta)}`);
  fireEvent.click(within(fila.closest('tr') as HTMLElement).getByRole('button', { name: 'Gestionar' }));
  await screen.findByRole('button', { name: 'Cerrar' });
};

describe('AdminOrdenes', () => {
  it('carga el listado con KPIs, contador y grupos sin procesar / procesadas', async () => {
    renderAdmin(<AdminOrdenes />);

    expect(await screen.findByRole('heading', { name: 'Órdenes' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('6 órdenes')).toBeInTheDocument());
    // KPIs calculados sobre las órdenes del handler (anclas por clase: la
    // etiqueta "En camino" también existe como option del filtro de envío).
    expect(screen.getByText('Órdenes totales')).toBeInTheDocument();
    const kpiPend = screen.getByText('Pendientes', { selector: '.ao-kpi-etiqueta' }).closest('.ao-kpi') as HTMLElement;
    expect(within(kpiPend).getByText('1')).toBeInTheDocument();
    const kpiCamino = screen.getByText('En camino', { selector: '.ao-kpi-etiqueta' }).closest('.ao-kpi') as HTMLElement;
    expect(within(kpiCamino).getByText('1')).toBeInTheDocument();
    const kpiEntreg = screen.getByText('Entregadas', { selector: '.ao-kpi-etiqueta' }).closest('.ao-kpi') as HTMLElement;
    expect(within(kpiEntreg).getByText('1')).toBeInTheDocument();
    const kpiCanc = screen.getByText('Canceladas', { selector: '.ao-kpi-etiqueta' }).closest('.ao-kpi') as HTMLElement;
    expect(within(kpiCanc).getByText('2')).toBeInTheDocument();
    // Grupo "Sin procesar" nace abierto (701, 702, 704, 706 visibles).
    expect(screen.getByText('Sin procesar')).toBeInTheDocument();
    expect(screen.getByText(`Pedido ${numeroPedido(701)}`)).toBeInTheDocument();
    expect(screen.getByText(`Pedido ${numeroPedido(706)}`)).toBeInTheDocument();
    // "Procesadas" nace cerrado: 703 (ENTREGADO) no se ve hasta expandir.
    expect(screen.queryByText(`Pedido ${numeroPedido(703)}`)).not.toBeInTheDocument();
  });

  it('el grupo Procesadas se expande y muestra las órdenes entregadas y canceladas', async () => {
    renderAdmin(<AdminOrdenes />);
    await screen.findByText(`Pedido ${numeroPedido(701)}`);

    fireEvent.click(screen.getByRole('button', { name: /Procesadas/ }));

    expect(await screen.findByText(`Pedido ${numeroPedido(703)}`)).toBeInTheDocument();
    expect(screen.getByText('ENTREGADO')).toBeInTheDocument();
    expect(screen.getByText(`Pedido ${numeroPedido(705)}`)).toBeInTheDocument();
    expect(screen.getByText('CANCELADO')).toBeInTheDocument();
  });

  it('el detalle de una orden muestra productos, variantes, totales y stepper de envío', async () => {
    renderAdmin(<AdminOrdenes />);
    await screen.findByText(`Pedido ${numeroPedido(702)}`);
    fireEvent.click(within(filaDe(702)).getByRole('button', { name: 'Gestionar' }));

    // Productos con variantes (color y atributo) y cantidades.
    expect(await screen.findByText('Balón Ord ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Negro')).toBeInTheDocument();
    expect(screen.getByText('Talla: 5')).toBeInTheDocument();
    expect(screen.getByText('x1')).toBeInTheDocument();
    // Totales con costo de envío separado (COSTO_ENVIO 15000): el subtotal
    // aparece dos veces (producto y fila de totales).
    expect(screen.getByText('Subtotal productos')).toBeInTheDocument();
    expect(screen.getAllByText('$75.000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('$15.000')).toBeInTheDocument();
    // Stepper: la orden EMPACADO está en el paso 3 (botones, no options del filtro).
    expect(screen.getByRole('button', { name: 'Por empaquetar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entregado' })).toBeInTheDocument();
    // Acciones: factura y cancelar envío (estado EMPACADO lo permite).
    expect(screen.getByRole('button', { name: /Factura PDF/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar envío' })).toBeInTheDocument();
    // CANCELADA no: la orden 702 está CONFIRMADA.
    expect(screen.queryByRole('button', { name: /Eliminar registro/ })).not.toBeInTheDocument();
  });

  it('avanzar el envío: PUT con el siguiente paso y confirmación breve', async () => {
    renderAdmin(<AdminOrdenes />);
    await expandir(701);

    fireEvent.click(screen.getByRole('button', { name: 'Avanzar: marcar como por empaquetar' }));

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'PUT', ruta: '/api/admin/compras/701/envio', cuerpo: { estado_envio: 'POR_EMPAQUETAR' },
    })));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: 'Envío actualizado' })));
  });

  it('cambiar el estado de la venta: PUT con el estado elegido', async () => {
    renderAdmin(<AdminOrdenes />);
    await expandir(702);

    fireEvent.change(screen.getByDisplayValue('CONFIRMADA'), { target: { value: 'COMPLETADA' } });

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'PUT', ruta: '/api/admin/compras/702/estado', cuerpo: { estado: 'COMPLETADA' },
    })));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: 'Estado actualizado' })));
  });

  it('cancelar el envío pide confirmación y emite PUT con CANCELADO', async () => {
    renderAdmin(<AdminOrdenes />);
    await expandir(704);

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar envío' }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Cancelar el envío?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'PUT', ruta: '/api/admin/compras/704/envio', cuerpo: { estado_envio: 'CANCELADO' },
    })));
  });

  it('eliminar un registro cancelado: DELETE tras confirmar y fila fuera del listado', async () => {
    renderAdmin(<AdminOrdenes />);
    await expandir(704);

    fireEvent.click(screen.getByRole('button', { name: /Eliminar registro/ }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Eliminar registro?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'DELETE', ruta: '/api/admin/compras/704',
    })));
    await waitFor(() => expect(screen.getByText('5 órdenes')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText(`Pedido ${numeroPedido(704)}`)).not.toBeInTheDocument());
  });

  it('la orden de vendedor externo es de solo lectura: sin stepper avanzable ni acciones', async () => {
    renderAdmin(<AdminOrdenes />);
    await expandir(706);

    expect(screen.getByText(/Gestión del vendedor · Deportes Andes ADMIN-TEST/)).toBeInTheDocument();
    expect(screen.getByText('Estado de la orden (solo lectura)')).toBeInTheDocument();
    expect(screen.getByDisplayValue('CONFIRMADA')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cancelar envío' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Avanzar/ })).not.toBeInTheDocument();
  });

  it('los KPI activan filtros: Canceladas deja 2 órdenes y la búsqueda acota por cliente', async () => {
    renderAdmin(<AdminOrdenes />);
    await screen.findByText(`Pedido ${numeroPedido(701)}`);

    fireEvent.click(screen.getByRole('button', { name: /Canceladas/ }));
    await waitFor(() => expect(screen.getByText('2 órdenes')).toBeInTheDocument());

    // "Órdenes totales" limpia los filtros y la búsqueda por email acota a 1.
    fireEvent.click(screen.getByRole('button', { name: /Órdenes totales/ }));
    await waitFor(() => expect(screen.getByText('6 órdenes')).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText('Buscar por # orden, cliente o correo...'), { target: { value: 'carla@test.local' } });
    await waitFor(() => expect(screen.getByText('1 órdenes')).toBeInTheDocument());
  });

  it('error del servidor al cambiar estado: advertencia con el mensaje del backend', async () => {
    server.use(
      http.put('*/api/admin/compras/:id/estado', () =>
        HttpResponse.json({ ok: false, msg: 'Error del servidor ADMIN-TEST' }, { status: 500 })),
    );
    renderAdmin(<AdminOrdenes />);
    await expandir(702);

    fireEvent.change(screen.getByDisplayValue('CONFIRMADA'), { target: { value: 'COMPLETADA' } });

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'Error del servidor ADMIN-TEST' })));
  });

  it('la factura PDF abre la ruta de factura en una pestaña nueva', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    renderAdmin(<AdminOrdenes />);
    await expandir(701);

    fireEvent.click(screen.getByRole('button', { name: /Factura PDF/ }));

    expect(abrir).toHaveBeenCalledWith('/api/admin/compras/701/factura', '_blank');
    abrir.mockRestore();
  });
});
