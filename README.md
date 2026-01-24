# Invoice Master - Quick Start Guide

## Prerequisites

- **Docker Desktop** installed (download from docker.com)
- **4GB RAM** available for Docker
- **5GB free disk space**

## Quick Start

### Windows:

```cmd
start-docker.bat
```

### Linux/Mac:

```bash
chmod +x start-docker.sh
./start-docker.sh
```

### Manual:

```bash
docker-compose up -d
```

## Access

- **Frontend (Main App):** http://localhost
- **API:** http://localhost:5001
- **API Docs (Swagger):** http://localhost:5001/swagger
- **Health Check:** http://localhost:5001/health

## Default Login Credentials

### Master User (Highest Privileges)

- **Email:** `chetan.karanjkar@gmail.com`
- **Password:** `Medrio@1234`
- **Role:** MasterUser (Can manage all Admins and view all data)

**Note:** MasterUser can only manage Admin users. They cannot create invoices directly.

## Common Commands

```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Check status
docker-compose ps
```

## Troubleshooting

**Port in use?** Edit `docker-compose.yml` and change ports.

**Services won't start?** Check logs: `docker-compose logs`

**Reset everything?** `docker-compose down -v && docker-compose up -d`

---

For detailed documentation, see: `DOCKER_README.md`
