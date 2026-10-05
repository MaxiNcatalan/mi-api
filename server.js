const express = require("express");

// ---------- 1. Configuración desde variables de entorno ----------
const config = {
  port: parseInt(process.env.PORT, 10) || 3000, // Railway inyecta PORT
  appName: process.env.APP_NAME || "mi-api",
  environment: process.env.RAILWAY_ENVIRONMENT_NAME || "local",
  commit: (process.env.RAILWAY_GIT_COMMIT_SHA || "dev").slice(0, 7),
  apiKey: process.env.API_KEY, // secreto: obligatorio
};

// Fail fast: si falta algo crítico, no arrancamos.
if (!config.apiKey) {
  console.error(JSON.stringify({ level: "error", msg: "Falta la variable API_KEY" }));
  process.exit(1);
}

const app = express();
const startedAt = Date.now();
let shuttingDown = false;

// ---------- 2. Health check (liveness): rápido, sin dependencias ----------
app.get("/health", (req, res) => {
  if (shuttingDown) {
    return res.status(503).json({ status: "shutting_down" });
  }
  res.status(200).json({
    status: "ok",
    app: config.appName,
    environment: config.environment,
    version: config.commit,
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
  });
});

// ---------- 3. Ruta de negocio de ejemplo ----------
app.get("/", (req, res) => {
  res.json({ message: `Hola desde ${config.appName}`, version: config.commit });
});

// ---------- 4. Arranque y apagado limpio ----------
const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(
    JSON.stringify({
      level: "info",
      msg: "Servidor iniciado",
      port: config.port,
      environment: config.environment,
      version: config.commit,
    })
  );
});

// Railway envía SIGTERM al reemplazar un deployment viejo.
process.on("SIGTERM", () => {
  console.log(JSON.stringify({ level: "info", msg: "SIGTERM recibido, cerrando..." }));
  shuttingDown = true;
  server.close(() => {
    console.log(JSON.stringify({ level: "info", msg: "Cierre limpio completado" }));
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref(); // salvavidas
});