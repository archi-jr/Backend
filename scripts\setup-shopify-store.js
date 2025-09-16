// scripts/setup-shopify-store.js
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../backend/.env') });

class ShopifyStoreSetup {
  constructor() {
    this.shopDomain = process.env.SHOPIFY_DEV_STORE_DOMAIN;
    this.accessToken = process.env.SHOPIFY_DEV_STORE_ACCESS_TOKEN;
    this.apiVersion = '2024-01';
    this.baseUrl = `https://${this.shopDomain}/admin/api/${this.apiVersion}`;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json',
      },
    });
  }
  
  async setupStore() {
    console.log('🏪 Setting up Shopify Development Store...\n');
    
    try {
      // Step 1: Create Products
      await this.createSampleProducts();
      
      // Step 2: Create Customers
      await this.createSampleCustomers();
      
      // Step 3: Create Collections
      await this.createSampleCollections();
      
      // Step 4: Create Price Rules
      await this.createSamplePriceRules();
      
      // Step 5: Create Orders
      await this.createSampleOrders();
      
      // Step 6: Register Webhooks
      await this.registerWebhooks();
      
      console.log('\n✅ Shopify store setup completed successfully!');
    } catch (error) {
      console.error('❌ Error setting up store:', error.response?.data || error.message);
    }
  }
  
  async createSampleProducts() {
    console.log('📦 Creating sample products...');
    
    const products = [
      {
        product: {
          title: 'Premium Cotton T-Shirt',
          body_html: '<strong>Comfortable and stylish!</strong>',
          vendor: 'Xeno Apparel',
          product_type: 'Shirts',
          tags: 'cotton, t-shirt, premium, comfortable',
          variants: [
            {
              option1: 'Small',
              price: '29.99',
              sku: 'COTTON-TS-S',
              inventory_quantity: 50,
            },
            {
              option1: 'Medium',
              price: '29.99',
              sku: 'COTTON-TS-M',
              inventory_quantity: 75,
            },
            {
              option1: 'Large',
              price: '29.99',
              sku: 'COTTON-TS-L',
              inventory_quantity: 60,
            },
            {
              option1: 'X-Large',
              price: '29.99',
              sku: 'COTTON-TS-XL',
              inventory_quantity: 40,
            },
          ],
          options: [
            {
              name: 'Size',
              values: ['Small', 'Medium', 'Large', 'X-Large'],
            },
          ],
        },
      },
      {
        product: {
          title: 'Wireless Bluetooth Headphones',
          body_html: '<p>High-quality audio with noise cancellation</p>',
          vendor: 'Xeno Electronics',
          product_type: 'Electronics',
          tags: 'electronics, headphones, bluetooth, wireless, audio',
          variants: [
            {
              option1: 'Black',
              price: '149.99',
              sku: 'WBH-BLACK',
              inventory_quantity: 30,
            },
            {
              option1: 'White',
              price: '149.99',
              sku: 'WBH-WHITE',
              inventory_quantity: 25,
            },
            {
              option1: 'Blue',
              price: '149.99',
              sku: 'WBH-BLUE',
              inventory_quantity: 20,
            },
          ],
          options: [
            {
              name: 'Color',
              values: ['Black', 'White', 'Blue'],
            },
          ],
        },
      },
      {
        product: {
          title: 'Organic Coffee Beans',
          body_html: '<p>Premium organic coffee from Colombia</p>',
          vendor: 'Xeno Coffee Co.',
          product_type: 'Food & Beverage',
          tags: 'coffee, organic, beans, premium, colombia',
          variants: [
            {
              option1: '250g',
              price: '12.99',
              sku: 'COFFEE-250',
              inventory_quantity: 100,
            },
            {
              option1: '500g',
              price: '22.99',
              sku: 'COFFEE-500',
              inventory_quantity: 80,
            },
            {
              option1: '1kg',
              price: '39.99',
              sku: 'COFFEE-1000',
              inventory_quantity: 50,
            },
          ],
          options: [
            {
              name: 'Weight',
              values: ['250g', '500g', '1kg'],
            },
          ],
        },
      },
      {
        product: {
          title: 'Yoga Mat Pro',
          body_html: '<p>Professional grade yoga mat with extra cushioning</p>',
          vendor: 'Xeno Fitness',
          product_type: 'Sports & Fitness',
          tags: 'yoga, mat, fitness, exercise, professional',
          variants: [
            {
              option1: 'Purple',
              price: '49.99',
              sku: 'YOGA-MAT-PURPLE',
              inventory_quantity: 40,
            },
            {
              option1: 'Green',
              price: '49.99',
              sku: 'YOGA-MAT-GREEN',
              inventory_quantity: 35,
            },
            {
              option1: 'Gray',
              price: '49.99',
              sku: 'YOGA-MAT-GRAY',
              inventory_quantity: 45,
            },
          ],
          options: [
            {
              name: 'Color',
              values: ['Purple', 'Green', 'Gray'],
            },
          ],
        },
      },
      {
        product: {
          title: 'Smart Watch X1',
          body_html: '<p>Advanced fitness tracking and notifications</p>',
          vendor: 'Xeno Tech',
          product_type: 'Electronics',
          tags: 'smartwatch, fitness, tracker, technology, wearable',
          variants: [
            {
              option1: '40mm',
              option2: 'Black',
              price: '299.99',
              sku: 'SW-X1-40-BLACK',
              inventory_quantity: 20,
            },
            {
              option1: '40mm',
              option2: 'Silver',
              price: '299.99',
              sku: 'SW-X1-40-SILVER',
              inventory_quantity: 15,
            },
            {
              option1: '44mm',
              option2: 'Black',
              price: '329.99',
              sku: 'SW-X1-44-BLACK',
              inventory_quantity: 18,
            },
            {
              option1: '44mm',
              option2: 'Silver',
              price: '329.99',
              sku: 'SW-X1-44-SILVER',
              inventory_quantity: 12,
            },
          ],
          options: [
            {
              name: 'Size',
              values: ['40mm', '44mm'],
            },
            {
              name: 'Color',
              values: ['Black', 'Silver'],
            },
          ],
        },
      },
    ];
    
    for (const product of products) {
      try {
        const response = await this.axiosInstance.post('/products.json', product);
        console.log(`  ✅ Created product: ${response.data.product.title}`);
      } catch (error) {
        console.error(`  ❌ Failed to create product:`, error.response?.data || error.message);
      }
    }
  }
  
  async createSampleCustomers() {
    console.log('\n👥 Creating sample customers...');
    
    const customers = [
      {
        customer: {
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          phone: '+12125551234',
          verified_email: true,
          addresses: [
            {
              address1: '123 Main St',
              city: 'New York',
              province: 'NY',
              phone: '+12125551234',
              zip: '10001',
              last_name: 'Doe',
              first_name: 'John',
              country: 'US',
            },
          ],
          tags: 'VIP, newsletter',
          note: 'Preferred customer - offer discounts',
          accepts_marketing: true,
        },
      },
      {
        customer: {
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane.smith@example.com',
          phone: '+12125555678',
          verified_email: true,
          addresses: [
            {
              address1: '456 Oak Ave',
              city: 'Los Angeles',
              province: 'CA',
              phone: '+12125555678',
              zip: '90001',
              last_name: 'Smith',
              first_name: 'Jane',
              country: 'US',
            },
          ],
          tags: 'wholesale, B2B',
          accepts_marketing: true,
        },
      },
      {
        customer: {
          first_name: 'Bob',
          last_name: 'Wilson',
          email: 'bob.wilson@example.com',
          phone: '+12125559012',
          verified_email: true,
          addresses: [
            {
              address1: '789 Pine Rd',
              city: 'Chicago',
              province: 'IL',
              phone: '+12125559012',
              zip: '60601',
              last_name: 'Wilson',
              first_name: 'Bob',
              country: 'US',
            },
          ],
          accepts_marketing: false,
        },
      },
      {
        customer: {
          first_name: 'Alice',
          last_name: 'Johnson',
          email: 'alice.johnson@example.com',
          phone: '+12125553456',
          verified_email: true,
          addresses: [
            {
              address1: '321 Elm St',
              city: 'Houston',
              province: 'TX',
              phone: '+12125553456',
              zip: '77001',
              last_name: 'Johnson',
              first_name: 'Alice',
              country: 'US',
            },
          ],
          tags: 'loyalty_program',
          accepts_marketing: true,
        },
      },
      {
        customer: {
          first_name: 'Charlie',
          last_name: 'Brown',
          email: 'charlie.brown@example.com',
          phone: '+12125557890',
          verified_email: true,
          addresses: [
            {
              address1: '654 Maple Dr',
              city: 'Phoenix',
              province: 'AZ',
              phone: '+12
