const { esVisibleParaAdmin, SQL_DEVOLUCION_VISIBLE_ADMIN } =
  require('../../../backend/utils/devolucionesVisibilidad');

test('JADDA es visible en cualquier estado', () => {
  expect(esVisibleParaAdmin({ idVendedor: null, estado: 'SOLICITADA' })).toBe(true);
  expect(esVisibleParaAdmin({ idVendedor: undefined, estado: 'MAS_PRUEBAS' })).toBe(true);
});

test('tienda oculta mientras la gestiona el vendedor', () => {
  expect(esVisibleParaAdmin({ idVendedor: 4, estado: 'SOLICITADA' })).toBe(false);
  expect(esVisibleParaAdmin({ idVendedor: 4, estado: 'MAS_PRUEBAS' })).toBe(false);
});

test('tienda visible al escalar o cerrar', () => {
  for (const estado of ['ESCALADA', 'APROBADA', 'RECHAZADA']) {
    expect(esVisibleParaAdmin({ idVendedor: 4, estado })).toBe(true);
  }
});

test('el SQL centraliza la misma regla', () => {
  expect(SQL_DEVOLUCION_VISIBLE_ADMIN)
    .toBe("(p.ID_VENDEDOR IS NULL OR d.ESTADO IN ('ESCALADA', 'APROBADA', 'RECHAZADA'))");
});
