import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { AuthProvider, useAuth } from '../../../frontend/src/context/AuthContext.tsx';
import { server } from '../setup.ts';

/**
 * AuthContext.extra: respuestas de perfil sin wrapper (ID_USUARIO o
 * NOMBRE_USUARIO directos), OAuth ?user= sin photo, contraseña temporal
 * (DEBE_CAMBIAR_PASSWORD), logout con red caída y useAuth fuera del provider.
 */

function Sonda() {
  const { usuario, usuarioLogueado, login, logoutGlobal } = useAuth();
  return (
    <div>
      <span data-testid="estado">{String(usuarioLogueado)}</span>
      <span data-testid="nombre">{usuario?.NOMBRE_USUARIO ?? 'anonimo'}</span>
      <span data-testid="foto">{usuario?.foto_url ?? 'sin-foto'}</span>
      <button data-testid="login-temp" onClick={() => login({ NOMBRE_USUARIO: 'Temporal', ID_ROL: 6, foto_url: null, DEBE_CAMBIAR_PASSWORD: 1 })}>login-temp</button>
      <button data-testid="login-normal" onClick={() => login({ NOMBRE_USUARIO: 'Normal', ID_ROL: 4, foto_url: null })}>login-normal</button>
      <button data-testid="logout" onClick={() => { void logoutGlobal(); }}>logout</button>
    </div>
  );
}

const montar = () => render(<AuthProvider><Sonda /></AuthProvider>);

const estadoDe = () => screen.getByTestId('estado').textContent;

afterEach(() => {
  window.history.replaceState({}, '', '/');
});

describe('AuthContext.extra', () => {
  it('perfil con ID_USUARIO directo (sin ok ni usuario) monta la sesión', async () => {
    server.use(
      http.get('*/api/auth/perfil', () =>
        HttpResponse.json({ ID_USUARIO: 3, NOMBRE_USUARIO: 'Directo', FOTO_URL: 'https://x/d.png' })),
    );
    montar();
    await waitFor(() => expect(estadoDe()).toBe('true'));
    expect(screen.getByTestId('nombre').textContent).toBe('Directo');
  });

  it('perfil con solo NOMBRE_USUARIO también cuenta (tercera condición del OR)', async () => {
    server.use(
      http.get('*/api/auth/perfil', () =>
        HttpResponse.json({ NOMBRE_USUARIO: 'NombreSolo' })),
    );
    montar();
    await waitFor(() => expect(estadoDe()).toBe('true'));
    expect(screen.getByTestId('nombre').textContent).toBe('NombreSolo');
    // Sin FOTO_URL → foto_url null (no undefined).
    expect(screen.getByTestId('foto').textContent).toBe('sin-foto');
  });

  it('?user= sin photo: la sesión social queda sin foto', async () => {
    window.history.replaceState({}, '', '/catalogo?user=SoloNombre');
    montar();
    await waitFor(() => expect(screen.getByTestId('nombre').textContent).toBe('SoloNombre'));
    expect(screen.getByTestId('foto').textContent).toBe('sin-foto');
    expect(window.location.search).toBe('');
  });

  it('login con contraseña temporal pasa por forzarCambioPassword', async () => {
    montar();
    await waitFor(() => expect(estadoDe()).toBe('false'));
    fireEvent.click(screen.getByTestId('login-temp'));
    expect(estadoDe()).toBe('true');
    expect(screen.getByTestId('nombre').textContent).toBe('Temporal');
  });

  it('logout con red caída: registra el error y limpia la sesión igual', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('red caída'));
    montar();
    await waitFor(() => expect(estadoDe()).toBe('false'));
    fireEvent.click(screen.getByTestId('login-normal'));
    expect(estadoDe()).toBe('true');
    await act(async () => { fireEvent.click(screen.getByTestId('logout')); });
    await waitFor(() => expect(estadoDe()).toBe('false'));
    expect(errorSpy).toHaveBeenCalledWith('Error al cerrar sesión:', expect.any(Error));
    errorSpy.mockRestore();
  });

  it('useAuth fuera del provider lanza el error de contexto', () => {
    function Sola() {
      useAuth();
      return null;
    }
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Sola />)).toThrow('useAuth debe usarse dentro de un AuthProvider');
    errorSpy.mockRestore();
  });
});
