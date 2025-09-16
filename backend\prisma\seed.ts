// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create default tenant
  const defaultTenant = await prisma.tenant.upsert({
    where: { tenantId: 'default-tenant' },
    update: {},
    create: {
      tenantId: 'default-tenant',
      companyName: 'Demo Company',
      shopifyDomain: 'demo-store.myshopify.com',
      shopifyAccessToken: 'encrypted_token_here',
      subscriptionPlan: 'FREE',
      subscriptionStatus: 'TRIAL',
      settings: {
        timezone: 'UTC',
        currency: 'USD',
        dateFormat: 'MM/DD/YYYY',
      },
      features: {
        webhooks: true,
        customEvents: true,
        advancedAnalytics: false,
      },
    },
  });

  console.log('✅ Default tenant created:', defaultTenant.tenantId);

  // Create super admin user
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  
  const adminUser = await prisma.user.upsert({
    where: { 
      tenantId_email: {
        tenantId: defaultTenant.tenantId,
        email: 'admin@xenoapp.com',
      },
    },
    update: {},
    create: {
      tenantId: defaultTenant.tenantId,
      email: 'admin@xenoapp.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      fullName: 'Admin User',
      role: 'SUPER_ADMIN',
      isActive: true,
      isEmailVerified: true,
      permissions: {
        all: true,
      },
    },
  });

  console.log('✅ Admin user created:', adminUser.email);

  // Create sample users
  const users = [
    {
      email: 'manager@xenoapp.com',
      firstName: 'Manager',
      lastName: 'User',
      role: 'MANAGER' as const,
    },
    {
      email: 'analyst@xenoapp.com',
      firstName: 'Analyst',
      lastName: 'User',
      role: 'ANALYST' as const,
    },
    {
      email: 'viewer@xenoapp.com',
      firstName: 'Viewer',
      lastName: 'User',
      role: 'VIEWER' as const,
    },
  ];

  for (const userData of users) {
    const user = await prisma.user.create({
      data: {
        tenantId: defaultTenant.tenantId,
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        fullName: `${userData.firstName} ${userData.lastName}`,
        role: userData.role,
        isActive: true,
        isEmailVerified: true,
      },
    });
    console.log(`✅ ${userData.role} user created:`, user.email);
  }

  // Create sample customers
  const customers = [
    {
      shopifyCustomerId: '1001',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      totalSpent: 1500.00,
      ordersCount: 5,
    },
    {
      shopifyCustomerId: '1002',
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      phone: '+1234567891',
      totalSpent: 2500.00,
      ordersCount: 8,
    },
    {
      shopifyCustomerId: '1003',
      email: 'bob.wilson@example.com',
      firstName: 'Bob',
      lastName: 'Wilson',
      phone: '+1234567892',
      totalSpent: 750.00,
      ordersCount: 3,
    },
  ];

  for (const customerData of customers) {
    const customer = await prisma.customer.create({
      data: {
        tenantId: defaultTenant.tenantId,
        ...customerData,
        displayName: `${customerData.firstName} ${customerData.lastName}`,
        acceptsMarketing: true,
        currency: 'USD',
        state: 'enabled',
      },
    });
    console.log(`✅ Customer created:`, customer.email);
  }

  // Create sample products
  const products = [
    {
      shopifyProductId: '2001',
      title: 'Classic T-Shirt',
      handle: 'classic-t-shirt',
      description: 'A comfortable classic t-shirt',
      vendor: 'Xeno Clothing',
      productType: 'Shirts',
      status: 'active',
      price: 29.99,
      totalInventory: 100,
      tags: 'clothing,shirts,casual',
    },
    {
      shopifyProductId: '2002',
      title: 'Premium Jeans',
      handle: 'premium-jeans',
      description: 'High-quality denim jeans',
      vendor: 'Xeno Clothing',
      productType: 'Pants',
      status: 'active',
      price: 89.99,
      totalInventory: 50,
      tags: 'clothing,pants,denim',
    },
    {
      shopifyProductId: '2003',
      title: 'Running Shoes',
      handle: 'running-shoes',
      description: 'Comfortable running shoes',
      vendor: 'Xeno Sports',
      productType: 'Footwear',
      status: 'active',
      price: 129.99,
      totalInventory: 75,
      tags: 'footwear,sports,running',
    },
  ];

  for (const productData of products) {
    const product = await prisma.product.create({
      data: {
        tenantId: defaultTenant.tenantId,
        ...productData,
      },
    });
    console.log(`✅ Product created:`, product.title);

    // Create a default variant for each product
    await prisma.productVariant.create({
      data:
