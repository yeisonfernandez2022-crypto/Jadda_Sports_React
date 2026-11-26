import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersProductosAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminProductos from '../../../frontend/src/admin/AdminProductos.tsx';

/**
 * AdminProductos — segunda capa de cobertura.
 *
 * Complementa AdminProductos.test.tsx con las ramas que faltaban: parámetros
 * de la URL, fallos de red, filtros y orden restantes, borrado con historial
 * (409), cierre del modal, validaciones de los Swal de creación y publicación
 * con proveedor/descuento. Todo contra el código real y MSW.
 */

const { swalFire, showValidationMessage } = vi.hoisted(() => ({
  swalFire: vi.fn(),
  showValidationMessage: vi.fn(),
}));

vi.mock('sweetalert2', () => ({
  default: { fire: swalFire, showValidationMessage },
}));

let api: ApiAdmin;
let handlers: RequestHandler[];

const montar = (ruta = '/admin/productos') =>
  renderAdmin(
    <Routes>
      <Route path="/admin/productos" element={<AdminProductos />} />
      <Route path="/admin/editar/:id" element={<div data-testid="sonda-edicion" />} />
      <Route path="/admin" element={<div data-testid="sonda-admin" />} />
    </Routes>,
    { ruta },
  );

const comboCon = (nombreOpcion: string) => {
  const combo = screen.getAllByRole('combobox').find((c) => within(c).queryByRole('option', { name: nombreOpcion }));
  if (!combo) throw new Error(`No se encontró el combobox con la opción "${nombreOpcion}"`);
  return combo;
};

const abrirGestionar = async () => {
  const utilidades = montar();
  fireEvent.click(await screen.findByRole('button', { name: /Gestionar productos/ }, { timeout: 3000 }));
  await screen.findByText('Sudadera Admin Prod ADMIN-TEST', {}, { timeout: 3000 });
  return utilidades;
};

const abrirPublicar = async (esperarCategorias = true) => {
  const utilidades = montar();
  fireEvent.click(await screen.findByRole('button', { name: /^Publicar/ }, { timeout: 3000 }));
  await screen.findByLabelText('Nombre del producto *');
  if (esperarCategorias) await screen.findByRole('option', { name: 'Fútbol ADMIN-TEST' });
  return utilidades;
};

const primeraFila = () => screen.getByRole('table').querySelector('tbody tr') as HTMLElement;

type ConfigSwal = {
  title?: string;
  preConfirm?: () => unknown;
  inputValidator?: (valor: string) => string;
  html?: string;
};

const configSwal = (title: string): ConfigSwal => {
  const llamada = swalFire.mock.calls.find(
    ([cfg]) => cfg && typeof cfg === 'object' && (cfg as ConfigSwal).title === title,
  );
  if (!llamada) throw new Error(`Swal no se abrió con el título "${title}"`);
  return llamada[0] as ConfigSwal;
};

const IDS_SWAL = [
  'swal-desc-nombre', 'swal-desc-pct', 'swal-desc-fin',
  'swal-cat-nombre', 'swal-cat-desc',
  'swal-prov-nombre', 'swal-prov-tel', 'swal-prov-email',
];

const crearInput = (id: string, valor: string, type = 'text') => {
  const input = document.createElement('input');
  input.id = id;
  input.type = type;
  input.value = valor;
  document.body.appendChild(input);
  return input;
};

const rellenarPublicacion = (opciones: { stock?: string } = {}) => {
  fireEvent.change(screen.getByLabelText('Nombre del producto *'), { target: { value: 'Producto Extra ADMIN-TEST' } });
  fireEvent.change(screen.getByLabelText('Precio (COP) *'), { target: { value: '80000' } });
  fireEvent.change(screen.getByLabelText('Descripción *'), { target: { value: 'Producto de prueba ADMIN-TEST' } });
  fireEvent.change(screen.getByPlaceholderText('o pega una URL de Cloudinary https://res.cloudinary.com/...'), { target: { value: '/images/productos/subidas/extra.png' } });
  fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
  fireEvent.change(screen.getByPlaceholderText('Color (ej: Negro)'), { target: { value: 'Azul' } });
  fireEvent.change(screen.getByPlaceholderText('Valor (ej: 39)'), { target: { value: '41' } });
  if (opciones.stock !== undefined) {
    fireEvent.change(screen.getByPlaceholderText('Stock'), { target: { value: opciones.stock } });
  }
};

beforeEach(() => {
  ({ api, handlers } = handlersProductosAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
  swalFire.mockReset().mockResolvedValue({ isConfirmed: true });
  showValidationMessage.mockReset();
});

afterEach(() => {
  IDS_SWAL.forEach((id) => document.getElementById(id)?.remove());
  vi.restoreAllMocks();
});

describe('AdminProductos — parámetros, fallos y filtros restantes', () => {
  it('entra directo a gestión y aplica stock_bajo, solo_jadda y estado desde la URL', async () => {
    montar('/admin/productos?stock_bajo=true&solo_jadda=true&estado=PENDIENTE');
    await screen.findByText('No se encontraron productos', {}, { timeout: 3000 });

    expect(screen.getByLabelText('Stock bajo')).toBeChecked();
    expect((comboCon('Tienda Jadda Sports') as HTMLSelectElement).value).toBe('JADDA');
    expect((comboCon('En revisión') as HTMLSelectElement).value).toBe('PENDIENTE');

    // El refetch del checkbox viaja con el vendedor JADDA ya aplicado.
    await waitFor(() => expect(api.peticiones).toContainEqual(
      expect.objectContaining({ metodo: 'GET', cuerpo: { stock_bajo: 'true', solo_jadda: 'true' } }),
    ));
  });

  it('tolera fallos de red al cargar catálogo, categorías y pendientes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(
      http.get('*/api/admin/productos', () => HttpResponse.error()),
      http.get('*/api/productos/categorias', () => HttpResponse.error()),
      http.get('*/api/admin/pendientes', () => HttpResponse.json({}, { status: 500 })),
    );
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Gestionar productos/ }, { timeout: 3000 }));

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(screen.getByText('No se encontraron productos')).toBeInTheDocument();
    expect(screen.getByText('0', { selector: '.ap-btn-revisar-num' })).toBeInTheDocument();
  });

  it('combina filtros de categoría, vendedor concreto y estados', async () => {
    await abrirGestionar();

    fireEvent.change(comboCon('Todas las categorías'), { target: { value: 'Fútbol ADMIN-TEST' } });
    expect(await screen.findByText('9 productos')).toBeInTheDocument();

    fireEvent.change(comboCon('Todas las categorías'), { target: { value: '' } });
    fireEvent.change(comboCon('Todas las tiendas/vendedores'), { target: { value: 'Tienda Norte ADMIN-TEST' } });
    expect(await screen.findByText('2 productos')).toBeInTheDocument();
    expect(screen.getByText('Guayos Admin Prod ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Camiseta Admin Prod ADMIN-TEST')).toBeInTheDocument();

    fireEvent.change(comboCon('Todas las tiendas/vendedores'), { target: { value: '' } });
    fireEvent.change(comboCon('Todos los estados'), { target: { value: 'APROBADO' } });
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
    expect(screen.getByText('Balón Admin Prod ADMIN-TEST')).toBeInTheDocument();

    fireEvent.change(comboCon('Todos los estados'), { target: { value: 'RECHAZADO' } });
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
    expect(screen.getByText('Camiseta Admin Prod ADMIN-TEST')).toBeInTheDocument();

    fireEvent.change(comboCon('Todos los estados'), { target: { value: 'JADDA' } });
    expect(await screen.findByText('9 productos')).toBeInTheDocument();
  });

  it('busca por marca, categoría y vendedor además de por nombre', async () => {
    await abrirGestionar();
    const buscador = screen.getByPlaceholderText('Buscar por nombre, marca, categoría o vendedor...');

    fireEvent.change(buscador, { target: { value: 'Nike' } });
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
    expect(screen.getByText('Guayos Admin Prod ADMIN-TEST')).toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: 'Running' } });
    expect(await screen.findByText('2 productos')).toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: 'Tienda Norte' } });
    expect(await screen.findByText('2 productos')).toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: 'Adidas' } });
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
    expect(screen.getByText('Balón Admin Prod ADMIN-TEST')).toBeInTheDocument();
  });

  it('ordena por precio y stock, y avanza con el botón Siguiente', async () => {
    await abrirGestionar();

    fireEvent.click(screen.getByRole('columnheader', { name: /Precio/ }));
    await waitFor(() => expect(within(primeraFila()).getByText('Producto Gen 5 ADMIN-TEST')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('columnheader', { name: /Precio/ }));
    await waitFor(() => expect(within(primeraFila()).getByText('Guayos Admin Prod ADMIN-TEST')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('columnheader', { name: /Stock/ }));
    await waitFor(() => expect(within(primeraFila()).getByText('Camiseta Admin Prod ADMIN-TEST')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('columnheader', { name: /Stock/ }));
    await waitFor(() => expect(within(primeraFila()).getByText('Producto Gen 5 ADMIN-TEST')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: /Siguiente/ })[0]);
    expect(await screen.findByText('Balón Admin Prod ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Camiseta Admin Prod ADMIN-TEST')).toBeInTheDocument();
  });

  it('vuelve al dashboard y alterna el filtro Por revisar', async () => {
    const { unmount } = await abrirGestionar();
    fireEvent.click(screen.getByRole('button', { name: /Volver al inicio/ }));
    expect(await screen.findByTestId('sonda-admin')).toBeInTheDocument();
    unmount();

    await abrirGestionar();
    fireEvent.click(screen.getByRole('button', { name: /Por revisar/ }));
    expect(await screen.findByText('1 producto')).toBeInTheDocument();
    expect(screen.getByText('Guayos Admin Prod ADMIN-TEST')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Por revisar/ }));
    expect(await screen.findByText('12 productos')).toBeInTheDocument();
  });

  it('usa los campos alternativos y la imagen de reemplazo cuando faltan datos', async () => {
    server.use(http.get('*/api/admin/productos', () => HttpResponse.json([
      { id: 77, nombre: 'Minúsculas ADMIN-TEST', precio: 12345, stock: 0 },
    ])));
    montar();
    fireEvent.click(await screen.findByRole('button', { name: /Gestionar productos/ }, { timeout: 3000 }));

    expect(await screen.findByText('Minúsculas ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('Sin categoría')).toBeInTheDocument();
    expect(screen.getByText('Tienda: Jadda Sports')).toBeInTheDocument();
    expect(screen.getByText('$12.345')).toBeInTheDocument();
    expect(screen.getByText('Agotado')).toBeInTheDocument();

    const imagen = screen.getByAltText('Minúsculas ADMIN-TEST');
    fireEvent.error(imagen);
    expect(imagen.getAttribute('src')).toContain('data:image/svg+xml');
  });
});

describe('AdminProductos — eliminación con historial', () => {
  const filaSudadera = () => screen.getByText('Sudadera Admin Prod ADMIN-TEST').closest('tr') as HTMLElement;

  it('cancela, bloquea pedidos en curso y reporta errores genéricos', async () => {
    await abrirGestionar();

    swalFire.mockResolvedValueOnce({ isConfirmed: false });
    fireEvent.click(within(filaSudadera()).getByTitle('Eliminar producto'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Eliminar Sudadera Admin Prod ADMIN-TEST?' })));
    expect(api.peticiones.some((p) => p.metodo === 'DELETE')).toBe(false);

    server.use(http.delete('*/api/productos/:id', () => HttpResponse.json(
      { error: 'Hay pedidos en curso ADMIN-TEST', enCurso: true }, { status: 409 },
    )));
    fireEvent.click(within(filaSudadera()).getByTitle('Eliminar producto'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning', title: 'No se puede eliminar', text: 'Hay pedidos en curso ADMIN-TEST',
    })));

    server.use(http.delete('*/api/productos/:id', () => HttpResponse.json({ error: 'Falla ADMIN-TEST' }, { status: 500 })));
    fireEvent.click(within(filaSudadera()).getByTitle('Eliminar producto'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error', 'Falla ADMIN-TEST', 'error'));
  });

  it('confirma el borrado suave cuando el producto tiene ventas', async () => {
    const rutas: string[] = [];
    server.use(http.delete('*/api/productos/:id', ({ request }) => {
      const url = new URL(request.url);
      rutas.push(`${url.pathname}${url.search}`);
      if (url.searchParams.get('confirmar') === '1') {
        return HttpResponse.json({ message: 'Archivado ADMIN-TEST' });
      }
      return HttpResponse.json({ requiereConfirmacion: true, error: 'Tiene historial ADMIN-TEST' }, { status: 409 });
    }));
    await abrirGestionar();

    fireEvent.click(within(filaSudadera()).getByTitle('Eliminar producto'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      title: 'Este producto tiene historial de ventas',
      html: expect.stringContaining('Tiene historial ADMIN-TEST'),
    })));
    await waitFor(() => expect(rutas).toContain('/api/productos/1?confirmar=1'));
    expect(swalFire).toHaveBeenCalledWith('¡Eliminado!', 'Archivado ADMIN-TEST', 'success');
  });

  it('respeta la cancelación del borrado suave y reporta el fallo del reintento', async () => {
    const rutas: string[] = [];
    server.use(http.delete('*/api/productos/:id', ({ request }) => {
      const url = new URL(request.url);
      rutas.push(`${url.pathname}${url.search}`);
      return HttpResponse.json({ requiereConfirmacion: true, error: 'Tiene historial ADMIN-TEST' }, { status: 409 });
    }));
    await abrirGestionar();

    swalFire.mockResolvedValueOnce({ isConfirmed: true }).mockResolvedValueOnce({ isConfirmed: false });
    fireEvent.click(within(filaSudadera()).getByTitle('Eliminar producto'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Este producto tiene historial de ventas' })));
    expect(rutas).toHaveLength(1);
    expect(rutas[0]).not.toContain('confirmar=1');

    swalFire.mockResolvedValueOnce({ isConfirmed: true }).mockResolvedValueOnce({ isConfirmed: true });
    server.use(http.delete('*/api/productos/:id', ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('confirmar') === '1') {
        return HttpResponse.json({ error: 'No se pudo ADMIN-TEST' }, { status: 500 });
      }
      return HttpResponse.json({ requiereConfirmacion: true, error: 'Tiene historial ADMIN-TEST' }, { status: 409 });
    }));
    fireEvent.click(within(filaSudadera()).getByTitle('Eliminar producto'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error', 'No se pudo ADMIN-TEST', 'error'));

    swalFire.mockResolvedValueOnce({ isConfirmed: true }).mockResolvedValueOnce({ isConfirmed: true });
    server.use(http.delete('*/api/productos/:id', ({ request }) => {
      const url = new URL(request.url);
      if (url.searchParams.get('confirmar') === '1') {
        return new HttpResponse('sin-json', { status: 500 });
      }
      return HttpResponse.json({ requiereConfirmacion: true, error: 'Tiene historial ADMIN-TEST' }, { status: 409 });
    }));
    fireEvent.click(within(filaSudadera()).getByTitle('Eliminar producto'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error', 'No se pudo eliminar el producto.', 'error'));
  });

  it('usa el mensaje por defecto si la respuesta de borrado no trae JSON', async () => {
    server.use(http.delete('*/api/productos/:id', () => new HttpResponse('sin-json', { status: 200 })));
    await abrirGestionar();

    fireEvent.click(within(filaSudadera()).getByTitle('Eliminar producto'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('¡Eliminado!', 'El producto ha sido borrado.', 'success'));
  });
});

describe('AdminProductos — modal de revisión', () => {
  it('reporta el error al cargar el detalle', async () => {
    server.use(http.get('*/api/admin/productos/:id', () => HttpResponse.json({}, { status: 500 })));
    await abrirGestionar();

    fireEvent.click(screen.getByTitle('Ver producto'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'Error', text: 'No se pudo cargar el producto',
    })));
  });

  it('cierra con overlay, teclado y botón, y sobrevive a la imagen rota', async () => {
    const { container } = await abrirGestionar();
    const abrir = async () => {
      fireEvent.click(screen.getByTitle('Ver producto'));
      await screen.findByRole('heading', { name: 'Guayos Admin Prod ADMIN-TEST' });
    };
    const abierto = () => screen.queryByRole('heading', { name: 'Guayos Admin Prod ADMIN-TEST' });

    await abrir();
    fireEvent.click(container.querySelector('.evidencia-overlay') as Element);
    await waitFor(() => expect(abierto()).not.toBeInTheDocument());

    await abrir();
    fireEvent.keyDown(container.querySelector('.evidencia-overlay') as Element, { key: 'Enter' });
    await waitFor(() => expect(abierto()).not.toBeInTheDocument());

    await abrir();
    fireEvent.click(container.querySelector('.au-modal') as Element);
    expect(abierto()).toBeInTheDocument();

    const principal = container.querySelector('.apv-img-principal') as HTMLImageElement;
    fireEvent.error(principal);
    expect(principal.style.visibility).toBe('hidden');

    // El keydown del modal burbujea al overlay: el espacio cierra el detalle.
    fireEvent.keyDown(container.querySelector('.au-modal') as Element, { key: ' ' });
    await waitFor(() => expect(abierto()).not.toBeInTheDocument());

    await abrir();
    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    await waitFor(() => expect(abierto()).not.toBeInTheDocument());
  });

  it('muestra los estados vacíos del detalle y los valores por defecto', async () => {
    server.use(http.get('*/api/admin/productos/:id', () => HttpResponse.json({
      ID: 3, NOMBRE: 'Guayos Vacíos ADMIN-TEST', MARCA: null, VENDEDOR_NOMBRE: null,
      ESTADO_PUBLICACION: 'PENDIENTE', PRECIO: 50000, DESCRIPCION: '   ',
      IMAGENES: [], VARIANTES: [], CARACTERISTICAS: [],
    })));
    await abrirGestionar();

    fireEvent.click(screen.getByTitle('Ver producto'));
    await screen.findByRole('heading', { name: 'Guayos Vacíos ADMIN-TEST' });

    expect(screen.getByText('Genérico · Vendedor')).toBeInTheDocument();
    expect(screen.getByText('El producto no tiene imágenes adjuntas')).toBeInTheDocument();
    expect(screen.getByText('Sin variantes registradas')).toBeInTheDocument();
    expect(screen.getByText('El vendedor no escribió descripción')).toBeInTheDocument();
    expect(screen.queryByText('Ficha técnica')).not.toBeInTheDocument();
  });

  it('cancela la aprobación, reporta errores y omite el aviso sin cambios', async () => {
    await abrirGestionar();
    const abrir = async () => {
      fireEvent.click(screen.getByTitle('Ver producto'));
      await screen.findByRole('heading', { name: 'Guayos Admin Prod ADMIN-TEST' });
    };

    swalFire.mockResolvedValueOnce({ isConfirmed: false });
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y publicar' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Guayos Admin Prod ADMIN-TEST' })).not.toBeInTheDocument());
    expect(api.peticiones.some((p) => p.metodo === 'POST' && p.ruta.endsWith('/aprobar'))).toBe(false);

    server.use(http.post('*/api/admin/productos/:id/aprobar', () => HttpResponse.json({ msg: 'Falla al aprobar ADMIN-TEST' }, { status: 500 })));
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y publicar' }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'Error', text: 'Falla al aprobar ADMIN-TEST',
    })));

    server.use(http.post('*/api/admin/productos/:id/aprobar', () => HttpResponse.json({ ok: true, sinCambios: true, msg: 'Sin cambios ADMIN-TEST' })));
    await abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Aprobar y publicar' }));
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Guayos Admin Prod ADMIN-TEST' })).not.toBeInTheDocument());
    expect(swalFire).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Producto aprobado' }));
  });

  it('valida el motivo del rechazo dentro del Swal', async () => {
    await abrirGestionar();
    fireEvent.click(screen.getByTitle('Ver producto'));
    await screen.findByRole('heading', { name: 'Guayos Admin Prod ADMIN-TEST' });

    fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    const config = configSwal('Rechazar producto');
    expect(config.inputValidator?.('')).toBe('Escribe el motivo del rechazo');
    expect(config.inputValidator?.('   ')).toBe('Escribe el motivo del rechazo');
    expect(config.inputValidator?.(' Motivo válido ')).toBe('');
  });
});

describe('AdminProductos — PublicarForm ampliado', () => {
  it('exige categoría cuando el catálogo llega vacío', async () => {
    server.use(http.get('*/api/productos/categorias', () => HttpResponse.json([])));
    const { container } = await abrirPublicar(false);
    rellenarPublicacion();

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Campo obligatorio', 'Debes seleccionar una categoría', 'warning'));
  });

  it('publica con proveedor, descuento y marca por defecto, y reporta fallos', async () => {
    const { container } = await abrirPublicar();
    await screen.findByRole('option', { name: 'Proveedura Uno ADMIN-TEST' });
    await screen.findByRole('option', { name: 'Ofertura ADMIN-TEST (15%)' });
    rellenarPublicacion({ stock: '' });

    fireEvent.change(screen.getByLabelText('Proveedor (opcional)'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Descuento (opcional)'), { target: { value: '9' } });

    let cuerpoPost: Record<string, unknown> | undefined;
    server.use(http.post('*/api/productos', async ({ request }) => {
      cuerpoPost = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ msg: 'Duplicado ADMIN-TEST' }, { status: 500 });
    }));
    fireEvent.click(screen.getByRole('button', { name: /Publicar Producto/ }));

    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error al publicar', 'Duplicado ADMIN-TEST', 'error'));
    expect(cuerpoPost).toMatchObject({ MARCA: 'Genérico', ID_PROVEEDOR: 10, ID_DESCUENTO: 9 });
    expect(cuerpoPost?.VARIANTES).toEqual([expect.objectContaining({ COLOR: 'Azul', STOCK: 0 })]);

    swalFire.mockClear();
    server.use(http.post('*/api/productos', () => HttpResponse.error()));
    fireEvent.click(screen.getByRole('button', { name: /Publicar Producto/ }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error al publicar', expect.any(String), 'error'));

    swalFire.mockClear();
    server.use(http.post('*/api/productos', () => new HttpResponse('sin-json', { status: 500 })));
    fireEvent.click(screen.getByRole('button', { name: /Publicar Producto/ }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error al publicar', 'Código de error: 500', 'error'));
  });

  it('gestiona filas de variantes y características, y cambia los catálogos', async () => {
    const { container } = await abrirPublicar();
    await screen.findByRole('option', { name: 'Proveedura Uno ADMIN-TEST' });
    await screen.findByRole('option', { name: 'Ofertura ADMIN-TEST (15%)' });

    fireEvent.change(screen.getByLabelText('Categoría *'), { target: { value: '2' } });
    expect((screen.getByLabelText('Categoría *') as HTMLSelectElement).value).toBe('2');

    fireEvent.change(screen.getByLabelText('Proveedor (opcional)'), { target: { value: '10' } });
    expect((screen.getByLabelText('Proveedor (opcional)') as HTMLSelectElement).value).toBe('10');

    fireEvent.change(screen.getByLabelText('Descuento (opcional)'), { target: { value: '9' } });
    expect((screen.getByLabelText('Descuento (opcional)') as HTMLSelectElement).value).toBe('9');

    fireEvent.click(screen.getByRole('button', { name: /Agregar variante/ }));
    expect(container.querySelectorAll('.ven-variante-row')).toHaveLength(2);
    const selectAtributo = container.querySelectorAll('.ven-variante-row select')[1] as HTMLSelectElement;
    fireEvent.change(selectAtributo, { target: { value: 'Peso' } });
    expect(selectAtributo.value).toBe('Peso');

    const filasVariante = container.querySelectorAll('.ven-variante-row');
    fireEvent.click(filasVariante[1].querySelector('.ven-row-del') as Element);
    expect(container.querySelectorAll('.ven-variante-row')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Agregar característica/ }));
    expect(container.querySelectorAll('.ven-carac-row')).toHaveLength(2);
    const filasCarac = container.querySelectorAll('.ven-carac-row');
    fireEvent.click(filasCarac[1].querySelector('.ven-row-del') as Element);
    expect(container.querySelectorAll('.ven-carac-row')).toHaveLength(1);
  });

  it('valida los formularios internos de descuento, categoría y proveedor', async () => {
    await abrirPublicar();

    fireEvent.change(screen.getByLabelText('Descuento (opcional)'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Crear descuento' })));
    const descuento = configSwal('Crear descuento');
    crearInput('swal-desc-nombre', '');
    crearInput('swal-desc-pct', '20');
    expect(descuento.preConfirm?.()).toBe(false);
    expect(showValidationMessage).toHaveBeenCalledWith('Escribe el nombre del descuento');
    (document.getElementById('swal-desc-nombre') as HTMLInputElement).value = 'Oferta ADMIN-TEST';
    (document.getElementById('swal-desc-pct') as HTMLInputElement).value = '0';
    expect(descuento.preConfirm?.()).toBe(false);
    expect(showValidationMessage).toHaveBeenCalledWith('El porcentaje debe estar entre 1 y 100');
    (document.getElementById('swal-desc-pct') as HTMLInputElement).value = '20';
    expect(descuento.preConfirm?.()).toEqual({ nombre: 'Oferta ADMIN-TEST', pct: 20, fin: '' });

    fireEvent.change(screen.getByLabelText('Categoría *'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Crear categoría' })));
    const categoria = configSwal('Crear categoría');
    crearInput('swal-cat-nombre', 'ab');
    crearInput('swal-cat-desc', '');
    expect(categoria.preConfirm?.()).toBe(false);
    expect(showValidationMessage).toHaveBeenCalledWith('El nombre debe tener entre 3 y 100 caracteres');
    (document.getElementById('swal-cat-nombre') as HTMLInputElement).value = 'Padel ADMIN-TEST';
    (document.getElementById('swal-cat-desc') as HTMLInputElement).value = 'x'.repeat(101);
    expect(categoria.preConfirm?.()).toBe(false);
    expect(showValidationMessage).toHaveBeenCalledWith('La descripción no puede superar 100 caracteres');
    (document.getElementById('swal-cat-desc') as HTMLInputElement).value = 'Nueva categoría';
    expect(categoria.preConfirm?.()).toEqual({ nombre: 'Padel ADMIN-TEST', descripcion: 'Nueva categoría' });

    fireEvent.change(screen.getByLabelText('Proveedor (opcional)'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Crear proveedor' })));
    const proveedor = configSwal('Crear proveedor');
    crearInput('swal-prov-nombre', 'ab');
    crearInput('swal-prov-tel', '');
    crearInput('swal-prov-email', '');
    expect(proveedor.preConfirm?.()).toBe(false);
    expect(showValidationMessage).toHaveBeenCalledWith('El nombre del proveedor debe tener al menos 3 caracteres');
    (document.getElementById('swal-prov-nombre') as HTMLInputElement).value = 'Proveedor ADMIN-TEST';
    (document.getElementById('swal-prov-tel') as HTMLInputElement).value = '1'.repeat(16);
    expect(proveedor.preConfirm?.()).toBe(false);
    expect(showValidationMessage).toHaveBeenCalledWith('El teléfono no puede superar 15 caracteres');
    (document.getElementById('swal-prov-tel') as HTMLInputElement).value = '';
    (document.getElementById('swal-prov-email') as HTMLInputElement).value = 'correo-invalido';
    expect(proveedor.preConfirm?.()).toBe(false);
    expect(showValidationMessage).toHaveBeenCalledWith('El email no tiene un formato válido');
    (document.getElementById('swal-prov-email') as HTMLInputElement).value = 'ventas@proveedor.test';
    expect(proveedor.preConfirm?.()).toEqual({
      nombre: 'Proveedor ADMIN-TEST', telefono: '', email: 'ventas@proveedor.test',
    });
  });

  it('crea categoría y proveedor al vuelo y los deja seleccionados', async () => {
    let categorias = [
      { ID_CATEGORIA: 1, NOMBRE_CATEGORIA: 'Fútbol ADMIN-TEST' },
      { ID_CATEGORIA: 2, NOMBRE_CATEGORIA: 'Running ADMIN-TEST' },
    ];
    let proveedores = [
      { id_proveedor: 20, nombre_proveedor: 'Proveedor Minúsculas ADMIN-TEST' },
    ];
    server.use(
      http.get('*/api/productos/categorias', () => HttpResponse.json(categorias)),
      http.post('*/api/productos/categorias', () => {
        categorias = [...categorias, { ID_CATEGORIA: 3, NOMBRE_CATEGORIA: 'Padel ADMIN-TEST' }];
        return HttpResponse.json({ ID_CATEGORIA: 3 });
      }),
      http.get('*/api/proveedores', () => HttpResponse.json(proveedores)),
      http.post('*/api/proveedores', () => {
        proveedores = [...proveedores, { id_proveedor: 12, nombre_proveedor: 'Proveedor Nuevo ADMIN-TEST' }];
        return HttpResponse.json({ ID_PROVEEDOR: 12 });
      }),
    );
    await abrirPublicar();
    expect(await screen.findByRole('option', { name: 'Proveedor Minúsculas ADMIN-TEST' })).toBeInTheDocument();

    swalFire.mockResolvedValueOnce({ isConfirmed: true, value: { nombre: 'Padel ADMIN-TEST', descripcion: 'Nueva' } });
    fireEvent.change(screen.getByLabelText('Categoría *'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: '¡Categoría creada!' })));
    await waitFor(() => expect((screen.getByLabelText('Categoría *') as HTMLSelectElement).value).toBe('3'));

    swalFire.mockResolvedValueOnce({ isConfirmed: true, value: { nombre: 'Proveedor Nuevo ADMIN-TEST', telefono: '', email: '' } });
    fireEvent.change(screen.getByLabelText('Proveedor (opcional)'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: '¡Proveedor creado!' })));
    await waitFor(() => expect((screen.getByLabelText('Proveedor (opcional)') as HTMLSelectElement).value).toBe('12'));
  });

  it('reporta los errores al crear categoría, proveedor y descuento', async () => {
    server.use(
      http.post('*/api/productos/categorias', () => HttpResponse.json({ msg: 'Categoría falló ADMIN-TEST' }, { status: 400 })),
      http.post('*/api/proveedores', () => HttpResponse.json({ msg: 'Proveedor falló ADMIN-TEST' }, { status: 400 })),
      http.post('*/api/productos/descuentos', () => HttpResponse.json({ error: 'Descuento falló ADMIN-TEST' }, { status: 400 })),
    );
    await abrirPublicar();

    swalFire.mockResolvedValueOnce({ isConfirmed: true, value: { nombre: 'Padel ADMIN-TEST', descripcion: '' } });
    fireEvent.change(screen.getByLabelText('Categoría *'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error', 'Categoría falló ADMIN-TEST', 'error'));

    swalFire.mockResolvedValueOnce({ isConfirmed: true, value: { nombre: 'Proveedor ADMIN-TEST', telefono: '', email: '' } });
    fireEvent.change(screen.getByLabelText('Proveedor (opcional)'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error', 'Proveedor falló ADMIN-TEST', 'error'));

    swalFire.mockResolvedValueOnce({ isConfirmed: true, value: { nombre: 'Oferta ADMIN-TEST', pct: 10, fin: '' } });
    fireEvent.change(screen.getByLabelText('Descuento (opcional)'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error', 'Descuento falló ADMIN-TEST', 'error'));
  });

  it('tolera que fallen las cargas iniciales de catálogos', async () => {
    server.use(
      http.get('*/api/productos/categorias', () => HttpResponse.error()),
      http.get('*/api/proveedores', () => HttpResponse.error()),
      http.get('*/api/productos/descuentos', () => HttpResponse.error()),
    );
    const { container } = await abrirPublicar(false);
    rellenarPublicacion();

    expect(screen.getByLabelText('Categoría *')).toHaveValue('__nuevo__');
    expect(screen.getByLabelText('Proveedor (opcional)')).toHaveValue('');
    expect(screen.getByLabelText('Descuento (opcional)')).toHaveValue('');
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Campo obligatorio', 'Debes seleccionar una categoría', 'warning'));
  });

  it('usa los mensajes por defecto cuando las creaciones responden sin JSON', async () => {
    server.use(
      http.post('*/api/productos/categorias', () => new HttpResponse('sin-json', { status: 500 })),
      http.post('*/api/proveedores', () => new HttpResponse('sin-json', { status: 500 })),
      http.post('*/api/productos/descuentos', () => new HttpResponse('sin-json', { status: 500 })),
    );
    await abrirPublicar();

    swalFire.mockResolvedValueOnce({ isConfirmed: true, value: { nombre: 'Padel ADMIN-TEST', descripcion: '' } });
    fireEvent.change(screen.getByLabelText('Categoría *'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error', 'No se pudo crear la categoría', 'error'));

    swalFire.mockResolvedValueOnce({ isConfirmed: true, value: { nombre: 'Proveedor ADMIN-TEST', telefono: '', email: '' } });
    fireEvent.change(screen.getByLabelText('Proveedor (opcional)'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error', 'No se pudo crear el proveedor', 'error'));

    swalFire.mockResolvedValueOnce({ isConfirmed: true, value: { nombre: 'Oferta ADMIN-TEST', pct: 10, fin: '' } });
    fireEvent.change(screen.getByLabelText('Descuento (opcional)'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith('Error', 'No se pudo crear el descuento', 'error'));
  });

  it('selecciona el descuento creado usando la clave id de la respuesta', async () => {
    const descuentos = [{ ID_DESCUENTO: 9, DESCRIPCION: 'Ofertura ADMIN-TEST', PORCENTAJE: 15, FECHA_FIN: null }];
    server.use(
      http.get('*/api/productos/descuentos', () => HttpResponse.json(descuentos)),
      http.post('*/api/productos/descuentos', () => {
        descuentos.push({ ID_DESCUENTO: 12, DESCRIPCION: 'Oferta id ADMIN-TEST', PORCENTAJE: 25, FECHA_FIN: null });
        return HttpResponse.json({ id: 12 });
      }),
    );
    await abrirPublicar();
    swalFire.mockResolvedValueOnce({ isConfirmed: true, value: { nombre: 'Oferta id ADMIN-TEST', pct: 25, fin: '' } });

    fireEvent.change(screen.getByLabelText('Descuento (opcional)'), { target: { value: '__nuevo__' } });
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: '¡Descuento creado!' })));
    await waitFor(() => expect((screen.getByLabelText('Descuento (opcional)') as HTMLSelectElement).value).toBe('12'));
  });
});
