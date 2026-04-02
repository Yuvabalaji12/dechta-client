'use strict';

require('dotenv').config();
const app  = require('./src/app');
const PORT = process.env.PORT || 5001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Dechta CLIENT backend running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
  console.log(`📡 Health: http://localhost:${PORT}/api/health`);
  console.log(`📦 Products: http://localhost:${PORT}/api/products`);
});

module.exports = app;
