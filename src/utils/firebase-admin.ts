import * as admin from "firebase-admin";

// 检查是否已经初始化
let app: admin.app.App;

export function initAdmin() {
  // 设置时区为日本时区
  process.env.TZ = "Asia/Tokyo";

  // 如果已经初始化，直接返回现有实例
  if (admin.apps.length > 0) {
    app = admin.app();
    return app;
  }

  try {
    // 检查是否在构建环境中 - 更精确的检测，避免误判本地开发环境
    const isBuildEnvironment = 
      (process.env.NODE_ENV !== 'production' && process.env.NEXT_PHASE === 'phase-production-build') ||
      process.env.CI === 'true'; // 检查CI环境
    
    // 检查必要的环境变量
    if (!process.env.FIREBASE_PROJECT_ID || 
        !process.env.FIREBASE_CLIENT_EMAIL || 
        !process.env.FIREBASE_PRIVATE_KEY) {
    
      // 构建时使用虚拟值
      if (isBuildEnvironment) {
        console.warn('Firebase credentials not found, using dummy values for build');
        // 不实际初始化Firebase
        return null;
      }
      
      // 本地开发环境 - 使用虚拟凭据初始化，便于开发
      if (process.env.NODE_ENV === 'development') {
        console.warn('Firebase credentials not found in development, using dummy credentials');
        app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: "dummy-project-id",
            clientEmail: "dummy@example.com",
            privateKey: "-----BEGIN PRIVATE KEY-----\nXXX\n-----END PRIVATE KEY-----\n",
          }),
        });
        return app;
      }
      
      // 生产环境中必须有凭据
      throw new Error('Firebase credentials not configured');
    }
    
    // 在构建环境中，不初始化Firebase Admin SDK
    if (isBuildEnvironment) {
      console.warn('Skipping Firebase Admin SDK initialization in build environment');
      return null;
    }
    
    // 使用实际凭据初始化
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // 替换私钥中的换行符
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(
          /\\n/g,
          "\n"
        ),
      }),
      databaseURL: process.env.FIREBASE_DATABASE_URL,
    });
    console.log("Firebase Admin SDK initialized");
  } catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    // 在构建环境中捕获到错误，不应该导致构建失败
    const isNonProductionEnv = 
      process.env.NODE_ENV !== 'production' || 
      process.env.NEXT_PHASE === 'phase-production-build' ||
      process.env.CI === 'true';
      
    if (isNonProductionEnv) {
      console.warn('Ignoring Firebase Admin SDK initialization error in build environment');
      return null;
    }
    
    // 在开发环境中，尝试使用虚拟凭据
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment && !app) {
      try {
        console.warn('Trying to initialize with dummy credentials in development');
        app = admin.initializeApp({
          credential: admin.credential.cert({
            projectId: "dummy-project-id",
            clientEmail: "dummy@example.com",
            privateKey: "-----BEGIN PRIVATE KEY-----\nXXX\n-----END PRIVATE KEY-----\n",
          }),
        });
        return app;
      } catch (devError) {
        console.error("Failed to initialize with dummy credentials:", devError);
      }
    }
    
    throw error;
  }

  return app;
}

// 导出Firestore和Auth实例，方便在API路由中使用
export const adminDb = () => admin.firestore();
export const adminAuth = () => admin.auth();
