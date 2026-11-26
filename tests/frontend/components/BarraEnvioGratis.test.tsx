import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BarraEnvioGratis from '../../../frontend/src/components/BarraEnvioGratis';

/**
 * BarraEnvioGratis: progreso hacia el umbral real de envío gratis ($800.000).
 * Caracterización de los tres estados: sin subtotal, faltante y logrado.
 */

describe('BarraEnvioGratis', () => {
  it('no renderiza nada si el subtotal es cero o inválido', () => {
    const { container, rerender } = render(<BarraEnvioGratis subtotal={0} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<BarraEnvioGratis subtotal={Number.NaN} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<BarraEnvioGratis subtotal={-1000} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra cuánto falta y la barra proporcional', () => {
    const { container } = render(<BarraEnvioGratis subtotal={400000} />);

    expect(screen.getByText(/Te faltan/)).toBeInTheDocument();
    expect(screen.getByText('$400.000')).toBeInTheDocument();
    expect(container.querySelector('.barra-envio-fill')).toHaveStyle({ width: '50%' });
  });

  it('aplica un mínimo visual del 3% en compras pequeñas', () => {
    const { container } = render(<BarraEnvioGratis subtotal={10000} />);
    expect(container.querySelector('.barra-envio-fill')).toHaveStyle({ width: '3%' });
  });

  it('celebra el envío gratis al alcanzar el umbral y no lo supera', () => {
    const { container, rerender } = render(<BarraEnvioGratis subtotal={800000} />);
    expect(screen.getByText(/¡Tienes/)).toBeInTheDocument();
    expect(screen.getByText('envío gratis')).toBeInTheDocument();
    expect(container.querySelector('.barra-envio-fill')).toHaveStyle({ width: '100%' });

    rerender(<BarraEnvioGratis subtotal={1200000} />);
    expect(container.querySelector('.barra-envio-fill')).toHaveStyle({ width: '100%' });
    expect(screen.queryByText(/Te faltan/)).not.toBeInTheDocument();
  });
});
