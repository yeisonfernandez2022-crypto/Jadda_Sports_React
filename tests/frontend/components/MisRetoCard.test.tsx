import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MisRetoCard from '../../../frontend/src/components/MisRetoCard';

/**
 * MisRetoCard: tarjeta de "mis retos" con progreso, alertas de revisión/
 * rechazo, cupón ganado y botón de reportar (con reglas de restante y
 * avance diario). esMetaAcumulable y montoMinimoSegunPorcentaje son reales.
 */

type RetoBase = Record<string, unknown>;

const reto = (sobre: RetoBase): RetoBase => ({
  TITULO: 'Reto Card-Test',
  DESCRIPCION: 'Completa 10 días de entrenamiento',
  PROGRESO: 3,
  META_VALOR: 10,
  META_TIPO: 'dias',
  EVIDENCIAS_PENDIENTES: 0,
  EVIDENCIAS_RECHAZADAS: 0,
  PENDIENTE_CANTIDAD: null,
  COMPLETADO: 0,
  AVANCES_HOY: 0,
  CUPON_GENERADO: null,
  RECOMPENSA_PORCENTAJE: null,
  ...sobre,
});

const montar = (retoData: RetoBase, esAdmin = false) => {
  const onVerAvances = vi.fn();
  const onReportar = vi.fn();
  render(<MisRetoCard reto={retoData} esAdmin={esAdmin} onVerAvances={onVerAvances} onReportar={onReportar} />);
  return { onVerAvances, onReportar };
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MisRetoCard — estado general', () => {
  it('en progreso: badge, barra y progreso con porcentaje', () => {
    montar(reto({}));

    expect(screen.getByText('Reto Card-Test')).toBeInTheDocument();
    expect(screen.getByText('En progreso')).toBeInTheDocument();
    // El texto vive repartido en varios nodos: asertar el contenedor.
    expect(document.querySelector('.mis-progress-info')).toHaveTextContent('3/10 dias');
    expect(screen.getByText('30%')).toBeInTheDocument();
    // La barra respeta el porcentaje (Math.min(pct, 100)).
    const fill = document.querySelector('.mis-progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('30%');
  });

  it('el porcentaje de la barra se capra al 100% cuando el progreso supera la meta', () => {
    // El texto muestra el pct crudo (140%); la barra se capra con Math.min.
    montar(reto({ PROGRESO: 14, META_VALOR: 10 }));

    expect(screen.getByText('140%')).toBeInTheDocument();
    const fill = document.querySelector('.mis-progress-fill') as HTMLElement;
    expect(fill.style.width).toBe('100%');
  });

  it('completado: badge, clase y botón "Ver avances enviados" llama onVerAvances', () => {
    const { onVerAvances } = montar(reto({ COMPLETADO: 1, PROGRESO: 10 }));

    expect(screen.getByText('Completado')).toBeInTheDocument();
    expect(document.querySelector('.mis-card')).toHaveClass('completado');
    fireEvent.click(screen.getByRole('button', { name: 'Ver avances enviados' }));
    expect(onVerAvances).toHaveBeenCalledTimes(1);
  });

  it('meta acumulable (km): sin aviso de día reportado aunque haya avances hoy', () => {
    montar(reto({ META_TIPO: 'km', AVANCES_HOY: 2 }));

    expect(screen.queryByText(/Avance de hoy ya reportado/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reportar avance' })).toBeEnabled();
  });
});

describe('MisRetoCard — alertas de revisión y rechazo', () => {
  it('un avance pendiente muestra "Ver avance en revisión" y abre los avances', () => {
    const { onVerAvances } = montar(reto({ EVIDENCIAS_PENDIENTES: 1 }));

    fireEvent.click(screen.getByText('Ver avance en revisión'));
    expect(onVerAvances).toHaveBeenCalledTimes(1);
  });

  it('varios pendientes y rechazados muestran el conteo', () => {
    montar(reto({ EVIDENCIAS_PENDIENTES: 2, EVIDENCIAS_RECHAZADAS: 3 }));

    expect(screen.getByText('Ver 2 avances en revisión')).toBeInTheDocument();
    expect(screen.getByText('Ver 3 avances rechazados')).toBeInTheDocument();
  });

  it('un rechazo muestra el texto singular', () => {
    montar(reto({ EVIDENCIAS_RECHAZADAS: 1 }));

    expect(screen.getByText('Ver avance rechazado')).toBeInTheDocument();
  });

  it('las alertas de rechazo se ocultan cuando el reto está completado', () => {
    montar(reto({ COMPLETADO: 1, EVIDENCIAS_RECHAZADAS: 1 }));

    expect(screen.queryByText(/rechazado/)).not.toBeInTheDocument();
  });
});

describe('MisRetoCard — cupón ganado', () => {
  it('muestra el cupón con su porcentaje y la compra mínima del tramo', () => {
    // 5% → mínimo 100000 (tramo 5-6%).
    montar(reto({ COMPLETADO: 1, CUPON_GENERADO: 'RETO-CARD5', RECOMPENSA_PORCENTAJE: 5 }));

    expect(screen.getByText('RETO-CARD5')).toBeInTheDocument();
    const cupon = document.querySelector('.mis-cupon') as HTMLElement;
    expect(cupon).toHaveTextContent('5% descuento en toda tu compra, un solo uso');
    expect(cupon).toHaveTextContent('compra mínima $100.000');
  });

  it('sin CUPON_GENERADO no aparece la sección de cupón', () => {
    montar(reto({ COMPLETADO: 1, CUPON_GENERADO: null, RECOMPENSA_PORCENTAJE: 5 }));

    expect(document.querySelector('.mis-cupon')).toBeNull();
  });
});

describe('MisRetoCard — botón de reportar', () => {
  it('restante = meta - progreso - pendiente y llama onReportar con él', () => {
    const { onReportar } = montar(reto({ PROGRESO: 3, META_VALOR: 10, EVIDENCIAS_PENDIENTES: 0, PENDIENTE_CANTIDAD: 2 }));

    // El texto de progreso vive repartido en varios nodos: asertar el contenedor.
    expect(document.querySelector('.mis-progress-info')).toHaveTextContent('3/10 dias');
    fireEvent.click(screen.getByRole('button', { name: 'Reportar avance' }));
    expect(onReportar).toHaveBeenCalledWith(expect.objectContaining({ TITULO: 'Reto Card-Test' }), 5);
  });

  it('sin restante (todo pendiente por aprobar) el botón queda deshabilitado', () => {
    montar(reto({ PROGRESO: 8, META_VALOR: 10, PENDIENTE_CANTIDAD: 2 }));

    expect(screen.getByRole('button', { name: 'Meta pendiente por aprobar' })).toBeDisabled();
  });

  it('día ya reportado (meta no acumulable) deshabilita y avisa "vuelve mañana"', () => {
    montar(reto({ META_TIPO: 'dias', AVANCES_HOY: 1 }));

    expect(screen.getByText(/Avance de hoy ya reportado/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vuelve mañana' })).toBeDisabled();
  });

  it('para el admin no hay botón de reportar y aparece la etiqueta de solo visualización', () => {
    montar(reto({}), true);

    expect(screen.queryByRole('button', { name: 'Reportar avance' })).not.toBeInTheDocument();
    expect(screen.getByText('Solo visualización')).toBeInTheDocument();
  });

  it('el reto completado tampoco muestra el botón de reportar', () => {
    montar(reto({ COMPLETADO: 1 }));

    expect(screen.queryByRole('button', { name: 'Reportar avance' })).not.toBeInTheDocument();
  });
});
