# Backup & Disaster Recovery

Roadmap Phase 6 ("Keamanan & Deployment: backup & disaster recovery").
Backup tersedia sebagai script `pg_dump` sederhana, dijalankan LEWAT
container `postgres` (`docker compose exec`) supaya versi client `pg_dump`
selalu cocok dengan versi server (image `postgres:16-alpine` di
`docker-compose.yml`), tanpa bergantung apa yang terinstall di host.

## Backup manual

```bash
./scripts/backup.sh
```

Menghasilkan `backups/hr_backend_<timestamp>.sql.gz` — format plain SQL
(bukan custom `-Fc`) supaya bisa dibuka/di-diff manusia saat audit, dengan
trade-off restore sedikit lebih lambat untuk database besar (di luar
cakupan ukuran yang ditargetkan roadmap ini; untuk skala jauh lebih besar,
pertimbangkan format custom + `pg_restore -j` paralel).

Direktori `backups/` sengaja **di-gitignore** — isinya data produksi
sungguhan (termasuk kolom terenkripsi seperti NIK/NPWP/rekening bank),
tidak pernah boleh masuk version control.

## Restore

```bash
./scripts/restore.sh backups/hr_backend_20260101T000000Z.sql.gz
```

**PERINGATAN**: script ini men-drop & recreate schema `public` sebelum
restore — MENIMPA seluruh isi database tujuan. Wajib konfirmasi eksplisit
(ketik `ya`) sebelum jalan. Jangan jalankan ke database production yang
masih dipakai tanpa maintenance window & pemberitahuan.

Backup yang belum pernah dicoba di-restore bukan backup yang bisa
diandalkan — `restore.sh` dibuat & didokumentasikan BERSAMA `backup.sh`
dari awal, bukan disusulkan nanti.

## Penjadwalan otomatis (belum ada di repo ini)

Belum ada cron job/scheduled task yang menjalankan `backup.sh` secara
berkala — script ini SIAP dipanggil dari cron/CI scheduler
(`0 2 * * * cd /path/to/hr-backend && ./scripts/backup.sh`), tapi
penjadwalan aktualnya adalah keputusan operasional (retensi berapa hari,
disimpan ke mana — S3/objek storage lain, dst.) yang harus disepakati
sebelum dipasang, bukan diasumsikan secara sepihak di sini.

## Yang BELUM tercakup

- Retensi otomatis (hapus backup lebih tua dari N hari) — `backups/` akan
  terus bertambah tanpa pembersihan otomatis.
- Upload ke object storage eksternal (S3/GCS/dst.) — saat ini backup
  hanya tersimpan lokal di mesin yang menjalankan script.
- Point-in-time recovery (PITR) — butuh WAL archiving, di luar cakupan
  setup Postgres single-container saat ini.
