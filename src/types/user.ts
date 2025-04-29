// 用户接口定义
import { FirestoreTimestamp } from "./reservation";

export interface User {
  uid: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  gender?: string;
  birthdate?: string;
  phone?: string;
  createdAt: FirestoreTimestamp | Date | string;
  lastLogin: FirestoreTimestamp | Date | string;
  updatedAt: FirestoreTimestamp | Date | string;
  isAdmin?: boolean;
} 