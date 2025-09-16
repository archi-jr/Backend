// webhooks.config.js
const WEBHOOK_TOPICS = {
  // Order webhooks
  ORDERS_CREATE: 'orders/create',
  ORDERS_UPDATED: 'orders/updated',
  ORDERS_CANCELLED: 'orders/cancelled',
  ORDERS_FULFILLED: 'orders/fulfilled',
  ORDERS_PAID: 'orders/paid',
  
  // Customer webhooks
  CUSTOMERS_CREATE: 'customers/create',
  CUSTOMERS_UPDATE: 'customers/update',
  CUSTOMERS_DELETE: 'customers/delete',
  
  // Product webhooks
  PRODUCTS_CREATE: 'products/create',
  PRODUCTS_UPDATE: 'products/update',
  PRODUCTS_DELETE: 'products/delete',
  
  // Checkout webhooks (for custom events)
  CHECKOUTS_CREATE: 'checkouts/create',
  CHECKOUTS_UPDATE: 'checkouts/update',
  CHECKOUTS_DELETE: 'checkouts/delete',
  
  // Cart webhooks
  CARTS_CREATE: 'carts/create',
  CARTS_UPDATE: 'carts/update',
  
  // App uninstalled
  APP_UNINSTALLED: 'app/uninstalled'
};

const CUSTOM_EVENT_TYPES = {
  CART_ABANDONED: 'cart_abandoned',
  CHECKOUT_STARTED: 'checkout_started',
  CHECKOUT_ABANDONED: 'checkout_abandoned',
  HIGH_VALUE_CART: 'high_value_cart',
  FIRST_PURCHASE: 'first_purchase',
  RETURNING_CUSTOMER: 'returning_customer'
};

module.exports = {
  WEBHOOK_TOPICS,
  CUSTOM_EVENT_TYPES
};
