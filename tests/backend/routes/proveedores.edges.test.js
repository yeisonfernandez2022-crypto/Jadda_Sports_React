/*
 * Router público de proveedores (routes/proveedores.js), que estaba en 0%
 * porque ningún test lo requería. El controller se reemplaza ANTES del
 * require del router (el router captura la referencia en carga) para no
 * tocar la BD: solo se prueba el cableado ruta → handler.
 */

const supertest = require('supertest');
const express = require('express');

const proveedorController = require('../../../backend/controllers/proveedorController');
const marca = (req, res) => res.status(200).json([{ ID_PROVEEDOR: 1, NOMBRE_PROVEEDOR: 'STUB' }]);
proveedorController.obtenerProveedores = marca;

const proveedoresRoutes = require('../../../backend/routes/proveedores');

describe('routes/proveedores — listado público', () => {
  const app = express();
  app.use('/api/proveedores', proveedoresRoutes);

  test('GET / responde con el listado del controller', async () => {
    const respuesta = await supertest(app).get('/api/proveedores');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual([{ ID_PROVEEDOR: 1, NOMBRE_PROVEEDOR: 'STUB' }]);
  });
});
