import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  UserCredential,
  getIdToken,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { auth, db, passwordResetSettings, emailVerificationSettings } from "./firebase";

// 用户基本信息接口
export interface UserData {
  uid: string;
  email: string;
  fullName?: string;
  phone?: string;
  birthdate?: string;
  gender?: "male" | "female" | "";
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

// 设置认证Cookie的函数
const setAuthCookie = async (user: User): Promise<void> => {
  try {
    // 获取用户的ID Token
    const token = await getIdToken(user);

    // 设置cookie，有效期为7天
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 7);

    // 设置cookie
    document.cookie = `firebase_auth_token=${token}; expires=${expiration.toUTCString()}; path=/; SameSite=Strict`;
  } catch (error) {
    console.error("设置认证Cookie失败:", error);
  }
};

// 清除认证Cookie的函数
const clearAuthCookie = (): void => {
  document.cookie =
    "firebase_auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict";
};

// 注册新用户
export const registerUser = async (
  email: string,
  password: string,
  userData: Omit<UserData, "uid" | "email" | "createdAt" | "updatedAt">
): Promise<{ success: boolean; data?: User; error?: any }> => {
  try {
    // 1. 在 Firebase Auth 中创建用户
    const userCredential: UserCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // 2. 获取新用户的 UID
    const user = userCredential.user;

    // 3. 发送邮箱验证邮件
    await sendEmailVerification(user, emailVerificationSettings);

    // 4. 在 Firestore 中创建用户文档
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      emailVerified: false, // 初始状态为未验证
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 5. 设置认证Cookie
    await setAuthCookie(user);

    return { success: true, data: user };
  } catch (error) {
    console.error("注册失败:", error);
    return { success: false, error };
  }
};

// 检查邮箱是否已验证
export const checkEmailVerification = async (): Promise<boolean> => {
  try {
    // 强制刷新用户，以获取最新的验证状态
    if (auth.currentUser) {
      await auth.currentUser.reload();
      return auth.currentUser.emailVerified;
    }
    return false;
  } catch (error) {
    console.error("检查邮箱验证状态失败:", error);
    return false;
  }
};

// 重新发送验证邮件
export const resendVerificationEmail = async (): Promise<{
  success: boolean;
  error?: any;
}> => {
  try {
    if (!auth.currentUser) {
      return { success: false, error: "用户未登录" };
    }

    await sendEmailVerification(auth.currentUser, emailVerificationSettings);
    return { success: true };
  } catch (error) {
    console.error("重新发送验证邮件失败:", error);
    return { success: false, error };
  }
};

// 用户登录
export const loginUser = async (
  email: string,
  password: string
): Promise<{
  success: boolean;
  data?: User & { emailVerified: boolean };
  error?: any;
}> => {
  try {
    // 1. 使用 Firebase Auth 登录
    const userCredential: UserCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // 2. 获取用户
    const user = userCredential.user;

    // 3. 检查用户是否在 Firestore 中有文档
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    // 4. 如果用户文档不存在，则创建基本信息
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      // 5. 更新最后登录时间和邮箱验证状态
      await updateDoc(userDocRef, {
        lastLogin: serverTimestamp(),
        emailVerified: user.emailVerified,
      });
    }

    // 6. 设置认证Cookie
    await setAuthCookie(user);

    return {
      success: true,
      data: Object.assign(user, { emailVerified: user.emailVerified }),
    };
  } catch (error) {
    console.error("登录失败:", error);
    return { success: false, error };
  }
};

// 用户登出
export const logoutUser = async (): Promise<{
  success: boolean;
  error?: any;
}> => {
  try {
    await signOut(auth);

    // 清除认证Cookie
    clearAuthCookie();

    return { success: true };
  } catch (error) {
    console.error("登出失败:", error);
    return { success: false, error };
  }
};

// 获取当前用户
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// 监听认证状态变化，并更新cookie
export const setupAuthListener = (): (() => void) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // 用户已登录，设置cookie
      await setAuthCookie(user);
    } else {
      // 用户已登出，清除cookie
      clearAuthCookie();
    }
  });
};

// 为了保持向后兼容性，保留onAuthStateChange函数
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// 获取用户数据
export const getUserData = async (
  uid: string
): Promise<{ success: boolean; data?: UserData; error?: any }> => {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() as UserData };
    } else {
      return { success: false, error: "用户数据不存在" };
    }
  } catch (error) {
    console.error("获取用户数据失败:", error);
    return { success: false, error };
  }
};

// 更新用户数据
export const updateUserData = async (
  uid: string,
  userData: Partial<Omit<UserData, "uid" | "email" | "createdAt">>
): Promise<{ success: boolean; error?: any }> => {
  try {
    const userDocRef = doc(db, "users", uid);

    await updateDoc(userDocRef, {
      ...userData,
      updatedAt: serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error("更新用户数据失败:", error);
    return { success: false, error };
  }
};

// 密码重置
export const resetPassword = async (
  email: string
): Promise<{ success: boolean; error?: any }> => {
  try {
    // 使用配置的密码重置设置
    await sendPasswordResetEmail(auth, email, passwordResetSettings);
    return { success: true };
  } catch (error) {
    console.error("密码重置失败:", error);
    return { success: false, error };
  }
};
