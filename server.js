const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 8080;
const isDevelopment = process.env.NODE_ENV !== 'production';

// En producción, servir desde dist; en desarrollo, desde webapp
const staticPath = isDevelopment 
  ? path.join(__dirname, 'webapp')
  : path.join(__dirname, 'dist');

console.log(`📂 Serving from: ${staticPath}`);

// Logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Servir archivos estáticos
app.use(express.static(staticPath));

// Servir recursos de UI5 desde node_modules
app.use('/resources', express.static(path.join(__dirname, 'node_modules/@openui5')));
app.use('/test-resources', express.static(path.join(__dirname, 'node_modules/@openui5')));

// Health check para Railway
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    serving: staticPath
  });
});

// Todas las rutas devuelven index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Manejo de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: isDevelopment ? err.message : 'Something went wrong'
  });
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('╔═══════════════════════════════════════════════╗');
  console.log('║  🚀 SAP UI5 Application Server              ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📂 Serving from: ${staticPath}`);
  console.log(`🏥 Health check: http://0.0.0.0:${PORT}/health`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
  });
});