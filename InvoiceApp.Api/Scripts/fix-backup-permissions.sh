#!/bin/bash
# Script to fix backup directory permissions in SQL Server container
# This is called from the API container startup

echo "Fixing backup directory permissions..."

# Try to fix permissions using docker exec from host (if available)
# Note: This requires the API container to have access to Docker socket
# For now, we'll rely on the SQL Server container's entrypoint or manual fix

# Alternative: Use SQL Server's xp_cmdshell to fix permissions
# This requires enabling xp_cmdshell in SQL Server

echo "Backup directory permissions should be fixed manually or via SQL Server entrypoint"
