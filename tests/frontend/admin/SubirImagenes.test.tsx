import React, { useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import { server } from '../setup';
import { HANDLERS_ADMIN, handlersProductosAdmin, type ApiAdmin, type RequestHandler } from './msw-handlers-admin';
import SubirImagenes from '../../../frontend/src/admin/SubirImagenes.tsx';

vi.mock('sweetalert2', () => ({
  default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) },
}));

import Swal from 'sweetalert2';

/**
 * SubirImagenes contra su código REAL: galería con portada y orden, URL
 * pegada (botón y Enter), quitar con confirmación, subida de archivos vía
 * dataURL y límite de 8 imágenes.
 */

let api: ApiAdmin;
let handlers: RequestHandler[];

/** Wrapper con estado real: los cambios de onChange actualizan la galería. */
const Galeria = ({ inicial, idProducto }: { inicial: string[]; idProducto?: number }) => {
  const [urls, setUrls] = useState<string[]>(inicial);
  return <SubirImagenes urls={urls} onChange={setUrls} idProducto={idProducto} />;
};

const montar = (inicial: string[] = [], idProducto = 7) => render(<Galeria inicial={inicial} idProducto={idProducto} />);

/** Escribe una URL pegada y la agrega con el botón (o Enter). */
const pegar = (url: string, conEnter = false) => {
  const input = screen.getByPlaceholderText('o pega una URL de Cloudinary https://res.cloudinary.com/...');
  fireEvent.change(input, { target: { value: url } });
  if (conEnter) {
    fireEvent.keyDown(input, { key: 'Enter' });
  } else {
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
  }
};

beforeEach(() => {
  ({ api, handlers } = handlersProductosAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('SubirImagenes', () => {
  it('sin imágenes: solo los controles de subida, sin galería ni hint', () => {
    montar();

    expect(screen.queryByAltText('Imagen 1')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subir imágenes del computador' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('o pega una URL de Cloudinary https://res.cloudinary.com/...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agregar' })).toBeInTheDocument();
    expect(screen.queryByText(/Usa las flechas para ordenar/)).not.toBeInTheDocument();
  });

  it('agrega URLs pegadas por botón y por Enter, marcando la primera como Portada', async () => {
    const { container } = montar();

    // Solo rutas del catálogo o Cloudinary: es el origen que el backend admite.
    pegar('/images/productos/subidas/u1.png');
    expect(await screen.findByAltText('Imagen 1')).toHaveAttribute('src', '/images/productos/subidas/u1.png');
    expect(container.querySelector('.si-item .si-badge')).toHaveTextContent('Portada');
    expect(screen.getByPlaceholderText('o pega una URL de Cloudinary https://res.cloudinary.com/...')).toHaveValue('');
    expect(screen.getByText(/Usa las flechas para ordenar/)).toBeInTheDocument();

    pegar('/images/productos/subidas/u2.png', true);
    const badges = container.querySelectorAll('.si-item .si-badge');
    expect(await screen.findByAltText('Imagen 2')).toHaveAttribute('src', '/images/productos/subidas/u2.png');
    expect(badges[badges.length - 1]).toHaveTextContent('2');
  });

  it('rechaza URLs fuera del origen permitido (ftp y https externo) y no agrega nada', () => {
    montar();

    pegar('ftp://test.local/malo.png');
    expect(screen.getByText(/Solo se aceptan URLs de Cloudinary/)).toBeInTheDocument();
    expect(screen.queryByAltText('Imagen 1')).not.toBeInTheDocument();

    // Regla real del backend (urlImagenProductoValida): un https ajeno a
    // Cloudinary NO es admitido; con la validación laxa el POST de creación
    // respondía 400 al publicar.
    pegar('https://test.local/externa.png');
    expect(screen.getByText(/Solo se aceptan URLs de Cloudinary/)).toBeInTheDocument();
    expect(screen.queryByAltText('Imagen 1')).not.toBeInTheDocument();
  });

  it('con dos imágenes muestra Portada, número y flechas con bordes deshabilitados', () => {
    const { container } = montar(['https://test.local/u1.png', 'https://test.local/u2.png']);

    expect(screen.getByAltText('Imagen 1')).toHaveAttribute('src', 'https://test.local/u1.png');
    expect(container.querySelector('.si-item .si-badge')).toHaveTextContent('Portada');

    const item1 = screen.getByAltText('Imagen 1').closest('.si-item') as HTMLElement;
    const item2 = screen.getByAltText('Imagen 2').closest('.si-item') as HTMLElement;
    expect(within(item1).getByTitle('Mover antes')).toBeDisabled();
    expect(within(item1).getByTitle('Mover después')).not.toBeDisabled();
    expect(within(item2).getByTitle('Mover antes')).not.toBeDisabled();
    expect(within(item2).getByTitle('Mover después')).toBeDisabled();
  });

  it('Mover después intercambia el orden y la portada cambia de imagen', async () => {
    montar(['https://test.local/u1.png', 'https://test.local/u2.png']);
    const item1 = screen.getByAltText('Imagen 1').closest('.si-item') as HTMLElement;

    fireEvent.click(within(item1).getByTitle('Mover después'));

    expect(await screen.findByAltText('Imagen 1')).toHaveAttribute('src', 'https://test.local/u2.png');
    expect(screen.getByAltText('Imagen 2')).toHaveAttribute('src', 'https://test.local/u1.png');
  });

  it('quitar pide confirmación y elimina la imagen elegida', async () => {
    montar(['https://test.local/u1.png', 'https://test.local/u2.png']);
    const item1 = screen.getByAltText('Imagen 1').closest('.si-item') as HTMLElement;

    fireEvent.click(within(item1).getByTitle('Quitar imagen'));

    expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({ title: '¿Quitar esta imagen?', confirmButtonText: 'Quitar' }));
    // Esperar la actualización del estado: findByAltText puede devolver el elemento viejo.
    await waitFor(() => expect(screen.getByAltText('Imagen 1')).toHaveAttribute('src', 'https://test.local/u2.png'));
    expect(screen.queryByAltText('Imagen 2')).not.toBeInTheDocument();
  });

  it('sube archivos válidos: dataURL en el POST y la URL devuelta entra a la galería', async () => {
    const { container } = montar([], 7);
    const archivo = new File(['pixel'], 'foto.png', { type: 'image/png' });

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [archivo] } });

    await waitFor(() => expect(api.peticiones).toContainEqual(expect.objectContaining({ metodo: 'POST', ruta: '/api/productos/imagenes' })));
    const cuerpo = api.peticiones.find((p) => p.metodo === 'POST' && p.ruta === '/api/productos/imagenes')?.cuerpo as {
      imagenes: { nombre: string; data: string }[]; idProducto?: number;
    };
    expect(cuerpo.imagenes).toEqual([expect.objectContaining({ nombre: 'foto.png' })]);
    expect(cuerpo.imagenes[0].data).toMatch(/^data:image\/png;base64,/);
    expect(cuerpo.idProducto).toBe(7);
    expect(await screen.findByAltText('Imagen 1')).toHaveAttribute('src', 'https://test.local/upload-1-ADMIN-TEST.png');
  });

  it('un archivo con tipo inválido muestra el error y no emite POST', async () => {
    const { container } = montar([], 7);
    const archivo = new File(['hola'], 'nota.txt', { type: 'text/plain' });

    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, { target: { files: [archivo] } });

    expect(await screen.findByText('"nota.txt" no es una imagen válida (jpg, png, webp, gif)')).toBeInTheDocument();
    await waitFor(() => expect(api.peticiones.some((p) => p.metodo === 'POST')).toBe(false));
    expect(screen.queryByAltText('Imagen 1')).not.toBeInTheDocument();
  });

  it('corta en 8 imágenes: la novena no entra y la galería queda completa', async () => {
    const iniciales = Array.from({ length: 8 }, (_, i) => `https://test.local/u${i + 1}.png`);
    montar(iniciales, 7);

    pegar('/images/productos/subidas/u9.png');

    expect(await screen.findByAltText('Imagen 8')).toHaveAttribute('src', 'https://test.local/u8.png');
    expect(screen.queryByAltText('Imagen 9')).not.toBeInTheDocument();
    expect(screen.getByAltText('Imagen 1')).toHaveAttribute('src', 'https://test.local/u1.png');
  });
});
