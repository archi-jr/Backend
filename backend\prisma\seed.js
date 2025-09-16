const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Create demo tenant
  const demoTenant = await prisma.tenant.upsert({
    where: { shopDomain: 'demo-store.myshopify.com' },
    update: {},
    create: {
      shopDomain: 'demo-store.myshopify.com',
      shopName: 'Demo Store',
      shopEmail: 'demo@xenoapp.com',
      shopOwner: 'Demo User',
      shopPlan: 'basic',
      shopCurrency: 'USD',
      shopTimezone: 'America/New_York',
      isActive: true,
      installedAt: new Date(),
    },
  });

  console.log('Created demo tenant:', demoTenant.shopDomain);

  // Create demo user
  const hashedPassword = await bcrypt.hash('Demo123!@#', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@xenoapp.com' },
    update: {},
    create: {
      email: 'demo@xenoapp.com',
      password: hashedPassword,
      firstName: 'Demo',
      lastName: 'User',
      emailVerified: true,
      tenantId: demoTenant.id,
    },
  });

  console.log('Created demo user:', demoUser.email);

  // Create sample customers
  const customers = [];
  for (let i = 1; i <= 20; i++) {
    customers.push({
      shopifyCustomerId: `demo_customer_${i}`,
      tenantId: demoTenant.id,
      email: `customer${i}@example.com`,
      firstName: `Customer`,
      lastName: `${i}`,
      phone: `+1234567${String(i).padStart(4, '0')}`,
      totalSpent: Math.random() * 5000,
      ordersCount: Math.floor(Math.random() * 20),
      verifiedEmail: true,
      acceptsMarketing: Math.random() > 0.5,
      currency: 'USD',
      shopifyCreatedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    });
  }

  await prisma.customer.createMany({
    data: customers,
    skipDuplicates: true,
  });

  console.log('Created sample customers');

  // Create sample products
  const products = [];
  const productTypes = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports'];
  
  for (let i = 1; i <= 50; i++) {
    products.push({
      shopifyProductId: `demo_product_${i}`,
      tenantId: demoTenant.id,
      title: `Product ${i}`,
      handle: `product-${i}`,
      productType: productTypes[Math.floor(Math.random() * productTypes.length)],
      vendor: `Vendor ${Math.floor(Math.random() * 5) + 1}`,
      status: Math.random() > 0.1 ? 'active' : 'draft',
      tags: `tag${i}, category${Math.floor(i / 10)}`,
      variants: JSON.stringify([
        {
          id: `variant_${i}_1`,
          title: 'Default',
          price: (Math.random() * 200 + 10).toFixed(2),
          sku: `SKU-${i}-1`,
          inventory_quantity: Math.floor(Math.random() * 100),
        },
      ]),
      shopifyCreatedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
    });
  }

  await prisma.product.createMany({
    data: products,
    skipDuplicates: true,
  });

  console.log('Created sample products');

  // Get created customers for orders
  const createdCustomers = await prisma.customer.findMany({
    where: { tenantId: demoTenant.id },
  });

  // Create sample orders
  const orders = [];
  const statuses = ['paid', 'pending', 'refunded', 'partially_paid'];
  
  for (let i = 1; i <= 100; i++) {
    const customer = createdCustomers[Math.floor(Math.random() * createdCustomers.length)];
    const orderTotal = Math.random() * 500 + 20;
    
    orders.push({
      shopifyOrderId: `demo_order_${i}`,
      tenantId: demoTenant.id,
      orderNumber: `#${1000 + i}`,
      customerId: customer.id,
      email: customer.email,
      totalPrice: orderTotal,
      subtotalPrice: orderTotal * 0.9,
      totalTax: orderTotal * 0.1,
      totalDiscounts: Math.random() * 20,
      currency: 'USD',
      financialStatus: statuses[Math.floor(Math.random() * statuses.length)],
      fulfillmentStatus: Math.random() > 0.3 ? 'fulfilled' : 'unfulfilled',
      processedAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
      lineItems: JSON.stringify([
        {
          product_id: `demo_product_${Math.floor(Math.random() * 50) + 1}`,
          quantity: Math.floor(Math.random() * 3) + 1,
          price: (orderTotal * 0.9).toFixed(2),
        },
      ]),
      shopifyCreatedAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000),
    });
  }

  await prisma.order.createMany({
    data: orders,
    skipDuplicates: true,
  });

  console.log('Created sample orders');

  // Create sample custom events
  const events = [];
  const eventTypes = ['cart_abandoned', 'checkout_started', 'product_viewed', 'collection_viewed'];
  
  for (let i = 1; i <= 200; i++) {
    const customer = createdCustomers[Math.floor(Math.random() * createdCustomers.length)];
    
    events.push({
      tenantId: demoTenant.id,
      customerId: Math.random() > 0.3 ? customer.id : null,
      eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
      eventData: JSON.stringify({
        cart_value: Math.random() * 300,
        items_count: Math.floor(Math.random() * 5) + 1,
        session_duration: Math.floor(Math.random() * 3600),
      }),
      sessionId: `session_${i}`,
      ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
    });
  }

  await prisma.customEvent.createMany({
    data: events,
  });

  console.log('Created sample custom events');

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
