import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import ModalBanners, { type Banner } from '../../../frontend/src/components/ModalBanners';

/**
 * ModalBanners: CRUD completo del carrusel desde la tienda.
 *
 * Se mockean:
 *  - fetch/MSW para /api/banners y /api/productos/imagenes.
 *  - sweetalert2 para resolver confirmaciones y capturar avisos.
 *  - Image para controlar naturalWidth/Height sin descargar archivos.
 */

const { swalFire } = vi.hoisted(() => ({ swalFire: vi.fn() }));

vi.mock('sweetalert2', () => ({
  default: { fire: swalFire },
}));

type Peticion = { metodo: string; ruta: string; cuerpo?: Record<string, unknown> };

const peticiones: Peticion[] = [];
let getBanners = 0;

const banner = (id: number, extra: Partial<Banner> = {}): Banner => ({
  ID_BANNER: id,
  IMAGEN: `https://cdn.test/banner-${id}.png`,
  TEXTO_ALT: `Banner ${id}`,
  ORDEN: id,
  ACTIVO: 1,
  ...extra,
});

const handlersBase = (banners: Banner[]) => [
  http.get('*/api/banners/admin', () => {
    getBanners += 1;
    return HttpResponse.json(banners);
  }),
  http.post('*/api/banners', async ({ request }) => {
    peticiones.push({ metodo: 'POST', ruta: '/api/banners', cuerpo: (await request.json()) as Record<string, unknown> });
    return HttpResponse.json({ ok: true, msg: 'Banner creado' });
  }),
  http.put('*/api/banners/:id', async ({ request, params }) => {
    peticiones.push({
      metodo: 'PUT',
      ruta: `/api/banners/${params.id}`,
      cuerpo: (await request.json()) as Record<string, unknown>,
    });
    return HttpResponse.json({ ok: true, msg: 'Banner actualizado' });
  }),
  http.delete('*/api/banners/:id', ({ params }) => {
    peticiones.push({ metodo: 'DELETE', ruta: `/api/banners/${params.id}` });
    return HttpResponse.json({ ok: true, msg: 'Banner eliminado' });
  }),
  http.post('*/api/productos/imagenes', async ({ request }) => {
    peticiones.push({
      metodo: 'POST',
      ruta: '/api/productos/imagenes',
      cuerpo: (await request.json()) as Record<string, unknown>,
    });
    return HttpResponse.json({ urls: ['https://cdn.test/subida.png'] });
  }),
];

// --- Image falsa: el componente mide con new Image().naturalWidth/Height ---
let medidas: { ancho: number; alto: number } | null = { ancho: 1757, alto: 432 };

class ImagenFalsa {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  naturalWidth = 0;
  naturalHeight = 0;

  set src(_url: string) {
    const actuales = medidas;
    if (actuales) {
      this.naturalWidth = actuales.ancho;
      this.naturalHeight = actuales.alto;
      queueMicrotask(() => this.onload?.());
    } else {
      queueMicrotask(() => this.onerror?.());
    }
  }
}

const montar = () => {
  const onCerrar = vi.fn();
  const utilidades = render(<ModalBanners onCerrar={onCerrar} />);
  return { ...utilidades, onCerrar };
};

const esperarLista = async () => {
  await waitFor(() => expect(screen.queryByText('Cargando banners...')).not.toBeInTheDocument());
};

beforeEach(() => {
  peticiones.length = 0;
  getBanners = 0;
  medidas = { ancho: 1757, alto: 432 };
  swalFire.mockReset().mockResolvedValue({ isConfirmed: true });
  vi.stubGlobal('Image', ImagenFalsa);
});

describe('ModalBanners — listado', () => {
  it('carga y muestra los banners con sus acciones', async () => {
    server.use(...handlersBase([banner(1), banner(2, { ACTIVO: 0, TEXTO_ALT: '' })]));
    const { container } = montar();
    await esperarLista();

    expect(screen.getByText('Banners de la portada')).toBeInTheDocument();
    expect(screen.getByText('2 banners en el carrusel de la tienda')).toBeInTheDocument();
    expect(screen.getByAltText('Banner 1')).toBeInTheDocument();
    expect(screen.getByAltText('Banner 2')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByLabelText('Ocultar de la tienda')).toBeInTheDocument();
    expect(screen.getByLabelText('Mostrar en la tienda')).toBeInTheDocument();
    expect(container.querySelectorAll('.mbn-fila')).toHaveLength(2);
  });

  it('muestra el estado vacío', async () => {
    server.use(...handlersBase([]));
    montar();

    expect(await screen.findByText(/No hay banners registrados/)).toBeInTheDocument();
    expect(screen.getByText('0 banners en el carrusel de la tienda')).toBeInTheDocument();
  });

  it('avisa cuando la carga responde error o falla la red', async () => {
    server.use(http.get('*/api/banners/admin', () => HttpResponse.json({ msg: 'Sin permiso' }, { status: 403 })));
    montar();
    await waitFor(() =>
      expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'Sin permiso' })),
    );

    swalFire.mockClear();
    server.use(http.get('*/api/banners/admin', () => HttpResponse.error()));
    montar();
    await waitFor(() =>
      expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error', title: 'Error al cargar los banners' })),
    );
  });

  it('cierra con Escape, overlay y botón, pero no al hacer clic dentro', async () => {
    server.use(...handlersBase([banner(1)]));
    const { container, onCerrar } = montar();
    await esperarLista();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(1);

    fireEvent.click(container.querySelector('.mbn-overlay') as Element);
    expect(onCerrar).toHaveBeenCalledTimes(2);

    fireEvent.click(container.querySelector('.mbn-modal') as Element);
    expect(onCerrar).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(onCerrar).toHaveBeenCalledTimes(3);
  });
});

describe('ModalBanners — alta y edición', () => {
  it('valida imagen y orden antes de crear, y envía el POST correcto', async () => {
    server.use(...handlersBase([banner(1)]));
    montar();
    await esperarLista();

    fireEvent.click(screen.getByRole('button', { name: /Agregar banner/ }));
    expect(screen.getByText('Nuevo banner')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Crear banner' }));
    await waitFor(() =>
      expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Falta la imagen' })),
    );

    fireEvent.change(screen.getByLabelText(/Imagen/), { target: { value: 'https://cdn.test/nuevo.png' } });
    fireEvent.change(screen.getByLabelText(/Orden/), { target: { value: '-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear banner' }));
    await waitFor(() =>
      expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ title: 'Orden inválido' })),
    );

    fireEvent.change(screen.getByLabelText(/Orden/), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear banner' }));

    await waitFor(() =>
      expect(peticiones).toContainEqual(
        expect.objectContaining({
          metodo: 'POST',
          ruta: '/api/banners',
          cuerpo: expect.objectContaining({
            IMAGEN: 'https://cdn.test/nuevo.png',
            ORDEN: 5,
            ACTIVO: 1,
          }),
        }),
      ),
    );
    await waitFor(() => expect(screen.getByText('Banners de la portada')).toBeInTheDocument());
    expect(getBanners).toBeGreaterThanOrEqual(2);
  });

  it('edita un banner existente y envía el PUT con los cambios', async () => {
    server.use(...handlersBase([banner(1)]));
    montar();
    await esperarLista();

    fireEvent.click(screen.getByLabelText('Editar banner'));
    expect(await screen.findByText('Editar banner')).toBeInTheDocument();
    expect((screen.getByLabelText(/Imagen/) as HTMLInputElement).value).toBe('https://cdn.test/banner-1.png');

    fireEvent.change(screen.getByLabelText(/Texto alternativo/), { target: { value: 'Alt nuevo' } });
    fireEvent.change(screen.getByLabelText(/Orden/), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() =>
      expect(peticiones).toContainEqual(
        expect.objectContaining({
          metodo: 'PUT',
          ruta: '/api/banners/1',
          cuerpo: expect.objectContaining({ TEXTO_ALT: 'Alt nuevo', ORDEN: 9 }),
        }),
      ),
    );
  });

  it('muestra el veredicto de medidas al salir del campo de imagen', async () => {
    server.use(...handlersBase([]));
    montar();
    await esperarLista();
    fireEvent.click(screen.getByRole('button', { name: /Agregar banner/ }));

    const imagen = screen.getByLabelText(/Imagen/);
    fireEvent.change(imagen, { target: { value: 'https://cdn.test/ok.png' } });
    fireEvent.blur(imagen);
    expect(await screen.findByText(/Medidas detectadas: 1757×432/)).toBeInTheDocument();
    expect(screen.getByText(/apta para el carrusel/)).toBeInTheDocument();

    medidas = { ancho: 500, alto: 500 };
    fireEvent.change(imagen, { target: { value: 'https://cdn.test/mal.png' } });
    fireEvent.blur(imagen);
    expect(await screen.findByText(/Medidas detectadas: 500×500/)).toBeInTheDocument();
    expect(screen.getByText(/no cumple la proporción/)).toBeInTheDocument();

    medidas = null;
    fireEvent.change(imagen, { target: { value: 'https://cdn.test/rota.png' } });
    fireEvent.blur(imagen);
    await waitFor(() => expect(screen.queryByText(/Medidas detectadas/)).not.toBeInTheDocument());
  });

  it('sube un archivo, guarda la URL devuelta y avisa si falla', async () => {
    server.use(...handlersBase([]));
    montar();
    await esperarLista();
    fireEvent.click(screen.getByRole('button', { name: /Agregar banner/ }));

    const archivo = new File(['pixel'], 'banner.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo] } });

    await waitFor(() =>
      expect((screen.getByLabelText(/Imagen/) as HTMLInputElement).value).toBe('https://cdn.test/subida.png'),
    );
    expect(peticiones).toContainEqual(
      expect.objectContaining({ metodo: 'POST', ruta: '/api/productos/imagenes' }),
    );

    swalFire.mockClear();
    server.use(http.post('*/api/productos/imagenes', () => HttpResponse.json({ error: 'Formato no válido' }, { status: 400 })));
    fireEvent.change(input, { target: { files: [archivo] } });
    await waitFor(() =>
      expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'Formato no válido' })),
    );
  });
});

describe('ModalBanners — visibilidad y borrado', () => {
  it('alterna la visibilidad y recarga la lista', async () => {
    server.use(...handlersBase([banner(1)]));
    montar();
    await esperarLista();

    fireEvent.click(screen.getByLabelText('Ocultar de la tienda'));
    await waitFor(() =>
      expect(peticiones).toContainEqual(
        expect.objectContaining({ metodo: 'PUT', ruta: '/api/banners/1', cuerpo: expect.objectContaining({ ACTIVO: 0 }) }),
      ),
    );
    await waitFor(() => expect(getBanners).toBeGreaterThanOrEqual(2));
  });

  it('avisa si no se puede cambiar la visibilidad', async () => {
    server.use(...handlersBase([banner(1)]));
    server.use(http.put('*/api/banners/:id', () => HttpResponse.json({ msg: 'No permitido' }, { status: 400 })));
    montar();
    await esperarLista();

    fireEvent.click(screen.getByLabelText('Ocultar de la tienda'));
    await waitFor(() =>
      expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'No permitido' })),
    );

    swalFire.mockClear();
    server.use(http.put('*/api/banners/:id', () => HttpResponse.error()));
    fireEvent.click(screen.getByLabelText('Ocultar de la tienda'));
    await waitFor(() =>
      expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error', title: 'Error al cambiar la visibilidad' })),
    );
  });

  it('elimina solo tras confirmar y avisa de errores', async () => {
    server.use(...handlersBase([banner(1)]));
    montar();
    await esperarLista();

    swalFire.mockResolvedValueOnce({ isConfirmed: false });
    fireEvent.click(screen.getByLabelText('Eliminar banner'));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'question' })));
    expect(peticiones.some((p) => p.metodo === 'DELETE')).toBe(false);

    swalFire.mockResolvedValueOnce({ isConfirmed: true });
    fireEvent.click(screen.getByLabelText('Eliminar banner'));
    await waitFor(() =>
      expect(peticiones).toContainEqual(expect.objectContaining({ metodo: 'DELETE', ruta: '/api/banners/1' })),
    );

    swalFire.mockClear();
    swalFire.mockResolvedValueOnce({ isConfirmed: true });
    server.use(http.delete('*/api/banners/:id', () => HttpResponse.json({ msg: 'No se pudo' }, { status: 500 })));
    fireEvent.click(screen.getByLabelText('Eliminar banner'));
    await waitFor(() =>
      expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'No se pudo' })),
    );

    swalFire.mockClear();
    swalFire.mockResolvedValueOnce({ isConfirmed: true });
    server.use(http.delete('*/api/banners/:id', () => HttpResponse.error()));
    fireEvent.click(screen.getByLabelText('Eliminar banner'));
    await waitFor(() =>
      expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'error', title: 'Error al eliminar el banner' })),
    );
  });
});
