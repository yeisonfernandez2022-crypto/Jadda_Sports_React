import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { Routes, Route, useParams } from 'react-router-dom';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersProductosAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminProductos from '../../../frontend/src/admin/AdminProductos.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Panel de productos contra su código REAL: cajitas de entrada, gestión del
 * catálogo (búsqueda, filtros, stock bajo con refetch, orden, paginación),
 * revisión de productos de vendedor (aprobar/rechazar), eliminación,
 * publicación como JADDA (validaciones, descuentos e imágenes).
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

/** Sonda de navegación: "Editar producto" lleva a /admin/editar/:id. */
const SondaEdicion = () => {
  const { id } = useParams();
  return <div data-testid="sonda-edicion">EDITAR:{id}</div>;
};

const montar = () =>
  renderAdmin(
    <Routes>
      <Route path="/admin/productos" element={<AdminProductos />} />
      <Route path="/admin/editar/:id" element={<SondaEdicion />} />
    </Routes>,
    { ruta: '/admin/productos' },
  );

/** Combobox identificado por una de sus opciones (los selects no tienen label). */
const comboCon = (nombreOpcion: string) => {
  const combo = screen.getAllByRole('combobox').find((c) => within(c).queryByRole('option', { name: nombreOpcion }));
  if (!combo) throw new Error(`No se encontró el combobox con la opción "${nombreOpcion}"`);
  return combo;
};

beforeEach(() => {
  ({ api, handlers } = handlersProductosAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminProductos', () => {
  it('muestra las cajitas de entrada sin abrir el catálogo y el contador del GET', async () => {
    const { container } = montar();

    // Ancla al DATO del GET (contador de productos). Timeout holgado: primer
    // test del archivo (arranque frío de MSW).
    expect(
      await screen.findByText(/Ver todos los productos: los de JADDA SPORTS y los de vendedores \(12\)/, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText('Publicar')).toBeInTheDocument();
    expect(container.querySelector('.ap-tabla')).toBeNull();
  });

  it('gestionar: tabla con estados, vendedor, stock y acciones según cada producto', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));

    expect(await screen.findByText('Sudadera Admin Prod ADMIN-TEST', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText('Balón Admin Prod ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Guayos Admin Prod ADMIN-TEST')).toBeInTheDocument();
    // Badges de estado de publicación (selector .ap-estado: la página 1
    // muestra los IDs 1-10 → 7 productos JADDA con badge).
    expect(screen.getAllByText('Jadda', { selector: '.ap-estado' })).toHaveLength(7);
    expect(screen.getByText('Aprobado')).toBeInTheDocument();
    expect(screen.getAllByText('En revisión', { selector: '.ap-estado' })).toHaveLength(1);
    expect(screen.getByText('Rechazado')).toBeInTheDocument();
    // Vendedor vs. tienda propia (7 filas JADDA en la página 1).
    expect(screen.getAllByText('Tienda: Jadda Sports')).toHaveLength(7);
    expect(screen.getByText('Vendedor: Deportes Andes ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getAllByText('Vendedor: Tienda Norte ADMIN-TEST').length).toBe(2);
    // Stock: agotado / bajo / normal (6 gen de stock 50 en la página 1).
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.getByText('¡Solo quedan 5!')).toBeInTheDocument();
    expect(screen.getAllByText('50 und')).toHaveLength(6);
    // El producto PENDIENTE de vendedor ofrece solo "Ver producto"; el resto editar/eliminar.
    expect(screen.getByTitle('Ver producto')).toBeInTheDocument();
    expect(screen.getAllByTitle('Editar producto')).toHaveLength(9);
    expect(screen.getAllByTitle('Eliminar producto')).toHaveLength(9);
    // Contador y pendientes del botón "Por revisar".
    expect(screen.getByText('12 productos')).toBeInTheDocument();
    expect(screen.getByText('4', { selector: '.ap-btn-revisar-num' })).toBeInTheDocument();
  });

  it('la búsqueda filtra el catálogo por nombre', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));
    await screen.findByText('Sudadera Admin Prod ADMIN-TEST', {}, { timeout: 3000 });

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, marca, categoría o vendedor...'), { target: { value: 'Guayos' } });
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
    expect(screen.queryByText('Sudadera Admin Prod ADMIN-TEST')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar por nombre, marca, categoría o vendedor...'), { target: { value: 'zzz-nada' } });
    expect(await screen.findByText('No se encontraron productos')).toBeInTheDocument();
  });

  it('los filtros de vendedor y estado acotan el listado combinándose', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));
    await screen.findByText('Sudadera Admin Prod ADMIN-TEST', {}, { timeout: 3000 });

    const comboVendedor = comboCon('Tienda Jadda Sports');
    const comboEstado = comboCon('Aprobados');

    fireEvent.change(comboVendedor, { target: { value: 'JADDA' } });
    expect(await screen.findByText('9 productos')).toBeInTheDocument();

    fireEvent.change(comboEstado, { target: { value: 'PENDIENTE' } });
    expect(await screen.findByText('No se encontraron productos')).toBeInTheDocument();

    fireEvent.change(comboVendedor, { target: { value: '' } });
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
    expect(screen.getByText('Guayos Admin Prod ADMIN-TEST')).toBeInTheDocument();
  });

  it('el checkbox de Stock bajo dispara un refetch con stock_bajo=true', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));
    await screen.findByText('Sudadera Admin Prod ADMIN-TEST', {}, { timeout: 3000 });

    fireEvent.click(screen.getByLabelText('Stock bajo'));

    expect(await screen.findByText('2 productos')).toBeInTheDocument();
    expect(screen.getByText('Balón Admin Prod ADMIN-TEST')).toBeInTheDocument();
    expect(screen.queryByText('Sudadera Admin Prod ADMIN-TEST')).not.toBeInTheDocument();
    expect(api.peticiones).toContainEqual(
      expect.objectContaining({ metodo: 'GET', cuerpo: { stock_bajo: 'true', solo_jadda: null } }),
    );
  });

  it('el encabezado Producto ordena asc y desc por NOMBRE', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));
    await screen.findByText('Sudadera Admin Prod ADMIN-TEST', {}, { timeout: 3000 });

    const primerFila = () => screen.getByRole('table').querySelector('tbody tr') as HTMLElement;
    fireEvent.click(screen.getByRole('columnheader', { name: /Producto/ }));
    expect(await within(primerFila()).findByText('Balón Admin Prod ADMIN-TEST')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('columnheader', { name: /Producto/ }));
    expect(await within(primerFila()).findByText('Sudadera Admin Prod ADMIN-TEST')).toBeInTheDocument();
  });

  it('la paginación corta en 10 por página y navega entre páginas', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));
    await screen.findByText('Sudadera Admin Prod ADMIN-TEST', {}, { timeout: 3000 });

    // Dos botones de página (arriba y abajo) y "Anterior" deshabilitado en la 1.
    const botonesPag2 = screen.getAllByRole('button', { name: '2' });
    expect(botonesPag2).toHaveLength(2);
    expect(botonesPag2[0]).not.toBeDisabled();

    fireEvent.click(botonesPag2[0]);
    expect(await screen.findByText('Producto Gen 11 ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Producto Gen 12 ADMIN-TEST')).toBeInTheDocument();
    expect(screen.queryByText('Sudadera Admin Prod ADMIN-TEST')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Anterior/ })[0]);
    expect(await screen.findByText('Sudadera Admin Prod ADMIN-TEST')).toBeInTheDocument();
  });

  it('Ver producto abre el modal de revisión con detalle, descuento y variantes', async () => {
    const { container } = montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));
    fireEvent.click(await screen.findByTitle('Ver producto', {}, { timeout: 3000 }));

    expect(await screen.findByRole('heading', { name: 'Guayos Admin Prod ADMIN-TEST' })).toBeInTheDocument();
    expect(screen.getByText(/Nike · Tienda Norte ADMIN-TEST/)).toBeInTheDocument();
    expect(screen.getByText('-20%')).toBeInTheDocument();
    // Precio original (tabla + modal) y precio final con descuento.
    expect(screen.getAllByText('$220.000').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('$176.000')).toBeInTheDocument();
    // Galería: la imagen de la tabla y la principal del modal, más 2 miniaturas.
    expect(screen.getAllByAltText('Guayos Admin Prod ADMIN-TEST')).toHaveLength(2);
    const miniaturas = container.querySelectorAll('.apv-thumbs .apv-thumb');
    expect(miniaturas).toHaveLength(2);
    fireEvent.click(miniaturas[1]);
    expect(container.querySelector('.apv-img-principal')?.getAttribute('src')).toContain('p2.png');
    // Variantes con color, atributo y stock (agotada la 42).
    expect(screen.getByText(/Talla: 40/)).toBeInTheDocument();
    expect(screen.getByText('12 uds')).toBeInTheDocument();
    expect(screen.getByText(/Talla: 42/)).toBeInTheDocument();
    expect(screen.getAllByText('Agotado').length).toBeGreaterThanOrEqual(1);
    // Descripción y ficha técnica.
    expect(screen.getByText('Guayos de alta tracción para cancha sintética')).toBeInTheDocument();
    expect(screen.getByText('Material')).toBeInTheDocument();
    expect(screen.getByText('Sintético')).toBeInTheDocument();
    // Footer de decisión.
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprobar y publicar' })).toBeInTheDocument();
  });

  it('Aprobar y publicar: POST con confirmación y fila pasa a Aprobado con acciones', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));
    fireEvent.click(await screen.findByTitle('Ver producto', {}, { timeout: 3000 }));
    await screen.findByRole('heading', { name: 'Guayos Admin Prod ADMIN-TEST' });

    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y publicar' }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'question', title: '¿Aprobar producto?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({ metodo: 'POST', ruta: '/api/admin/productos/3/aprobar' })));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: 'Producto aprobado' })));
    // Refetch: la fila 3 ahora está aprobada (badge + acciones de edición).
    expect(await screen.findAllByText('Aprobado')).toHaveLength(2);
    expect(screen.queryByTitle('Ver producto')).not.toBeInTheDocument();
  });

  it('Rechazar cancelado: no emite POST y la fila sigue En revisión', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));
    fireEvent.click(await screen.findByTitle('Ver producto', {}, { timeout: 3000 }));
    await screen.findByRole('heading', { name: 'Guayos Admin Prod ADMIN-TEST' });

    // El mock por defecto resuelve { isConfirmed: true } SIN value → el panel exige motivo.
    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Rechazar producto', input: 'textarea' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Guayos Admin Prod ADMIN-TEST' })).not.toBeInTheDocument());
    expect(api.peticiones.some((p) => p.metodo === 'POST')).toBe(false);
    // El badge de la fila 3 sigue "En revisión" (excluye la option del filtro).
    expect(screen.getAllByText('En revisión', { selector: '.ap-estado' })).toHaveLength(1);
  });

  it('Rechazar con motivo: POST con la observación del Swal y fila Rechazado', async () => {
    (Swal.fire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isConfirmed: true, value: 'No cumple política ADMIN-TEST' });
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));
    fireEvent.click(await screen.findByTitle('Ver producto', {}, { timeout: 3000 }));
    await screen.findByRole('heading', { name: 'Guayos Admin Prod ADMIN-TEST' });

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/admin/productos/3/rechazar', cuerpo: { observacion: 'No cumple política ADMIN-TEST' },
    })));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: 'Producto rechazado' })));
    expect(await screen.findAllByText('Rechazado')).toHaveLength(2);
  });

  it('eliminar un producto propio: Swal, DELETE y fila fuera del listado', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));
    const celda = await screen.findByText('Sudadera Admin Prod ADMIN-TEST', {}, { timeout: 3000 });
    fireEvent.click(within(celda.closest('tr') as HTMLElement).getByTitle('Eliminar producto'));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Eliminar Sudadera Admin Prod ADMIN-TEST?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({ metodo: 'DELETE', ruta: '/api/productos/1' })));
    expect(Swal.fire).toHaveBeenCalledWith('¡Eliminado!', 'El producto ha sido borrado.', 'success');
    expect(await screen.findByText('11 productos')).toBeInTheDocument();
    expect(screen.queryByText('Sudadera Admin Prod ADMIN-TEST')).not.toBeInTheDocument();
  });

  it('editar un producto propio navega a /admin/editar/:id', async () => {
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }));
    fireEvent.click(screen.getByRole('button', { name: /Gestionar productos/ }));
    const celda = await screen.findByText('Sudadera Admin Prod ADMIN-TEST', {}, { timeout: 3000 });
    fireEvent.click(within(celda.closest('tr') as HTMLElement).getByTitle('Editar producto'));

    await waitFor(() => expect(screen.getByTestId('sonda-edicion')).toHaveTextContent('EDITAR:1'));
  });
});

describe('AdminProductos — PublicarForm', () => {
  /** Entra a la vista Publicar y espera los catálogos cargados (opciones visibles). */
  const abrirPublicar = async () => {
    const { container } = montar();
    fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }, { timeout: 3000 }));
    await screen.findByLabelText('Nombre del producto *');
    // Las opciones de categoría solo existen tras el GET → auto-selección lista.
    await screen.findByRole('option', { name: 'Fútbol ADMIN-TEST' });
    return container;
  };

  const enviar = (form: HTMLFormElement) => fireEvent.submit(form);

  it('bloquea el submit con el aviso de faltantes y valida en orden los campos', async () => {
    const container = await abrirPublicar();
    const form = container.querySelector('form') as HTMLFormElement;

    expect(screen.getByText('Debes completar todos los campos obligatorios antes de publicar')).toBeInTheDocument();
    expect(screen.getByText(/Faltan: nombre, precio, descripción, al menos una imagen/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publicar Producto/ })).toBeDisabled();

    enviar(form);
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Campo obligatorio', 'Debes escribir el nombre del producto', 'warning'));

    fireEvent.change(screen.getByLabelText('Nombre del producto *'), { target: { value: 'Sudadera Publicar ADMIN-TEST' } });
    enviar(form);
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Campo obligatorio', 'Debes ingresar un precio válido mayor a 0', 'warning'));

    fireEvent.change(screen.getByLabelText('Precio (COP) *'), { target: { value: '120000' } });
    enviar(form);
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Campo obligatorio', 'Debes escribir una descripción del producto', 'warning'));

    fireEvent.change(screen.getByLabelText('Descripción *'), { target: { value: 'Sudadera térmica de prueba' } });
    enviar(form);
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Imágenes requeridas', 'Sube al menos una imagen del producto', 'warning'));

    fireEvent.change(screen.getByPlaceholderText('o pega una URL de imagen https://...'), { target: { value: 'https://test.local/pub.png' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    enviar(form);
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith('Sin variantes', 'Debes agregar al menos una variante completa (color, tipo y valor)', 'warning'));

    expect(api.peticiones.some((p) => p.metodo === 'POST' && p.ruta === '/api/productos')).toBe(false);
  });

  it('publica el producto con imagen, variante y característica Color automática', async () => {
    const container = await abrirPublicar();

    fireEvent.change(screen.getByLabelText('Nombre del producto *'), { target: { value: 'Sudadera Publicar ADMIN-TEST' } });
    fireEvent.change(screen.getByLabelText('Marca'), { target: { value: 'Jadda' } });
    fireEvent.change(screen.getByLabelText('Precio (COP) *'), { target: { value: '120000' } });
    fireEvent.change(screen.getByLabelText('Descripción *'), { target: { value: 'Sudadera térmica de prueba' } });
    fireEvent.change(screen.getByPlaceholderText('o pega una URL de imagen https://...'), { target: { value: 'https://test.local/pub.png' } });
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    fireEvent.change(screen.getByPlaceholderText('Color (ej: Negro)'), { target: { value: 'Negro' } });
    fireEvent.change(screen.getByPlaceholderText('Valor (ej: 39)'), { target: { value: '40' } });
    fireEvent.change(screen.getByPlaceholderText('Stock'), { target: { value: '10' } });
    fireEvent.change(screen.getByPlaceholderText('Propiedad (ej: Material)'), { target: { value: 'Material' } });
    fireEvent.change(screen.getByPlaceholderText('Valor (ej: Poliéster)'), { target: { value: 'Poliéster' } });

    expect(screen.queryByText(/Debes completar todos los campos/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publicar Producto/ }));

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({ metodo: 'POST', ruta: '/api/productos' })));
    const cuerpo = api.peticiones.find((p) => p.metodo === 'POST' && p.ruta === '/api/productos')?.cuerpo as Record<string, unknown>;
    expect(cuerpo).toMatchObject({ NOMBRE: 'Sudadera Publicar ADMIN-TEST', MARCA: 'Jadda', PRECIO: 120000, ID_CATEGORIA: 1, ID_PROVEEDOR: 10, ID_DESCUENTO: null });
    expect(cuerpo.IMAGENES).toEqual(['https://test.local/pub.png']);
    expect(cuerpo.VARIANTES).toEqual([expect.objectContaining({ COLOR: 'Negro', NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: '40', STOCK: 10 })]);
    expect(cuerpo.CARACTERISTICAS).toEqual(expect.arrayContaining([
      { NOMBRE_ATRIBUTO: 'Material', VALOR_ATRIBUTO: 'Poliéster' },
      { NOMBRE_ATRIBUTO: 'Color', VALOR_ATRIBUTO: 'Negro' },
    ]));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: '¡Producto publicado!' })));
    // onPublicado → vuelve a la vista de gestión con el catálogo.
    expect(await screen.findByText('Balón Admin Prod ADMIN-TEST', {}, { timeout: 3000 })).toBeInTheDocument();
  });

  it('+ Crear nuevo descuento: POST del Swal y selección automática', async () => {
    (Swal.fire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      isConfirmed: true,
      value: { nombre: 'Oferta Diciembre', pct: 20, fin: '2026-12-01' },
    });
    await abrirPublicar();
    const comboDescuento = screen.getByLabelText('Descuento (opcional)');

    fireEvent.change(comboDescuento, { target: { value: '__nuevo__' } });

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/productos/descuentos',
      cuerpo: { DESCRIPCION: 'Oferta Diciembre', PORCENTAJE: 20, FECHA_FIN: '2026-12-01' },
    })));
    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: '¡Descuento creado!' })));
    // Refetch del catálogo de descuentos + auto-selección del nuevo.
    await waitFor(() => expect((within(comboDescuento).getByRole('option', { name: 'Oferta Diciembre (20%)' }) as HTMLOptionElement).selected).toBe(true));
  });
});
