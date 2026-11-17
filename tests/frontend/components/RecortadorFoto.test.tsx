import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RecortadorFoto from '../../../frontend/src/components/RecortadorFoto';

/**
 * RecortadorFoto: overlay con react-easy-crop para recortar la foto de perfil.
 * Se mockea el Cropper (reporta un área configurable) y se stubbean los
 * primitivos de browser que jsdom no trae (Image, canvas 2D/toBlob) para
 * ejercitar el pipeline real de exportación (canvas → Blob → FileReader).
 */

const fireMock = vi.fn().mockResolvedValue({ isConfirmed: true });
vi.mock('sweetalert2', () => ({ default: { fire: (...a: unknown[]) => fireMock(...a) } }));

// Estado del mock del Cropper (nombres mock* para sobrevivir al hoisting).
let mockReportarArea = true;
let mockAreaPx: { x: number; y: number; width: number; height: number } = { x: 0, y: 0, width: 100, height: 80 };

vi.mock('react-easy-crop', async () => {
  const ReactMock = await import('react');
  const Cropper = (props: { onCropComplete?: (a: unknown, b: unknown) => void; image?: string }) => {
    const { useEffect } = ReactMock;
    useEffect(() => {
      if (mockReportarArea) {
        props.onCropComplete?.({ x: 0, y: 0, width: 100, height: 80 }, mockAreaPx);
      }
    }, []);
    return <div data-testid="cropper-mock" data-image={String(props.image)} />;
  };
  return { default: Cropper };
});

const onCancelarMock = vi.fn();
const onConfirmarMock = vi.fn().mockResolvedValue(undefined);

const montar = (props: Partial<Parameters<typeof RecortadorFoto>[0]> = {}) =>
  render(
    <RecortadorFoto
      archivo={new File(['pau'], 'foto.png', { type: 'image/png' })}
      subiendo={false}
      onCancelar={onCancelarMock}
      onConfirmar={onConfirmarMock}
      {...props}
    />,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockReportarArea = true;
  mockAreaPx = { x: 0, y: 0, width: 100, height: 80 };
  onConfirmarMock.mockResolvedValue(undefined);

  // jsdom no carga imágenes: un Image con onload en cola de microtareas.
  class ImagenFalsa {
    naturalWidth = 100;
    naturalHeight = 80;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_: string) {
      Promise.resolve().then(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', ImagenFalsa);

  // Canvas 2D: drawImage disponible y toBlob entrega un Blob real.
  const ctxFalso = { drawImage: vi.fn() };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctxFalso) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.toBlob = vi.fn((cb: (b: Blob | null) => void, mimeType?: string) => {
    cb(new Blob(['recorte'], { type: mimeType ?? 'image/jpeg' }));
  }) as unknown as typeof HTMLCanvasElement.prototype.toBlob;

  // URL de blob para la vista previa.
  Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:foto-local'), writable: true, configurable: true });
  Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true, configurable: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RecortadorFoto — render y cierre', () => {
  it('muestra cabecera, hint, cropper con la imagen, zoom y acciones', () => {
    montar();

    expect(screen.getByText('Elige cómo se verá tu foto')).toBeInTheDocument();
    expect(screen.getByText(/Arrastra la imagen para moverla y ajusta el zoom/)).toBeInTheDocument();
    expect(screen.getByTestId('cropper-mock')).toHaveAttribute('data-image', 'blob:foto-local');
    const zoom = screen.getByLabelText('Zoom de la foto') as HTMLInputElement;
    expect(zoom.value).toBe('1');
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Subir foto' })).toBeEnabled();
    expect(screen.queryByText('Subiendo…')).not.toBeInTheDocument();
  });

  it('la tecla Escape cancela cuando no hay subida en vuelo', () => {
    montar();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCancelarMock).toHaveBeenCalledTimes(1);
  });

  it('con subiendo=true, Escape, overlay y botones no cierran nada', () => {
    const { container } = montar({ subiendo: true });

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(container.querySelector('.rc-overlay') as HTMLElement);
    expect(onCancelarMock).not.toHaveBeenCalled();
    // El botón de subida pasa a "Subiendo…" y se deshabilita.
    expect(container.querySelector('.rc-btn-subir')).toBeDisabled();
    expect(screen.getByText('Subiendo…')).toBeInTheDocument();
  });

  it('click en el overlay cierra, pero click en la tarjeta no', () => {
    const { container } = montar();

    fireEvent.click(screen.getByRole('dialog', { name: 'Recortar foto de perfil' }));
    expect(onCancelarMock).not.toHaveBeenCalled();

    fireEvent.click(container.querySelector('.rc-overlay') as HTMLElement);
    expect(onCancelarMock).toHaveBeenCalledTimes(1);
  });

  it('el botón Cerrar de la cabecera cancela', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onCancelarMock).toHaveBeenCalledTimes(1);
  });

  it('el slider de zoom actualiza el valor controlado', () => {
    montar();
    const zoom = screen.getByLabelText('Zoom de la foto') as HTMLInputElement;
    fireEvent.change(zoom, { target: { value: '2.5' } });
    expect(zoom.value).toBe('2.5');
  });
});

describe('RecortadorFoto — exportación del recorte', () => {
  it('Subir foto exporta un dataURL PNG (archivo png) y llama onConfirmar', async () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Subir foto' }));

    await waitFor(() => expect(onConfirmarMock).toHaveBeenCalledTimes(1));
    const dataUrl = onConfirmarMock.mock.calls[0][0] as string;
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(fireMock).not.toHaveBeenCalled();
    // El spinner desaparece al terminar.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Subir foto' })).toBeInTheDocument());
  });

  it('un archivo JPEG exporta dataURL image/jpeg', async () => {
    montar({ archivo: new File(['pau'], 'foto.jpg', { type: 'image/jpeg' }) });
    fireEvent.click(screen.getByRole('button', { name: 'Subir foto' }));

    await waitFor(() => expect(onConfirmarMock).toHaveBeenCalledTimes(1));
    expect(onConfirmarMock.mock.calls[0][0]).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('área parcialmente fuera del lienzo (x negativa) se recorta con clamp', async () => {
    mockAreaPx = { x: -20, y: -10, width: 100, height: 80 };
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Subir foto' }));

    await waitFor(() => expect(onConfirmarMock).toHaveBeenCalledTimes(1));
  });

  it('área completamente fuera cae en el dibujo de imagen completa', async () => {
    mockAreaPx = { x: 500, y: 500, width: 10, height: 10 };
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Subir foto' }));

    await waitFor(() => expect(onConfirmarMock).toHaveBeenCalledTimes(1));
  });

  it('sin área reportada por el Cropper, confirmar no hace nada', async () => {
    mockReportarArea = false;
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Subir foto' }));

    await new Promise((r) => setTimeout(r, 20));
    expect(onConfirmarMock).not.toHaveBeenCalled();
    expect(fireMock).not.toHaveBeenCalled();
  });

  it('canvas sin contexto 2D muestra el Swal de error con el mensaje', async () => {
    (HTMLCanvasElement.prototype.getContext as unknown as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const { container } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Subir foto' }));

    await waitFor(() => expect(fireMock).toHaveBeenCalledTimes(1));
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error',
      title: 'ERROR AL RECORTAR',
      text: 'Canvas no disponible',
    }));
    expect(onConfirmarMock).not.toHaveBeenCalled();
    // El botón vuelve a estar habilitado tras el finally.
    await waitFor(() => expect(container.querySelector('.rc-btn-subir')).toBeEnabled());
  });

  it('toBlob nulo también cae en el error "No se pudo generar el recorte"', async () => {
    (HTMLCanvasElement.prototype.toBlob as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (cb: (b: Blob | null) => void) => cb(null),
    );
    montar();
    fireEvent.click(screen.getByRole('button', { name: 'Subir foto' }));

    await waitFor(() => expect(fireMock).toHaveBeenCalledTimes(1));
    expect(fireMock).toHaveBeenCalledWith(expect.objectContaining({ text: 'No se pudo generar el recorte' }));
  });
});
