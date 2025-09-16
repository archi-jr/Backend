const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Middleware to ensure tenant isolation
const tenantIsolation = async (req, res, next) => {
  try {
    // Extract tenant ID from various sources
    const tenantId = req.headers['x-tenant-id'] || 
                    req.query.tenantId || 
                    req.body.tenantId ||
                    (req.user && req.user.tenantId);

    if (!tenantId) {
      return res.status(400).json({
        error: 'Tenant identification required',
        message: 'Missing tenant ID in request',
      });
    }

    // Validate tenant exists and is active
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        isActive: true,
        plan: true,
        settings: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        error: 'Invalid tenant',
        message: 'Tenant not found',
      });
    }

    if (!tenant.isActive) {
      return res.status(403).json({
        error: 'Tenant inactive',
        message: 'This tenant account is currently inactive',
      });
    }

    // Attach tenant info to request
    req.tenantId = tenantId;
    req.tenant = tenant;

    // Set Prisma client to use tenant-specific queries
    req.prisma = new Proxy(prisma, {
      get(target, prop) {
        const originalMethod = target[prop];
        
        if (typeof originalMethod === 'object' && originalMethod !== null) {
          return new Proxy(originalMethod, {
            get(innerTarget, innerProp) {
              const innerMethod = innerTarget[innerProp];
              
              if (typeof innerMethod === 'function') {
                return function(...args) {
                  // Automatically add tenantId to queries
                  if (args[0] && typeof args[0] === 'object') {
                    // For findMany, findFirst, etc.
                    if (args[0].where) {
                      args[0].where = {
                        ...args[0].where,
                        tenantId: tenantId,
                      };
                    }
                    // For create, update
                    if (args[0].data) {
                      args[0].data = {
                        ...args[0].data,
                        tenantId: tenantId,
                      };
                    }
                  }
                  
                  return innerMethod.apply(innerTarget, args);
                };
              }
              
              return innerMethod;
            },
          });
        }
        
        return originalMethod;
      },
    });

    next();
  } catch (error) {
    console.error('Tenant isolation error:', error);
    res.status(500).json({
      error: 'Tenant isolation failed',
      message: 'Unable to verify tenant access',
    });
  }
};

// Validate cross-tenant access
const validateCrossTenantAccess = async (req, res, next) => {
  try {
    const requestTenantId = req.tenantId;
    const userTenantId = req.user?.tenantId;

    // Check if user belongs to the tenant
    if (userTenantId && userTenantId !== requestTenantId) {
      // Log potential security breach
      console.error(`Cross-tenant access attempt: User ${req.user.id} from tenant ${userTenantId} tried to access tenant ${requestTenantId}`);
      
      return res.status(403).json({
        error: 'Access denied',
        message: 'Cross-tenant access is not allowed',
      });
    }

    // Additional check for data access
    if (req.params.id) {
      const resourceTenantId = await checkResourceTenant(req.route.path, req.params.id);
      
      if (resourceTenantId && resourceTenantId !== requestTenantId) {
        console.error(`Data isolation breach: Attempted to access resource ${req.params.id} belonging to tenant ${resourceTenantId}`);
        
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to this resource',
        });
      }
    }

    next();
  } catch (error) {
    console.error('Cross-tenant validation error:', error);
    res.status(500).json({
      error: 'Access validation failed',
    });
  }
};

// Check which tenant a resource belongs to
async function checkResourceTenant(routePath, resourceId) {
  try {
    // Determine the model based on route
    let model;
    if (routePath.includes('customer')) model = 'customer';
    else if (routePath.includes('order')) model = 'order';
    else if (routePath.includes('product')) model = 'product';
    else return null;

    const resource = await prisma[model].findUnique({
      where: { id: resourceId },
      select: { tenantId: true },
    });

    return resource?.tenantId;
  } catch (error) {
    console.error('Resource tenant check error:', error);
    return null;
  }
}

module.exports = {
  tenantIsolation,
  validateCrossTenantAccess,
};
