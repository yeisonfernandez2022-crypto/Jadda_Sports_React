import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { toggleFavoritoUI, type FavoritoItem } from '../../../frontend/src/utils/favoritosUI';

/**
 * favoritosUI: toggle compartido de favoritos (Principal y Catálogo). Fetch
 * contra /api/favoritos con toast (mixin) y acceso directo a /favoritos.
 */

const { mockFire, mockClose, mockMixin } = vi.hoisted(() => ({
  mockFire: vi.fn(),
  mockClose: vi.fn(),
  mockMixin: vi.fn(),
}));
vi.mock('sweetalert2', () => ({
  default: { fire: mockFire, close: mockClose, mixin: mockMixin },
}));

const navegarMock = vi.fn();

const fav = (ID: number, ID_FAVORITO: number): FavoritoItem => ({ ID, ID_FAVORITO });

const llamar = (favoritos: FavoritoItem[], setFavoritos = vi.fn(), logueado = true, id = 10) =>
  toggleFavoritoUI({ id, logueado, favoritos, setFavoritos, navigate: navegarMock });

const instalarHandlers = (opciones: { statusPost?: number; msgPost?: string; rechazarDelete?: boolean } = {}) => {
  server.use(
    http.post('*/api/favoritos', async ({ request }) => {
      const b = (await request.json()) as { id_producto: number };
      if (b.id_producto === 999) return HttpResponse.error();
      if (opciones.statusPost) return HttpResponse.json({ msg: opciones.msgPost ?? 'Error al agregar' }, { status: opciones.statusPost });
      return HttpResponse.json({ ok: true });
    }),
    http.get('*/api/favoritos', () =>
      HttpResponse.json([
        { ID: 10, ID_FAVORITO: 77 },
        { ID: 12, ID_FAVORITO: 88 },
      ]),
    ),
    http.delete('*/api/favoritos/:id', ({ params }) => {
      if (opciones.rechazarDelete || String(params.id) === '555') return HttpResponse.error();
      return HttpResponse.json({ ok: true });
    }),
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFire.mockResolvedValue({ isConfirmed: true });
  // El toast (mixin) delega en el fire compartido.
  mockMixin.mockReturnValue({ fire: mockFire });
  instalarHandlers();
});

describe('favoritosUI — sin sesión', () => {
  it('avisa con el Swal de iniciar sesión y no toca el servidor', async () => {
    const setFavoritos = vi.fn();

    await llamar([], setFavoritos, false);

    expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      title: 'INICIA SESIÓN',
      text: 'Debes iniciar sesión para guardar favoritos.',
      icon: 'warning',
    }));
    expect(setFavoritos).not.toHaveBeenCalled();
    expect(mockMixin).not.toHaveBeenCalled();
  });
});

describe('favoritosUI — agregar', () => {
  it('POST, refresca la lista y toast "Agregado a favoritos"', async () => {
    const setFavoritos = vi.fn();

    const promesa = llamar([], setFavoritos);
    // El Toast está mockeado: montamos el DOM que el toast real crearía para
    // que el setTimeout(100) del enlace lo encuentre.
    document.body.innerHTML = '<a href="#" id="jadda-ver-favoritos">Ver mis favoritos</a>';
    await promesa;
    await new Promise((r) => setTimeout(r, 150));

    expect(setFavoritos).toHaveBeenCalledWith([
      { ID: 10, ID_FAVORITO: 77 },
      { ID: 12, ID_FAVORITO: 88 },
    ]);
    expect(mockMixin).toHaveBeenCalledWith(expect.objectContaining({ toast: true, position: 'bottom' }));
    expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success',
      html: expect.stringContaining('Agregado a favoritos'),
    }));
    // El enlace del toast navega a /favoritos al hacer click.
    const enlace = document.getElementById('jadda-ver-favoritos');
    expect(enlace).not.toBeNull();
    enlace!.click();
    expect(navegarMock).toHaveBeenCalledWith('/favoritos');
    expect(mockClose).toHaveBeenCalled();
  });

  it('POST rechazado muestra el msg del backend y no actualiza la lista', async () => {
    instalarHandlers({ statusPost: 400, msgPost: 'Ya está en tus favoritos BELL-TEST' });
    const setFavoritos = vi.fn();

    await llamar([], setFavoritos);

    expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      title: 'Ya está en tus favoritos BELL-TEST',
    }));
    expect(setFavoritos).not.toHaveBeenCalled();
  });

  it('fallo de red en el POST cae en el catch y no revienta', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setFavoritos = vi.fn();

    await llamar([], setFavoritos, true, 999);

    expect(setFavoritos).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('favoritosUI — quitar', () => {
  it('DELETE del ID_FAVORITO y actualizador que filtra el item', async () => {
    const setFavoritos = vi.fn();

    await llamar([fav(10, 77)], setFavoritos);

    await new Promise((r) => setTimeout(r, 150));
    // La eliminación usa un UPDATER: (prev) => prev.filter(...).
    expect(setFavoritos).toHaveBeenCalledTimes(1);
    const actualizador = setFavoritos.mock.calls[0][0] as (prev: FavoritoItem[]) => FavoritoItem[];
    expect(actualizador([{ ID: 10, ID_FAVORITO: 77 }, { ID: 12, ID_FAVORITO: 88 }])).toEqual([{ ID: 12, ID_FAVORITO: 88 }]);
    expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success',
      html: expect.stringContaining('Quitado de favoritos'),
    }));
  });

  it('el DELETE fallido NO actualiza en local (el catch envuelve todo el toggle)', async () => {
    instalarHandlers({ rechazarDelete: true });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setFavoritos = vi.fn();

    // ID_FAVORITO 555 → el handler rechaza: el catch del toggle captura todo.
    await llamar([{ ID: 10, ID_FAVORITO: 555 }], setFavoritos);

    await new Promise((r) => setTimeout(r, 150));
    expect(setFavoritos).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
