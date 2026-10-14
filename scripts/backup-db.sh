#!/usr/bin/env bash
# =========================================================
# UnlazyNotes Automated PostgreSQL Database Backup Script
# =========================================================
set -e

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/unlazynotes}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/unlazynotes_${TIMESTAMP}.sql.gz"
RETENTION_DAYS="${RETENTION_DAYS:-7}"

# Detect running postgres container & database name
CONTAINER_NAME="unlazynotes-db"
DB_NAME="${POSTGRES_DB:-unlazynotes}"

if ! sudo docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  if sudo docker ps --format '{{.Names}}' | grep -q "^unlazynotes-dev-db$"; then
    CONTAINER_NAME="unlazynotes-dev-db"
    DB_NAME="unlazynotes_dev"
  else
    echo "❌ Error: Neither 'unlazynotes-db' nor 'unlazynotes-dev-db' container is currently running."
    exit 1
  fi
fi

mkdir -p "$BACKUP_DIR"

echo "📦 [$(date +'%Y-%m-%d %H:%M:%S')] Starting database backup from container '${CONTAINER_NAME}' (db: ${DB_NAME})..."

# Execute pg_dump inside container and pipe through gzip
sudo docker exec "$CONTAINER_NAME" pg_dump -U postgres "$DB_NAME" | gzip > "$FILENAME"

# Verify backup file size
FILESIZE=$(ls -lh "$FILENAME" | awk '{print $5}')
echo "✅ [$(date +'%Y-%m-%d %H:%M:%S')] Backup created successfully: $FILENAME ($FILESIZE)"

# Prune backups older than RETENTION_DAYS
echo "🧹 Pruning backups older than ${RETENTION_DAYS} days in $BACKUP_DIR..."
find "$BACKUP_DIR" -type f -name "unlazynotes_*.sql.gz" -mtime +"$RETENTION_DAYS" -exec rm -f {} +

echo "🎉 Backup workflow finished successfully."

# =========================================================
# Offsite Cloud Storage Upload (Optional: Cloudflare R2 / AWS S3)
# Uncomment below when S3/R2 credentials or rclone are configured:
#
# if command -v aws >/dev/null 2>&1; then
#   aws s3 cp "$FILENAME" "s3://${S3_BACKUP_BUCKET:-unlazy-backups}/postgres/"
# elif command -v rclone >/dev/null 2>&1; then
#   rclone copy "$FILENAME" "r2:unlazy-backups/postgres/"
# fi
# =========================================================
