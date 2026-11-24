import React from 'react';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { server } from '../setup';
import Chats from '../../../frontend/src/pages/Chats';

/**
 * Chats (modo admin): en el hilo de soporte el nombre del cliente es un enlace
 * a su ficha. Se aíslan AuthContext y AdminNavbar; el resto corre real.
 */

const auth = {
  usuario: { ID_USUARIO: 1, NOMBRE_USUARIO: 'Admin Test' },
  usuarioLogueado: true,
  esAdmin: true,
  esVendedor: false,
  loadingAuth: false,
};

vi.mock('../../../frontend/src/context/AuthContext.tsx', () => ({
  useAuth: () => auth,
}));

vi.mock('../../../frontend/src/admin/AdminNavbar.tsx', () => ({
  default: () => null,
}));

const conversacion = {
  ID_CHAT: 9,
  TIPO: 'SOPORTE',
  ESTADO: 'ACTIVA',
  ID_CLIENTE: 3,
  CLIENTE_NOMBRE: 'Ana Cliente',
  VENDEDOR_EMPRESA: null,
  PRODUCTO_NOMBRE: null,
  ID_DEVOLUCION: null,
  PARTE: null,
  DEVOLUCION_ESTADO: null,
  ULTIMO_MENSAJE: 'Necesito ayuda con mi pedido',
  ULTIMO_ROL: 'CLIENTE',
  NO_LEIDOS: 1,
  ULTIMA_ACTIVIDAD: '2026-11-15T10:00:00Z',
};

const montar = () =>
  render(
    <MemoryRouter initialEntries={['/admin/chats?chat=9']}>
      <Routes>
        <Route path="/admin/chats" element={<Chats />} />
        <Route path="/admin/usuarios/:id" element={<div>DETALLE USUARIO</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  server.use(
    http.get('*/api/chat/conversaciones', () => HttpResponse.json([conversacion])),
    http.get('*/api/chat/9/mensajes', () =>
      HttpResponse.json({
        ok: true,
        mensajes: [
          {
            ID_MENSAJE: 1,
            ROL_AUTOR: 'CLIENTE',
            AUTOR_NOMBRE: 'Ana Cliente',
            MENSAJE: 'Necesito ayuda con mi pedido',
            FECHA: '2026-11-15T10:00:00Z',
          },
        ],
        chat: {
          ID_CHAT: 9,
          TIPO: 'SOPORTE',
          ESTADO: 'ACTIVA',
          ID_CLIENTE: 3,
          PRODUCTO: null,
          VENDEDOR_EMPRESA: null,
        },
        mi_rol: 'ADMIN',
      }),
    ),
  );
});

describe('Chats — modo admin', () => {
  it('el nombre del cliente en el hilo abre su ficha de usuario', async () => {
    montar();

    const nombre = await screen.findByRole('button', { name: 'Ana Cliente' }, { timeout: 3000 });
    expect(nombre).toHaveAttribute('title', 'Ver información de Ana Cliente');

    fireEvent.click(nombre);

    expect(await screen.findByText('DETALLE USUARIO')).toBeInTheDocument();
  });
});
