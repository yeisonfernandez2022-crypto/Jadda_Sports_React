import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Routes, Route } from 'react-router-dom';
import { server } from '../setup';
import {
  HANDLERS_ADMIN, PERFIL_ADMIN, handlersConfiguracionAdmin,
  type ApiAdmin, type RequestHandler,
} from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import AdminConfiguracion from '../../../frontend/src/admin/AdminConfiguracion.tsx';

/**
 * AdminConfiguracion — segunda capa de cobertura.
 *
 * Complementa AdminConfiguracion.test.tsx con la edición de todos los campos,
 * la subida de foto (validaciones, éxito y fallos), las validaciones y los
 * toggles del modal de contraseña, el cierre del modal por todas sus vías y
 * la variante de vendedor de la pantalla.
 */

const { swalFire } = vi.hoisted(() => ({ swalFire: vi.fn() }));

vi.mock('sweetalert2', () => ({
  default: { fire: swalFire },
}));

let api: ApiAdmin;
let handlers: RequestHandler[];

const montar = () =>
  renderAdmin(
    <Routes>
      <Route path="/admin/configuracion" element={<AdminConfiguracion />} />
      <Route path="/admin" element={<div data-testid="sonda-admin" />} />
      <Route path="/vendedor" element={<div data-testid="sonda-vendedor" />} />
    </Routes>,
    { ruta: '/admin/configuracion' },
  );

const inputFoto = (container: HTMLElement) =>
  container.querySelector('input[type="file"]') as HTMLInputElement;

const subirArchivo = (container: HTMLElement, archivo: File) => {
  fireEvent.change(inputFoto(container), { target: { files: [archivo] } });
};

const abrirModalPassword = async () => {
  fireEvent.click(await screen.findByRole('button', { name: /Cambiar contraseña/ }));
  await screen.findByRole('heading', { name: 'Cambiar contraseña' });
};

const llenarPassword = (actual: string, nueva: string, confirmar: string) => {
  fireEvent.change(screen.getByPlaceholderText('Tu contraseña actual'), { target: { value: actual } });
  fireEvent.change(screen.getByPlaceholderText('Mínimo 8 caracteres'), { target: { value: nueva } });
  fireEvent.change(screen.getByPlaceholderText('Repite la nueva contraseña'), { target: { value: confirmar } });
};

const modalPasswordAbierto = () =>
  screen.queryByRole('heading', { name: 'Cambiar contraseña' });

beforeEach(() => {
  ({ api, handlers } = handlersConfiguracionAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
  swalFire.mockReset().mockResolvedValue({ isConfirmed: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminConfiguracion — perfil y campos', () => {
  it('carga la forma directa del perfil, edita todos los campos y vuelve al panel', async () => {
    server.use(http.get('*/api/auth/perfil', () => HttpResponse.json({
      ID_USUARIO: 2, NOMBRE_USUARIO: 'Directo ADMIN-TEST', APELLIDO_USUARIO: null,
      USUARIO: 'directo', TELEFONO: null, TIPO_DOCUMENTO: null,
      NUMERO_DOCUMENTO: null, FOTO_URL: null,
    })));
    montar();

    expect(await screen.findByDisplayValue('Directo ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByLabelText('Apellido')).toHaveValue('');
    expect(screen.getByLabelText('Teléfono')).toHaveValue('');

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Nombre Editado ADMIN-TEST' } });
    fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Apellido Editado' } });
    fireEvent.change(screen.getByLabelText('Nombre de usuario *'), { target: { value: 'editado' } });
    fireEvent.change(screen.getByLabelText('Teléfono'), { target: { value: '3009998877' } });
    fireEvent.change(screen.getByLabelText('Tipo de documento'), { target: { value: 'CC' } });
    fireEvent.change(screen.getByLabelText('Número de documento'), { target: { value: '123456' } });

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({ metodo: 'PUT' })));
    expect(api.peticiones.find((p) => p.metodo === 'PUT')?.cuerpo).toMatchObject({
      nombre: 'Nombre Editado ADMIN-TEST',
      apellido: 'Apellido Editado',
      usuario: 'editado',
      telefono: '3009998877',
      tipo_documento: 'CC',
      numero_documento: '123456',
      foto_url: null,
    });

    fireEvent.click(screen.getByRole('button', { name: /Volver al inicio/ }));
    expect(await screen.findByTestId('sonda-admin')).toBeInTheDocument();
  });

  it('muestra el aviso cuando el perfil responde con error', async () => {
    server.use(http.get('*/api/auth/perfil', () => HttpResponse.json({}, { status: 500 })));
    montar();

    expect(await screen.findByText('No se pudo cargar el perfil')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Información personal' })).not.toBeInTheDocument();
  });

  it('registra en consola el fallo de red al cargar el perfil', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    server.use(http.get('*/api/auth/perfil', () => HttpResponse.error()));
    montar();

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Error al cargar perfil'));
    expect(await screen.findByText('No se pudo cargar el perfil')).toBeInTheDocument();
  });

  it('reporta el fallo de red al guardar el perfil sin salir del formulario', async () => {
    server.use(http.put('*/api/auth/perfil', () => HttpResponse.error()));
    montar();
    await screen.findByDisplayValue('Admin Probe');

    fireEvent.click(screen.getByRole('button', { name: /Guardar cambios/ }));

    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'error', title: 'Error al guardar el perfil' }),
    ));
    expect(screen.getByDisplayValue('Admin Probe')).toBeInTheDocument();
  });

  it('muestra la variante de vendedor y vuelve a su panel', async () => {
    server.use(http.get('*/api/auth/perfil', () => HttpResponse.json({
      ok: true,
      usuario: {
        ...PERFIL_ADMIN.usuario,
        ID_ROL: 6,
        NOMBRE_USUARIO: 'Vendedor ADMIN-TEST',
        APELLIDO_USUARIO: null,
      },
    })));
    montar();

    expect(await screen.findByDisplayValue('Vendedor ADMIN-TEST')).toBeInTheDocument();
    expect(document.querySelector('.ven-sidebar')).toBeInTheDocument();
    expect(document.querySelector('footer.admin-footer')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Volver al Panel de vendedor/ })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'breadcrumb' }))
      .getByRole('link', { name: 'Mi tienda' })).toBeInTheDocument();

    await abrirModalPassword();
    expect(screen.getByText('Seguridad de tu cuenta de vendedor')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(modalPasswordAbierto()).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Volver al Panel de vendedor/ }));
    expect(await screen.findByTestId('sonda-vendedor')).toBeInTheDocument();
  });
});

describe('AdminConfiguracion — foto de perfil', () => {
  it('valida que exista archivo, el formato y el tamaño antes de subir', async () => {
    const { container } = montar();
    await screen.findByDisplayValue('Admin Probe');

    fireEvent.change(inputFoto(container), { target: { files: [] } });
    expect(swalFire).not.toHaveBeenCalled();

    subirArchivo(container, new File(['x'], 'foto.txt', { type: 'text/plain' }));
    expect(swalFire).toHaveBeenCalledWith(
      'Formato no válido', 'Solo se permiten imágenes JPG, PNG, WebP o GIF', 'warning',
    );

    const grande = new File(['x'], 'grande.png', { type: 'image/png' });
    Object.defineProperty(grande, 'size', { value: 10 * 1024 * 1024 + 1 });
    subirArchivo(container, grande);
    expect(swalFire).toHaveBeenCalledWith('Archivo muy grande', 'La imagen no debe superar 10 MB', 'warning');

    expect(api.peticiones.some((p) => p.ruta === '/api/auth/foto')).toBe(false);
  });

  it('abre el selector con la cámara y actualiza la foto al subirla', async () => {
    const clickInput = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {});
    const { container } = montar();
    await screen.findByDisplayValue('Admin Probe');

    fireEvent.click(screen.getByTitle('Cambiar foto'));
    expect(clickInput).toHaveBeenCalled();

    subirArchivo(container, new File(['png'], 'foto.png', { type: 'image/png' }));

    await waitFor(() => expect(api.peticiones).toContainEqual(
      expect.objectContaining({ metodo: 'POST', ruta: '/api/auth/foto' }),
    ));
    expect(swalFire).toHaveBeenCalledWith(expect.objectContaining({ icon: 'success', title: 'Foto actualizada' }));
    await waitFor(() => expect(screen.getByAltText('Foto de perfil'))
      .toHaveAttribute('src', 'https://test.local/foto-nueva.png'));
    expect(inputFoto(container).value).toBe('');
  });

  it('reporta el rechazo del servidor y el fallo de red al subir la foto', async () => {
    server.use(http.post('*/api/auth/foto', () => HttpResponse.json({
      ok: false, message: 'Foto rechazada ADMIN-TEST',
    })));
    const { container } = montar();
    await screen.findByDisplayValue('Admin Probe');

    subirArchivo(container, new File(['png'], 'foto.png', { type: 'image/png' }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'warning', title: 'Foto rechazada ADMIN-TEST' }),
    ));

    server.use(http.post('*/api/auth/foto', () => HttpResponse.error()));
    subirArchivo(container, new File(['png'], 'foto2.png', { type: 'image/png' }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'error', title: 'Error al subir la foto' }),
    ));
  });
});

describe('AdminConfiguracion — cambio de contraseña', () => {
  it('exige los tres campos y que la nueva contraseña coincida', async () => {
    montar();
    await screen.findByDisplayValue('Admin Probe');
    await abrirModalPassword();

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    expect(swalFire).toHaveBeenCalledWith('Campos obligatorios', 'Completa todos los campos', 'warning');

    llenarPassword('actual1234', 'nueva12345', 'distinta12345');
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    expect(swalFire).toHaveBeenCalledWith(
      'No coinciden', 'La nueva contraseña y la confirmación no son iguales', 'warning',
    );
    expect(api.peticiones.some((p) => p.metodo === 'POST' && p.ruta === '/api/auth/cambiar-password')).toBe(false);
  });

  it('alterna la visibilidad de las tres contraseñas y cierra por overlay, teclado, ✕ y Cancelar', async () => {
    const { container } = montar();
    await screen.findByDisplayValue('Admin Probe');
    await abrirModalPassword();

    const modal = modalPasswordAbierto()?.closest('.au-modal') as HTMLElement;
    const ojos = modal.querySelectorAll('.input-group .btn-outline-secondary');
    expect(ojos).toHaveLength(3);

    const actual = screen.getByPlaceholderText('Tu contraseña actual');
    const nueva = screen.getByPlaceholderText('Mínimo 8 caracteres');
    const confirmar = screen.getByPlaceholderText('Repite la nueva contraseña');

    fireEvent.click(ojos[0]);
    expect(actual).toHaveAttribute('type', 'text');
    fireEvent.click(ojos[0]);
    expect(actual).toHaveAttribute('type', 'password');

    fireEvent.click(ojos[1]);
    expect(nueva).toHaveAttribute('type', 'text');
    fireEvent.click(ojos[1]);
    expect(nueva).toHaveAttribute('type', 'password');

    fireEvent.click(ojos[2]);
    expect(confirmar).toHaveAttribute('type', 'text');
    fireEvent.click(ojos[2]);
    expect(confirmar).toHaveAttribute('type', 'password');

    fireEvent.click(modal);
    expect(modalPasswordAbierto()).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '✕' }));
    await waitFor(() => expect(modalPasswordAbierto()).not.toBeInTheDocument());

    await abrirModalPassword();
    fireEvent.keyDown(container.querySelector('.evidencia-overlay') as Element, { key: 'Enter' });
    await waitFor(() => expect(modalPasswordAbierto()).not.toBeInTheDocument());

    await abrirModalPassword();
    const modalActual = modalPasswordAbierto()?.closest('.au-modal') as HTMLElement;
    fireEvent.keyDown(modalActual, { key: ' ' });
    await waitFor(() => expect(modalPasswordAbierto()).not.toBeInTheDocument());

    await abrirModalPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    await waitFor(() => expect(modalPasswordAbierto()).not.toBeInTheDocument());

    await abrirModalPassword();
    fireEvent.click(container.querySelector('.evidencia-overlay') as Element);
    await waitFor(() => expect(modalPasswordAbierto()).not.toBeInTheDocument());
  });

  it('reporta el rechazo del servidor y el fallo de red al cambiar la contraseña', async () => {
    server.use(http.post('*/api/auth/cambiar-password', () => HttpResponse.json({
      ok: false, msg: 'Clave rechazada ADMIN-TEST',
    })));
    montar();
    await screen.findByDisplayValue('Admin Probe');
    await abrirModalPassword();
    llenarPassword('actual1234', 'nueva12345', 'nueva12345');

    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'warning', title: 'Clave rechazada ADMIN-TEST' }),
    ));
    expect(modalPasswordAbierto()).toBeInTheDocument();

    server.use(http.post('*/api/auth/cambiar-password', () => HttpResponse.error()));
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));
    await waitFor(() => expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({ icon: 'error', title: 'Error al cambiar la contraseña' }),
    ));
    expect(modalPasswordAbierto()).toBeInTheDocument();
  });
});
