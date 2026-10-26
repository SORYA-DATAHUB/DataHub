| # | Method | Path | Permission | Notes |
|---|---|---|---|---|
| 1 | GET | `/api/v1/healthz` | `public` |  |
| 2 | GET | `/api/v1/readyz` | `public` |  |
| 3 | GET | `/api/v1/metrics` | `internal` |  |
| 4 | GET | `/api/v1/auth/csrf` | `public` |  |
| 5 | POST | `/api/v1/auth/register` | `public` |  |
| 6 | POST | `/api/v1/auth/login` | `public` |  |
| 7 | POST | `/api/v1/auth/mfa/verify` | `user` |  |
| 8 | POST | `/api/v1/auth/logout` | `user` |  |
| 9 | POST | `/api/v1/auth/verify-email` | `public` |  |
| 10 | POST | `/api/v1/auth/resend-verification` | `user` |  |
| 11 | POST | `/api/v1/auth/forgot-password` | `public` |  |
| 12 | POST | `/api/v1/auth/reset-password` | `public` |  |
| 13 | POST | `/api/v1/auth/change-password` | `user` |  |
| 14 | GET | `/api/v1/auth/me` | `user` |  |
| 15 | GET | `/api/v1/auth/sessions` | `user` |  |
| 16 | DELETE | `/api/v1/auth/sessions/{session_id}` | `user` |  |
| 17 | POST | `/api/v1/auth/sessions/revoke-others` | `user` |  |
| 18 | POST | `/api/v1/auth/mfa/setup` | `user` |  |
| 19 | POST | `/api/v1/auth/mfa/enable` | `user` |  |
| 20 | POST | `/api/v1/auth/mfa/disable` | `user` |  |
| 21 | GET | `/api/v1/me/profile` | `profile.self` |  |
| 22 | PATCH | `/api/v1/me/profile` | `profile.self` | If-Match optional |
| 23 | POST | `/api/v1/me/onboarding` | `profile.self` |  |
| 24 | GET | `/api/v1/me/payout-methods` | `payout.request` |  |
| 25 | POST | `/api/v1/me/payout-methods` | `payout.request` |  |
| 26 | DELETE | `/api/v1/me/payout-methods/{method_id}` | `payout.request` |  |
| 27 | GET | `/api/v1/me/verification` | `profile.self` |  |
| 28 | POST | `/api/v1/me/verification` | `profile.self` |  |
| 29 | POST | `/api/v1/me/deletion-request` | `profile.self` |  |
| 30 | GET | `/api/v1/me/notification-preferences` | `profile.self` |  |
| 31 | PATCH | `/api/v1/me/notification-preferences` | `profile.self` |  |
| 32 | GET | `/api/v1/public/pricing` | `public` |  |
| 33 | GET | `/api/v1/public/formats` | `public` |  |
| 34 | POST | `/api/v1/public/contact` | `public` |  |
| 35 | POST | `/api/v1/datasets` | `dataset.create` |  |
| 36 | GET | `/api/v1/datasets` | `dataset.read.own` |  |
| 37 | GET | `/api/v1/datasets/{dataset_id}` | `dataset.read.own` |  |
| 38 | PATCH | `/api/v1/datasets/{dataset_id}` | `dataset.create` | If-Match optional |
| 39 | DELETE | `/api/v1/datasets/{dataset_id}` | `dataset.create` |  |
| 40 | POST | `/api/v1/datasets/{dataset_id}/submit` | `dataset.create` |  |
| 41 | POST | `/api/v1/datasets/{dataset_id}/withdraw` | `dataset.create` |  |
| 42 | GET | `/api/v1/datasets/{dataset_id}/files` | `dataset.read.own` |  |
| 43 | DELETE | `/api/v1/datasets/{dataset_id}/files/{file_id}` | `dataset.create` |  |
| 44 | GET | `/api/v1/datasets/{dataset_id}/reviews` | `dataset.read.own` |  |
| 45 | GET | `/api/v1/datasets/{dataset_id}/estimate` | `dataset.read.own` |  |
| 46 | GET | `/api/v1/files/{file_id}` | `user` |  |
| 47 | GET | `/api/v1/files/{file_id}/preview/{page}` | `user` |  |
| 48 | GET | `/api/v1/files/{file_id}/text` | `user` |  |
| 49 | POST | `/api/v1/files/{file_id}/download-url` | `user` |  |
| 50 | POST | `/api/v1/datasets/{dataset_id}/uploads` | `dataset.create` |  |
| 51 | POST | `/api/v1/uploads/{upload_id}/part-urls` | `dataset.create` |  |
| 52 | GET | `/api/v1/uploads/{upload_id}` | `dataset.create` |  |
| 53 | POST | `/api/v1/uploads/{upload_id}/complete` | `dataset.create` |  |
| 54 | DELETE | `/api/v1/uploads/{upload_id}` | `dataset.create` |  |
| 55 | GET | `/api/v1/reviews/queue` | `dataset.review` |  |
| 56 | POST | `/api/v1/datasets/{dataset_id}/claim-review` | `dataset.review` |  |
| 57 | GET | `/api/v1/reviews/{review_id}` | `dataset.review` |  |
| 58 | PUT | `/api/v1/reviews/{review_id}/files/{file_id}` | `dataset.review` |  |
| 59 | POST | `/api/v1/reviews/{review_id}/files/bulk` | `dataset.review` |  |
| 60 | PATCH | `/api/v1/reviews/{review_id}` | `dataset.review` | If-Match optional |
| 61 | GET | `/api/v1/reviews/{review_id}/summary` | `dataset.review` |  |
| 62 | POST | `/api/v1/reviews/{review_id}/finalize` | `dataset.review` | Idempotency-Key optional |
| 63 | POST | `/api/v1/reviews/{review_id}/release` | `dataset.review` |  |
| 64 | GET | `/api/v1/reviews/history` | `dataset.review` |  |
| 65 | GET | `/api/v1/wallet` | `payout.request` |  |
| 66 | GET | `/api/v1/wallet/transactions` | `payout.request` |  |
| 67 | GET | `/api/v1/earnings` | `payout.request` |  |
| 68 | POST | `/api/v1/payouts` | `payout.request` | Idempotency-Key required |
| 69 | GET | `/api/v1/payouts` | `payout.request` |  |
| 70 | GET | `/api/v1/payouts/{payout_id}` | `payout.request` |  |
| 71 | POST | `/api/v1/payouts/{payout_id}/cancel` | `payout.request` | Idempotency-Key optional |
| 72 | GET | `/api/v1/admin/finance/overview` | `finance.read` | admin MFA |
| 73 | GET | `/api/v1/admin/payouts` | `finance.read` | admin MFA |
| 74 | GET | `/api/v1/admin/payouts/{payout_id}` | `finance.read` | admin MFA |
| 75 | POST | `/api/v1/admin/payouts/{payout_id}/approve` | `payout.approve` | admin MFA, step-up, Idempotency-Key optional |
| 76 | POST | `/api/v1/admin/payouts/{payout_id}/reject` | `payout.approve` | admin MFA, step-up, Idempotency-Key optional |
| 77 | POST | `/api/v1/admin/payouts/{payout_id}/mark-paid` | `payout.record_payment` | admin MFA, step-up, Idempotency-Key optional |
| 78 | POST | `/api/v1/admin/payouts/{payout_id}/mark-failed` | `payout.record_payment` | admin MFA, step-up, Idempotency-Key optional |
| 79 | POST | `/api/v1/admin/payouts/{payout_id}/cancel` | `payout.approve` | admin MFA, step-up, Idempotency-Key optional |
| 80 | POST | `/api/v1/admin/payouts/{payout_id}/reverse` | `finance.adjust` | admin MFA, step-up, Idempotency-Key optional |
| 81 | POST | `/api/v1/admin/payouts/{payout_id}/proof` | `payout.record_payment` | admin MFA |
| 82 | POST | `/api/v1/admin/adjustments` | `finance.adjust` | admin MFA, step-up, Idempotency-Key optional |
| 83 | GET | `/api/v1/admin/ledger` | `finance.read` | admin MFA |
| 84 | GET | `/api/v1/pricing-rules` | `finance.read` | admin MFA |
| 85 | POST | `/api/v1/admin/pricing-rules` | `pricing.manage` | admin MFA, step-up, Idempotency-Key optional |
| 86 | GET | `/api/v1/admin/finance/reconciliation` | `finance.read` | admin MFA |
| 87 | GET | `/api/v1/annotation/projects` | `annotation.manage` | admin MFA |
| 88 | POST | `/api/v1/annotation/projects` | `annotation.manage` | admin MFA |
| 89 | GET | `/api/v1/annotation/projects/{project_id}` | `annotation.manage` | admin MFA |
| 90 | PATCH | `/api/v1/annotation/projects/{project_id}` | `annotation.manage` | admin MFA, If-Match optional |
| 91 | POST | `/api/v1/annotation/projects/{project_id}/generate-tasks` | `annotation.manage` | admin MFA |
| 92 | POST | `/api/v1/annotation/projects/{project_id}/close` | `annotation.manage` | admin MFA |
| 93 | GET | `/api/v1/annotation/projects/{project_id}/tasks` | `annotation.manage` | admin MFA |
| 94 | POST | `/api/v1/annotation/tasks/{task_id}/assign` | `annotation.manage` | admin MFA |
| 95 | POST | `/api/v1/annotation/tasks/bulk-assign` | `annotation.manage` | admin MFA |
| 96 | POST | `/api/v1/annotation/tasks/{task_id}/unassign` | `annotation.manage` | admin MFA |
| 97 | GET | `/api/v1/annotation/my-tasks` | `annotation.work` |  |
| 98 | GET | `/api/v1/annotation/tasks/{task_id}` | `annotation.work` or `annotation.review` or `annotation.manage` |  |
| 99 | POST | `/api/v1/annotation/tasks/{task_id}/start` | `annotation.work` |  |
| 100 | PUT | `/api/v1/annotation/tasks/{task_id}/draft` | `annotation.work` | If-Match required |
| 101 | POST | `/api/v1/annotation/tasks/{task_id}/submit` | `annotation.work` | If-Match optional |
| 102 | GET | `/api/v1/annotation/tasks/{task_id}/versions` | `annotation.work` or `annotation.review` or `annotation.manage` |  |
| 103 | GET | `/api/v1/annotation/my-rewards` | `annotation.work` |  |
| 104 | GET | `/api/v1/annotation/review-queue` | `annotation.review` |  |
| 105 | POST | `/api/v1/annotation/tasks/{task_id}/claim-review` | `annotation.review` |  |
| 106 | POST | `/api/v1/annotation/tasks/{task_id}/review` | `annotation.review` | Idempotency-Key optional |
| 107 | GET | `/api/v1/annotation/reviews/history` | `annotation.review` |  |
| 108 | GET | `/api/v1/conversations` | `message.self` |  |
| 109 | POST | `/api/v1/conversations` | `message.self` |  |
| 110 | GET | `/api/v1/conversations/{conversation_id}` | `message.self` |  |
| 111 | PATCH | `/api/v1/conversations/{conversation_id}` | `message.self` |  |
| 112 | GET | `/api/v1/conversations/{conversation_id}/messages` | `message.self` |  |
| 113 | POST | `/api/v1/conversations/{conversation_id}/messages` | `message.self` |  |
| 114 | POST | `/api/v1/conversations/{conversation_id}/read` | `message.self` |  |
| 115 | POST | `/api/v1/conversations/{conversation_id}/attachments` | `message.self` |  |
| 116 | GET | `/api/v1/attachments/{attachment_id}/download-url` | `message.self` |  |
| 117 | GET | `/api/v1/ws` | `user` |  |
| 118 | GET | `/api/v1/notifications` | `profile.self` |  |
| 119 | GET | `/api/v1/notifications/unread-count` | `profile.self` |  |
| 120 | POST | `/api/v1/notifications/{notification_id}/read` | `profile.self` |  |
| 121 | POST | `/api/v1/notifications/read-all` | `profile.self` |  |
| 122 | GET | `/api/v1/admin/users` | `user.read` | admin MFA |
| 123 | GET | `/api/v1/admin/users/{user_id}` | `user.read` | admin MFA |
| 124 | POST | `/api/v1/admin/users/{user_id}/suspend` | `user.manage` | admin MFA, step-up |
| 125 | POST | `/api/v1/admin/users/{user_id}/reactivate` | `user.manage` | admin MFA, step-up |
| 126 | PUT | `/api/v1/admin/users/{user_id}/roles` | `user.manage` | admin MFA, step-up |
| 127 | POST | `/api/v1/admin/users/{user_id}/revoke-sessions` | `user.manage` | admin MFA, step-up |
| 128 | GET | `/api/v1/admin/verifications` | `user.verify` | admin MFA |
| 129 | POST | `/api/v1/admin/verifications/{verification_id}/decision` | `user.verify` | admin MFA |
| 130 | GET | `/api/v1/admin/datasets` | `dataset.read.any` | admin MFA |
| 131 | GET | `/api/v1/admin/datasets/{dataset_id}` | `dataset.read.any` | admin MFA |
| 132 | POST | `/api/v1/admin/datasets/{dataset_id}/takedown` | `dataset.read.any` | admin MFA, step-up |
| 133 | POST | `/api/v1/admin/files/{file_id}/rescan` | `dataset.read.any` | admin MFA |
| 134 | POST | `/api/v1/admin/exports` | `dataset.export` | admin MFA, step-up |
| 135 | GET | `/api/v1/admin/exports` | `dataset.export` | admin MFA |
| 136 | GET | `/api/v1/admin/exports/{export_id}` | `dataset.export` | admin MFA |
| 137 | POST | `/api/v1/admin/exports/{export_id}/download-url` | `dataset.export` | admin MFA |
| 138 | GET | `/api/v1/admin/analytics/overview` | `analytics.read` | admin MFA |
| 139 | GET | `/api/v1/admin/audit-logs` | `audit.read` | admin MFA |
| 140 | GET | `/api/v1/admin/security-events` | `audit.read` | admin MFA |
| 141 | GET | `/api/v1/admin/settings` | `settings.manage` | admin MFA |
| 142 | PUT | `/api/v1/admin/settings/{key}` | `settings.manage` | admin MFA, step-up, If-Match optional |
| 143 | GET | `/api/v1/admin/roles` | `user.read` | admin MFA |