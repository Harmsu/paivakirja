#!/usr/bin/env bash
# Yöllinen PostgreSQL-varmuuskopio Object Storageen (yleinen: toimii kaikille hobbysovelluksille).
#
# Ajetaan UpCloud-palvelimella cronista, esim. /etc/cron.d/pg-backup-s3:
#   30 2 * * * postgres /usr/local/bin/pg-backup-to-s3.sh >> /var/log/pg-backup-s3.log 2>&1
#
# Vaatii: rclone (on jo palvelimella), pg_dump. S3-yhteys tulee ympäristömuuttujista
# tiedostosta /etc/pg-backup-s3.env (chmod 600, ei gittiin):
#   RCLONE_CONFIG_BACKUP_TYPE=s3
#   RCLONE_CONFIG_BACKUP_PROVIDER=Other
#   RCLONE_CONFIG_BACKUP_ENDPOINT=https://<objectstorage-endpoint>
#   RCLONE_CONFIG_BACKUP_ACCESS_KEY_ID=...
#   RCLONE_CONFIG_BACKUP_SECRET_ACCESS_KEY=...
#   BACKUP_BUCKET=hobby-db-backups          # eri bucket kuin sovellusten kuvat
#   DATABASES="paivakirja hiff uintiharjoittelu cycling_tracker"
#
# Säilytys: daily/ 14 päivää, monthly/ (kuun 1. päivän dumppi) 6 kuukautta.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/pg-backup-s3.env}"
set -a; . "$ENV_FILE"; set +a
: "${BACKUP_BUCKET:?}" "${DATABASES:?}"

STAMP="$(date -u +%Y-%m-%d)"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
FAILED=0

for db in $DATABASES; do
  file="$TMP/${db}_${STAMP}.dump"
  # -Fc on valmiiksi pakattu ja palautetaan pg_restorella
  if ! pg_dump -Fc --no-owner --no-acl "$db" -f "$file"; then
    echo "$(date -Is) VIRHE: pg_dump $db epäonnistui"; FAILED=1; continue
  fi
  rclone copyto "$file" "backup:$BACKUP_BUCKET/daily/$db/$(basename "$file")"
  if [ "$(date -u +%d)" = "01" ]; then
    rclone copyto "$file" "backup:$BACKUP_BUCKET/monthly/$db/$(basename "$file")"
  fi
  echo "$(date -Is) OK: $db ($(du -h "$file" | cut -f1))"
done

rclone delete --min-age 14d "backup:$BACKUP_BUCKET/daily"
rclone delete --min-age 190d "backup:$BACKUP_BUCKET/monthly"

exit "$FAILED"
