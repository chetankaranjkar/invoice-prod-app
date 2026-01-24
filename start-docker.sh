#!/bin/bash

echo "===================================="
echo "Invoice Master - Docker Quick Start"
echo "===================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed"
    echo "Please install Docker from https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose is not installed"
    exit 1
fi

echo "Docker is installed and ready!"
echo ""

# Check if containers are already running
if docker-compose ps 2>/dev/null | grep -q "Up"; then
    echo "Containers are already running. Stopping them first..."
    docker-compose down
    echo ""
fi

echo "Starting Invoice Master application..."
echo "This may take 2-3 minutes on first run..."
echo ""

# Start services
docker-compose up -d

if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Failed to start containers"
    echo "Please check the logs: docker-compose logs"
    exit 1
fi

echo ""
echo "===================================="
echo "Application is starting up..."
echo "===================================="
echo ""
echo "Waiting for services to be healthy..."
sleep 10

echo ""
echo "===================================="
echo "Invoice Master is ready!"
echo "===================================="
echo ""
echo "Access the application at:"
echo "  Frontend: http://localhost"
echo "  API Swagger: http://localhost:5001/swagger"
echo ""
echo "Default login credentials:"
echo "  Master User:"
echo "    Email: chetan.karanjkar@gmail.com"
echo "    Password: Medrio@1234"
echo ""
echo "To view logs: docker-compose logs -f"
echo "To stop: docker-compose down"
echo ""
