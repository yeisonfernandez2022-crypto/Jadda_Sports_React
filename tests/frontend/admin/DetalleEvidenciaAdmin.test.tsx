import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { server } from '../setup';
import {
  HANDLERS_ADMIN,
  EVIDENCIA_DETALLE_IMAGENES_ADMIN,
  handlersRetosAdmin,
  type ApiAdmin,
  type RequestHandler,
} from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import DetalleEvidenciaAdmin from '../../../frontend/src/admin/DetalleEvidenciaAdmin.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * Página de detalle de una evidencia de reto: encabezado claro, usuario, reto
 * con progreso, galería con zoom y acciones de aprobar/rechazar.
 * Consume GET /api/retos/admin/evidencias/:id.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

const renderDetalle = (ruta = '/admin/retos/21') =>
  renderAdmin(
    <Routes>
      <Route path="/admin/retos/:id" element={<DetalleEvidenciaAdmin />} />
      <Route path="/admin/retos" element={<p>lista-retos</p>} />
      <Route path="/admin/usuarios/:id" element={<p>detalle-usuario</p>} />
    </Routes>,
    { ruta }
  );

beforeEach(() => {
  ({ api, handlers } = handlersRetosAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('DetalleEvidenciaAdmin', () => {
  it('muestra encabezado, usuario, reto, progreso y la galería de dos imágenes', async () => {
    renderDetalle();

    expect(await screen.findByRole('heading', { level: 1, name: /Evidencia de reto/i })).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Reto 10K ADMIN-TEST')).toBeInTheDocument();
    expect(screen.getByText('3/10')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a evidencias/i })).toHaveAttribute('href', '/admin/retos');
    expect(screen.getByRole('link', { name: /ver usuario/i })).toHaveAttribute('href', '/admin/usuarios/71');

    expect(screen.getByAltText('Evidencia 1')).toHaveAttribute('src', 'https://test.local/evidencia-1.jpg');
    expect(screen.getByAltText('Evidencia 2')).toHaveAttribute('src', 'https://test.local/evidencia-2.jpg');
  });

  it('el clic en una imagen abre el visor ampliado y Escape lo cierra', async () => {
    renderDetalle();
    await screen.findByRole('heading', { level: 1, name: /Evidencia de reto/i });

    fireEvent.click(screen.getByAltText('Evidencia 1'));

    expect(screen.getByRole('dialog', { name: /evidencia ampliada/i })).toBeInTheDocument();
    expect(screen.getByAltText('Evidencia ampliada')).toHaveAttribute('src', 'https://test.local/evidencia-1.jpg');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /evidencia ampliada/i })).not.toBeInTheDocument();
  });

  it('el clic fuera de la imagen también cierra el visor', async () => {
    renderDetalle();
    await screen.findByRole('heading', { level: 1, name: /Evidencia de reto/i });

    fireEvent.click(screen.getByAltText('Evidencia 2'));
    fireEvent.click(screen.getByRole('dialog', { name: /evidencia ampliada/i }));

    expect(screen.queryByRole('dialog', { name: /evidencia ampliada/i })).not.toBeInTheDocument();
  });

  it('una evidencia aprobada con video no muestra acciones y reproduce con controls', async () => {
    renderDetalle('/admin/retos/22');

    expect(await screen.findByRole('heading', { level: 1, name: /Evidencia de reto/i })).toBeInTheDocument();
    expect(screen.getByText('Mario Ruiz')).toBeInTheDocument();
    expect(screen.getByText('APROBADO')).toBeInTheDocument();
    expect(screen.getByText(/Material verificado ADMIN-TEST/)).toBeInTheDocument();

    const video = screen.getByLabelText(/evidencia en video/i) as HTMLVideoElement;
    expect(video.tagName).toBe('VIDEO');
    expect(video.controls).toBe(true);

    expect(screen.queryByRole('button', { name: /aprobar avance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rechazar/i })).not.toBeInTheDocument();
  });

  it('aprobar confirma, hace POST y actualiza el estado local', async () => {
    renderDetalle();
    await screen.findByRole('heading', { level: 1, name: /Evidencia de reto/i });

    fireEvent.click(screen.getByRole('button', { name: /aprobar avance/i }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Aprobar esta evidencia?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST',
      ruta: '/api/retos/admin/evidencias/21/aprobar',
      cuerpo: { observacion: '' },
    })));
    await waitFor(() => expect(screen.getByText('APROBADO')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /aprobar avance/i })).not.toBeInTheDocument();
  });

  it('rechazar envía la observación y actualiza el estado local', async () => {
    (Swal.fire as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ isConfirmed: true, value: 'No corresponde ADMIN-TEST' });
    renderDetalle();
    await screen.findByRole('heading', { level: 1, name: /Evidencia de reto/i });

    fireEvent.click(screen.getByRole('button', { name: /rechazar/i }));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Rechazar esta evidencia?' }));
    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({
      metodo: 'POST',
      ruta: '/api/retos/admin/evidencias/21/rechazar',
      cuerpo: { observacion: 'No corresponde ADMIN-TEST' },
    })));
    await waitFor(() => expect(screen.getByText('RECHAZADO')).toBeInTheDocument());
  });

  it('un RUTAS_EXTRA inválido se ignora y conserva la ruta principal', async () => {
    server.use(http.get('*/api/retos/admin/evidencias/:id', () =>
      HttpResponse.json({ ...EVIDENCIA_DETALLE_IMAGENES_ADMIN, RUTAS_EXTRA: 'no-es-json' })));
    renderDetalle();

    expect(await screen.findByAltText('Evidencia 1')).toBeInTheDocument();
    expect(screen.queryByAltText('Evidencia 2')).not.toBeInTheDocument();
  });

  it('una evidencia inexistente muestra el error y el enlace de vuelta', async () => {
    renderDetalle('/admin/retos/999');

    expect(await screen.findByText(/Evidencia no encontrada/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a evidencias/i })).toHaveAttribute('href', '/admin/retos');
  });
});
