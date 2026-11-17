import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ImageZoom from '../../../frontend/src/components/ImageZoom';

/**
 * ImageZoom: contenedor que hace zoom sobre la imagen centrando el punto del
 * mouse (transform-origin) y lo restablece al salir.
 */

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ImageZoom', () => {
  it('renderiza la imagen con su src y alt', () => {
    render(<ImageZoom src="https://test.local/zoom.png" alt="Producto Zoom-Test" />);

    expect(screen.getByAltText('Producto Zoom-Test')).toHaveAttribute('src', 'https://test.local/zoom.png');
  });

  it('el mousemove centra el transform-origin en el punto del mouse', () => {
    vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 10, top: 20, width: 200, height: 100, right: 210, bottom: 120, x: 10, y: 20, toJSON: () => ({}),
    });
    render(<ImageZoom src="https://test.local/zoom.png" alt="img" />);
    const contenedor = document.querySelector('.image-zoom-container') as HTMLElement;
    const img = document.querySelector('.image-zoom-img') as HTMLElement;

    // (110-10)/200 = 50%; (70-20)/100 = 50%.
    fireEvent.mouseMove(contenedor, { clientX: 110, clientY: 70 });
    expect(img.style.transformOrigin).toBe('50% 50%');

    // (10-10)/200 = 0%; (20-20)/100 = 0%.
    fireEvent.mouseMove(contenedor, { clientX: 10, clientY: 20 });
    expect(img.style.transformOrigin).toBe('0% 0%');

    // (210-10)/200 = 100%; (120-20)/100 = 100%.
    fireEvent.mouseMove(contenedor, { clientX: 210, clientY: 120 });
    expect(img.style.transformOrigin).toBe('100% 100%');
  });

  it('al salir del contenedor el origen vuelve al centro', () => {
    vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
      left: 0, top: 0, width: 200, height: 100, right: 200, bottom: 100, x: 0, y: 0, toJSON: () => ({}),
    });
    render(<ImageZoom src="https://test.local/zoom.png" alt="img" />);
    const contenedor = document.querySelector('.image-zoom-container') as HTMLElement;
    const img = document.querySelector('.image-zoom-img') as HTMLElement;

    fireEvent.mouseMove(contenedor, { clientX: 190, clientY: 90 });
    expect(img.style.transformOrigin).toBe('95% 90%');

    fireEvent.mouseLeave(contenedor);
    expect(img.style.transformOrigin).toBe('50% 50%');
  });

  it('una imagen rota cae al placeholder de JADDA', () => {
    render(<ImageZoom src="https://test.local/rota.png" alt="img" />);
    const img = document.querySelector('.image-zoom-img') as HTMLImageElement;

    fireEvent.error(img);

    expect(img).toHaveAttribute('src', 'https://placehold.co/600x600?text=JADDA');
  });
});
