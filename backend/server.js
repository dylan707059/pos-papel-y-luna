// server.js - punto de entrada del servidor
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const { iniciarDB } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// rutas
app.use('/auth',        require('./routes/auth'));
app.use('/productos',   require('./routes/productos'));
app.use('/categorias',  require('./routes/categorias'));
app.use('/clientes',    require('./routes/clientes'));
app.use('/proveedores', require('./routes/proveedores'));
app.use('/descuentos',  require('./routes/descuentos'));
app.use('/ventas',      require('./routes/ventas'));
app.use('/compras',     require('./routes/compras'));
app.use('/faltantes',   require('./routes/faltantes'));
app.use('/reportes',    require('./routes/reportes'));

app.get('/', (req, res) => {
  res.json({ mensaje: 'POS Papel y Luna - API funcionando', version: 'MVP 3' });
});

// ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// errores generales
app.use((err, req, res, next) => {
  console.error('Error del servidor:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

// iniciar la base de datos y luego el servidor
async function arrancar() {
  try {
    await iniciarDB();
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('No se pudo iniciar el servidor:', err.message);
    process.exit(1);
  }
}

arrancar();
