const http = require("http");
const { Pool } = require("pg");

const PORT = Number(process.env.APP_PORT || 3000);
const DB_HOST = process.env.DB_HOST || "db";
const DB_PORT = Number(process.env.DB_PORT || 5432);

const pool = new Pool({
  host: DB_HOST,
  port: DB_PORT,
  user: process.env.DB_USER || "app",
  password: process.env.DB_PASSWORD || "app",
  database: process.env.DB_NAME || "app",
});

// Without this handler, an idle connection dropped by the database
// (for example after `docker compose stop db`) would crash the app
pool.on("error", (err) => console.error("Idle DB connection error:", err.code || err.message));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A started container does not mean the database is ready.
// Retry the first connection instead of crashing on ECONNREFUSED.
async function connectWithRetry(retries = 10, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Connecting to ${DB_HOST}:${DB_PORT} (attempt ${attempt}/${retries})`);
      await pool.query("SELECT 1");
      console.log("Connected to DB");
      return;
    } catch (err) {
      console.log(`DB not ready: ${err.code || err.message}`);
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }
}

async function initSchema() {
  await pool.query(
    "CREATE TABLE IF NOT EXISTS visits (id SERIAL PRIMARY KEY, visited_at TIMESTAMPTZ NOT NULL DEFAULT now())"
  );
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/health") {
      await pool.query("SELECT 1");
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ status: "ok", db: "connected" }));
    }

    if (req.url === "/") {
      await pool.query("INSERT INTO visits DEFAULT VALUES");
      const { rows } = await pool.query("SELECT count(*)::int AS total FROM visits");
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end(`Hello from Node.js + PostgreSQL. Visits stored in the database: ${rows[0].total}\n`);
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found\n");
  } catch (err) {
    console.error("Request failed:", err.code || err.message);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "error", error: err.code || err.message }));
  }
});

connectWithRetry()
  .then(initSchema)
  .then(() => server.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => {
    console.error("Could not connect to the database, exiting:", err.message);
    process.exit(1);
  });

// Stop cleanly when Docker sends SIGTERM (docker compose stop / down)
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down");
  server.close(() => pool.end().then(() => process.exit(0)));
});
