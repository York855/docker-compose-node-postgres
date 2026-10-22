# Node.js + PostgreSQL with Docker Compose

A two-service stack: a small Node.js web app and a PostgreSQL database, started with one command.
The app counts page visits and stores them in the database, so you can see that the services talk to each other and that data survives restarts.

```mermaid
flowchart LR
    U[Browser<br/>localhost:3000] --> A[app<br/>Node.js]
    A -- "db:5432<br/>(Compose DNS)" --> D[(db<br/>PostgreSQL 16)]
    D --- V[(db-data<br/>named volume)]
```

## What this project shows

- **Service discovery by name.** The app connects to `db:5432`. Compose puts both containers on one network, and its DNS resolves the service name `db` to the database container, so no IP addresses are hard-coded.
- **Startup order that waits for readiness.** A running container is not the same as a database that accepts connections. The `db` service has a `pg_isready` healthcheck, and the app starts only when `db` is healthy (`depends_on: condition: service_healthy`).
- **Retry logic as a second safety net.** If the database is still unavailable, the app retries the connection 10 times instead of crashing with `ECONNREFUSED`.
- **Persistent data.** PostgreSQL data lives in the named volume `db-data`, so it survives `docker compose down` and is removed only with `docker compose down -v`.
- **Container image built from a Dockerfile.** Dependencies are installed in a separate layer for caching, and the app runs as the non-root `node` user.
- **Configuration through environment variables.** Defaults live in `compose.yaml`; real values go into `.env`, which is excluded from Git.

## Project structure

```
.
├── compose.yaml      # both services, healthchecks, volume
├── .env.example      # template for local settings
└── app/
    ├── Dockerfile    # image for the Node.js app
    ├── package.json
    └── server.js     # HTTP server + PostgreSQL connection with retries
```

## How to run

Requirements: Docker with Docker Compose.

```bash
git clone https://github.com/Yoruk855/docker-compose-node-postgres.git
cd docker-compose-node-postgres
docker compose up --build
```

Open http://localhost:3000. Each refresh adds a visit to the database.

Health endpoint: http://localhost:3000/health

To use your own credentials, copy `.env.example` to `.env` and edit it before the first start.

## Things to try

| Command | What happens |
| --- | --- |
| `docker compose ps` | Both services show as `healthy` |
| `docker compose logs app` | `Connecting to db:5432 …` then `Connected to DB` |
| `docker compose stop db`, then open `/health` | The app keeps running and answers with `500` and `ENOTFOUND`: with the `db` container stopped, Compose DNS no longer resolves the name `db` |
| `docker compose start db` | The app recovers without a restart |
| `docker compose down`, then `up` | The visit counter keeps its value: data is in the volume |
| `docker compose down -v`, then `up` | The counter starts from 1: the volume was deleted |

## The problem this project solves

The first version of the app crashed on startup with `ECONNREFUSED`. Compose had started both containers at the same time, and the app tried to connect while PostgreSQL was still initializing. The fix has two parts: a healthcheck on the database with `depends_on: condition: service_healthy`, and retry logic in the app.

## Stop and clean up

```bash
docker compose down      # stop and remove containers, keep data
docker compose down -v   # also delete the database volume
```
