# Admin API Swagger "Try it out" Guide

Swagger UI requires an authenticated administrator session. Log in through the web app using an account whose session payload contains `isAdmin: true`, then open `/api-docs` in the same browser tab so the `connect.sid` cookie is automatically sent with every request.

## Seeded sample identifiers

The in-memory `adminApiStore` seeds the following deterministic records every time the server boots. Use these identifiers for path parameters when you want to inspect or mutate the pre-populated data.

| Resource | Identifier |
| --- | --- |
| Admin user | `user_admin_controller` |
| Reviewer user | `user_quality_reviewer` |
| Reviewer warning | `warning_reviewer_failed_login` |
| Admin activity entry | `activity_admin_seed_login` |
| Linear algebra auction | `auction_linear_notes` |
| Organic chemistry auction | `auction_organic_chemistry` |
| Seed bid on linear auction | `bid_linear_quality` |
| Fraud report | `report_fraud_suspicion` |
| Settled transaction | `txn_linear_sale` |
| Seed refund | `refund_linear_partial` |
| Pending payout | `payout_linear_seller` |
| Maintenance announcement | `announcement_system_maintenance` |
| Platform name setting | `platformName` |
| Welcome notification | `notification_admin_welcome` |
| Audit bootstrap log | `audit_seed_bootstrap` |
| Email integration | `integration_email_delivery` |
| Moderator invitation | `invitation_moderator_seed` |
| Admin session | `session_admin_seed` |

## GET endpoints (15)

- `GET /admin/api/system/health`
- `GET /admin/api/system/stats`
- `GET /admin/api/users`
- `GET /admin/api/users/{id}` → use `id=user_admin_controller`.
- `GET /admin/api/users/{id}/activity` → use `id=user_admin_controller` (optional `limit` query defaults to 20).
- `GET /admin/api/auctions`
- `GET /admin/api/auctions/{id}` → use `id=auction_linear_notes`.
- `GET /admin/api/auctions/{id}/bids` → use `id=auction_linear_notes`.
- `GET /admin/api/reports`
- `GET /admin/api/reports/{id}` → use `id=report_fraud_suspicion`.
- `GET /admin/api/transactions`
- `GET /admin/api/transactions/{id}` → use `id=txn_linear_sale`.
- `GET /admin/api/payouts`
- `GET /admin/api/announcements`
- `GET /admin/api/settings`

## POST endpoints (15)

```
POST /admin/api/users
{
  "name": "Sandbox User",
  "email": "sandbox@example.com",
  "status": "ACTIVE"
}
```

```
POST /admin/api/users/{id}/warn
id=user_quality_reviewer
{
  "message": "Please update verification details"
}
```

```
POST /admin/api/auctions
{
  "title": "Advanced Calculus Notes",
  "sellerId": "user_admin_controller",
  "status": "OPEN",
  "startingPrice": 15
}
```

```
POST /admin/api/auctions/{id}/bids
id=auction_linear_notes
{
  "bidderId": "user_quality_reviewer",
  "bidderName": "Quality Reviewer",
  "amount": 14
}
```

```
POST /admin/api/reports
{
  "type": "SPAM",
  "auctionId": "auction_organic_chemistry",
  "reporterId": "user_admin_controller",
  "description": "Duplicate listing detected"
}
```

```
POST /admin/api/reports/{id}/resolve
id=report_fraud_suspicion
{
  "resolution": "Confirmed fraudulent pattern and suspended seller"
}
```

```
POST /admin/api/transactions
{
  "auctionId": "auction_linear_notes",
  "amount": 18,
  "buyerId": "user_quality_reviewer",
  "status": "SETTLED"
}
```

```
POST /admin/api/transactions/{id}/refund
id=txn_linear_sale
{
  "amount": 2,
  "reason": "Partial refund for overcharge"
}
```

```
POST /admin/api/payouts
{
  "transactionId": "txn_linear_sale",
  "amount": 10,
  "recipientId": "user_admin_controller",
  "status": "PENDING"
}
```

```
POST /admin/api/announcements
{
  "title": "Holiday Schedule",
  "body": "Operations team will be offline during Chuseok.",
  "status": "DRAFT"
}
```

- `POST /admin/api/announcements/{id}/publish` → use `id=announcement_system_maintenance` (no body required).

```
POST /admin/api/settings
{
  "key": "maxAttachmentSizeMb",
  "value": 25
}
```

```
POST /admin/api/integrations/test
{
  "name": "integration_email_delivery",
  "payload": {
    "template": "test",
    "to": "admin@example.com"
  }
}
```

```
POST /admin/api/audit-logs/search
{
  "actorId": "user_admin_controller",
  "action": "SEED"
}
```

```
POST /admin/api/notifications/broadcast
{
  "message": "System maintenance will start in 1 hour.",
  "audience": "admins",
  "type": "SYSTEM"
}
```

## PUT endpoints (15)

```
PUT /admin/api/users/{id}
id=user_quality_reviewer
{
  "status": "ACTIVE"
}
```

```
PUT /admin/api/users/{id}/status
id=user_quality_reviewer
{
  "status": "SUSPENDED"
}
```

```
PUT /admin/api/auctions/{id}
id=auction_linear_notes
{
  "status": "CLOSED",
  "startingPrice": 11
}
```

```
PUT /admin/api/auctions/{id}/status
id=auction_organic_chemistry
{
  "status": "REVIEW"
}
```

```
PUT /admin/api/reports/{id}
id=report_fraud_suspicion
{
  "status": "UNDER_REVIEW"
}
```

```
PUT /admin/api/reports/{id}/assign
id=report_fraud_suspicion
{
  "assigneeId": "user_admin_controller"
}
```

```
PUT /admin/api/transactions/{id}
id=txn_linear_sale
{
  "status": "SETTLED",
  "amount": 20
}
```

```
PUT /admin/api/transactions/{id}/status
id=txn_linear_sale
{
  "status": "REFUNDED"
}
```

```
PUT /admin/api/payouts/{id}
id=payout_linear_seller
{
  "status": "PAID",
  "amount": 10
}
```

```
PUT /admin/api/payouts/{id}/status
id=payout_linear_seller
{
  "status": "ON_HOLD"
}
```

```
PUT /admin/api/announcements/{id}
id=announcement_system_maintenance
{
  "status": "PUBLISHED",
  "body": "Maintenance completed successfully."
}
```

```
PUT /admin/api/settings/{key}
key=platformName
{
  "value": "Jokbo Trade Plus"
}
```

```
PUT /admin/api/notifications/{id}
id=notification_admin_welcome
{
  "status": "SENT",
  "message": "Updated welcome message"
}
```

```
PUT /admin/api/audit-logs/{id}/flag
id=audit_seed_bootstrap
{
  "flagged": true,
  "reason": "Requires follow-up"
}
```

```
PUT /admin/api/integrations/{name}
name=integration_email_delivery
{
  "status": "ACTIVE",
  "config": {
    "provider": "ses",
    "region": "ap-northeast-2",
    "retryLimit": 3
  }
}
```

## DELETE endpoints (15)

- `DELETE /admin/api/users/{id}` → `id=user_quality_reviewer`.
- `DELETE /admin/api/users/{id}/warnings/{warningId}` → `id=user_quality_reviewer`, `warningId=warning_reviewer_failed_login`.
- `DELETE /admin/api/auctions/{id}` → `id=auction_linear_notes`.
- `DELETE /admin/api/auctions/{id}/bids/{bidId}` → `id=auction_linear_notes`, `bidId=bid_linear_quality`.
- `DELETE /admin/api/reports/{id}` → `id=report_fraud_suspicion`.
- `DELETE /admin/api/transactions/{id}` → `id=txn_linear_sale`.
- `DELETE /admin/api/payouts/{id}` → `id=payout_linear_seller`.
- `DELETE /admin/api/announcements/{id}` → `id=announcement_system_maintenance`.
- `DELETE /admin/api/settings/{key}` → `key=platformName` (recreate afterwards if needed).
- `DELETE /admin/api/notifications/{id}` → `id=notification_admin_welcome`.
- `DELETE /admin/api/audit-logs/{id}` → `id=audit_seed_bootstrap`.
- `DELETE /admin/api/integrations/{name}` → `name=integration_email_delivery`.
- `DELETE /admin/api/system/cache` (no additional input).
- `DELETE /admin/api/system/sessions/{id}` → `id=session_admin_seed`.
- `DELETE /admin/api/invitations/{id}` → `id=invitation_moderator_seed`.

All other POST and PUT operations return the created or updated entity, so you can reuse the `id` from the response for follow-up requests.
