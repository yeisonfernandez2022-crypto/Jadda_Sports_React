import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import AvisoCookies from '../../../frontend/src/components/AvisoCookies.tsx';

/**
 * AvisoCookies: aparece sin la bandera en localStorage, aceptar persiste la
 * fecha (ley 1581/Decreto 1377 — aviso informativo) y NO reaparece al
 * recargar; modo privado (localStorage roto) se oculta solo en la sesión.
 *
 * El setup global reemplaza window.localStorage con mocks vi.fn(): este test
 * les da BACKING real (mapa en memoria) con mockImplementation, y el caso
 * "modo privado" los lanza explícitamente.
 */
const CLAVE = 'jadda_aviso_cookies';
const backing = new Map();

const montar = () => render(<BrowserRouter><AvisoCookies /></BrowserRouter>);

beforeEach(() => {
  backing.clear();
  vi.restoreAllMocks();
  vi.spyOn(Storage.prototype, 'getItem').mockRestore?.();
});

afterEach(() => {
  backing.clear();
});

describe('AvisoCookies', () => {
  beforeEach(() => {
    // backing real para el mock de localStorage del setup global
    vi.mocked(window.localStorage.getItem).mockImplementation((k: string) => backing.has(k) ? (backing.get(k) as string) : null);
    vi.mocked(window.localStorage.setItem).mockImplementation((k: string, v: string) => { backing.set(k, v); });
  });

  it('sin bandera previa: visible con el texto real de cookies esenciales', () => {
    montar();
    expect(screen.getByText(/cookie esencial de sesión/i)).toBeTruthy();
    expect(screen.getByText(/No usamos cookies publicitarias/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Más detalles/i })).toBeTruthy();
  });

  it('aceptar: persiste la fecha en localStorage y desaparece (no reaparece al recargar)', () => {
    montar();
    fireEvent.click(screen.getByRole('button', { name: /Entendido/i }));
    expect(screen.queryByText(/cookie esencial/i)).toBeNull();
    expect(backing.get(CLAVE)).toBeTruthy();
    // recargar con la bandera → NO vuelve
    montar();
    expect(screen.queryByText(/cookie esencial/i)).toBeNull();
  });

  it('con bandera previa en localStorage: NUNCA se muestra', () => {
    backing.set(CLAVE, new Date().toISOString());
    montar();
    expect(screen.queryByText(/cookie esencial/i)).toBeNull();
  });

  it('localStorage roto (modo privado): visible y aceptar lo oculta solo en la sesión', () => {
    vi.mocked(window.localStorage.getItem).mockImplementation(() => { throw new Error('modo privado'); });
    vi.mocked(window.localStorage.setItem).mockImplementation(() => { throw new Error('modo privado'); });
    montar();
    expect(screen.getByText(/cookie esencial/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Entendido/i }));
    expect(screen.queryByText(/cookie esencial/i)).toBeNull();
  });
});
