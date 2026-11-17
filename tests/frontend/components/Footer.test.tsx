import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import Footer from '../../../frontend/src/components/Footer';

/**
 * Footer: marca, enlaces de navegación y atención al cliente, redes y el
 * formulario de newsletter (validación local + POST /api/newsletter).
 */

const { mockFire } = vi.hoisted(() => ({ mockFire: vi.fn() }));
vi.mock('sweetalert2', () => ({ default: { fire: mockFire } }));

const montar = () =>
  render(
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<Sonda />} />
      </Routes>
      <Footer />
    </BrowserRouter>,
  );

/** Sonda de ruta: el texto del div refleja pathname + search reales. */
const Sonda = () => {
  const location = useLocation();
  return <div data-testid="sonda">{location.pathname + location.search}</div>;
};

const escribirCorreo = (valor: string) => {
  fireEvent.change(screen.getByLabelText('Correo para novedades'), { target: { value: valor } });
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFire.mockResolvedValue({ isConfirmed: true });
});

describe('Footer — contenido estático', () => {
  it('renderiza la marca, descripción, contacto y copyright', () => {
    montar();

    expect(screen.getByText(/Ropa, calzado y accesorios deportivos/)).toBeInTheDocument();
    expect(screen.getByText('Bogotá, Colombia')).toBeInTheDocument();
    expect(screen.getByText('Compra 100% segura')).toBeInTheDocument();
    expect(screen.getByText(/© 2026 JADDA SPORTS/)).toBeInTheDocument();
  });

  it('los enlaces de navegación y atención al cliente navegan por el router', () => {
    montar();

    fireEvent.click(screen.getByText('Catálogo'));
    expect(screen.getByTestId('sonda')).toHaveTextContent('/catalogo');

    fireEvent.click(screen.getByText('Ofertas'));
    expect(screen.getByTestId('sonda')).toHaveTextContent('/catalogo?descuento=true');

    fireEvent.click(screen.getByText('Sobre Nosotros'));
    expect(screen.getByTestId('sonda')).toHaveTextContent('/sobre-nosotros');

    fireEvent.click(screen.getByText('Contáctanos'));
    expect(screen.getByTestId('sonda')).toHaveTextContent('/contacto');

    fireEvent.click(screen.getByText('Preguntas frecuentes'));
    expect(screen.getByTestId('sonda')).toHaveTextContent('/preguntas-frecuentes');

    fireEvent.click(screen.getByText('Políticas de devolución'));
    expect(screen.getByTestId('sonda')).toHaveTextContent('/politicas-devolucion');

    fireEvent.click(screen.getByText('Términos y condiciones'));
    expect(screen.getByTestId('sonda')).toHaveTextContent('/terminos-condiciones');

    fireEvent.click(screen.getByText('Política de privacidad'));
    expect(screen.getByTestId('sonda')).toHaveTextContent('/politica-privacidad');

    fireEvent.click(screen.getByText('PQR'));
    expect(screen.getByTestId('sonda')).toHaveTextContent('/pqr');
  });

  it('muestra las 4 redes sociales con su aria-label', () => {
    montar();

    expect(screen.getByLabelText('Facebook')).toBeInTheDocument();
    expect(screen.getByLabelText('Instagram')).toBeInTheDocument();
    expect(screen.getByLabelText('TikTok')).toBeInTheDocument();
    expect(screen.getByLabelText('WhatsApp')).toBeInTheDocument();
    expect(document.querySelectorAll('.footer-social')).toHaveLength(4);
  });
});

describe('Footer — newsletter', () => {
  it('correo vacío muestra el Swal de correo inválido', async () => {
    montar();

    fireEvent.click(screen.getByRole('button', { name: /SUSCRIBIRME/ }));

    await waitFor(() => expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'warning',
      title: 'CORREO INVÁLIDO',
      text: 'Ingresa un correo válido para suscribirte.',
    })));
  });

  it('correo con formato inválido muestra el mismo aviso', async () => {
    montar();
    escribirCorreo('no-es-correo');

    fireEvent.click(screen.getByRole('button', { name: /SUSCRIBIRME/ }));

    await waitFor(() => expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({ title: 'CORREO INVÁLIDO' })));
  });

  it('suscripción exitosa muestra ¡SUSCRITO! y limpia el input', async () => {
    server.use(http.post('*/api/newsletter', () => HttpResponse.json({ msg: 'Revisa tu correo FOOT-TEST' }, { status: 200 })));
    montar();
    escribirCorreo('cliente@foot.test');

    fireEvent.click(screen.getByRole('button', { name: /SUSCRIBIRME/ }));

    await waitFor(() => expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success',
      title: '¡SUSCRITO!',
      text: 'Revisa tu correo FOOT-TEST',
    })));
    expect(screen.getByLabelText('Correo para novedades')).toHaveValue('');
  });

  it('respuesta ok sin msg usa el texto por defecto', async () => {
    server.use(http.post('*/api/newsletter', () => HttpResponse.json({}, { status: 200 })));
    montar();
    escribirCorreo('cliente@foot.test');

    fireEvent.click(screen.getByRole('button', { name: /SUSCRIBIRME/ }));

    await waitFor(() => expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'success',
      text: 'Gracias por suscribirte a nuestras novedades.',
    })));
  });

  it('respuesta de error del backend muestra ERROR con el msg y conserva el input', async () => {
    server.use(http.post('*/api/newsletter', () => HttpResponse.json({ msg: 'Correo duplicado FOOT-TEST' }, { status: 409 })));
    montar();
    escribirCorreo('cliente@foot.test');

    fireEvent.click(screen.getByRole('button', { name: /SUSCRIBIRME/ }));

    await waitFor(() => expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error',
      title: 'ERROR',
      text: 'Correo duplicado FOOT-TEST',
    })));
    expect(screen.getByLabelText('Correo para novedades')).toHaveValue('cliente@foot.test');
  });

  it('fallo de red muestra el mensaje de reintento', async () => {
    server.use(http.post('*/api/newsletter', () => HttpResponse.error()));
    montar();
    escribirCorreo('cliente@foot.test');

    fireEvent.click(screen.getByRole('button', { name: /SUSCRIBIRME/ }));

    await waitFor(() => expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({
      icon: 'error',
      text: 'No se pudo suscribir. Intenta de nuevo.',
    })));
  });
});
