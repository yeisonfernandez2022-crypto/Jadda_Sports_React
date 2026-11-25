import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersProductosAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import EditarProductoAdmin from '../../../frontend/src/admin/EditarProductoAdmin.tsx';

/**
 * EditarProductoAdmin — segunda capa de cobertura.
 *
 * Complementa EditarProductoAdmin.test.tsx con los huecos que faltaban:
 * productos sin datos opcionales, catálogos caídos, galería (clic, teclado e
 * imágenes rotas), edición de todos los campos y filas, guardado con valores
 * por defecto, fallos de PUT/DELETE, guardias beforeunload/popstate y
 * navegación por breadcrumb. Todo contra el código real y MSW.
 */

const { swalFire } = vi.hoisted(() => ({ swalFire: vi.fn() }));

vi.mock('sweetalert2', () => ({
  default: { fire: swalFire },
}));

let api: ApiAdmin;
let handlers: RequestHandler[];

const montar = (ruta = '/admin/editar/5') =>
  renderAdmin(
    <Routes>
      <Route path="/admin/editar" element={<EditarProductoAdmin />} />
      <Route path="/admin/editar/:id" element={<EditarProductoAdmin />} />
      <Route path="/admin" element={<div data-testid="sonda-admin" />} />
      <Route path="/admin/productos" element={<div data-testid="sonda-productos" />} />
    </Routes>,
    { ruta },
  );

const esperarProducto = async (nombre = 'Guayos Editar ADMIN-TEST') => {
  const apariciones = await screen.findAllByText(nombre, {}, { timeout: 3000 });
  expect(apariciones.length).toBeGreaterThanOrEqual(1);
};

const entrarEdicion = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Producto' }, { timeout: 3000 }));
  await screen.findByLabelText('Nombre del Producto');
};

const cuerpoPut = () =>
  api.peticiones.find((p) => p.metodo === 'PUT' && p.ruta === '/api/productos/5')?.cuerpo as Record<string, unknown>;

const avisosCambios = () =>
  swalFire.mock.calls.filter(([config]) =>
    (config as { title?: string })?.title === 'Cambios sin guardar').length;

beforeEach(() => {
  ({ api, handlers } = handlersProductosAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
  swalFire.mockReset().mockResolvedValue({ isConfirmed: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EditarProductoAdmin — carga y datos alternativos', () => {
  it('sin id en la ruta no consulta el producto ni monta el formulario', async () => {
    const { container } = montar('/admin/editar');

    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(container.querySelector('.spinner-border')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Editar Producto' })).not.toBeInTheDocument();
    expect(api.peticiones).toHaveLength(0);
  });

  it('carga un producto sin datos opcionales y muestra los valores por defecto', async () => {
    server.use(
      http.get('*/api/productos/:id/caracteristicas', () => HttpResponse.json({})),
      http.get(/\/api\/productos\/\d+$/, () => HttpResponse.json({
        ID_PRODUCTO: 5, NOMBRE: '', IMAGENES: [], VARIANTES: [],
      })),
    );
    montar();

    await screen.findByRole('heading', { name: 'Editar producto' }, { timeout: 3000 });
    expect(screen.getAllByText('Producto #5').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(8);
    expect(screen.getByText('Sin características')).toBeInTheDocument();
    expect(screen.getByText('Sin imágenes')).toBeInTheDocument();
    expect(screen.getAllByText('$0').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('0 uds')).toBeInTheDocument();
  });

  it('tolera el fallo de los catálogos y deja los huecos de categoría y proveedor', async () => {
    server.use(
      http.get('*/api/productos/categorias', () => HttpResponse.error()),
      http.get('*/api/productos/descuentos', () => HttpResponse.error()),
      http.get('*/api/proveedores', () => HttpResponse.error()),
    );
    montar();

    await esperarProducto();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Ninguno').length).toBeGreaterThanOrEqual(2);
  });

  it('resuelve proveedores con claves en minúsculas y muestra el descuento aplicado', async () => {
    server.use(
      http.get('*/api/proveedores', () => HttpResponse.json([
        { id_proveedor: 10, nombre_proveedor: 'Proveedor Minúsculas ADMIN-TEST' },
      ])),
      http.get('*/api/productos/descuentos', () => HttpResponse.json([
        { ID_DESCUENTO: 9, DESCRIPCION: 'Ofertura ADMIN-TEST', PORCENTAJE: 15 },
      ])),
      http.get(/\/api\/productos\/\d+$/, () => HttpResponse.json({
        ID_PRODUCTO: 5, NOMBRE: 'Guayos Con Descuento ADMIN-TEST', MARCA: '', PRECIO: 200000,
        ID_CATEGORIA: 2, ID_PROVEEDOR: 10, ID_DESCUENTO: 9, DESCRIPCION: '',
        IMAGENES: [{ url: 'https://test.local/a.png' }],
        VARIANTES: [{ ID_VARIANTE: 1, COLOR: '', NOMBRE_ATRIBUTO: 'Suela', ATRIBUTO: '', STOCK: '3' }],
      })),
    );
    montar();

    await esperarProducto('Guayos Con Descuento ADMIN-TEST');
    expect(screen.getByText('Proveedor Minúsculas ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getAllByText('Ofertura ADMIN-TEST (15%)').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('-15%')).toBeInTheDocument();
  });
});

describe('EditarProductoAdmin — galería y vista previa', () => {
  it('recorre la galería con clic y teclado y oculta las imágenes rotas', async () => {
    server.use(http.get(/\/api\/productos\/\d+$/, () => HttpResponse.json({
      ID_PRODUCTO: 5, NOMBRE: 'Guayos Galería ADMIN-TEST', MARCA: 'Nike', PRECIO: 120000,
      ID_CATEGORIA: 1, ID_PROVEEDOR: 10, ID_DESCUENTO: null, DESCRIPCION: 'Galería',
      IMAGENES: [
        { url: 'https://test.local/g1.png' },
        { url: 'https://test.local/g2.png' },
        { url: 'https://test.local/g3.png' },
      ],
      VARIANTES: [],
    })));
    const { container } = montar();

    await esperarProducto('Guayos Galería ADMIN-TEST');
    const thumbs = container.querySelectorAll('.pp-thumb');
    expect(thumbs).toHaveLength(3);

    fireEvent.click(thumbs[1]);
    expect(thumbs[1]).toHaveClass('activa');
    expect(container.querySelector('.ap-preview-img')).toHaveAttribute('src', 'https://test.local/g2.png');

    fireEvent.keyDown(thumbs[2], { key: 'Enter' });
    expect(thumbs[2]).toHaveClass('activa');

    fireEvent.keyDown(thumbs[0], { key: ' ' });
    expect(thumbs[0]).toHaveClass('activa');

    const imagenRota = within(thumbs[1] as HTMLElement).getByAltText('Imagen 2');
    fireEvent.error(imagenRota);
    expect(imagenRota.style.display).toBe('none');
  });

  it('muestra los huecos de la ficha técnica y la vista previa del modo edición', async () => {
    server.use(http.get('*/api/productos/:id/caracteristicas', () => HttpResponse.json([
      { NOMBRE_ATRIBUTO: null, VALOR_ATRIBUTO: null },
    ])));
    montar();

    await esperarProducto();
    const ficha = screen.getByText('Ficha Técnica').closest('.edit-card') as HTMLElement;
    expect(within(ficha).getAllByText('—')).toHaveLength(2);

    await entrarEdicion();
    fireEvent.click(screen.getByRole('button', { name: 'Vista previa del producto' }));

    const modal = (await screen.findByRole('heading', { name: 'Vista previa del producto' })).closest('.pp-modal') as HTMLElement;
    const fichaModal = modal.querySelector('.pp-ficha') as HTMLElement;
    expect(within(fichaModal).getAllByText('—')).toHaveLength(2);
  });

  it('abre y cierra la vista previa con clic interno, teclado, overlay y ✕', async () => {
    const { container } = montar();
    await esperarProducto();
    const abierta = () => screen.queryByRole('heading', { name: 'Vista previa del producto' });

    fireEvent.click(screen.getAllByRole('button', { name: 'Vista previa' })[0]);
    await screen.findByRole('heading', { name: 'Vista previa del producto' });
    fireEvent.click(container.querySelector('.pp-modal') as Element);
    expect(abierta()).toBeInTheDocument();

    fireEvent.keyDown(container.querySelector('.pp-modal') as Element, { key: 'Enter' });
    await waitFor(() => expect(abierta()).not.toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Vista previa' })[1]);
    await screen.findByRole('heading', { name: 'Vista previa del producto' });
    fireEvent.keyDown(container.querySelector('.pp-backdrop') as Element, { key: ' ' });
    await waitFor(() => expect(abierta()).not.toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Vista previa' })[0]);
    await screen.findByRole('heading', { name: 'Vista previa del producto' });
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    await waitFor(() => expect(abierta()).not.toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'Vista previa' })[0]);
    await screen.findByRole('heading', { name: 'Vista previa del producto' });
    fireEvent.click(container.querySelector('.pp-backdrop') as Element);
    await waitFor(() => expect(abierta()).not.toBeInTheDocument());
  });

  it('abre la ficha pública desde los botones Ver página', async () => {
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null);
    montar();
    await esperarProducto();

    const botones = screen.getAllByRole('button', { name: 'Ver página' });
    expect(botones.length).toBeGreaterThanOrEqual(2);
    botones.forEach((boton) => fireEvent.click(boton));

    expect(abrir).toHaveBeenCalledTimes(botones.length);
    expect(abrir).toHaveBeenCalledWith('/producto/5', '_blank');
  });
});

describe('EditarProductoAdmin — edición y guardado', () => {
  it('edita todos los campos, variantes y características y envía el PUT completo', async () => {
    const { container } = montar();
    await esperarProducto();
    await entrarEdicion();

    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Marca Nueva ADMIN-TEST' } });
    fireEvent.change(screen.getByLabelText('Categoría'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Proveedor'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Descuento (opcional)'), { target: { value: '9' } });
    fireEvent.change(container.querySelector('.admin-textarea') as Element, {
      target: { value: 'Descripción editada ADMIN-TEST' },
    });

    const filas = container.querySelectorAll('.variant-row');
    fireEvent.change(within(filas[0] as HTMLElement).getByPlaceholderText('Ej: Negro'), { target: { value: 'Rojo' } });
    fireEvent.change(within(filas[0] as HTMLElement).getByRole('combobox'), { target: { value: 'Peso' } });
    const valor = within(filas[0] as HTMLElement).getByPlaceholderText('Ej: 40, M');
    expect(valor).not.toBeDisabled();
    fireEvent.change(valor, { target: { value: '5 kg' } });
    fireEvent.change(within(filas[0] as HTMLElement).getByRole('spinbutton'), { target: { value: '9' } });

    fireEvent.click(screen.getByRole('button', { name: '+ Agregar variante' }));
    const filasConNueva = container.querySelectorAll('.variant-row');
    expect(filasConNueva).toHaveLength(3);
    fireEvent.click(within(filasConNueva[2] as HTMLElement).getByRole('button', { name: '✕' }));
    expect(container.querySelectorAll('.variant-row')).toHaveLength(2);

    const ficha = screen.getByText('Ficha Técnica').closest('.edit-card') as HTMLElement;
    fireEvent.click(within(ficha).getByRole('button', { name: '+ Agregar característica' }));
    const propiedades = within(ficha).getAllByPlaceholderText('Propiedad');
    const valores = within(ficha).getAllByPlaceholderText('Valor');
    expect(propiedades).toHaveLength(2);
    fireEvent.change(propiedades[1], { target: { value: 'Suela' } });
    fireEvent.change(valores[1], { target: { value: 'Goma' } });
    fireEvent.click(within(ficha).getAllByRole('button', { name: '✕' })[0]);
    expect(within(ficha).getAllByPlaceholderText('Propiedad')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(api.peticiones).toContainEqual(
      expect.objectContaining({ metodo: 'PUT', ruta: '/api/productos/5' }),
    ));
    const cuerpo = cuerpoPut();
    expect(cuerpo).toMatchObject({
      NOMBRE: 'Guayos Editar ADMIN-TEST',
      MARCA: 'Marca Nueva ADMIN-TEST',
      PRECIO: 120000,
      DESCRIPCION: 'Descripción editada ADMIN-TEST',
      ID_CATEGORIA: 2,
      ID_PROVEEDOR: 11,
      ID_DESCUENTO: 9,
      IMAGENES: ['https://test.local/e1.png'],
    });
    expect(cuerpo.VARIANTES).toEqual([
      expect.objectContaining({ COLOR: 'Rojo', NOMBRE_ATRIBUTO: 'Peso', ATRIBUTO: '5 kg', STOCK: 9 }),
      expect.objectContaining({ COLOR: 'Blanco', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '42', STOCK: 0 }),
    ]);
    expect(cuerpo.CARACTERISTICAS).toEqual([
      { NOMBRE_ATRIBUTO: 'Suela', VALOR_ATRIBUTO: 'Goma' },
      { NOMBRE_ATRIBUTO: 'Color', VALOR_ATRIBUTO: 'Rojo, Blanco' },
    ]);
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'success', title: '¡Actualizado!' }),
    ));
  });

  it('guarda con marca Genérico, sin imágenes ni catálogos y sin variantes', async () => {
    server.use(
      http.get('*/api/productos/:id/caracteristicas', () => HttpResponse.json([])),
      http.get(/\/api\/productos\/\d+$/, () => HttpResponse.json({
        ID_PRODUCTO: 5, NOMBRE: 'Producto Mínimo ADMIN-TEST', MARCA: '', PRECIO: 50000,
        ID_CATEGORIA: 1, ID_PROVEEDOR: null, ID_DESCUENTO: null, DESCRIPCION: 'Mínimo',
        IMAGENES: [], VARIANTES: [],
      })),
    );
    const { container } = montar();

    await esperarProducto('Producto Mínimo ADMIN-TEST');
    await entrarEdicion();
    fireEvent.change(screen.getByLabelText('Nombre del Producto'), {
      target: { value: 'Producto Mínimo Editado ADMIN-TEST' },
    });
    fireEvent.change(screen.getByLabelText('Precio de Venta (COP)'), { target: { value: '55000' } });

    const filas = container.querySelectorAll('.variant-row');
    expect(filas).toHaveLength(1);
    fireEvent.click(within(filas[0] as HTMLElement).getByRole('button', { name: '✕' }));
    expect(container.querySelectorAll('.variant-row')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({ metodo: 'PUT' })));
    const cuerpo = cuerpoPut();
    expect(cuerpo.MARCA).toBe('Genérico');
    expect(cuerpo.ID_PROVEEDOR).toBeNull();
    expect(cuerpo.ID_DESCUENTO).toBeNull();
    expect(cuerpo.IMAGENES).toBeUndefined();
    expect(cuerpo.URL_IMAGEN).toBeNull();
    expect(cuerpo.VARIANTES).toEqual([]);
    expect(cuerpo.CARACTERISTICAS).toEqual([]);
  });

  it('cancelar sin cambios sale de edición y recarga el producto sin preguntar', async () => {
    montar();
    await esperarProducto();
    await entrarEdicion();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('button', { name: 'Editar Producto' })).toBeInTheDocument();
    await waitFor(() => expect(api.peticiones.filter(
      (p) => p.metodo === 'GET' && p.ruta === '/api/productos/5',
    )).toHaveLength(2));
    expect(swalFire).not.toHaveBeenCalled();
  });

  it('cancelar con cambios y decisión de seguir editando conserva el formulario', async () => {
    montar();
    await esperarProducto();
    await entrarEdicion();
    fireEvent.change(screen.getByLabelText('Nombre del Producto'), { target: { value: 'Sin guardar ADMIN-TEST' } });

    swalFire.mockResolvedValueOnce({ isConfirmed: false });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(avisosCambios()).toBe(1));
    expect(screen.getByDisplayValue('Sin guardar ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeInTheDocument();
  });

  it('reporta los fallos del PUT y permite reintentar', async () => {
    montar();
    await esperarProducto();
    await entrarEdicion();
    fireEvent.change(screen.getByLabelText('Nombre del Producto'), { target: { value: 'Fallo PUT ADMIN-TEST' } });

    server.use(http.put(/\/api\/productos\/\d+$/, () => HttpResponse.json({ msg: 'Falla PUT ADMIN-TEST' }, { status: 500 })));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error', 'No se pudo actualizar el producto', 'error'));
    expect(screen.getByRole('button', { name: 'Guardar Cambios' })).toBeEnabled();
    expect(screen.getByDisplayValue('Fallo PUT ADMIN-TEST')).toBeInTheDocument();

    server.use(http.put(/\/api\/productos\/\d+$/, () => HttpResponse.error()));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(swalFire.mock.calls.filter(
      (llamada) => llamada[0] === 'Error',
    )).toHaveLength(2));
    expect(screen.getByDisplayValue('Fallo PUT ADMIN-TEST')).toBeInTheDocument();
  });

  it('reporta los fallos al eliminar el producto', async () => {
    montar();
    await esperarProducto();

    server.use(http.delete(/\/api\/productos\/\d+$/, () => HttpResponse.json({ msg: 'No se pudo ADMIN-TEST' }, { status: 500 })));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Producto' }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error', 'No se pudo eliminar el producto.', 'error'));

    server.use(http.delete(/\/api\/productos\/\d+$/, () => HttpResponse.error()));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Producto' }));
    await waitFor(() => expect(swalFire.mock.calls.filter(
      (llamada) => llamada[0] === 'Error',
    )).toHaveLength(2));
    expect(screen.queryByTestId('sonda-admin')).not.toBeInTheDocument();
  });
});

describe('EditarProductoAdmin — guardias y navegación', () => {
  it('beforeunload y popstate solo interrumpen cuando hay cambios', async () => {
    const retroceder = vi.spyOn(History.prototype, 'back').mockImplementation(() => {});
    montar();
    await esperarProducto();

    const sinCambios = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(sinCambios);
    expect(sinCambios.defaultPrevented).toBe(false);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(swalFire).not.toHaveBeenCalled();

    await entrarEdicion();
    fireEvent.change(screen.getByLabelText('Nombre del Producto'), { target: { value: 'Con cambios ADMIN-TEST' } });

    await waitFor(() => {
      const conCambios = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(conCambios);
      expect(conCambios.defaultPrevented).toBe(true);
    });

    swalFire.mockResolvedValueOnce({ isConfirmed: false });
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(avisosCambios()).toBe(1));
    expect(retroceder).not.toHaveBeenCalled();

    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(retroceder).toHaveBeenCalledTimes(1));
    expect(avisosCambios()).toBe(2);

    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(retroceder).toHaveBeenCalledTimes(1);
    expect(avisosCambios()).toBe(2);
  });

  it('navega por el breadcrumb a Productos y al Dashboard', async () => {
    const primera = montar();
    await esperarProducto();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'breadcrumb' })).getByRole('link', { name: 'Productos' }));
    expect(await screen.findByTestId('sonda-productos')).toBeInTheDocument();
    primera.unmount();

    montar();
    await esperarProducto();
    fireEvent.click(within(screen.getByRole('navigation', { name: 'breadcrumb' })).getByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByTestId('sonda-admin')).toBeInTheDocument();
  });
});
