import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersProductosAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import EditarProductoAdmin from '../../../frontend/src/admin/EditarProductoAdmin.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Panel de edición de producto contra su código REAL: carga combinada
 * (producto + características), vista de solo lectura, edición con PUT,
 * guardia de cambios sin guardar, eliminación y vista previa.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

/** Sonda para verificar las navegaciones protegidas por la guardia. */
const SondaAdmin = () => <div data-testid="sonda-admin">DASHBOARD</div>;

const montar = () =>
  renderAdmin(
    <Routes>
      <Route path="/admin/editar/:id" element={<EditarProductoAdmin />} />
      <Route path="/admin" element={<SondaAdmin />} />
    </Routes>,
    { ruta: '/admin/editar/5' },
  );

/** Entra al modo edición y confirma que los inputs tienen los datos del GET. */
const entrarEdicion = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Producto' }));
  expect(await screen.findByDisplayValue('Guayos Editar ADMIN-TEST')).toBeInTheDocument();
};

beforeEach(() => {
  ({ api, handlers } = handlersProductosAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('EditarProductoAdmin', () => {
  it('carga el producto en solo lectura: datos, ficha técnica sin Color y resumen', async () => {
    montar();

    // Ancla al DATO del GET. Timeout holgado: primer test del archivo.
    const apariciones = await screen.findAllByText('Guayos Editar ADMIN-TEST', {}, { timeout: 3000 });
    expect(apariciones.length).toBeGreaterThanOrEqual(2);
    expect(await screen.findByRole('heading', { name: 'Editar producto' })).toBeInTheDocument();
    expect(screen.getAllByText('Nike').length).toBeGreaterThanOrEqual(2);
    // Display de precio (el locale del entorno varía entre es-CO y en-US).
    expect(screen.getAllByText(/120[.,]000/).length).toBeGreaterThanOrEqual(2);
    // La categoría aparece en el display y en el resumen.
    expect(screen.getAllByText('Fútbol ADMIN-TEST').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Proveedura Uno ADMIN-TEST')).toBeInTheDocument();
    // "Ninguno" aparece en el display y en el resumen de descuento.
    expect(screen.getAllByText('Ninguno').length).toBeGreaterThanOrEqual(2);
    // Ficha técnica: la característica "Color" se filtra (viene de la variante).
    const ficha = screen.getByText('Ficha Técnica').closest('.edit-card') as HTMLElement;
    expect(within(ficha).getByText('Material')).toBeInTheDocument();
    expect(within(ficha).getByText('Cuero sintético')).toBeInTheDocument();
    expect(within(ficha).queryByText('Color')).not.toBeInTheDocument();
    // Resumen con stock total y contador de variantes.
    expect(screen.getByText('4 uds')).toBeInTheDocument();
    expect(screen.getByText(/variante\(s\)/)).toBeInTheDocument();
    // Acciones del modo lectura.
    expect(screen.getByRole('button', { name: 'Editar Producto' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Vista previa' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: 'Ver página' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Eliminar Producto' })).toBeInTheDocument();
    // Dos peticiones iniciales: producto y características.
    expect(api.peticiones.filter((p) => p.metodo === 'GET' && p.ruta === '/api/productos/5')).toHaveLength(1);
  });

  it('Editar Producto muestra inputs con los datos cargados y la variante nueva con Valor deshabilitado', async () => {
    const { container } = montar();
    await screen.findAllByText('Guayos Editar ADMIN-TEST', {}, { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Editar Producto' }));

    expect(await screen.findByDisplayValue('Guayos Editar ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Nike')).toBeInTheDocument();
    expect(screen.getByDisplayValue('120000')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoría')).toHaveValue('1');
    expect(screen.getByLabelText('Proveedor')).toHaveValue('10');
    expect(screen.getByLabelText('Descuento (opcional)')).toHaveValue('');
    expect(container.querySelector('.admin-textarea')).toHaveValue('Guayos de tracción mejorada');
    // Variantes existentes con sus valores (dos filas). Los labels de las
    // filas comparten htmlFor → se cuentan por fila del DOM; los valores
    // viven en los inputs (displayValue).
    const filasIniciales = container.querySelectorAll('.variant-row');
    expect(filasIniciales).toHaveLength(2);
    expect(within(filasIniciales[0] as HTMLElement).getByDisplayValue('Negro')).toBeInTheDocument();
    expect(within(filasIniciales[1] as HTMLElement).getByDisplayValue('Blanco')).toBeInTheDocument();
    // + Agregar variante crea una fila vacía: Valor deshabilitado sin Tipo.
    fireEvent.click(screen.getByRole('button', { name: '+ Agregar variante' }));
    const filasVariante = container.querySelectorAll('.variant-row');
    expect(filasVariante).toHaveLength(3);
    expect(within(filasVariante[filasVariante.length - 1] as HTMLElement).getByPlaceholderText('Ej: 40, M')).toBeDisabled();
    expect(screen.getByRole('button', { name: '+ Agregar característica' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('Guardar Cambios: PUT con el cuerpo completo y refetch que refleja el cambio', async () => {
    montar();
    await screen.findAllByText('Guayos Editar ADMIN-TEST', {}, { timeout: 3000 });
    fireEvent.click(screen.getByRole('button', { name: 'Editar Producto' }));

    fireEvent.change(screen.getByLabelText('Nombre del Producto'), { target: { value: 'Guayos Editado ADMIN-TEST' } });
    fireEvent.change(screen.getByLabelText('Precio de Venta (COP)'), { target: { value: '130000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({ metodo: 'PUT', ruta: '/api/productos/5' })));
    const cuerpo = api.peticiones.find((p) => p.metodo === 'PUT' && p.ruta === '/api/productos/5')?.cuerpo as Record<string, unknown>;
    expect(cuerpo).toMatchObject({ NOMBRE: 'Guayos Editado ADMIN-TEST', MARCA: 'Nike', PRECIO: 130000, ID_CATEGORIA: 1, ID_PROVEEDOR: 10, ID_DESCUENTO: null });
    expect(cuerpo.IMAGENES).toEqual(['https://test.local/e1.png']);
    expect(cuerpo.VARIANTES).toEqual(expect.arrayContaining([
      expect.objectContaining({ ID_VARIANTE: 31, COLOR: 'Negro', ATRIBUTO: '40', STOCK: 4 }),
      expect.objectContaining({ ID_VARIANTE: 32, COLOR: 'Blanco', ATRIBUTO: '42', STOCK: 0 }),
    ]));
    // La característica "Color" se regenera a partir de las variantes.
    expect(cuerpo.CARACTERISTICAS).toEqual(expect.arrayContaining([
      { NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Cuero sintético' },
      { NOMBRE_ATRIBUTO: 'Color', VALOR_ATRIBUTO: 'Negro, Blanco' },
    ]));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: '¡Actualizado!' })));
    // Sale del modo edición y recarga: el display muestra el nombre actualizado.
    expect(await screen.findAllByText('Guayos Editado ADMIN-TEST')).toBeTruthy();
    expect(screen.queryByText('Guayos Editar ADMIN-TEST')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Editar Producto' })).toBeInTheDocument();
  });

  it('con cambios sin guardar, Volver al inicio pregunta y respeta la decisión', async () => {
    montar();
    await screen.findAllByText('Guayos Editar ADMIN-TEST', {}, { timeout: 3000 });
    await entrarEdicion();
    fireEvent.change(screen.getByLabelText('Nombre del Producto'), { target: { value: 'Guayos Editado ADMIN-TEST' } });

    // Primera decisión: quedarse.
    (Swal.fire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isConfirmed: false });
    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Cambios sin guardar', confirmButtonText: 'Salir sin guardar', cancelButtonText: 'Seguir editando',
    })));
    expect(screen.queryByTestId('sonda-admin')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Guayos Editado ADMIN-TEST')).toBeInTheDocument();

    // Segunda decisión: salir (el mock por defecto confirma).
    fireEvent.click(screen.getByRole('button', { name: 'Volver al inicio' }));
    await waitFor(() => expect(screen.getByTestId('sonda-admin')).toBeInTheDocument());
  });

  it('Cancelar con cambios sin guardar: Swal, vuelve a solo lectura y recarga el producto', async () => {
    montar();
    await screen.findAllByText('Guayos Editar ADMIN-TEST', {}, { timeout: 3000 });
    await entrarEdicion();
    fireEvent.change(screen.getByLabelText('Nombre del Producto'), { target: { value: 'Guayos Editado ADMIN-TEST' } });

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cambios sin guardar' })));
    // El GET original no fue mutado: el display vuelve al valor del servidor.
    expect(await screen.findAllByText('Guayos Editar ADMIN-TEST')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Editar Producto' })).toBeInTheDocument();
    // Recarga: segunda petición del producto.
    await waitFor(() => expect(api.peticiones.filter((p) => p.metodo === 'GET' && p.ruta === '/api/productos/5')).toHaveLength(2));
  });

  it('Eliminar Producto: Swal, DELETE y navegación a /admin', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar Producto' }, { timeout: 3000 }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Eliminar este producto?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({ metodo: 'DELETE', ruta: '/api/productos/5' })));
    expect(Swal.fire).toHaveBeenCalledWith('¡Eliminado!', 'El producto ha sido borrado.', 'success');
    await waitFor(() => expect(screen.getByTestId('sonda-admin')).toBeInTheDocument());
  });

  it('la vista previa muestra la ficha técnica y Ver página real abre /producto/:id', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    montar();
    await screen.findAllByText('Guayos Editar ADMIN-TEST', {}, { timeout: 3000 });

    fireEvent.click(screen.getAllByRole('button', { name: 'Vista previa' })[0]);

    expect(await screen.findByRole('heading', { name: 'Vista previa del producto' })).toBeInTheDocument();
    // Ficha técnica del modal (características ya filtradas).
    const modal = screen.getByRole('heading', { name: 'Vista previa del producto' }).closest('.pp-modal') as HTMLElement;
    expect(within(modal).getByText('Material')).toBeInTheDocument();
    expect(within(modal).getByText('Cuero sintético')).toBeInTheDocument();
    expect(within(modal).queryByText('Color')).not.toBeInTheDocument();

    fireEvent.click(within(modal).getByRole('button', { name: 'Ver página real' }));
    expect(abrir).toHaveBeenCalledWith('/producto/5', '_blank');

    fireEvent.click(within(modal).getByRole('button', { name: 'Cerrar' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Vista previa del producto' })).not.toBeInTheDocument());
    abrir.mockRestore();
  });

  it('error de red al cargar el producto: Swal de error y sin pantalla de edición', async () => {
    // El override gana sobre la fábrica y rompe el fetch → catch del panel.
    server.use(http.get('*/api/productos/:id', () => HttpResponse.error()));
    const { container } = montar();

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Error', 'No se pudo cargar el producto', 'error'));
    expect(container.querySelector('.spinner-border')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Producto' })).not.toBeInTheDocument();
  });
});
