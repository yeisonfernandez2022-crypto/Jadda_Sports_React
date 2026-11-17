import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersConfiguracionAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminConfiguracion from '../../../frontend/src/admin/AdminConfiguracion.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Configuración de perfil contra su código REAL: carga /api/auth/perfil,
 * edición y PUT, modal de contraseña con sus validaciones y rutas de error.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

beforeEach(() => {
  ({ api, handlers } = handlersConfiguracionAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('AdminConfiguracion', () => {
  it('carga el perfil del administrador en el formulario', async () => {
    renderAdmin(<AdminConfiguracion />);

    expect(await screen.findByRole('heading', { name: 'Configuración' })).toBeInTheDocument();
    expect(await screen.findByDisplayValue('Admin Probe')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre de usuario *')).toHaveDisplayValue('admin');
    expect(screen.getByLabelText('Teléfono')).toHaveDisplayValue('3001234567');
  });

  it('guarda los cambios del perfil: PUT con el cuerpo esperado', async () => {
    renderAdmin(<AdminConfiguracion />);
    await screen.findByDisplayValue('Admin Probe');

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Admin Probe Dos' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'PUT', ruta: '/api/auth/perfil',
    })));
    const put = api.peticiones.find((p) => p.metodo === 'PUT');
    expect(put?.cuerpo).toMatchObject({ nombre: 'Admin Probe Dos', usuario: 'admin' });
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: 'Perfil guardado ADMIN-TEST' }));
  });

  it('nombre vacío: advertencia de campo obligatorio y SIN PUT', async () => {
    renderAdmin(<AdminConfiguracion />);
    await screen.findByDisplayValue('Admin Probe');

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));

    expect(Swal.fire).toHaveBeenCalledWith('Campo obligatorio', 'El nombre es obligatorio', 'warning');
    expect(api.peticiones.some((p) => p.metodo === 'PUT')).toBe(false);
  });

  it('contraseña nueva corta o no coincidente: advertencia y SIN POST', async () => {
    renderAdmin(<AdminConfiguracion />);
    await screen.findByDisplayValue('Admin Probe');

    fireEvent.click(screen.getByRole('button', { name: /Cambiar contraseña/ }));
    // Los tres campos llenos (la validación de obligatorios es la primera);
    // la nueva corta activa la de debilidad.
    fireEvent.change(screen.getByPlaceholderText('Tu contraseña actual'), { target: { value: 'actual1234' } });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: 'corta' } });
    fireEvent.change(screen.getByPlaceholderText('Repite la nueva contraseña'), { target: { value: 'corta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));

    expect(Swal.fire).toHaveBeenCalledWith('Contraseña débil', 'La nueva contraseña debe tener al menos 8 caracteres', 'warning');
    expect(api.peticiones.some((p) => p.metodo === 'POST' && p.ruta === '/api/auth/cambiar-password')).toBe(false);
  });

  it('cambio de contraseña válido: POST con actual y nueva, modal cerrado', async () => {
    renderAdmin(<AdminConfiguracion />);
    await screen.findByDisplayValue('Admin Probe');

    fireEvent.click(screen.getByRole('button', { name: /Cambiar contraseña/ }));
    fireEvent.change(screen.getByPlaceholderText('Tu contraseña actual'), { target: { value: 'actual1234' } });
    fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: 'nueva12345' } });
    fireEvent.change(screen.getByPlaceholderText('Repite la nueva contraseña'), { target: { value: 'nueva12345' } });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST', ruta: '/api/auth/cambiar-password',
      cuerpo: { password_actual: 'actual1234', password_nueva: 'nueva12345' },
    })));
    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success' }));
    // El modal se cierra tras el éxito.
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Cambiar contraseña' })).not.toBeInTheDocument());
  });

  it('error del servidor al guardar perfil: mensaje y sin éxito', async () => {
    server.use(
      http.put('*/api/auth/perfil', () =>
        HttpResponse.json({ ok: false, message: 'Error del servidor ADMIN-TEST' }, { status: 500 })),
    );
    renderAdmin(<AdminConfiguracion />);
    await screen.findByDisplayValue('Admin Probe');

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));

    await waitFor(() => expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'warning', title: 'Error del servidor ADMIN-TEST' })));
  });
});
