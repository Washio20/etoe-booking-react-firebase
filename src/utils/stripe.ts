import Stripe from 'stripe';

// 检查是否已经初始化
let stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  // 检查是否在构建环境中
  const isBuildEnvironment = 
    (process.env.NODE_ENV !== 'production' && process.env.NEXT_PHASE === 'phase-production-build') ||
    process.env.CI === 'true'; // 检查CI环境

  if (isBuildEnvironment) {
    console.warn('Skipping Stripe initialization in build environment');
    // 返回null或模拟对象
    return null;
  }

  // 检查必要的环境变量
  if (!process.env.STRIPE_SECRET_KEY) {
    if (isBuildEnvironment) {
      console.warn('Stripe credentials not found, skipping initialization for build');
      return null;
    }
    
    // 开发环境使用虚拟凭据
    if (process.env.NODE_ENV === 'development') {
      console.warn('Stripe credentials not found in development, using dummy client');
      // 返回一个简单的模拟对象，避免在开发环境中出错
      return {
        checkout: {
          sessions: {
            create: async () => ({ url: 'https://example.com/mock-checkout' }),
            retrieve: async () => ({ amount_total: 1000, payment_intent: 'mock_intent' }),
          }
        },
        refunds: {
          create: async () => ({ id: 'mock_refund_id' }),
        },
        webhooks: {
          constructEvent: () => ({ type: 'mock.event', data: { object: {} } }),
        }
      } as unknown as Stripe;
    }
    
    throw new Error('Stripe credentials not configured');
  }

  if (!stripe) {
    try {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-03-31.basil',
      });
    } catch (error) {
      console.error('Error initializing Stripe:', error);
      const isNonProductionEnv = 
        process.env.NODE_ENV !== 'production' || 
        process.env.NEXT_PHASE === 'phase-production-build' ||
        process.env.CI === 'true';
        
      if (isNonProductionEnv) {
        console.warn('Ignoring Stripe initialization error in non-production environment');
        return null;
      }
      throw error;
    }
  }

  return stripe;
} 