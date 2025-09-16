# 📂 Project Structure

D:\Xeno App
├── .github/
│ ├── workflows/
│ │ ├── ci.yml
│ │ ├── cd.yml
│ │ └── test.yml
│ ├── ISSUE_TEMPLATE/
│ │ ├── bug_report.md
│ │ └── feature_request.md
│ └── PULL_REQUEST_TEMPLATE.md
├── .husky/
│ ├── pre-commit
│ ├── pre-push
│ └── commit-msg
├── .vscode/
│ ├── extensions.json
│ ├── launch.json
│ ├── settings.json
│ └── tasks.json
├── backend/
│ ├── .env
│ ├── .env.example
│ ├── .eslintrc.json
│ ├── .prettierrc
│ ├── jest.config.js
│ ├── nodemon.json
│ ├── package.json
│ ├── tsconfig.json
│ ├── prisma/
│ │ ├── schema.prisma
│ │ ├── seed.ts
│ │ └── migrations/
│ ├── src/
│ │ ├── index.ts
│ │ ├── config/
│ │ │ ├── app.config.ts
│ │ │ ├── database.config.ts
│ │ │ ├── redis.config.ts
│ │ │ ├── shopify.config.ts
│ │ │ └── constants.ts
│ │ ├── controllers/
│ │ │ ├── auth.controller.ts
│ │ │ ├── customer.controller.ts
│ │ │ ├── product.controller.ts
│ │ │ ├── order.controller.ts
│ │ │ ├── dashboard.controller.ts
│ │ │ ├── analytics.controller.ts
│ │ │ ├── webhook.controller.ts
│ │ │ ├── report.controller.ts
│ │ │ └── tenant.controller.ts
│ │ ├── middleware/
│ │ │ ├── auth.middleware.ts
│ │ │ ├── tenant.middleware.ts
│ │ │ ├── error.middleware.ts
│ │ │ ├── rate-limit.middleware.ts
│ │ │ ├── validation.middleware.ts
│ │ │ ├── cors.middleware.ts
│ │ │ ├── logger.middleware.ts
│ │ │ └── cache.middleware.ts
│ │ ├── models/
│ │ │ ├── index.ts
│ │ │ ├── tenant.model.ts
│ │ │ ├── user.model.ts
│ │ │ ├── customer.model.ts
│ │ │ ├── product.model.ts
│ │ │ ├── order.model.ts
│ │ │ └── analytics.model.ts
│ │ ├── routes/
│ │ │ ├── index.ts
│ │ │ ├── auth.routes.ts
│ │ │ ├── shopify.routes.ts
│ │ │ ├── webhook.routes.ts
│ │ │ ├── customer.routes.ts
│ │ │ ├── product.routes.ts
│ │ │ ├── order.routes.ts
│ │ │ ├── dashboard.routes.ts
│ │ │ ├── analytics.routes.ts
│ │ │ └── admin.routes.ts
│ │ ├── services/
│ │ │ ├── auth.service.ts
│ │ │ ├── shopify-auth.service.ts
│ │ │ ├── shopify.service.ts
│ │ │ ├── customer.service.ts
│ │ │ ├── product.service.ts
│ │ │ ├── order.service.ts
│ │ │ ├── analytics.service.ts
│ │ │ ├── email.service.ts
│ │ │ ├── cache.service.ts
│ │ │ ├── sync.service.ts
│ │ │ └── report.service.ts
│ │ ├── utils/
│ │ │ ├── database.ts
│ │ │ ├── encryption.ts
│ │ │ ├── logger.ts
│ │ │ ├── validator.ts
│ │ │ ├── formatter.ts
│ │ │ ├── date.ts
│ │ │ ├── shopify-api.ts
│ │ │ └── response.ts
│ │ ├── validators/
│ │ │ ├── auth.validator.ts
│ │ │ ├── customer.validator.ts
│ │ │ ├── product.validator.ts
│ │ │ ├── order.validator.ts
│ │ │ └── common.validator.ts
│ │ ├── webhooks/
│ │ │ ├── webhook-handler.ts
│ │ │ ├── order.webhook.ts
│ │ │ ├── product.webhook.ts
│ │ │ ├── customer.webhook.ts
│ │ │ ├── cart.webhook.ts
│ │ │ └── checkout.webhook.ts
│ │ ├── jobs/
│ │ │ ├── sync.job.ts
│ │ │ ├── cleanup.job.ts
│ │ │ ├── report.job.ts
│ │ │ ├── email.job.ts
│ │ │ └── analytics.job.ts
│ │ └── types/
│ │ ├── index.d.ts
│ │ ├── shopify.types.ts
│ │ ├── api.types.ts
│ │ ├── webhook.types.ts
│ │ └── express.d.ts
│ ├── tests/
│ │ ├── unit/
│ │ │ ├── services/
│ │ │ ├── controllers/
│ │ │ └── utils/
│ │ ├── integration/
│ │ │ ├── api/
│ │ │ └── webhooks/
│ │ └── fixtures/
│ │ └── test-data.ts
│ ├── logs/
│ └── dist/
├── frontend/
│ ├── .env.local
│ ├── .eslintrc.json
│ ├── .prettierrc
│ ├── next.config.js
│ ├── package.json
│ ├── tailwind.config.ts
│ ├── tsconfig.json
│ ├── components.json
│ ├── public/
│ │ ├── favicon.ico
│ │ ├── images/
│ │ │ ├── logo.svg
│ │ │ └── icons/
│ │ └── fonts/
│ ├── src/
│ │ ├── app/
│ │ │ ├── layout.tsx
│ │ │ ├── page.tsx
│ │ │ ├── globals.css
│ │ │ ├── api/
│ │ │ │ └── auth/
│ │ │ │ └── [...nextauth]/
│ │ │ │ └── route.ts
│ │ │ ├── (auth)/
│ │ │ │ ├── login/
│ │ │ │ │ └── page.tsx
│ │ │ │ ├── register/
│ │ │ │ │ └── page.tsx
│ │ │ │ └── layout.tsx
│ │ │ ├── (dashboard)/
│ │ │ │ ├── dashboard/
│ │ │ │ │ └── page.tsx
│ │ │ │ ├── customers/
│ │ │ │ │ ├── page.tsx
│ │ │ │ │ └── [id]/
│ │ │ │ │ └── page.tsx
│ │ │ │ ├── products/
│ │ │ │ │ ├── page.tsx
│ │ │ │ │ └── [id]/
│ │ │ │ │ └── page.tsx
│ │ │ │ ├── orders/
│ │ │ │ │ ├── page.tsx
│ │ │ │ │ └── [id]/
│ │ │ │ │ └── page.tsx
│ │ │ │ ├── analytics/
│ │ │ │ │ └── page.tsx
│ │ │ │ ├── reports/
│ │ │ │ │ └── page.tsx
│ │ │ │ ├── settings/
│ │ │ │ │ └── page.tsx
│ │ │ │ └── layout.tsx
│ │ │ └── shopify/
│ │ │ ├── install/
│ │ │ │ └── page.tsx
│ │ │ └── callback/
│ │ │ └── page.tsx
│ │ ├── components/
│ │ │ ├── ui/
│ │ │ │ ├── alert.tsx
│ │ │ │ ├── button.tsx
│ │ │ │ ├── card.tsx
│ │ │ │ ├── dialog.tsx
│ │ │ │ ├── dropdown-menu.tsx
│ │ │ │ ├── form.tsx
│ │ │ │ ├── input.tsx
│ │ │ │ ├── label.tsx
│ │ │ │ ├── select.tsx
│ │ │ │ ├── table.tsx
│ │ │ │ ├── tabs.tsx
│ │ │ │ └── toast.tsx
│ │ │ ├── layout/
│ │ │ │ ├── header.tsx
│ │ │ │ ├── sidebar.tsx
│ │ │ │ ├── footer.tsx
│ │ │ │ └── nav.tsx
│ │ │ ├── dashboard/
│ │ │ │ ├── stats-card.tsx
│ │ │ │ ├── chart-card.tsx
│ │ │ │ ├── recent-orders.tsx
│ │ │ │ ├── top-customers.tsx
│ │ │ │ └── revenue-chart.tsx
│ │ │ ├── customers/
│ │ │ │ ├── customer-list.tsx
│ │ │ │ ├── customer-card.tsx
│ │ │ │ ├── customer-form.tsx
│ │ │ │ └── customer-filters.tsx
│ │ │ ├── products/
│ │ │ │ ├── product-list.tsx
│ │ │ │ ├── product-card.tsx
│ │ │ │ ├── product-form.tsx
│ │ │ │ └── product-filters.tsx
│ │ │ ├── orders/
│ │ │ │ ├── order-list.tsx
│ │ │ │ ├── order-card.tsx
│ │ │ │ ├── order-details.tsx
│ │ │ │ └── order-filters.tsx
│ │ │ ├── charts/
│ │ │ │ ├── line-chart.tsx
│ │ │ │ ├── bar-chart.tsx
│ │ │ │ ├── pie-chart.tsx
│ │ │ │ └── area-chart.tsx
│ │ │ └── common/
│ │ │ ├── loading.tsx
│ │ │ ├── error.tsx
│ │ │ ├── empty-state.tsx
│ │ │ ├── pagination.tsx
│ │ │ └── search.tsx
│ │ ├── hooks/
│ │ │ ├── use-auth.ts
│ │ │ ├── use-tenant.ts
│ │ │ ├── use-api.ts
│ │ │ ├── use-debounce.ts
│ │ │ ├── use-local-storage.ts
│ │ │ ├── use-toast.ts
│ │ │ └── use-pagination.ts
│ │ ├── lib/
│ │ │ ├── api.ts
│ │ │ ├── auth.ts
│ │ │ ├── shopify.ts
│ │ │ ├── utils.ts
│ │ │ ├── constants.ts
│ │ │ └── validators.ts
│ │ ├── services/
│ │ │ ├── auth.service.ts
│ │ │ ├── customer.service.ts
│ │ │ ├── product.service.ts
│ │ │ ├── order.service.ts
│ │ │ ├── analytics.service.ts
│ │ │ └── dashboard.service.ts
│ │ ├── store/
│ │ │ ├── auth.store.ts
│ │ │ ├── tenant.store.ts
│ │ │ ├── ui.store.ts
│ │ │ └── index.ts
│ │ ├── styles/
│ │ │ ├── components/
│ │ │ └── utilities.css
│ │ └── types/
│ │ ├── api.types.ts
│ │ ├── auth.types.ts
│ │ ├── customer.types.ts
│ │ ├── product.types.ts
│ │ ├── order.types.ts
│ │ └── dashboard.types.ts
│ └── tests/
│ ├── unit/
│ ├── integration/
│ └── e2e/
├── shared/
│ ├── types/
│ │ ├── index.ts
│ │ ├── shopify.types.ts
│ │ └── api.types.ts
│ ├── constants/
│ │ └── index.ts
│ └── utils/
│ └── index.ts
├── scripts/
│ ├── setup/
│ │ ├── initialize-project.bat
│ │ ├── setup-shopify-store.js
│ │ └── verify-setup.js
│ ├── deployment/
│ │ ├── deploy-backend.sh
│ │ ├── deploy-frontend.sh
│ │ └── deploy-all.sh
│ └── migration/
│ └── migrate-data.js
├── docker/
│ ├── backend.Dockerfile
│ ├── frontend.Dockerfile
│ └── nginx.conf
├── docs/
│ ├── api/
│ │ ├── endpoints.md
│ │ └── authentication.md
│ ├── deployment/
│ │ ├── railway.md
│ │ └── vercel.md
│ └── architecture/
│ ├── overview.md
│ └── database-schema.md
├── .env.example
├── .gitignore
├── .prettierrc
├── .eslintrc.json
├── docker-compose.yml
├── package.json
├── README.md
├── LICENSE
└── CONTRIBUTING.md
