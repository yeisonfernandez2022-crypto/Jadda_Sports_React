const {
  resolverAlcance, condicionAlcance, etiquetaAlcance, sufijoAlcance,
} = require('../../../backend/utils/alcanceReporte');

test('default todo', () => {
  expect(resolverAlcance({})).toEqual({
    tipo: 'todo', idVendedor: null, etiqueta: 'Todo el catálogo', sufijo: 'todo',
  });
});

test('jadda y tienda válida', () => {
  expect(resolverAlcance({ alcance: 'jadda' }).sufijo).toBe('jadda');
  expect(resolverAlcance({ alcance: 'tienda', tienda: '7' })).toEqual({
    tipo: 'tienda', idVendedor: 7, etiqueta: 'Tienda #7', sufijo: 'tienda-7',
  });
});

test('alcance inválido o tienda sin id → 400', () => {
  expect(resolverAlcance({ alcance: 'otro' })).toEqual(expect.objectContaining({ statusCode: 400 }));
  expect(resolverAlcance({ alcance: 'tienda' })).toEqual(expect.objectContaining({ statusCode: 400 }));
  expect(resolverAlcance({ alcance: 'tienda', tienda: '0' })).toEqual(expect.objectContaining({ statusCode: 400 }));
  expect(resolverAlcance({ alcance: 'tienda', tienda: 'abc' })).toEqual(expect.objectContaining({ statusCode: 400 }));
});

test('fragmento SQL y etiquetas', () => {
  const todo = resolverAlcance({});
  expect(condicionAlcance(todo)).toEqual({ sql: '1=1', params: [] });
  expect(condicionAlcance(resolverAlcance({ alcance: 'jadda' }))).toEqual({
    sql: 'p.ID_VENDEDOR IS NULL', params: [],
  });
  const tienda = resolverAlcance({ alcance: 'tienda', tienda: '7' });
  expect(condicionAlcance(tienda, 'v')).toEqual({ sql: 'v.ID_VENDEDOR = ?', params: [7] });
  expect(etiquetaAlcance(tienda, 'DeporteX')).toBe('Tienda: DeporteX');
  expect(sufijoAlcance(tienda)).toBe('tienda-7');
});

test('alias no permitido → error de programación', () => {
  expect(() => condicionAlcance(resolverAlcance({}), 'x')).toThrow();
});
