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

// ユーザー基本情報インターフェース
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

// 認証Cookie設定関数
const setAuthCookie = async (user: User): Promise<void> => {
  try {
    // ユーザーIDトークンの取得
    const token = await getIdToken(user);

    // Cookie設定、有効期間は7日間
    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 7);

    // Cookie設定
    document.cookie = `firebase_auth_token=${token}; expires=${expiration.toUTCString()}; path=/; SameSite=Strict`;
  } catch (error) {
    console.error("認証Cookie設定に失敗しました:", error);
  }
};

// 認証Cookie削除関数
const clearAuthCookie = (): void => {
  document.cookie =
    "firebase_auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Strict";
};

// 新規ユーザー登録
export const registerUser = async (
  email: string,
  password: string,
  userData: Omit<UserData, "uid" | "email" | "createdAt" | "updatedAt">
): Promise<{ success: boolean; data?: User; error?: any }> => {
  try {
    // 1. Firebase Authでユーザー作成
    const userCredential: UserCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    // 2. 新規ユーザーのUID取得
    const user = userCredential.user;

    // 3. メール認証メール送信 - パラメータ追加
    const productionDomain = process.env.NEXT_PUBLIC_BASE_URL;
    const isProduction = process.env.NODE_ENV === 'production';
    
    const verificationUrl = isProduction
      ? `${productionDomain}/__/auth/action`
      : emailVerificationSettings.url;
    
    // 明確な設定を使用
    const actionCodeSettings = {
      url: verificationUrl,
      handleCodeInApp: true,
      // カスタムパラメータ追加 - メールとユーザーIDでユーザー識別を容易に
      // 注意: Firebaseは一部のパラメータをフィルタリングする可能性がありますが、これらは通常安全です
      dynamicLinkDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    };

    await sendEmailVerification(user, actionCodeSettings);

    // 4. Firestoreにユーザードキュメント作成
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: user.email,
      emailVerified: false, // 初期状態は未認証
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // 5. 認証Cookie設定
    await setAuthCookie(user);

    return { success: true, data: user };
  } catch (error) {
    console.error("登録に失敗しました:", error);
    return { success: false, error };
  }
};

// メール認証状態確認
export const checkEmailVerification = async (): Promise<boolean> => {
  try {
    // ユーザー情報を強制更新して最新の認証状態を取得
    if (auth.currentUser) {
      await auth.currentUser.reload();
      return auth.currentUser.emailVerified;
    }
    return false;
  } catch (error) {
    console.error("メール認証状態確認に失敗しました:", error);
    return false;
  }
};

// 認証メール再送信
export const resendVerificationEmail = async (): Promise<{
  success: boolean;
  error?: any;
}> => {
  try {
    if (!auth.currentUser) {
      return { success: false, error: "ユーザーがログインしていません" };
    }

    // 現在の環境設定を取得
    const productionDomain = process.env.NEXT_PUBLIC_BASE_URL;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // 本番環境では常に本番ドメインを使用
    const verificationUrl = isProduction
      ? `${productionDomain}/__/auth/action`
      : emailVerificationSettings.url;
    
    // 明確なURL設定を使用
    const actionCodeSettings = {
      url: verificationUrl,
      handleCodeInApp: true
    };

    await sendEmailVerification(auth.currentUser, actionCodeSettings);
    return { success: true };
  } catch (error) {
    console.error("認証メール再送信に失敗しました:", error);
    return { success: false, error };
  }
};

// ユーザーログイン
export const loginUser = async (
  email: string,
  password: string
): Promise<{
  success: boolean;
  data?: User & { emailVerified: boolean };
  error?: any;
}> => {
  try {
    // 1. Firebase Authでログイン
    const userCredential: UserCredential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    // 2. ユーザー取得
    const user = userCredential.user;

    // 3. ユーザーがFirestoreにドキュメントを持っているか確認
    const userDocRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userDocRef);

    // 4. ユーザードキュメントが存在しない場合、基本情報を作成
    if (!userDoc.exists()) {
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      // 5. 最終ログイン時間とメール認証状態を更新
      await updateDoc(userDocRef, {
        lastLogin: serverTimestamp(),
        emailVerified: user.emailVerified,
      });
    }

    // 6. 認証Cookie設定
    await setAuthCookie(user);

    return {
      success: true,
      data: Object.assign(user, { emailVerified: user.emailVerified }),
    };
  } catch (error) {
    console.error("ログインに失敗しました:", error);
    return { success: false, error };
  }
};

// ユーザーログアウト
export const logoutUser = async (): Promise<{
  success: boolean;
  error?: any;
}> => {
  try {
    await signOut(auth);

    // 認証Cookie削除
    clearAuthCookie();

    return { success: true };
  } catch (error) {
    console.error("ログアウトに失敗しました:", error);
    return { success: false, error };
  }
};

// 現在のユーザー取得
export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// 認証状態変更リスナー設定、Cookieを更新
export const setupAuthListener = (): (() => void) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // ユーザーがログイン中、Cookieを設定
      await setAuthCookie(user);
    } else {
      // ユーザーがログアウト、Cookieを削除
      clearAuthCookie();
    }
  });
};

// 後方互換性のため、onAuthStateChange関数を保持
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// ユーザーデータ取得
export const getUserData = async (
  uid: string
): Promise<{ success: boolean; data?: UserData; error?: any }> => {
  try {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() as UserData };
    } else {
      return { success: false, error: "ユーザーデータが存在しません" };
    }
  } catch (error) {
    console.error("ユーザーデータ取得に失敗しました:", error);
    return { success: false, error };
  }
};

// ユーザーデータ更新
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
    console.error("ユーザーデータ更新に失敗しました:", error);
    return { success: false, error };
  }
};

// パスワードリセット
export const resetPassword = async (
  email: string
): Promise<{ success: boolean; error?: any }> => {
  try {
    // 設定したパスワードリセット設定を使用
    await sendPasswordResetEmail(auth, email, passwordResetSettings);
    return { success: true };
  } catch (error) {
    console.error("パスワードリセットに失敗しました:", error);
    return { success: false, error };
  }
};
