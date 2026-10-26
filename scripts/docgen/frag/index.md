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
| 35 | POST | `/api/v1/public/takedown-requests` | `public` |  |
| 36 | POST | `/api/v1/datasets` | `dataset.create` |  |
| 37 | GET | `/api/v1/datasets` | `dataset.read.own` |  |
| 38 | GET | `/api/v1/datasets/{dataset_id}` | `dataset.read.own` |  |
| 39 | PATCH | `/api/v1/datasets/{dataset_id}` | `dataset.create` | If-Match optional |
| 40 | DELETE | `/api/v1/datasets/{dataset_id}` | `dataset.create` |  |
| 41 | POST | `/api/v1/datasets/{dataset_id}/submit` | `dataset.create` |  |
| 42 | POST | `/api/v1/datasets/{dataset_id}/withdraw` | `dataset.create` |  |
| 43 | GET | `/api/v1/datasets/{dataset_id}/files` | `dataset.read.own` |  |
| 44 | DELETE | `/api/v1/datasets/{dataset_id}/files/{file_id}` | `dataset.create` |  |
| 45 | GET | `/api/v1/datasets/{dataset_id}/reviews` | `dataset.read.own` |  |
| 46 | GET | `/api/v1/datasets/{dataset_id}/estimate` | `dataset.read.own` |  |
| 47 | GET | `/api/v1/files/{file_id}` | `user` |  |
| 48 | GET | `/api/v1/files/{file_id}/preview/{page}` | `user` |  |
| 49 | GET | `/api/v1/files/{file_id}/text` | `user` |  |
| 50 | POST | `/api/v1/files/{file_id}/download-url` | `user` |  |
| 51 | POST | `/api/v1/datasets/{dataset_id}/uploads` | `dataset.create` |  |
| 52 | POST | `/api/v1/uploads/{upload_id}/part-urls` | `dataset.create` |  |
| 53 | GET | `/api/v1/uploads/{upload_id}` | `dataset.create` |  |
| 54 | POST | `/api/v1/uploads/{upload_id}/complete` | `dataset.create` |  |
| 55 | DELETE | `/api/v1/uploads/{upload_id}` | `dataset.create` |  |
| 56 | GET | `/api/v1/reviews/queue` | `dataset.review` |  |
| 57 | POST | `/api/v1/datasets/{dataset_id}/claim-review` | `dataset.review` |  |
| 58 | GET | `/api/v1/reviews/{review_id}` | `dataset.review` |  |
| 59 | PUT | `/api/v1/reviews/{review_id}/files/{file_id}` | `dataset.review` |  |
| 60 | POST | `/api/v1/reviews/{review_id}/files/bulk` | `dataset.review` |  |
| 61 | PATCH | `/api/v1/reviews/{review_id}` | `dataset.review` | If-Match optional |
| 62 | GET | `/api/v1/reviews/{review_id}/summary` | `dataset.review` |  |
| 63 | POST | `/api/v1/reviews/{review_id}/finalize` | `dataset.review` | Idempotency-Key optional |
| 64 | POST | `/api/v1/reviews/{review_id}/release` | `dataset.review` |  |
| 65 | GET | `/api/v1/reviews/history` | `dataset.review` |  |
| 66 | GET | `/api/v1/wallet` | `payout.request` |  |
| 67 | GET | `/api/v1/wallet/transactions` | `payout.request` |  |
| 68 | GET | `/api/v1/earnings` | `payout.request` |  |
| 69 | POST | `/api/v1/payouts` | `payout.request` | Idempotency-Key required |
| 70 | GET | `/api/v1/payouts` | `payout.request` |  |
| 71 | GET | `/api/v1/payouts/{payout_id}` | `payout.request` |  |
| 72 | POST | `/api/v1/payouts/{payout_id}/cancel` | `payout.request` | Idempotency-Key optional |
| 73 | GET | `/api/v1/admin/finance/overview` | `finance.read` | admin MFA |
| 74 | GET | `/api/v1/admin/payouts` | `finance.read` | admin MFA |
| 75 | GET | `/api/v1/admin/payouts/{payout_id}` | `finance.read` | admin MFA |
| 76 | POST | `/api/v1/admin/payouts/{payout_id}/approve` | `payout.approve` | admin MFA, step-up, Idempotency-Key optional |
| 77 | POST | `/api/v1/admin/payouts/{payout_id}/reject` | `payout.approve` | admin MFA, step-up, Idempotency-Key optional |
| 78 | POST | `/api/v1/admin/payouts/{payout_id}/mark-paid` | `payout.record_payment` | admin MFA, step-up, Idempotency-Key optional |
| 79 | POST | `/api/v1/admin/payouts/{payout_id}/mark-failed` | `payout.record_payment` | admin MFA, step-up, Idempotency-Key optional |
| 80 | POST | `/api/v1/admin/payouts/{payout_id}/cancel` | `payout.approve` | admin MFA, step-up, Idempotency-Key optional |
| 81 | POST | `/api/v1/admin/payouts/{payout_id}/reverse` | `finance.adjust` | admin MFA, step-up, Idempotency-Key optional |
| 82 | POST | `/api/v1/admin/payouts/{payout_id}/proof` | `payout.record_payment` | admin MFA |
| 83 | POST | `/api/v1/admin/adjustments` | `finance.adjust` | admin MFA, step-up, Idempotency-Key optional |
| 84 | GET | `/api/v1/admin/ledger` | `finance.read` | admin MFA |
| 85 | GET | `/api/v1/pricing-rules` | `finance.read` | admin MFA |
| 86 | POST | `/api/v1/admin/pricing-rules` | `pricing.manage` | admin MFA, step-up, Idempotency-Key optional |
| 87 | GET | `/api/v1/admin/finance/reconciliation` | `finance.read` | admin MFA |
| 88 | GET | `/api/v1/annotation/projects` | `annotation.manage` | admin MFA |
| 89 | POST | `/api/v1/annotation/projects` | `annotation.manage` | admin MFA |
| 90 | GET | `/api/v1/annotation/projects/{project_id}` | `annotation.manage` | admin MFA |
| 91 | PATCH | `/api/v1/annotation/projects/{project_id}` | `annotation.manage` | admin MFA, If-Match optional |
| 92 | POST | `/api/v1/annotation/projects/{project_id}/generate-tasks` | `annotation.manage` | admin MFA |
| 93 | POST | `/api/v1/annotation/projects/{project_id}/close` | `annotation.manage` | admin MFA |
| 94 | GET | `/api/v1/annotation/projects/{project_id}/tasks` | `annotation.manage` | admin MFA |
| 95 | POST | `/api/v1/annotation/tasks/{task_id}/assign` | `annotation.manage` | admin MFA |
| 96 | POST | `/api/v1/annotation/tasks/bulk-assign` | `annotation.manage` | admin MFA |
| 97 | POST | `/api/v1/annotation/tasks/{task_id}/unassign` | `annotation.manage` | admin MFA |
| 98 | GET | `/api/v1/annotation/my-tasks` | `annotation.work` |  |
| 99 | GET | `/api/v1/annotation/tasks/{task_id}` | `annotation.work` or `annotation.review` or `annotation.manage` |  |
| 100 | POST | `/api/v1/annotation/tasks/{task_id}/start` | `annotation.work` |  |
| 101 | PUT | `/api/v1/annotation/tasks/{task_id}/draft` | `annotation.work` | If-Match required |
| 102 | POST | `/api/v1/annotation/tasks/{task_id}/submit` | `annotation.work` | If-Match optional |
| 103 | GET | `/api/v1/annotation/tasks/{task_id}/versions` | `annotation.work` or `annotation.review` or `annotation.manage` |  |
| 104 | GET | `/api/v1/annotation/my-rewards` | `annotation.work` |  |
| 105 | GET | `/api/v1/annotation/review-queue` | `annotation.review` |  |
| 106 | POST | `/api/v1/annotation/tasks/{task_id}/claim-review` | `annotation.review` |  |
| 107 | POST | `/api/v1/annotation/tasks/{task_id}/review` | `annotation.review` | Idempotency-Key optional |
| 108 | GET | `/api/v1/annotation/reviews/history` | `annotation.review` |  |
| 109 | GET | `/api/v1/conversations` | `message.self` |  |
| 110 | POST | `/api/v1/conversations` | `message.self` |  |
| 111 | GET | `/api/v1/conversations/{conversation_id}` | `message.self` |  |
| 112 | PATCH | `/api/v1/conversations/{conversation_id}` | `message.self` |  |
| 113 | GET | `/api/v1/conversations/{conversation_id}/messages` | `message.self` |  |
| 114 | POST | `/api/v1/conversations/{conversation_id}/messages` | `message.self` |  |
| 115 | POST | `/api/v1/conversations/{conversation_id}/read` | `message.self` |  |
| 116 | POST | `/api/v1/conversations/{conversation_id}/attachments` | `message.self` |  |
| 117 | GET | `/api/v1/attachments/{attachment_id}/download-url` | `message.self` |  |
| 118 | GET | `/api/v1/ws` | `user` |  |
| 119 | GET | `/api/v1/notifications` | `profile.self` |  |
| 120 | GET | `/api/v1/notifications/unread-count` | `profile.self` |  |
| 121 | POST | `/api/v1/notifications/{notification_id}/read` | `profile.self` |  |
| 122 | POST | `/api/v1/notifications/read-all` | `profile.self` |  |
| 123 | GET | `/api/v1/admin/users` | `user.read` | admin MFA |
| 124 | GET | `/api/v1/admin/users/{user_id}` | `user.read` | admin MFA |
| 125 | POST | `/api/v1/admin/users/{user_id}/suspend` | `user.manage` | admin MFA, step-up |
| 126 | POST | `/api/v1/admin/users/{user_id}/reactivate` | `user.manage` | admin MFA, step-up |
| 127 | PUT | `/api/v1/admin/users/{user_id}/roles` | `user.manage` | admin MFA, step-up |
| 128 | POST | `/api/v1/admin/users/{user_id}/revoke-sessions` | `user.manage` | admin MFA, step-up |
| 129 | GET | `/api/v1/admin/verifications` | `user.verify` | admin MFA |
| 130 | POST | `/api/v1/admin/verifications/{verification_id}/decision` | `user.verify` | admin MFA |
| 131 | GET | `/api/v1/admin/datasets` | `dataset.read.any` | admin MFA |
| 132 | GET | `/api/v1/admin/datasets/{dataset_id}` | `dataset.read.any` | admin MFA |
| 133 | POST | `/api/v1/admin/datasets/{dataset_id}/takedown` | `dataset.read.any` | admin MFA, step-up |
| 134 | POST | `/api/v1/admin/files/{file_id}/rescan` | `dataset.read.any` | admin MFA |
| 135 | GET | `/api/v1/admin/takedown-requests` | `user.manage` | admin MFA |
| 136 | POST | `/api/v1/admin/takedown-requests/{takedown_id}/decision` | `user.manage` | admin MFA, step-up |
| 137 | POST | `/api/v1/admin/exports` | `dataset.export` | admin MFA, step-up |
| 138 | GET | `/api/v1/admin/exports` | `dataset.export` | admin MFA |
| 139 | GET | `/api/v1/admin/exports/{export_id}` | `dataset.export` | admin MFA |
| 140 | POST | `/api/v1/admin/exports/{export_id}/download-url` | `dataset.export` | admin MFA |
| 141 | GET | `/api/v1/admin/analytics/overview` | `analytics.read` | admin MFA |
| 142 | GET | `/api/v1/admin/audit-logs` | `audit.read` | admin MFA |
| 143 | GET | `/api/v1/admin/security-events` | `audit.read` | admin MFA |
| 144 | GET | `/api/v1/admin/settings` | `settings.manage` | admin MFA |
| 145 | PUT | `/api/v1/admin/settings/{key}` | `settings.manage` | admin MFA, step-up, If-Match optional |
| 146 | GET | `/api/v1/admin/roles` | `user.read` | admin MFA |