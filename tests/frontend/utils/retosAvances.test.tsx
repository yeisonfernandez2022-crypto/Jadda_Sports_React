import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { waitFor, fireEvent } from '@testing-library/react';

// Mock de axios: verEvidenciasReto (GET/DELETE) y reportarAvanceReto no usan axios
// en la subida (XHR), así que el mock de get/delete basta.
vi.mock('axios', () => ({
  default: { get: vi.fn(), delete: vi.fn() },
}));

// Mock de Swal: captura la configuración (html + didOpen + preConfirm) SIN
// renderizarla; las suites inyectan el html en document.body y llaman didOpen
// a mano para ejercitar la lógica DOM real del modal.
vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn().mockResolvedValue({ isConfirmed: true }),
    showValidationMessage: vi.fn(),
    close: vi.fn(),
  },
}));

import axios from 'axios';
import Swal from 'sweetalert2';
import {
  TIPOS, tipoDe, esMetaAcumulable, esVideoUrlReto,
  verEvidenciasReto, reportarAvanceReto,
} from '../../../frontend/src/utils/retosAvances';

const fireMock = Swal.fire as unknown as ReturnType<typeof vi.fn>;
const showValidation = Swal.showValidationMessage as unknown as ReturnType<typeof vi.fn>;
const getMock = axios.get as unknown as ReturnType<typeof vi.fn>;
const deleteMock = axios.delete as unknown as ReturnType<typeof vi.fn>;

/** Doble de XMLHttpRequest: captura el send y permite disparar onprogress/onload. */
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

/** Espera a que el flujo asíncrono dispare el primer Swal.fire. */
const esperaSwal = async (total = 1) => {
  await waitFor(() => expect(fireMock.mock.calls.length).toBeGreaterThanOrEqual(total));
  return fireMock.mock.calls[total - 1][0] as { html: string; didOpen?: () => void; preConfirm?: () => unknown };
};

/** Inyecta el html del Swal en el body (así el didOpen encuentra los nodos). */
const montarHtml = (config: { html: string }) => {
  document.body.innerHTML = config.html;
};

beforeAll(() => {
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:url-mock'), configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true });
  vi.stubGlobal('XMLHttpRequest', XhrFalso);
  // jsdom no implementa media: play() devolvería undefined y el código llama
  // vid.play().catch(...) → shim de entorno (como matchMedia/ResizeObserver).
  HTMLMediaElement.prototype.play = vi.fn(() => Promise.resolve());
});

beforeEach(() => {
  vi.clearAllMocks();
  deleteMock.mockResolvedValue({ data: { msg: 'ok ADMIN-TEST' } });
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
  XhrFalso.ultimo = null;
});

describe('retosAvances — helpers puros', () => {
  it('TIPOS y tipoDe resuelven icono/clase/etiqueta con fallback tipo-otro', () => {
    expect(Object.keys(TIPOS)).toEqual(['sesiones', 'km', 'dias', 'reps', 'pasos']);
    expect(tipoDe('km').etiqueta).toBe('Kilómetros');
    expect(tipoDe('reps').clase).toBe('tipo-reps');
    const otro = tipoDe('salto');
    expect(otro.clase).toBe('tipo-otro');
    expect(otro.etiqueta).toBe('salto');
  });

  it('esMetaAcumulable solo acepta km y reps (insensible a mayúsculas)', () => {
    expect(esMetaAcumulable('km')).toBe(true);
    expect(esMetaAcumulable('REPS')).toBe(true);
    expect(esMetaAcumulable('sesiones')).toBe(false);
    expect(esMetaAcumulable('dias')).toBe(false);
    expect(esMetaAcumulable('')).toBe(false);
  });

  it('esVideoUrlReto acepta mp4/webm/mov (con query) y rechaza fotos', () => {
    expect(esVideoUrlReto('https://test.local/a.mp4')).toBe(true);
    expect(esVideoUrlReto('https://test.local/a.WEBM?token=1')).toBe(true);
    expect(esVideoUrlReto('https://test.local/a.MOV')).toBe(true);
    expect(esVideoUrlReto('https://test.local/a.png')).toBe(false);
    expect(esVideoUrlReto('https://test.local/a.mp4.png')).toBe(false);
  });
});

describe('retosAvances — verEvidenciasReto', () => {
  const reto = { ID_RETO_USUARIO: 5, TITULO: 'Reto Km Nav-Test', META_TIPO: 'km', PROGRESO: 30, META_VALOR: 100 };
  const alCambiar = vi.fn();

  it('error del GET: Swal de error y sin modal', async () => {
    getMock.mockRejectedValueOnce(new Error('red caída'));
    const promesa = verEvidenciasReto(reto, alCambiar);
    await esperaSwal();
    await promesa;
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'Error', text: 'No se pudieron cargar tus avances',
    }));
    expect(fireMock.mock.calls).toHaveLength(1);
  });

  it('sin evidencias: Swal informativo "Sin avances enviados"', async () => {
    getMock.mockResolvedValueOnce({ data: [] });
    const promesa = verEvidenciasReto(reto, alCambiar);
    await esperaSwal();
    await promesa;
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'info', title: 'Sin avances enviados', text: 'Aún no has reportado avances en este reto.',
    }));
  });

  it('con evidencias: hero con progreso, chips por estado y tarjetas agrupadas', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        { ID_EVIDENCIA: 11, ESTADO: 'pendiente', CANTIDAD: 15, RUTA: 'https://test.local/f1.png', RUTAS_EXTRA: JSON.stringify(['https://test.local/f2.png', 'https://test.local/v1.mp4']), FECHA_SUBIDA: '2026-11-15T10:00:00Z', OBSERVACION: null },
        { ID_EVIDENCIA: 12, ESTADO: 'pendiente', CANTIDAD: 1, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T11:00:00Z', OBSERVACION: null },
        { ID_EVIDENCIA: 13, ESTADO: 'aprobado', CANTIDAD: 20, RUTA: 'https://test.local/f3.png', RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-14T09:00:00Z', OBSERVACION: 'Material claro ADMIN-TEST' },
        { ID_EVIDENCIA: 14, ESTADO: 'rechazado', CANTIDAD: 5, RUTA: '', RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-13T09:00:00Z', OBSERVACION: 'La captura está editada' },
      ],
    });
    const promesa = verEvidenciasReto(reto, alCambiar);
    const config = await esperaSwal();
    await promesa;

    expect(config.html).toContain('Mis avances enviados');
    expect(config.html).toContain('Reto Km Nav-Test');
    // Hero: 30/100 km con 30%.
    expect(config.html).toContain('30/100 km · 30%');
    expect(config.html).toContain('width:30%');
    // Chips de resumen solo de estados presentes, con conteos.
    expect(config.html).toContain('En revisión: 2');
    expect(config.html).toContain('Aprobados: 1');
    expect(config.html).toContain('Rechazados: 1');
    // Grupos en ORDEN pendiente → aprobado → rechazado.
    expect(config.html.indexOf('En revisión (2)')).toBeLessThan(config.html.indexOf('Aprobados (1)'));
    expect(config.html.indexOf('Aprobados (1)')).toBeLessThan(config.html.indexOf('Rechazados (1)'));
    // Cantidades con unidad: +15 km y +1 km (singular km).
    expect(config.html).toContain('+15 km');
    expect(config.html).toContain('+1 km');
    // Material: 2 fotos + 1 video en la primera tarjeta; "Sin material" en las otras.
    expect(config.html).toContain('2 fotos + 1 video');
    expect(config.html).toContain('Sin material');
    expect(config.html).toContain('Este avance no tiene material adjunto');
    // Los pendientes ofrecen eliminar el avance.
    expect(config.html).toContain('id="reto-del-ev-11"');
    expect(config.html).toContain('id="reto-del-ev-12"');
    // El rechazado muestra motivo colapsable; el aprobado comentario directo
    // (el texto vive partido por el <strong>).
    expect(config.html).toContain('Ver motivo de la revisión');
    expect(config.html).toContain('Motivo del rechazo:');
    expect(config.html).toContain('La captura está editada');
    expect(config.html).toContain('Comentario del equipo:');
    expect(config.html).toContain('Material claro ADMIN-TEST');
    // Previews: imágenes + un video.
    expect(config.html).toContain('<img src="https://test.local/f1.png"');
    expect(config.html).toContain('<video src="https://test.local/v1.mp4"');
  });

  it('RUTAS_EXTRA corrupto se recupera con la RUTA principal (1 foto)', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ ID_EVIDENCIA: 21, ESTADO: 'pendiente', CANTIDAD: 3, RUTA: 'https://test.local/a.png', RUTAS_EXTRA: 'no-es-json', FECHA_SUBIDA: '2026-11-15T10:00:00Z' }],
    });
    const promesa = verEvidenciasReto(reto, alCambiar);
    const config = await esperaSwal();
    await promesa;
    expect(config.html).toContain('1 foto');
    expect(config.html).toContain('<img src="https://test.local/a.png"');
  });

  it('unidades por tipo: reps singular/plural y sesiones con un avance', async () => {
    getMock.mockResolvedValueOnce({
      data: [
        { ID_EVIDENCIA: 31, ESTADO: 'pendiente', CANTIDAD: 1, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z' },
        { ID_EVIDENCIA: 32, ESTADO: 'pendiente', CANTIDAD: 3, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:05:00Z' },
      ],
    });
    const promesa = verEvidenciasReto({ ...reto, META_TIPO: 'reps' }, alCambiar);
    const config = await esperaSwal();
    await promesa;
    expect(config.html).toContain('+1 rep');
    expect(config.html).toContain('+3 reps');
    expect(config.html).toContain('0/100 reps · 30%');
  });

  it('didOpen: el botón de motivo alterna visibilidad y texto', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ ID_EVIDENCIA: 41, ESTADO: 'rechazado', CANTIDAD: 2, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z', OBSERVACION: 'Vídeo ilegible' }],
    });
    const promesa = verEvidenciasReto(reto, alCambiar);
    const config = await esperaSwal();
    await promesa;
    montarHtml(config);
    config.didOpen?.();

    const btn = document.getElementById('reto-motivo-41') as HTMLButtonElement;
    const box = document.getElementById('reto-motivo-box-41') as HTMLElement;
    expect(box.style.display).toBe('none');
    fireEvent.click(btn);
    expect(box.style.display).toBe('block');
    expect(btn.textContent).toBe('Ocultar motivo');
    fireEvent.click(btn);
    expect(box.style.display).toBe('none');
    expect(btn.textContent).toBe('Ver motivo de la revisión');
  });

  it('didOpen: eliminar un pendiente confirmado hace DELETE y avisa al padre', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ ID_EVIDENCIA: 51, ESTADO: 'pendiente', CANTIDAD: 2, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z' }],
    });
    const promesa = verEvidenciasReto(reto, alCambiar);
    const config = await esperaSwal();
    await promesa;
    montarHtml(config);
    config.didOpen?.();

    fireEvent.click(document.getElementById('reto-del-ev-51') as HTMLElement);

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith('/api/retos/evidencias/51'));
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning', title: '¿Eliminar este avance?', confirmButtonText: 'Sí, eliminar',
    }));
    expect(Swal.close).toHaveBeenCalled();
    expect(alCambiar).toHaveBeenCalledTimes(1);
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success', title: 'Avance eliminado',
    }));
  });

  it('didOpen: cancelar la confirmación no elimina nada', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ ID_EVIDENCIA: 52, ESTADO: 'pendiente', CANTIDAD: 2, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z' }],
    });
    const promesa = verEvidenciasReto(reto, alCambiar);
    const config = await esperaSwal();
    await promesa;
    montarHtml(config);
    config.didOpen?.();

    // La resolución falsa va DESPUÉS del primer Swal (el del modal de
    // evidencias) para que la consuma la confirmación de borrado.
    fireMock.mockResolvedValueOnce({ isConfirmed: false });
    fireEvent.click(document.getElementById('reto-del-ev-52') as HTMLElement);

    await waitFor(() => expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Eliminar este avance?' })));
    expect(deleteMock).not.toHaveBeenCalled();
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it('didOpen: fallo del DELETE muestra el mensaje del backend', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ ID_EVIDENCIA: 53, ESTADO: 'pendiente', CANTIDAD: 2, RUTA: null, RUTAS_EXTRA: null, FECHA_SUBIDA: '2026-11-15T10:00:00Z' }],
    });
    deleteMock.mockRejectedValueOnce({ response: { data: { msg: 'Cupo de eliminaciones agotado ADMIN-TEST' } } });
    const promesa = verEvidenciasReto(reto, alCambiar);
    const config = await esperaSwal();
    await promesa;
    montarHtml(config);
    config.didOpen?.();

    fireEvent.click(document.getElementById('reto-del-ev-53') as HTMLElement);

    await waitFor(() => expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'No se pudo eliminar', text: 'Cupo de eliminaciones agotado ADMIN-TEST',
    })));
  });
});

describe('retosAvances — reportarAvanceReto', () => {
  const alCambiar = vi.fn();
  const archivo = (nombre: string, tipo: string) => new File(['contenido'], nombre, { type: tipo });

  /** Abre el modal del formulario: resuelve el primer Swal y monta el html. */
  const abrirFormulario = async (metaTipo: string, restante = 10) => {
    const promesa = reportarAvanceReto(5, restante, metaTipo, alCambiar);
    const config = await esperaSwal();
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

  it('reto acumulable (km): stepper con máximo y contador vacío', async () => {
    const { config } = await abrirFormulario('km', 10);
    expect(config.html).toContain('¿Cuánto sumas a tu progreso?');
    expect(config.html).toContain('(máx. 10 km)');
    expect(config.html).toContain('0/5 archivos — hasta 25 MB c/u');
  });

  it('reto por sesiones: panel informativo de 1 avance por día sin stepper', async () => {
    const { config } = await abrirFormulario('sesiones', 10);
    expect(config.html).toContain('1 sesión por avance');
    expect(config.html).toContain('Solo se permite un avance por día');
    expect(document.getElementById('rw-plus')).toBeNull();
    // Sin material, preConfirm valida primero.
    expect(config.preConfirm?.()).toBe(false);
    expect(showValidation).toHaveBeenCalledWith('Debes adjuntar al menos una foto o video');
    // Con material y meta no acumulable: la cantidad es fija = 1.
    agregar(archivo('foto.png', 'image/png'));
    expect(config.preConfirm?.()).toBe(1);
  });

  it('agregar archivos: preview FOTO con badge, tamaño y botón de quitar', async () => {
    await abrirFormulario('km', 10);
    // Archivo de 2048 bytes → "2 KB" (formatearMB).
    agregar(new File(['x'.repeat(2048)], 'foto.png', { type: 'image/png' }));

    const previews = document.querySelectorAll('.ra-preview');
    expect(previews).toHaveLength(1);
    expect(document.querySelector('.ra-preview-badge')?.textContent).toBe('FOTO');
    expect(document.querySelector('.ra-preview-size')?.textContent).toBe('2 KB');
    expect(document.querySelector('.ra-preview img')?.getAttribute('src')).toBe('blob:url-mock');
    expect(document.querySelector('.ra-contador')?.textContent).toBe('1/5 archivos — hasta 25 MB c/u');

    // Quitar: revokeObjectURL + tarjeta fuera.
    fireEvent.click(document.querySelector('.ra-preview-x') as HTMLElement);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url-mock');
    expect(document.querySelectorAll('.ra-preview')).toHaveLength(0);
    expect(document.querySelector('.ra-contador')?.textContent).toBe('0/5 archivos — hasta 25 MB c/u');
  });

  it('archivos de video se marcan VIDEO y los tipos extraños se ignoran', async () => {
    await abrirFormulario('km', 10);
    agregar(archivo('clip.mp4', 'video/mp4'));
    agregar(archivo('notas.txt', 'text/plain'));

    const previews = document.querySelectorAll('.ra-preview');
    expect(previews).toHaveLength(1);
    expect(document.querySelector('.ra-preview-badge')?.textContent).toBe('VIDEO');
    expect(document.querySelector('.ra-preview video')).not.toBeNull();
  });

  it('supera 25 MB: mensaje de validación y archivo fuera', async () => {
    await abrirFormulario('km', 10);
    const grande = new File(['x'.repeat(26)], 'grande.png', { type: 'image/png' });
    Object.defineProperty(grande, 'size', { value: 26 * 1024 * 1024, configurable: true });
    agregar(grande);

    expect(showValidation).toHaveBeenCalledWith('"grande.png" supera los 25 MB');
    expect(document.querySelectorAll('.ra-preview')).toHaveLength(0);
  });

  it('límite de 5 archivos: showValidationMessage al sexto', async () => {
    await abrirFormulario('km', 10);
    for (let i = 0; i < 6; i++) agregar(archivo(`foto${i}.png`, 'image/png'));

    expect(document.querySelectorAll('.ra-preview')).toHaveLength(5);
    expect(showValidation).toHaveBeenCalledWith('Máximo 5 archivos por avance');
  });

  it('stepper suma y resta con tope en el máximo', async () => {
    await abrirFormulario('km', 3);
    const input = document.getElementById('cantidad-reto') as HTMLInputElement;
    expect(input.value).toBe('1');
    fireEvent.click(document.getElementById('rw-plus') as HTMLElement);
    expect(input.value).toBe('2');
    fireEvent.click(document.getElementById('rw-plus') as HTMLElement);
    fireEvent.click(document.getElementById('rw-plus') as HTMLElement);
    expect(input.value).toBe('3');
    fireEvent.click(document.getElementById('rw-minus') as HTMLElement);
    expect(input.value).toBe('2');
    fireEvent.click(document.getElementById('rw-minus') as HTMLElement);
    fireEvent.click(document.getElementById('rw-minus') as HTMLElement);
    expect(input.value).toBe('1');
    fireEvent.click(document.getElementById('rw-minus') as HTMLElement);
    expect(input.value).toBe('1');
  });

  it('preConfirm: sin material valida; con material devuelve la cantidad del stepper', async () => {
    const { config } = await abrirFormulario('km', 10);
    // Sin archivos.
    expect(config.preConfirm?.()).toBe(false);
    expect(showValidation).toHaveBeenCalledWith('Debes adjuntar al menos una foto o video');

    agregar(archivo('foto.png', 'image/png'));
    expect(config.preConfirm?.()).toBe(1);

    (document.getElementById('cantidad-reto') as HTMLInputElement).value = '4';
    expect(config.preConfirm?.()).toBe(4);

    // Fuera de rango: > máximo.
    (document.getElementById('cantidad-reto') as HTMLInputElement).value = '99';
    expect(config.preConfirm?.()).toBe(false);
    expect(showValidation).toHaveBeenCalledWith('El avance debe ser entre 1 y 10 km');
  });

  it('dropzone: click pide archivos, dragover pinta y drop agrega', async () => {
    await abrirFormulario('km', 10);
    const drop = document.getElementById('rw-drop') as HTMLElement;
    const clickSpy = vi.spyOn(inputArchivos(), 'click').mockImplementation(() => {});

    fireEvent.click(drop);
    expect(clickSpy).toHaveBeenCalledTimes(1);

    fireEvent.dragOver(drop);
    // jsdom normaliza el hex a rgb.
    expect(drop.style.borderColor).toBe('rgb(231, 55, 55)');
    fireEvent.dragLeave(drop);
    expect(drop.style.borderColor).toBe('var(--ra-borde, #cbd5e1)');

    Object.defineProperty(inputArchivos(), 'files', { value: [archivo('foto.png', 'image/png')], configurable: true });
    fireEvent.drop(drop, { dataTransfer: { files: inputArchivos().files } });
    expect(document.querySelectorAll('.ra-preview')).toHaveLength(1);
  });

  it('subida exitosa: XHR con cantidad + materiales, progreso 50% y Swal de éxito', async () => {
    fireMock.mockResolvedValueOnce({ value: 3, isConfirmed: true });
    const { promesa, config } = await abrirFormulario('km', 10);
    agregar(archivo('foto.png', 'image/png'));
    agregar(archivo('clip.mp4', 'video/mp4'));

    // Confirmar el formulario → segundo Swal "Subiendo evidencia…".
    void config.preConfirm?.();
    await promesa;
    const subida = fireMock.mock.calls[1][0] as { html: string; didOpen?: () => void };
    // Inyectar el html del modal de subida para la barra de progreso.
    montarHtml(subida);
    subida.didOpen?.();

    const xhr = XhrFalso.ultimo as XhrFalso;
    expect(xhr).not.toBeNull();
    expect(xhr.open).toHaveBeenCalledWith('POST', '/api/retos/progreso/5');
    expect(xhr.withCredentials).toBe(true);
    expect(xhr.fd?.get('cantidad')).toBe('3');
    expect(xhr.fd?.getAll('materiales').length).toBe(2);

    xhr.upload.onprogress?.({ loaded: 50, total: 100, lengthComputable: true });
    expect(document.getElementById('rw-prog-fill')?.style.width).toBe('50%');
    expect(document.getElementById('rw-prog-pct')?.textContent).toBe('50%');

    xhr.responseText = JSON.stringify({ msg: 'Avance recibido ADMIN-TEST' });
    xhr.status = 200;
    xhr.onload?.();
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success', title: 'Avance en revisión', text: 'Avance recibido ADMIN-TEST',
    }));
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });

  it('subida rechazada por el servidor muestra el error y no avisa al padre', async () => {
    fireMock.mockResolvedValueOnce({ value: 1, isConfirmed: true });
    const { promesa, config } = await abrirFormulario('km', 10);
    agregar(archivo('foto.png', 'image/png'));
    void config.preConfirm?.();
    await promesa;
    const subida = fireMock.mock.calls[1][0] as { didOpen?: () => void };
    subida.didOpen?.();

    const xhr = XhrFalso.ultimo as XhrFalso;
    xhr.responseText = JSON.stringify({ msg: 'Límite diario alcanzado ADMIN-TEST' });
    xhr.status = 400;
    xhr.onload?.();
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'Error', text: 'Límite diario alcanzado ADMIN-TEST',
    }));
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it('respuesta ilegible del servidor cae en el error de conexión', async () => {
    fireMock.mockResolvedValueOnce({ value: 1, isConfirmed: true });
    const { promesa, config } = await abrirFormulario('km', 10);
    agregar(archivo('foto.png', 'image/png'));
    void config.preConfirm?.();
    await promesa;
    const subida = fireMock.mock.calls[1][0] as { didOpen?: () => void };
    subida.didOpen?.();

    const xhr = XhrFalso.ultimo as XhrFalso;
    xhr.responseText = 'no-es-json';
    xhr.onload?.();
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'Error de conexión', text: 'No se pudo completar la subida. Inténtalo de nuevo.',
    }));
  });

  it('fallo de red (onerror) muestra el error de conexión', async () => {
    fireMock.mockResolvedValueOnce({ value: 1, isConfirmed: true });
    const { promesa, config } = await abrirFormulario('km', 10);
    agregar(archivo('foto.png', 'image/png'));
    void config.preConfirm?.();
    await promesa;
    const subida = fireMock.mock.calls[1][0] as { didOpen?: () => void };
    subida.didOpen?.();

    const xhr = XhrFalso.ultimo as XhrFalso;
    xhr.onerror?.();
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error', title: 'Error de conexión',
    }));
  });

  it('cancelar el formulario (sin confirmación) no sube nada', async () => {
    fireMock.mockResolvedValueOnce({ value: undefined, isConfirmed: false });
    const promesa = reportarAvanceReto(5, 10, 'km', alCambiar);
    await esperaSwal();
    await promesa;
    expect(fireMock.mock.calls).toHaveLength(1);
    expect(XhrFalso.ultimo).toBeNull();
    expect(alCambiar).not.toHaveBeenCalled();
  });
});
