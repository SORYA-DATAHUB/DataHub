| Method | Path | Permission | con | ann | rev | adm | sup | Resource rule |
|---|---|---|:-:|:-:|:-:|:-:|:-:|---|
| GET | `/api/v1/healthz` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/readyz` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/metrics` | `internal` | net | net | net | net | net |  |
| GET | `/api/v1/auth/csrf` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/register` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/login` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/mfa/verify` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/logout` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/verify-email` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/resend-verification` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/forgot-password` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/reset-password` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/change-password` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/auth/me` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/auth/sessions` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own sessions only |
| DELETE | `/api/v1/auth/sessions/{session_id}` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own sessions only |
| POST | `/api/v1/auth/sessions/revoke-others` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own sessions only |
| POST | `/api/v1/auth/mfa/setup` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/mfa/enable` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/auth/mfa/disable` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | denied for admin/super_admin (`auth.mfa_cannot_disable`) |
| GET | `/api/v1/me/profile` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| PATCH | `/api/v1/me/profile` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| POST | `/api/v1/me/onboarding` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| GET | `/api/v1/me/payout-methods` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | self only (no id in path) |
| POST | `/api/v1/me/payout-methods` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | self only (no id in path) |
| DELETE | `/api/v1/me/payout-methods/{method_id}` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | self only (no id in path) |
| GET | `/api/v1/me/verification` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| POST | `/api/v1/me/verification` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| POST | `/api/v1/me/deletion-request` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| GET | `/api/v1/me/notification-preferences` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| PATCH | `/api/v1/me/notification-preferences` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | self only (no id in path) |
| GET | `/api/v1/public/pricing` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/public/formats` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/public/contact` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/public/takedown-requests` | `public` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| POST | `/api/v1/datasets` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | lists only caller's datasets |
| GET | `/api/v1/datasets` | `dataset.read.own` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | lists only caller's datasets |
| GET | `/api/v1/datasets/{dataset_id}` | `dataset.read.own` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| PATCH | `/api/v1/datasets/{dataset_id}` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| DELETE | `/api/v1/datasets/{dataset_id}` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| POST | `/api/v1/datasets/{dataset_id}/submit` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| POST | `/api/v1/datasets/{dataset_id}/withdraw` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| GET | `/api/v1/datasets/{dataset_id}/files` | `dataset.read.own` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| DELETE | `/api/v1/datasets/{dataset_id}/files/{file_id}` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| GET | `/api/v1/datasets/{dataset_id}/reviews` | `dataset.read.own` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| GET | `/api/v1/datasets/{dataset_id}/estimate` | `dataset.read.own` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner; reads also: assigned reviewer, `dataset.read.any` |
| GET | `/api/v1/files/{file_id}` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | owner · reviewer of the dataset · assignee of a task on the file · `dataset.read.any` |
| GET | `/api/v1/files/{file_id}/preview/{page}` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | owner · reviewer of the dataset · assignee of a task on the file · `dataset.read.any` |
| GET | `/api/v1/files/{file_id}/text` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | owner · reviewer of the dataset · assignee of a task on the file · `dataset.read.any` |
| POST | `/api/v1/files/{file_id}/download-url` | `authenticated` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | owner · reviewer of the dataset · assignee of a task on the file · `dataset.read.any` |
| POST | `/api/v1/datasets/{dataset_id}/uploads` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | dataset owner; dataset draft/changes_requested |
| POST | `/api/v1/uploads/{upload_id}/part-urls` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner of the upload session's dataset |
| GET | `/api/v1/uploads/{upload_id}` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner of the upload session's dataset |
| POST | `/api/v1/uploads/{upload_id}/complete` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner of the upload session's dataset |
| DELETE | `/api/v1/uploads/{upload_id}` | `dataset.create` | ✓ᴿ | — | — | ✓ᴿ | ✓ᴿ | owner of the upload session's dataset |
| GET | `/api/v1/reviews/queue` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | excludes own datasets |
| POST | `/api/v1/datasets/{dataset_id}/claim-review` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | dataset not owned by caller (SoD) |
| GET | `/api/v1/reviews/{review_id}` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | GET: assignee or `dataset.read.any`; PATCH: assignee |
| PUT | `/api/v1/reviews/{review_id}/files/{file_id}` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee reviewer only |
| POST | `/api/v1/reviews/{review_id}/files/bulk` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee reviewer only |
| PATCH | `/api/v1/reviews/{review_id}` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | GET: assignee or `dataset.read.any`; PATCH: assignee |
| GET | `/api/v1/reviews/{review_id}/summary` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee reviewer only |
| POST | `/api/v1/reviews/{review_id}/finalize` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee reviewer only |
| POST | `/api/v1/reviews/{review_id}/release` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee or admin |
| GET | `/api/v1/reviews/history` | `dataset.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | own reviews (admin: any via reviewer_id) |
| GET | `/api/v1/wallet` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own wallet only |
| GET | `/api/v1/wallet/transactions` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own wallet only |
| GET | `/api/v1/earnings` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own wallet only |
| POST | `/api/v1/payouts` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own payouts only |
| GET | `/api/v1/payouts` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own payouts only |
| GET | `/api/v1/payouts/{payout_id}` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own payouts only |
| POST | `/api/v1/payouts/{payout_id}/cancel` | `payout.request` | ✓ᴿ | ✓ᴿ | — | — | — | own payouts only |
| GET | `/api/v1/admin/finance/overview` | `finance.read` | — | — | — | M | M |  |
| GET | `/api/v1/admin/payouts` | `finance.read` | — | — | — | M | M |  |
| GET | `/api/v1/admin/payouts/{payout_id}` | `finance.read` | — | — | — | M | M |  |
| POST | `/api/v1/admin/payouts/{payout_id}/approve` | `payout.approve` | — | — | — | Sᴿ | Sᴿ | actor ≠ payout recipient; 2nd approver ≠ 1st |
| POST | `/api/v1/admin/payouts/{payout_id}/reject` | `payout.approve` | — | — | — | Sᴿ | Sᴿ | actor ≠ payout recipient; 2nd approver ≠ 1st |
| POST | `/api/v1/admin/payouts/{payout_id}/mark-paid` | `payout.record_payment` | — | — | — | Sᴿ | Sᴿ | actor ≠ payout recipient; 2nd approver ≠ 1st |
| POST | `/api/v1/admin/payouts/{payout_id}/mark-failed` | `payout.record_payment` | — | — | — | Sᴿ | Sᴿ | actor ≠ payout recipient; 2nd approver ≠ 1st |
| POST | `/api/v1/admin/payouts/{payout_id}/cancel` | `payout.approve` | — | — | — | S | S |  |
| POST | `/api/v1/admin/payouts/{payout_id}/reverse` | `finance.adjust` | — | — | — | — | Sᴿ | actor ≠ payout recipient; 2nd approver ≠ 1st |
| POST | `/api/v1/admin/payouts/{payout_id}/proof` | `payout.record_payment` | — | — | — | M | M |  |
| POST | `/api/v1/admin/adjustments` | `finance.adjust` | — | — | — | — | Sᴿ | target user ≠ actor |
| GET | `/api/v1/admin/ledger` | `finance.read` | — | — | — | M | M |  |
| GET | `/api/v1/pricing-rules` | `finance.read` | — | — | — | M | M |  |
| POST | `/api/v1/admin/pricing-rules` | `pricing.manage` | — | — | — | — | S |  |
| GET | `/api/v1/admin/finance/reconciliation` | `finance.read` | — | — | — | M | M |  |
| GET | `/api/v1/annotation/projects` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/projects` | `annotation.manage` | — | — | — | M | M |  |
| GET | `/api/v1/annotation/projects/{project_id}` | `annotation.manage` | — | — | — | M | M |  |
| PATCH | `/api/v1/annotation/projects/{project_id}` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/projects/{project_id}/generate-tasks` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/projects/{project_id}/close` | `annotation.manage` | — | — | — | M | M |  |
| GET | `/api/v1/annotation/projects/{project_id}/tasks` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/tasks/{task_id}/assign` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/tasks/bulk-assign` | `annotation.manage` | — | — | — | M | M |  |
| POST | `/api/v1/annotation/tasks/{task_id}/unassign` | `annotation.manage` | — | — | — | M | M |  |
| GET | `/api/v1/annotation/my-tasks` | `annotation.work` | — | ✓ᴿ | — | — | — | own tasks/rewards |
| GET | `/api/v1/annotation/tasks/{task_id}` | `annotation.work` or `annotation.review` or `annotation.manage` | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee · claimant reviewer · `annotation.manage` |
| POST | `/api/v1/annotation/tasks/{task_id}/start` | `annotation.work` | — | ✓ᴿ | — | — | — | active assignee only |
| PUT | `/api/v1/annotation/tasks/{task_id}/draft` | `annotation.work` | — | ✓ᴿ | — | — | — | active assignee only |
| POST | `/api/v1/annotation/tasks/{task_id}/submit` | `annotation.work` | — | ✓ᴿ | — | — | — | active assignee only |
| GET | `/api/v1/annotation/tasks/{task_id}/versions` | `annotation.work` or `annotation.review` or `annotation.manage` | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | assignee · claimant reviewer · `annotation.manage` |
| GET | `/api/v1/annotation/my-rewards` | `annotation.work` | — | ✓ᴿ | — | — | — | own tasks/rewards |
| GET | `/api/v1/annotation/review-queue` | `annotation.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | excludes tasks the caller annotated |
| POST | `/api/v1/annotation/tasks/{task_id}/claim-review` | `annotation.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | not the task's annotator; review: claimant only |
| POST | `/api/v1/annotation/tasks/{task_id}/review` | `annotation.review` | — | — | ✓ᴿ | ✓ᴿ | ✓ᴿ | not the task's annotator; review: claimant only |
| GET | `/api/v1/annotation/reviews/history` | `annotation.review` | — | — | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/conversations` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| POST | `/api/v1/conversations` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| GET | `/api/v1/conversations/{conversation_id}` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| PATCH | `/api/v1/conversations/{conversation_id}` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| GET | `/api/v1/conversations/{conversation_id}/messages` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| POST | `/api/v1/conversations/{conversation_id}/messages` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| POST | `/api/v1/conversations/{conversation_id}/read` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| POST | `/api/v1/conversations/{conversation_id}/attachments` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant, or `message.support` holder |
| GET | `/api/v1/attachments/{attachment_id}/download-url` | `message.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | participant of the attachment's conversation, or uploader, or `message.support` |
| GET | `/api/v1/ws` | `authenticated` | ✓ | ✓ | ✓ | ✓ | ✓ |  |
| GET | `/api/v1/notifications` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own notifications only |
| GET | `/api/v1/notifications/unread-count` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own notifications only |
| POST | `/api/v1/notifications/{notification_id}/read` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own notifications only |
| POST | `/api/v1/notifications/read-all` | `profile.self` | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | ✓ᴿ | own notifications only |
| GET | `/api/v1/admin/users` | `user.read` | — | — | — | M | M |  |
| GET | `/api/v1/admin/users/{user_id}` | `user.read` | — | — | — | M | M |  |
| POST | `/api/v1/admin/users/{user_id}/suspend` | `user.manage` | — | — | — | Sᴿ | Sᴿ | target ≠ self; target holding admin/super_admin requires super_admin |
| POST | `/api/v1/admin/users/{user_id}/reactivate` | `user.manage` | — | — | — | Sᴿ | Sᴿ | target ≠ self; target holding admin/super_admin requires super_admin |
| PUT | `/api/v1/admin/users/{user_id}/roles` | `user.manage` | — | — | — | Sᴿ | Sᴿ | target ≠ self; target holding admin/super_admin requires super_admin |
| POST | `/api/v1/admin/users/{user_id}/revoke-sessions` | `user.manage` | — | — | — | Sᴿ | Sᴿ | target ≠ self; target holding admin/super_admin requires super_admin |
| GET | `/api/v1/admin/verifications` | `user.verify` | — | — | — | M | M |  |
| POST | `/api/v1/admin/verifications/{verification_id}/decision` | `user.verify` | — | — | — | Mᴿ | Mᴿ | subject ≠ actor |
| GET | `/api/v1/admin/deletion-requests` | `user.manage` | — | — | — | M | M |  |
| POST | `/api/v1/admin/deletion-requests/{deletion_id}/decision` | `user.manage` | — | — | — | S | S |  |
| GET | `/api/v1/admin/datasets` | `dataset.read.any` | — | — | — | M | M |  |
| GET | `/api/v1/admin/datasets/{dataset_id}` | `dataset.read.any` | — | — | — | M | M |  |
| POST | `/api/v1/admin/datasets/{dataset_id}/takedown` | `dataset.read.any` | — | — | — | S | S |  |
| POST | `/api/v1/admin/files/{file_id}/rescan` | `dataset.read.any` | — | — | — | M | M |  |
| GET | `/api/v1/admin/takedown-requests` | `user.manage` | — | — | — | M | M |  |
| POST | `/api/v1/admin/takedown-requests/{takedown_id}/decision` | `user.manage` | — | — | — | S | S |  |
| POST | `/api/v1/admin/exports` | `dataset.export` | — | — | — | S | S |  |
| GET | `/api/v1/admin/exports` | `dataset.export` | — | — | — | M | M |  |
| GET | `/api/v1/admin/exports/{export_id}` | `dataset.export` | — | — | — | M | M |  |
| POST | `/api/v1/admin/exports/{export_id}/download-url` | `dataset.export` | — | — | — | M | M |  |
| GET | `/api/v1/admin/analytics/overview` | `analytics.read` | — | — | — | M | M |  |
| GET | `/api/v1/admin/audit-logs` | `audit.read` | — | — | — | — | M |  |
| GET | `/api/v1/admin/security-events` | `audit.read` | — | — | — | — | M |  |
| GET | `/api/v1/admin/background-jobs` | `user.manage` | — | — | — | M | M |  |
| POST | `/api/v1/admin/background-jobs/{job_id}/requeue` | `user.manage` | — | — | — | S | S |  |
| POST | `/api/v1/admin/legal-holds` | `settings.manage` | — | — | — | — | S |  |
| GET | `/api/v1/admin/settings` | `settings.manage` | — | — | — | — | M |  |
| PUT | `/api/v1/admin/settings/{key}` | `settings.manage` | — | — | — | — | S |  |
| GET | `/api/v1/admin/roles` | `user.read` | — | — | — | M | M |  |