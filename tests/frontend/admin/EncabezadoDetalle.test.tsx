import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EncabezadoDetalle from '../../../frontend/src/admin/EncabezadoDetalle.tsx';

/**
 * Encabezado compartido de las páginas de detalle admin. Sustituye al hero
 * azul de los modales por una cabecera clara con volver, breadcrumb, badges y
 * acciones; la variante compacta se usa dentro de modales ya abiertos.
 */

describe('EncabezadoDetalle', () => {
  it('página completa: h1, volver, breadcrumb, subtítulo, badges y acciones', () => {
    render(
      <MemoryRouter>
        <EncabezadoDetalle
          icono={<span>icono</span>}
          titulo="Detalle de usuario"
          subtitulo="Ana Pérez"
          volver={{ to: '/admin/usuarios', label: 'Volver a usuarios' }}
          breadcrumb={[
            { label: 'Usuarios', to: '/admin/usuarios' },
            { label: 'Detalle' },
          ]}
          badges={<span>Admin</span>}
          acciones={<button>Acción</button>}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Detalle de usuario' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /volver a usuarios/i })).toHaveAttribute('href', '/admin/usuarios');
    expect(screen.getByRole('navigation', { name: 'breadcrumb' })).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Acción' })).toBeInTheDocument();
    expect(document.querySelector('.au-modal-hero')).toBeNull();
  });

  it('compacto: h2, sin volver ni breadcrumb y con la clase adp-header--compacto', () => {
    const { container } = render(
      <MemoryRouter>
        <EncabezadoDetalle
          compacto
          icono={<span>icono</span>}
          titulo="Detalle"
          volver={{ to: '/admin/usuarios', label: 'Volver a usuarios' }}
          breadcrumb={[{ label: 'Usuarios', to: '/admin/usuarios' }]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Detalle' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /volver a usuarios/i })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'breadcrumb' })).toBeNull();
    expect(container.querySelector('.adp-header--compacto')).not.toBeNull();
  });
});
