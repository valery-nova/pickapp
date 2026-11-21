# n8n setup

Import each JSON in `n8n/workflows/` as a new workflow. Replace placeholders:

- `PICKAPP_APP_URL` → your app URL, default `http://localhost:3000`
- `N8N_WEBHOOK_SECRET` → shared secret sent as `x-pickapp-webhook-secret` when the app calls n8n
- Supabase credentials only inside n8n credentials store, never in the repo

Recommended flow for the hackathon demo:

1. `ai-product-creator`: receives product image metadata from the app, calls the configured LLM, validates JSON, returns a draft.
2. `ai-sales-assistant`: receives store slug + message, fetches catalog/inventory through app data APIs, replies with grounded JSON.
3. `smart-order-manager`: receives order intent, calls `POST /api/orders` with idempotency key, then logs notification.
4. `inventory-automation`: scheduled or event webhook; reads inventory and emits low-stock alerts to automation logs/notifications.
5. `ai-business-analyst`: reads `/api/analytics`, summarizes recommendations, stores a sales insight.
6. `customer-follow-up`: checks pending orders and prepares follow-up messages without sending real WhatsApp unless a channel credential is configured.

The app already performs transactional order/inventory work in Supabase RPCs or the demo provider; n8n should orchestrate, notify, analyze, and not bypass validation.
