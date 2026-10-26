| Class | Limit | Applies to |
|---|---|---|
| `none` | Not rate-limited (health probes; internal metrics). | `GET /healthz`, `GET /readyz`, `GET /metrics` |
| `public` | 60 / min per IP. | `GET /auth/csrf`, `GET /public/pricing`, `GET /public/formats` |
| `contact` | 5 / h per IP. | `POST /public/contact` |
| `auth_register` | 5 / h per IP. | `POST /auth/register` |
| `auth_login` | 5 / min per (IP + email) and 20 / min per IP; account lockout after 10 consecutive failures (15 min). | `POST /auth/login` |
| `auth_mfa` | 5 / min per session and 20 / h per user; 10 consecutive failures revoke the MFA-pending session. | `POST /auth/mfa/verify`, `POST /auth/mfa/enable` |
| `auth_token` | 10 / h per IP (verify-email, reset-password). | `POST /auth/verify-email`, `POST /auth/reset-password` |
| `auth_resend` | 3 / h per user. | `POST /auth/resend-verification` |
| `auth_forgot` | 3 / h per email and 10 / h per IP (silently not sent above limit; response still 202). | `POST /auth/forgot-password` |
| `auth_password` | 5 / h per user (change-password, MFA setup/disable, payout-method create). | `POST /auth/change-password`, `POST /auth/mfa/setup`, `POST /auth/mfa/disable`, `POST /me/payout-methods` |
| `read` | 600 / min per user. | All other authenticated GETs (54 endpoints) |
| `write` | 120 / min per user. | All other authenticated unsafe methods (52 endpoints) |
| `autosave` | 60 / min per user per task. | `PUT /annotation/tasks/{task_id}/draft` |
| `upload` | 600 / min per user (init, part-urls, status, complete, abort; multipart verification/proof). | `POST /me/verification`, `POST /datasets/{dataset_id}/uploads`, `POST /uploads/{upload_id}/part-urls`, `GET /uploads/{upload_id}`, `POST /uploads/{upload_id}/complete`, `DELETE /uploads/{upload_id}`, `POST /admin/payouts/{payout_id}/proof` |
| `download` | 120 / min per user (presigned URL issuance, preview redirects). | `GET /files/{file_id}/preview/{page}`, `POST /files/{file_id}/download-url`, `GET /attachments/{attachment_id}/download-url`, `POST /admin/exports/{export_id}/download-url` |
| `payout_request` | 10 / h per user. | `POST /payouts` |
| `messaging` | 30 / min per user. | `POST /conversations`, `POST /conversations/{conversation_id}/messages` |
| `attachment` | 60 / h per user. | `POST /conversations/{conversation_id}/attachments` |
| `export` | 10 / h per user. | `POST /admin/exports` |
| `ws` | 10 connection attempts / min per user; max 5 concurrent sockets per user. | `GET /ws` |