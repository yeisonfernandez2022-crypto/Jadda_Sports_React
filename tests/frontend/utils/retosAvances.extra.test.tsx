import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { waitFor, fireEvent } from '@testing-library/react';

// Mocks con el mismo patrón de la suite base: la factory NO referencia
// variables externas (evita el TDZ del hoisting) y el test las obtiene por
// import + cast.
vi.mock('axios', () => ({
  default: { get: vi.fn(), delete: vi.fn() },
}));

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn().mockResolvedValue({ isConfirmed: true }),
    showValidationMessage: vi.fn(),
    close: vi.fn(),
  },
}));

import axios from 'axios';
import Swal from 'sweetalert2';
import { verEvidenciasReto, reportarAvanceReto } from '../../../frontend/src/utils/retosAvances';

const fireMock = Swal.fire as unknown as ReturnType<typeof vi.fn>;
const getMock = axios.get as unknown as ReturnType<typeof vi.fn>;
const deleteMock = axios.delete as unknown as ReturnType<typeof vi.fn>;

/** Doble de XMLHttpRequest (igual que la suite base). */
class XhrFalso {
  static ultimo: XhrFalso | null = null;
  open = vi.fn();
  withCredentials = false;
  upload = { onprogress: null as ((e: { loaded: number; total: number; lengthComputable: boolean }) => void) | null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  responseText = '';
  status = 200;
  fd: FormData | null = null;
  send(fd: FormData) {
    this.fd = fd;
    XhrFalso.ultimo = this;
  }
}

const esperaSwal = async (total = 1) => {
  await waitFor(() => expect(fireMock.mock.calls.length).toBeGreaterThanOrEqual(total));
  return fireMock.mock.calls[total - 1][0] as { html: string; didOpen?: () => void; preConfirm?: () => unknown };
};

const montarHtml = (config: { html: string }) => {
  document.body.innerHTML = config.html;
};

const archivo = (nombre: string, tipo: string) => new File(['contenido'], nombre, { type: tipo });

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:url-extra'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
  vi.stubGlobal('XMLHttpRequest', XhrFalso);
});

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  XhrFalso.ultimo = null;
  vi.restoreAllMocks();
});

describe('retosAvances.extra — verEvidenciasReto: unidades y hero por tipo de meta', () => {
  const reto = (META_TIPO: string | null, PROGRESO = 5, META_VALOR = 10) => ({
    ID_RETO_USUARIO: 5, TITULO: 'Reto Extra-Test', META_TIPO, PROGRESO, META_VALOR,
  });

  it('META_TIPO dias: unidad "día"/"días" y hero de calendario', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        { ID_EVIDENCIA: 61, ESTADO: 'pendiente', CANTIDAD: 1, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z' },
        { ID_EVIDENCIA: 62, ESTADO: 'aprobado', CANTIDAD: 2, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:05:00Z' },
      ],
    });
    const promesa = verEvidenciasReto(reto('dias'), vi.fn());
    const config = await esperaSwal();
    await promesa;
    expect(config.html).toContain('+1 día');
    expect(config.html).toContain('+2 días');
    expect(config.html).toContain('5/10 días · 50%');
    // Hero de días (rect + check del calendario).
    expect(config.html).toContain('<rect x="3" y="5" width="18" height="16"');
  });

  it('META_TIPO sesiones: singular y plural en tarjetas', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        { ID_EVIDENCIA: 63, ESTADO: 'pendiente', CANTIDAD: 1, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z' },
        { ID_EVIDENCIA: 64, ESTADO: 'pendiente', CANTIDAD: 4, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:05:00Z' },
      ],
    });
    const promesa = verEvidenciasReto(reto('sesiones'), vi.fn());
    const config = await esperaSwal();
    await promesa;
    expect(config.html).toContain('+1 sesión');
    expect(config.html).toContain('+4 sesiones');
    // Hero de sesiones (círculo + mancuerna ligera).
    expect(config.html).toContain('<circle cx="12" cy="14" r="7"');
  });

  it('META_TIPO pasos usa la meta como etiqueta y hero de pasos', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ ID_EVIDENCIA: 65, ESTADO: 'pendiente', CANTIDAD: 8000, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z' }],
    });
    const promesa = verEvidenciasReto(reto('pasos', 8000, 10000), vi.fn());
    const config = await esperaSwal();
    await promesa;
    expect(config.html).toContain('+8000 pasos');
    expect(config.html).toContain('<path d="M3 12h4l2.5-6 4 12L16 12h5"');
  });

  it('META_TIPO nulo: unidad por defecto "unidades" y hero genérico', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ ID_EVIDENCIA: 66, ESTADO: 'pendiente', CANTIDAD: 7, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z' }],
    });
    const promesa = verEvidenciasReto(reto(null), vi.fn());
    const config = await esperaSwal();
    await promesa;
    expect(config.html).toContain('+7 unidades');
    expect(config.html).toContain('5/10 unidades · 50%');
    // Hero por defecto: las dos mancuernas.
    expect(config.html).toContain('<rect x="4" y="8" width="3" height="8"');
  });
});

describe('retosAvances.extra — estados y material atípicos', () => {
  it('estado desconocido: grupo "Otros", dot por defecto y badge con el estado en mayúsculas', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ ID_EVIDENCIA: 71, ESTADO: 'perdido', CANTIDAD: 2, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z' }],
    });
    const promesa = verEvidenciasReto({ ID_RETO_USUARIO: 5, TITULO: 'Reto Extra-Test', META_TIPO: 'km', PROGRESO: 5, META_VALOR: 10 }, vi.fn());
    const config = await esperaSwal();
    await promesa;
    expect(config.html).toContain('Otros (1)');
    expect(config.html).toContain('#94a3b8');
    expect(config.html).toContain('>PERDIDO<');
    // Sin chips de resumen (ningún estado conocido).
    expect(config.html).not.toContain('En revisión:');
  });

  it('dos videos en RUTAS_EXTRA: chip "1 foto + 2 videos"', async () => {
    getMock.mockResolvedValueOnce({
      data: [{
        ID_EVIDENCIA: 72, ESTADO: 'pendiente', CANTIDAD: 3,
        RUTA: 'https://test.local/f.png',
        RUTAS_EXTRA: JSON.stringify(['https://test.local/v1.mp4', 'https://test.local/v2.webm']),
        FECHA_SUBIDA: '2026-11-15T10:00:00Z',
      }],
    });
    const promesa = verEvidenciasReto({ ID_RETO_USUARIO: 5, TITULO: 'Reto Extra-Test', META_TIPO: 'km', PROGRESO: 5, META_VALOR: 10 }, vi.fn());
    const config = await esperaSwal();
    await promesa;
    expect(config.html).toContain('1 foto + 2 videos');
  });

  it('rechazado y aprobado SIN observación no muestran bloque de motivo', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        { ID_EVIDENCIA: 73, ESTADO: 'rechazado', CANTIDAD: 1, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z', OBSERVACION: null },
        { ID_EVIDENCIA: 74, ESTADO: 'aprobado', CANTIDAD: 1, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:05:00Z', OBSERVACION: null },
      ],
    });
    const promesa = verEvidenciasReto({ ID_RETO_USUARIO: 5, TITULO: 'Reto Extra-Test', META_TIPO: 'km', PROGRESO: 5, META_VALOR: 10 }, vi.fn());
    const config = await esperaSwal();
    await promesa;
    expect(config.html).not.toContain('Ver motivo de la revisión');
    expect(config.html).not.toContain('Comentario del equipo:');
  });

  it('didOpen con el box de motivo ausente: el click del botón no revienta', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ ID_EVIDENCIA: 75, ESTADO: 'rechazado', CANTIDAD: 1, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z', OBSERVACION: 'Sin motivo visible' }],
    });
    const promesa = verEvidenciasReto({ ID_RETO_USUARIO: 5, TITULO: 'Reto Extra-Test', META_TIPO: 'km', PROGRESO: 5, META_VALOR: 10 }, vi.fn());
    const config = await esperaSwal();
    await promesa;
    montarHtml(config);
    // Se elimina el box ANTES de didOpen: el botón queda sin objetivo.
    document.getElementById('reto-motivo-box-75')?.remove();
    config.didOpen?.();
    expect(() => fireEvent.click(document.getElementById('reto-motivo-75') as HTMLElement)).not.toThrow();
  });

  it('fallo del DELETE sin msg en la respuesta usa el texto genérico', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ ID_EVIDENCIA: 76, ESTADO: 'pendiente', CANTIDAD: 1, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z' }],
    });
    deleteMock.mockRejectedValueOnce(new Error('red caída'));
    const promesa = verEvidenciasReto({ ID_RETO_USUARIO: 5, TITULO: 'Reto Extra-Test', META_TIPO: 'km', PROGRESO: 5, META_VALOR: 10 }, vi.fn());
    const config = await esperaSwal();
    await promesa;
    montarHtml(config);
    config.didOpen?.();

    fireEvent.click(document.getElementById('reto-del-ev-76') as HTMLElement);
    await waitFor(() => expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'No se pudo eliminar', text: 'Error al eliminar el avance',
    })));
  });
});

describe('retosAvances.extra — reportarAvanceReto: formularios y subida', () => {
  const abrirFormulario = async (metaTipo: string, restante = 10, indice = 1) => {
    const promesa = reportarAvanceReto(5, restante, metaTipo, vi.fn());
    const config = await esperaSwal(indice);
    montarHtml(config);
    config.didOpen?.();
    return { promesa, config };
  };

  const inputArchivos = () => document.getElementById('archivos-reto') as HTMLInputElement;
  const agregar = (file: File) => {
    const input = inputArchivos();
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
  };

  it('restante 0: el máximo queda en 1 (Math.max)', async () => {
    const { config } = await abrirFormulario('km', 0);
    expect(config.html).toContain('(máx. 1 km)');
  });

  it('panel informativo de dias y de meta desconocida (pasos)', async () => {
    const { config: cfgDias } = await abrirFormulario('dias', 10);
    expect(cfgDias.html).toContain('1 día por avance');

    // Segundo formulario del test: el config de pasos es la llamada 2 de Swal.
    const { config: cfgPasos } = await abrirFormulario('pasos', 10, 2);
    expect(cfgPasos.html).toContain('1 pasos por avance');
  });

  it('archivo de 1.5 MB: chip en MB (formatearMB rama alta)', async () => {
    await abrirFormulario('km', 10);
    const medio = new File(['x'], 'medio.png', { type: 'image/png' });
    Object.defineProperty(medio, 'size', { value: Math.round(1.5 * 1024 * 1024), configurable: true });
    agregar(medio);

    expect(document.querySelector('.ra-preview-size')?.textContent).toBe('1.5 MB');
  });

  it('video con play() rechazado: el catch silencioso lo absorbe', async () => {
    await abrirFormulario('km', 10);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('autoplay'));
    agregar(archivo('clip.mp4', 'video/mp4'));

    expect(document.querySelectorAll('.ra-preview')).toHaveLength(1);
    expect(document.querySelector('.ra-preview-badge')?.textContent).toBe('VIDEO');
  });

  it('input.files nulo (change sin archivos) no revienta', async () => {
    await abrirFormulario('km', 10);
    const input = inputArchivos();
    Object.defineProperty(input, 'files', { value: null, configurable: true });
    expect(() => fireEvent.change(input)).not.toThrow();
    expect(document.querySelectorAll('.ra-preview')).toHaveLength(0);
  });

  it('drop sin dataTransfer (eventos de otros orígenes) no agrega nada', async () => {
    await abrirFormulario('km', 10);
    const drop = document.getElementById('rw-drop') as HTMLElement;
    expect(() => fireEvent.drop(drop, {})).not.toThrow();
    expect(document.querySelectorAll('.ra-preview')).toHaveLength(0);
  });

  it('stepper con input vacío usa 1 como base (Number("" || 1))', async () => {
    await abrirFormulario('km', 10);
    const input = document.getElementById('cantidad-reto') as HTMLInputElement;
    input.value = '';
    fireEvent.click(document.getElementById('rw-plus') as HTMLElement);
    expect(input.value).toBe('2');
  });

  it('preConfirm con cantidad "0" inválida muestra el rango', async () => {
    const { config } = await abrirFormulario('km', 10);
    agregar(archivo('foto.png', 'image/png'));
    (document.getElementById('cantidad-reto') as HTMLInputElement).value = '0';
    expect(config.preConfirm?.()).toBe(false);
    expect(Swal.showValidationMessage as unknown as ReturnType<typeof vi.fn>)
      .toHaveBeenCalledWith('El avance debe ser entre 1 y 10 km');
  });

  it('subida de 2 archivos: texto plural y progreso ignorado si no es computable', async () => {
    // El html de la subida se interpola AL MOMENTO del segundo fire, así que
    // el form debe resolver a mano DESPUÉS de agregar los archivos (resolver
    // diferido): así lista.length ya es 2 cuando se construye el texto.
    let resolverForm!: (v: unknown) => void;
    fireMock.mockImplementationOnce(() => new Promise((res) => { resolverForm = res; }));
    const { promesa, config } = await abrirFormulario('km', 10);
    agregar(archivo('f1.png', 'image/png'));
    agregar(archivo('f2.png', 'image/png'));

    // preConfirm con cantidad válida devuelve la cantidad (camino feliz).
    (document.getElementById('cantidad-reto') as HTMLInputElement).value = '2';
    const valor = config.preConfirm?.();
    expect(valor).toBe(2);
    resolverForm({ isConfirmed: true, value: valor });
    await promesa;

    const subida = fireMock.mock.calls[1][0] as { html: string; didOpen?: () => void };
    expect(subida.html).toContain('mientras se suben 2 archivos');
    montarHtml(subida);
    subida.didOpen?.();

    const xhr = XhrFalso.ultimo as XhrFalso;
    expect(xhr.fd?.get('cantidad')).toBe('2');
    expect(xhr.fd?.getAll('materiales')).toHaveLength(2);
    // Evento no computable: la barra NO se actualiza.
    xhr.upload.onprogress?.({ loaded: 10, total: 100, lengthComputable: false });
    expect(document.getElementById('rw-prog-pct')?.textContent).toBe('0%');

    // Éxito sin msg del servidor → texto por defecto.
    xhr.responseText = JSON.stringify({});
    xhr.status = 201;
    xhr.onload?.();
    await waitFor(() => expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success',
      title: 'Avance en revisión',
      text: 'Deja que nuestros asesores revisen el material para aprobar el avance. Puede tardar hasta 24 horas en ser revisado.',
    })));
  });

  it('subida rechazada sin msg en el JSON usa "Error al reportar"', async () => {
    fireMock.mockResolvedValueOnce({ value: 1, isConfirmed: true });
    const { promesa, config } = await abrirFormulario('km', 10);
    agregar(archivo('foto.png', 'image/png'));
    void config.preConfirm?.();
    await promesa;

    const subida = fireMock.mock.calls[1][0] as { didOpen?: () => void };
    subida.didOpen?.();
    const xhr = XhrFalso.ultimo as XhrFalso;
    xhr.responseText = JSON.stringify({});
    xhr.status = 500;
    xhr.onload?.();
    await waitFor(() => expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', text: 'Error al reportar',
    })));
  });
});
