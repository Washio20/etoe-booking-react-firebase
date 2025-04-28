import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Firebase 配置
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// 初始化 Firebase
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// 确定应用的基础 URL
// 1. 优先使用明确设置的环境变量 
// 2. 在客户端，使用当前窗口的源
// 3. 在 Cloud Run 环境，使用固定的生产 URL
// 4. 默认为本地开发 URL
const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }
  
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  
  return "http://localhost:3000";
};

const baseUrl = getBaseUrl();

// 导出 Firebase 服务
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// 所有Firebase操作使用统一的URL
const actionUrl = `${baseUrl}/auth/action`;

// 配置密码重置设置
export const passwordResetSettings = {
  url: actionUrl,
  handleCodeInApp: true,
};

// 配置邮箱验证设置
export const emailVerificationSettings = {
  url: actionUrl,
  handleCodeInApp: true,
};

// 设置认证语言为日语
auth.languageCode = "ja";

export default app;
