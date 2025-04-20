import * as admin from "firebase-admin";

// 检查是否已经初始化
let app: admin.app.App;

export function initAdmin() {
  // 设置时区为日本时区
  process.env.TZ = "Asia/Tokyo";

  if (admin.apps.length === 0) {
    try {
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
    }
  } else {
    app = admin.app();
  }

  return app;
}

// 导出Firestore和Auth实例，方便在API路由中使用
export const adminDb = () => admin.firestore();
export const adminAuth = () => admin.auth();
