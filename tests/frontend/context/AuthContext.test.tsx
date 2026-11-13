import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { AuthProvider, useAuth } from '../../../frontend/src/context/AuthContext.tsx';
import { server } from '../setup.ts';

/**
 * Prueba el AuthContext REAL (sin mock del propio contexto): montaje contra
 * MSW, derivadas de rol, login/refresh/logout y la rama legacy del OAuth
 * full-page (?user=).
 *
 * NOTA: NO se sustituye window.location globalmente — MSW resuelve las rutas
 * relativas de los handlers registrados en runtime contra location, y el stub
 * rompía el match (401 fantasma).
 */

function Sonda() {
  const { usuario, usuarioLogueado, esAdmin, esVendedor, loadingAuth, login, logoutGlobal, refreshPerfil } = useAuth();
  return (
    <div>
      <span data-testid="estado">{JSON.stringify({ logueado: usuarioLogueado, esAdmin, esVendedor, loadingAuth })}</span>
      <span data-testid="nombre">{usuario?.NOMBRE_USUARIO ?? 'anonimo'}</span>
      <span data-testid="rol">{usuario?.ID_ROL ?? '-'}</span>
      <button data-testid="login" onClick={() => login({ NOMBRE_USUARIO: 'Probe', ID_ROL: 4, foto_url: null })}>login</button>
      <button data-testid="refresh" onClick={() => { void refreshPerfil(); }}>refresh</button>
      <button data-testid="logout" onClick={() => { void logoutGlobal(); }}>logout</button>
    </div>
  );
}

const montar = () => render(<AuthProvider><Sonda /></AuthProvider>);

const estadoDe = () => JSON.parse(screen.getByTestId('estado').textContent ?? '{}');

afterEach(() => {
  // devolver la URL limpia para el siguiente test
  window.history.replaceState({}, '', '/');
});

describe('AuthContext', () => {
  it('arranca anónimo: /api/auth/perfil 401 → usuario null y carga terminada', async () => {
    montar();
    await waitFor(() => expect(estadoDe().loadingAuth).toBe(false));
    expect(estadoDe().logueado).toBe(false);
    expect(screen.getByTestId('nombre').textContent).toBe('anonimo');
  });

  it('con sesión: perfil 200 → logueado, y las derivadas de rol funcionan', async () => {
    server.use(
      http.get('*/api/auth/perfil', () =>
        HttpResponse.json({ ok: true, usuario: { ID_USUARIO: 7, NOMBRE_USUARIO: 'Yeison', ID_ROL: 1, FOTO_URL: 'https://x/y.png' } })),
    );
    montar();
    await waitFor(() => expect(estadoDe().loadingAuth).toBe(false));
    expect(estadoDe().logueado).toBe(true);
    expect(estadoDe().esAdmin).toBe(true);
    expect(estadoDe().esVendedor).toBe(false);
    expect(screen.getByTestId('rol').textContent).toBe('1');
  });

  it('ID_ROL 6 → esVendedor (y no esAdmin)', async () => {
    server.use(
      http.get('*/api/auth/perfil', () =>
        HttpResponse.json({ ok: true, usuario: { ID_USUARIO: 8, NOMBRE_USUARIO: 'Vende', ID_ROL: 6, FOTO_URL: null } })),
    );
    montar();
    await waitFor(() => expect(estadoDe().loadingAuth).toBe(false));
    expect(estadoDe().esVendedor).toBe(true);
    expect(estadoDe().esAdmin).toBe(false);
  });

  it('login() marca la sesión de inmediato sin esperar el perfil', async () => {
    montar();
    await waitFor(() => expect(estadoDe().loadingAuth).toBe(false));
    fireEvent.click(screen.getByTestId('login'));
    expect(estadoDe().logueado).toBe(true);
    expect(screen.getByTestId('nombre').textContent).toBe('Probe');
  });

  it('refreshPerfil vuelve a pedir el perfil y actualiza el usuario', async () => {
    let llamada = 0;
    server.use(
      http.get('*/api/auth/perfil', () => {
        llamada += 1;
        return llamada === 1
          ? HttpResponse.json({ ok: false }, { status: 401 })
          : HttpResponse.json({ ok: true, usuario: { ID_USUARIO: 9, NOMBRE_USUARIO: 'Actualizado', ID_ROL: 4, FOTO_URL: null } });
      }),
    );
    montar();
    await waitFor(() => expect(estadoDe().loadingAuth).toBe(false));
    expect(estadoDe().logueado).toBe(false);
    await act(async () => { fireEvent.click(screen.getByTestId('refresh')); });
    await waitFor(() => expect(screen.getByTestId('nombre').textContent).toBe('Actualizado'));
  });

  it('logoutGlobal destruye la sesión en el servidor y limpia el estado', async () => {
    const postLogout = vi.fn(() => Promise.resolve({ data: { ok: true } }));
    const axios = (await import('axios')).default;
    const espia = vi.spyOn(axios, 'post').mockImplementation(postLogout);
    server.use(
      http.get('*/api/auth/perfil', () =>
        HttpResponse.json({ ok: true, usuario: { ID_USUARIO: 1, NOMBRE_USUARIO: 'Admin', ID_ROL: 1, FOTO_URL: null } })),
    );
    montar();
    await waitFor(() => expect(estadoDe().logueado).toBe(true));
    await act(async () => { fireEvent.click(screen.getByTestId('logout')); });
    await waitFor(() => expect(screen.getByTestId('nombre').textContent).toBe('anonimo'));
    expect(postLogout).toHaveBeenCalledWith('/api/auth/logout', {}, { withCredentials: true });
    espia.mockRestore();
  });

  it('rama legacy del OAuth full-page: ?user= monta la sesión y limpia la URL', async () => {
    window.history.replaceState({}, '', '/catalogo?user=Johan&photo=https://x/j.png');
    montar();
    await waitFor(() => expect(screen.getByTestId('nombre').textContent).toBe('Johan'));
    expect(window.location.search).toBe('');
    expect(window.location.pathname).toBe('/catalogo');
  });

  it('la rama ?user= NO toca la página puente del popup (oauth-popup-callback)', async () => {
    window.history.replaceState({}, '', '/oauth-popup-callback?user=Popup');
    montar();
    await waitFor(() => expect(estadoDe().loadingAuth).toBe(false));
    // En la página puente se ignora el ?user= (el popup lo consume) → sigue anónimo y la URL queda intacta
    expect(estadoDe().logueado).toBe(false);
    expect(window.location.search).toContain('user=Popup');
  });
});
