import * as admin from "firebase-admin";

// 检查是否已经初始化
let app: admin.app.App;

export function initAdmin() {
  // 设置时区为日本时区
  process.env.TZ = "Asia/Tokyo";

  // 检查是否在构建环境中
  const isBuildEnvironment = 
    (process.env.NODE_ENV !== 'production' && process.env.NEXT_PHASE === 'phase-production-build') ||
    process.env.CI === 'true'; // 检查CI环境

  if (isBuildEnvironment) {
    console.warn('Skipping Firebase Admin initialization in build environment');
    return null;
  }

  if (admin.apps.length === 0) {
    try {
      // 检查必要的环境变量
      if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL) {
        if (isBuildEnvironment) {
          console.warn('Firebase Admin credentials not found, skipping initialization for build');
          return null;
        }
        throw new Error('Firebase Admin credentials not configured');
      }

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
        databaseURL: process.env.FIREBASE_DATABASE_URL || undefined,
      });
      console.log("Firebase Admin SDK initialized");
    } catch (error) {
      console.error("Error initializing Firebase Admin SDK:", error);
      if (isBuildEnvironment) {
        console.warn('Ignoring Firebase Admin initialization error in build environment');
        return null;
      }
      throw error;
    }
  } else {
    app = admin.app();
  }

  return app;
}

// 导出Firestore和Auth实例，方便在API路由中使用
export const adminDb = () => admin.firestore();
export const adminAuth = () => admin.auth();