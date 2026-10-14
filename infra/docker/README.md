# Local Infrastructure

MinIO menyediakan private S3-compatible storage untuk development lokal. Production tetap memakai private managed S3-compatible storage sesuai blueprint, kecuali keputusan deployment kemudian menetapkan MinIO yang dikelola dengan backup, monitoring, dan replikasi yang memadai.

## Menjalankan MinIO

```powershell
Copy-Item infra/docker/.env.example infra/docker/.env
# Ubah MINIO_ROOT_USER dan MINIO_ROOT_PASSWORD pada .env.
docker compose --env-file infra/docker/.env -f infra/docker/compose.yml up -d
```

Endpoint lokal:

- S3 API: `http://localhost:9000`
- Console: `http://localhost:9001`

Bootstrap membuat dua bucket privat:

- `evflow-private`: lampiran transaksi, foto, POD, dokumen HR/Finance, dan XML Coretax;
- `evflow-exports`: hasil ekspor bertenggat. Aplikasi tetap bertanggung jawab atas signed URL, masa berlaku, audit akses, dan lifecycle produksi.

Konfigurasi aplikasi ketika berjalan langsung pada host:

```dotenv
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=<nilai MINIO_ROOT_USER lokal>
S3_SECRET_ACCESS_KEY=<nilai MINIO_ROOT_PASSWORD lokal>
S3_FORCE_PATH_STYLE=true
S3_BUCKET_PRIVATE=evflow-private
S3_BUCKET_EXPORTS=evflow-exports
```

Image `latest` hanya menjadi default development saat bootstrap. Kunci digest atau release image yang telah diuji sebelum CI/pilot. Jangan commit `infra/docker/.env`, file ekspor, upload, atau kredensial nyata.
