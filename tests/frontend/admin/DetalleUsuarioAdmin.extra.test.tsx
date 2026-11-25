import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { server } from '../setup';
import {
  HANDLERS_ADMIN, USUARIO_DETALLE_ADMIN, handlersUsuariosAdmin,
  type RequestHandler,
} from './msw-handlers-admin';
import { renderAdmin } from './helpers';
import DetalleUsuarioAdmin from '../../../frontend/src/admin/DetalleUsuarioAdmin.tsx';

/**
 * DetalleUsuarioAdmin — segunda capa de cobertura.
 *
 * Complementa DetalleUsuarioAdmin.test.tsx con los filtros por estado,
 * el cierre de compras expandidas, el perfil con datos incompletos, las
 * relaciones completas (retos, direcciones, métodos y vendedor parcial),
 * el color de cada rol y el mensaje de error por defecto.
 */

let handlers: RequestHandler[];

const renderDetalle = (ruta = '/admin/usuarios/7') =>
  renderAdmin(
    <Routes>
      <Route path="/admin/usuarios/:id" element={<DetalleUsuarioAdmin />} />
      <Route path="/admin/usuarios" element={<p>lista-usuarios</p>} />
      <Route path="/admin/vendedores/:id" element={<p>detalle-vendedor</p>} />
    </Routes>,
    { ruta },
  );

const servirDetalle = (detalle: Record<string, unknown>) => {
  server.use(http.get('*/api/admin/usuarios/:id', () => HttpResponse.json(detalle)));
};

beforeEach(() => {
  ({ handlers } = handlersUsuariosAdmin());
  server.use(...HANDLERS_ADMIN, ...handlers);
});

describe('DetalleUsuarioAdmin — filtros y compras', () => {
  it('filtra por estado, expande y vuelve a cerrar las compras', async () => {
    renderDetalle();
    await screen.findByRole('heading', { level: 1, name: /Ana Compradora/i });

    const filtro = screen.getByLabelText('Filtrar compras por estado');

    fireEvent.change(filtro, { target: { value: 'completada' } });
    expect(screen.getByRole('button', { name: /compra 9/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compra 502/ })).not.toBeInTheDocument();

    fireEvent.change(filtro, { target: { value: 'cancelada' } });
    expect(screen.getByRole('button', { name: /compra 502/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /compra 9/ })).not.toBeInTheDocument();

    fireEvent.change(filtro, { target: { value: 'pendiente' } });
    expect(screen.getByText('Sin resultados con esos filtros')).toBeInTheDocument();

    fireEvent.change(filtro, { target: { value: 'enviada' } });
    expect(screen.getByText('Sin resultados con esos filtros')).toBeInTheDocument();

    fireEvent.change(filtro, { target: { value: 'todos' } });
    const toggle = screen.getByRole('button', { name: /compra 9/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(screen.getByRole('button', { name: /compra 502/ }));
    expect(screen.getByText('Sin ítems registrados')).toBeInTheDocument();
  });
});

describe('DetalleUsuarioAdmin — datos incompletos', () => {
  it('muestra los huecos de un perfil sin nombre, fechas válidas ni relaciones', async () => {
    servirDetalle({
      usuario: {
        ID_USUARIO: 8, ID_ROL: 4, NOMBRE_ROL: null, NOMBRE_USUARIO: '', APELLIDO_USUARIO: null,
        USUARIO: 'raro', EMAIL: 'raro@test.local', TELEFONO: null, TIPO_DOCUMENTO: null,
        NUMERO_DOCUMENTO: null, CONFIRMADO: 0, AUTH_PROVIDER: 'google',
        FECHA_REGISTRO: '2026-00-00', ULTIMA_CONEXION: 'no-fecha', ULTIMA_UBICACION: 'Bogotá',
        DEBE_CAMBIAR_PASSWORD: 1,
      },
    });
    const { container } = renderDetalle();

    expect(await screen.findByText('Sin rol')).toBeInTheDocument();
    const titulo = screen.getByRole('heading', { level: 1 });
    expect(titulo.textContent).toBe('');
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(container.querySelector('.au-rol-otro')).toHaveTextContent('Sin rol');
    expect(screen.getByText('No verificado')).toBeInTheDocument();
    expect(screen.getAllByText('google').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('@raro · raro@test.local')).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('Sin registros · Bogotá')).toBeInTheDocument();
    expect(screen.getByText('Debe cambiar su contraseña')).toBeInTheDocument();

    expect(screen.getByText('Sin compras registradas')).toBeInTheDocument();
    expect(screen.getByText('No está inscrito en retos')).toBeInTheDocument();
    expect(screen.getByText('Sin direcciones guardadas')).toBeInTheDocument();
    expect(screen.getByText('Sin métodos de pago guardados')).toBeInTheDocument();

    const kpis = container.querySelectorAll('.adp-kpi-valor');
    expect(kpis).toHaveLength(4);
    expect(kpis[0]).toHaveTextContent('0');
  });

  it('usa el mensaje por defecto cuando el error no trae detalle', async () => {
    server.use(http.get('*/api/admin/usuarios/:id', () => HttpResponse.json({}, { status: 500 })));
    renderDetalle();

    expect(await screen.findByText('No se pudo cargar el detalle del usuario.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});

describe('DetalleUsuarioAdmin — relaciones completas', () => {
  it('pinta retos, direcciones, métodos, vendedor parcial y compra con ítems variados', async () => {
    servirDetalle({
      usuario: {
        ID_USUARIO: 9, ID_ROL: 1, NOMBRE_ROL: 'Administrador', NOMBRE_USUARIO: 'Zoe',
        APELLIDO_USUARIO: '', USUARIO: 'zoe', EMAIL: 'zoe@test.local', TELEFONO: '',
        TIPO_DOCUMENTO: 'NIT', NUMERO_DOCUMENTO: '', CONFIRMADO: 1, AUTH_PROVIDER: 'local',
        FECHA_REGISTRO: '2026-02-30', ULTIMA_CONEXION: '2026-11-20T10:00:00.000Z',
        ULTIMA_UBICACION: null, DEBE_CAMBIAR_PASSWORD: 0,
      },
      stats: {
        totalCompras: 1, totalGastado: 50000, totalFavoritos: 0, totalRetos: 2,
        productosPublicados: 1, unidadesVendidas: 2, totalVentas: 3, totalIngresos: 40000,
      },
      compras: [{
        ID_VENTA: 77, ESTADO: 'ENVIADA', FECHA_VENTA: null, TOTAL_ARTICULOS: 3,
        METODO_PAGO: null, TOTAL: 50000, TOTAL_PEDIDO: null, ESTADO_ENVIO: null,
        ENVIO_DIRECCION: 'Calle 1', ENVIO_BARRIO: '', ENVIO_CIUDAD: 'Bogotá',
        ENVIO_DEPARTAMENTO: null, ENVIO_CODIGO_POSTAL: '110111', ENVIO_TELEFONO: null,
        COSTO_ENVIO: null,
        items: [
          {
            ID_VENTA: 77, CANTIDAD: 1, PRECIO_UNITARIO: 10000, SUBTOTAL: 10000,
            NOMBRE: 'Solo color', ID_VENDEDOR: null, IMAGEN: 'https://test.local/x.png',
            COLOR: 'Azul', NOMBRE_ATRIBUTO: null, ATRIBUTO: null,
          },
          {
            ID_VENTA: 77, CANTIDAD: 2, PRECIO_UNITARIO: 20000, SUBTOTAL: 40000,
            NOMBRE: 'Solo atributo', ID_VENDEDOR: 5, IMAGEN: null,
            COLOR: null, NOMBRE_ATRIBUTO: 'Talla', ATRIBUTO: 'M',
          },
        ],
      }],
      retos: [
        {
          ID_RETO_USUARIO: 1, TITULO: 'Reto completado', PROGRESO: 10, META_VALOR: 10,
          META_TIPO: 'km', COMPLETADO: 1, RECOMPENSA_PORCENTAJE: 0,
          EVIDENCIAS_PENDIENTES: 0, CUPON_GENERADO: 'CUPON-TEST',
        },
        {
          ID_RETO_USUARIO: 2, TITULO: 'Reto en curso', PROGRESO: 0, META_VALOR: 0,
          META_TIPO: 'días', COMPLETADO: 0, RECOMPENSA_PORCENTAJE: null,
          EVIDENCIAS_PENDIENTES: null, CUPON_GENERADO: null,
        },
      ],
      direcciones: [
        {
          ID_DIRECCION: 1, ETIQUETA: null, ES_PRINCIPAL: 0, DIRECCION: 'Calle 2',
          BARRIO: null, CIUDAD: 'Cali', DEPARTAMENTO: 'Valle', CODIGO_POSTAL: null,
          TELEFONO_CONTACTO: null,
        },
        {
          ID_DIRECCION: 2, ETIQUETA: 'Oficina', ES_PRINCIPAL: 1, DIRECCION: 'Av 3',
          BARRIO: 'Centro', CIUDAD: 'Bogotá', DEPARTAMENTO: 'Cundinamarca',
          CODIGO_POSTAL: '110', TELEFONO_CONTACTO: '3001234567',
        },
      ],
      metodos: [
        {
          ID: 1, NOMBRE_METODO: 'Tarjeta', ES_PRINCIPAL: 0, TITULAR: null,
          BANCO: null, TIPO: null, TELEFONO: null, FECHA_CREADO: null,
        },
        {
          ID: 2, NOMBRE_METODO: 'Nequi', ES_PRINCIPAL: 1, TITULAR: 'Ana',
          BANCO: 'Bancolombia', TIPO: 'DIGITAL', TELEFONO: '3001234567',
          FECHA_CREADO: '2026-11-01',
        },
      ],
      vendedor: {
        ID_VENDEDOR: 4, ID_SOLICITUD: 44, NOMBRE_EMPRESA: 'Tienda Parcial ADMIN-TEST',
        ESTADO: null, CIUDAD: 'Cali',
      },
    });
    const { container } = renderDetalle();

    expect(await screen.findByRole('heading', { level: 1, name: 'Zoe' })).toBeInTheDocument();
    expect(screen.getByText('Verificado')).toBeInTheDocument();
    expect(container.querySelector('.au-rol-admin')).toHaveTextContent('Administrador');
    expect(screen.queryByText('No verificado')).not.toBeInTheDocument();
    expect(screen.getByText(/Sin estado/)).toBeInTheDocument();
    expect(screen.getByText(/Tienda Parcial ADMIN-TEST/)).toHaveTextContent('Cali');
    expect(screen.getByRole('link', { name: /ver ficha del vendedor/i })).toHaveAttribute('href', '/admin/vendedores/44');

    fireEvent.click(screen.getByRole('button', { name: /compra 77/ }));
    expect(screen.getByText('Solo color')).toBeInTheDocument();
    expect(screen.getByText('Azul')).toBeInTheDocument();
    expect(screen.getByText('Solo atributo')).toBeInTheDocument();
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('JADDA')).toBeInTheDocument();
    expect(screen.getByText('Tienda')).toBeInTheDocument();
    expect(screen.getByText(/Calle 1/)).toBeInTheDocument();
    expect(screen.getByText(/CP 110111/)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);

    const imagen = screen.getByAltText('Solo color');
    fireEvent.error(imagen);
    expect(imagen.getAttribute('src')).toContain('data:image/svg+xml');

    expect(screen.getByText('Completado')).toBeInTheDocument();
    expect(screen.getByText('En progreso')).toBeInTheDocument();
    expect(screen.getByText(/CUPON-TEST/)).toBeInTheDocument();
    expect(screen.getByText(/0\/0 días/)).toBeInTheDocument();
    expect(screen.queryByText(/Premio/)).not.toBeInTheDocument();

    expect(screen.getByText('Dirección')).toBeInTheDocument();
    expect(screen.getByText('Oficina')).toBeInTheDocument();
    expect(screen.getAllByText('Principal').length).toBe(2);
    expect(screen.getByText(/Av 3/)).toBeInTheDocument();
    expect(screen.getByText(/Cundinamarca/)).toBeInTheDocument();

    expect(screen.getByText('Tarjeta')).toBeInTheDocument();
    expect(screen.getByText('Nequi')).toBeInTheDocument();
    expect(screen.getByText(/Titular: Ana · Bancolombia/)).toBeInTheDocument();
    expect(screen.getByText('DIGITAL · 3001234567')).toBeInTheDocument();
  });
});

describe('DetalleUsuarioAdmin — roles', () => {
  it('aplica el color de administrador y asesor', async () => {
    let rolActual = { ID_ROL: 1, clase: 'au-rol-admin' };
    server.use(http.get('*/api/admin/usuarios/:id', () => HttpResponse.json({
      usuario: { ...USUARIO_DETALLE_ADMIN.usuario, ID_ROL: rolActual.ID_ROL },
      compras: [], retos: [], direcciones: [], metodos: [],
    })));

    for (const rol of [
      { ID_ROL: 1, clase: 'au-rol-admin' },
      { ID_ROL: 3, clase: 'au-rol-asesor' },
    ]) {
      rolActual = rol;
      const { unmount, container } = renderDetalle();
      await screen.findByRole('heading', { level: 1, name: /Ana Compradora/i });
      expect(container.querySelector(`.${rol.clase}`)).toHaveTextContent('Cliente');
      unmount();
    }
  });
});
