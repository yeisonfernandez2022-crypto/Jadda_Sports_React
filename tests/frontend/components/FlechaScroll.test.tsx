import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FlechaScroll from '../../../frontend/src/components/FlechaScroll';

/**
 * FlechaScroll: flecha inferior que aparece cuando hay contenido pendiente.
 * Se controlan scrollHeight, innerHeight, scrollY y el rect del footer para
 * recorrer las tres ramas de refrescar(): sin scroll, con footer y sin footer.
 */

const definir = (objeto: object, propiedad: string, valor: unknown) => {
  Object.defineProperty(objeto, propiedad, { value: valor, configurable: true, writable: true });
};

beforeEach(() => {
  definir(document.documentElement, 'scrollHeight', 2000);
  definir(document.body, 'scrollHeight', 2000);
  definir(window, 'innerHeight', 800);
  definir(window, 'scrollY', 0);
  window.scrollBy = vi.fn();
});

afterEach(() => {
  document.querySelectorAll('footer').forEach((f) => f.remove());
  vi.useRealTimers();
});

describe('FlechaScroll', () => {
  it('permanece oculta si la página no tiene scroll suficiente', () => {
    definir(document.documentElement, 'scrollHeight', 100);
    definir(document.body, 'scrollHeight', 100);

    const { container } = render(<FlechaScroll />);
    const boton = container.querySelector('button') as HTMLButtonElement;

    expect(boton).toHaveAttribute('aria-hidden', 'true');
    expect(boton).toHaveAttribute('tabindex', '-1');
  });

  it('aparece con footer y calcula la línea del 25%', () => {
    const footer = document.createElement('footer');
    footer.getBoundingClientRect = () => ({ top: 1500, height: 400 } as DOMRect);
    document.body.appendChild(footer);

    render(<FlechaScroll />);
    const boton = screen.getByRole('button', { name: 'Bajar y ver más contenido' });

    expect(boton).toHaveAttribute('aria-hidden', 'false');
    expect(boton).toHaveAttribute('tabindex', '0');
    expect(boton.className).toContain('flecha-scroll-visible');
  });

  it('aparece sin footer usando el scroll disponible', () => {
    render(<FlechaScroll />);
    expect(screen.getByRole('button', { name: 'Bajar y ver más contenido' }))
      .toHaveAttribute('aria-hidden', 'false');
  });

  it('se oculta al llegar al final y baja 0.85 de la ventana al hacer clic', async () => {
    render(<FlechaScroll />);
    const boton = screen.getByRole('button', { name: 'Bajar y ver más contenido' });

    fireEvent.click(boton);
    expect(window.scrollBy).toHaveBeenCalledWith({ top: 680, behavior: 'smooth' });

    definir(window, 'scrollY', 1300);
    fireEvent.scroll(window);
    await waitFor(() => expect(boton).toHaveAttribute('aria-hidden', 'true'));
  });
});
