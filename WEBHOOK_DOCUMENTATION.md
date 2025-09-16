# Webhook System Documentation

## Overview
The Xeno App implements a comprehensive webhook system to handle real-time events from Shopify stores, including custom event detection for abandoned carts and checkout processes.

## Architecture

### Components

1. **Webhook Receiver** (`/api/webhooks/shopify`)
   - Verifies Shopify webhook signatures
   - Processes incoming webhooks asynchronously
   - Returns immediate response to Shopify

2. **Event Queue System**
   - Three priority levels: High, Normal, Low
   - In-memory queue using p-queue
   - Automatic retry mechanism for failed events
   - Deduplication using NodeCache

3. **Abandoned Cart Detection**
   - Runs every 10 minutes via cron job
   - 30-minute threshold for cart abandonment
   - 60-minute threshold for checkout abandonment
   - Automatic recovery email scheduling

4. **Custom Events**
   - Cart Abandoned
   - Checkout Started
   - Checkout Abandoned
   - High Value Cart (>$500)
   - First Purchase
   - Returning Customer

## Webhook Topics Supported

### Order Webhooks
- `orders/create`
- `orders/updated`
- `orders/cancelled`
- `orders/fulfilled`
- `orders/paid`

### Customer Webhooks
- `customers/create`
- `customers/update`
- `customers/delete`

### Product Webhooks
- `products/create`
- `products/update`
- `products/delete`

### Checkout & Cart Webhooks
- `checkouts/create`
- `checkouts/update`
- `checkouts/delete`
- `carts/create`
- `carts/update`

### App Webhooks
- `app/uninstalled`

## Event Processing Flow

1. Webhook received from Shopify
2. Signature verification
3. Event added to appropriate priority queue
4. Event stored in database with PENDING status
5. Event processed based on type
6. Custom events triggered if applicable
7. Status updated to COMPLETED or FAILED
8. Failed events added to retry queue (max 3 attempts)

## Database Schema

### Key Tables
- `WebhookEvent`: Stores all webhook events
- `WebhookLog`: Logs all received webhooks
- `CustomEvent`: Stores custom events (abandonment, etc.)
- `CartTracking`: Tracks cart states
- `CheckoutTracking`: Tracks checkout states
- `AbandonmentAnalytics`: Analytics data
- `RecoveryAttempt`: Recovery email attempts

## API Endpoints

### Webhook Endpoints
- `POST /api/webhooks/shopify` - Main webhook receiver
- `POST /api/webhooks/custom-events/cart-abandoned` - Manual cart abandonment
- `POST /api/webhooks/custom-events/checkout-started` - Manual checkout start
- `GET /api/webhooks/analytics/abandonment/:shopId` - Get abandonment metrics
- `GET /api/webhooks/queue/status` - Get queue status
- `POST /api/webhooks/detect-abandoned-carts` - Trigger detection manually

### Event Endpoints
- `GET /api/events/recent` - Get recent custom events
- `GET /api/events/statistics` - Get event statistics
- `GET /api/events/webhook-logs` - Get webhook logs

## Configuration

### Environment Variables
```env
SHOPIFY_WEBHOOK_SECRET=<webhook_secret>
WEBHOOK_ENDPOINT_URL=<your_webhook_url>
CART_ABANDONMENT_THRESHOLD_MINUTES=30
CHECKOUT_ABANDONMENT_THRESHOLD_MINUTES=60
ABANDONMENT_CHECK_INTERVAL_MINUTES=10
