import { NextResponse } from "next/server";
import { getAuth, type UserRecord } from "firebase-admin/auth";
import {
  getFirestore,
  type DocumentSnapshot,
  type QuerySnapshot,
} from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { User } from "@/types/user";

// 检查是否为管理员用户
async function isAdmin(idToken: string): Promise<boolean> {
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    const user = await getAuth().getUser(decodedToken.uid);
    
    // 检查自定义声明中的admin字段
    const customClaims = (await getAuth().getUser(user.uid)).customClaims || {};
    return !!customClaims.admin;
  } catch (error) {
    console.error("Admin verification error:", error);
    return false;
  }
}

function mergeUserData(
  authUser: UserRecord | null,
  profileDoc?: DocumentSnapshot
): User {
  const profileData = profileDoc?.exists ? profileDoc.data() : undefined;

  return {
    uid: authUser?.uid ?? profileDoc?.id ?? "",
    email:
      authUser?.email ??
      (typeof profileData?.email === "string" ? profileData.email : ""),
    emailVerified:
      authUser?.emailVerified ??
      (typeof profileData?.emailVerified === "boolean"
        ? profileData.emailVerified
        : false),
    fullName: profileData?.fullName ?? "",
    gender: profileData?.gender,
    birthdate: profileData?.birthdate,
    phone: profileData?.phone,
    createdAt:
      authUser?.metadata.creationTime ?? profileData?.createdAt ?? "",
    lastLogin:
      authUser?.metadata.lastSignInTime ?? profileData?.lastLogin ?? "",
    updatedAt: profileData?.updatedAt ?? "",
    isAdmin: authUser?.customClaims?.admin === true,
  };
}

async function listAllUsers(auth: ReturnType<typeof getAuth>) {
  const allUsers: UserRecord[] = [];
  let pageToken: string | undefined;

  do {
    const result = await auth.listUsers(1000, pageToken);
    allUsers.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);

  return allUsers;
}

async function findProfilesByEmail(
  db: ReturnType<typeof getFirestore>,
  email: string,
  normalizedEmail: string
) {
  const emailCandidates = new Set([email.trim()]);
  emailCandidates.add(normalizedEmail);

  const snapshotPromises: Promise<QuerySnapshot>[] = [
    ...Array.from(emailCandidates).map((value) =>
      db.collection("users").where("email", "==", value).get()
    ),
    db.collection("users").where("emailLowercase", "==", normalizedEmail).get(),
  ];

  const snapshots = await Promise.all(snapshotPromises);
  const results = new Map<string, DocumentSnapshot>();

  snapshots.forEach((snapshot) => {
    snapshot.forEach((doc) => {
      if (!results.has(doc.id)) {
        results.set(doc.id, doc);
      }
    });
  });

  return Array.from(results.values());
}

export async function GET(req: Request) {
  try {
    // 初始化Firebase Admin
    initAdmin();

    // 获取授权头部
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "認証トークンが必要です" },
        { status: 401 }
      );
    }
    
    // 提取令牌
    const idToken = authHeader.split("Bearer ")[1];
    
    // 验证是否为管理员
    if (!(await isAdmin(idToken))) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }
    
    // 获取查询参数
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    
    // 获取Firestore和Auth实例
    const db = getFirestore();
    const auth = getAuth();

    // 邮箱搜索逻辑优化
    if (email) {
      const trimmedEmail = email.trim();
      const normalizedEmail = trimmedEmail.toLowerCase();
      const likelyExactEmail = normalizedEmail.includes("@");

      if (likelyExactEmail) {
        try {
          const authUser = await auth.getUserByEmail(normalizedEmail);
          const profileDoc = await db.collection("users").doc(authUser.uid).get();
          const mergedUser = mergeUserData(authUser, profileDoc);

          return NextResponse.json({
            users: [mergedUser],
            totalCount: 1,
          });
        } catch (error: any) {
          if (error?.code === "auth/user-not-found") {
            const profileMatches = await findProfilesByEmail(
              db,
              trimmedEmail,
              normalizedEmail
            );

            if (profileMatches.length > 0) {
              const mergedProfiles = await Promise.all(
                profileMatches.map(async (profileDoc) => {
                  let authUser: UserRecord | null = null;
                  try {
                    authUser = await auth.getUser(profileDoc.id);
                  } catch (authError: any) {
                    if (authError?.code !== "auth/user-not-found") {
                      console.error("Error fetching auth user:", authError);
                    }
                  }
                  return mergeUserData(authUser, profileDoc);
                })
              );

              return NextResponse.json({
                users: mergedProfiles,
                totalCount: mergedProfiles.length,
              });
            }
            // 如果Firestore也没有匹配结果，继续执行全量检索
          } else {
            console.error("Error fetching user by email:", error);
            return NextResponse.json(
              { error: "ユーザー情報の取得中にエラーが発生しました" },
              { status: 500 }
            );
          }
        }
      }
    }

    // 获取所有用户（支持分页获取超过1000个用户）
    const userRecords = await listAllUsers(auth);

    // 并行获取所有用户的Firestore数据
    const userProfilesPromises = userRecords.map((record) =>
      db.collection("users").doc(record.uid).get()
    );

    const userProfiles = await Promise.all(userProfilesPromises);

    const usersData = userRecords.map((authUser, index) =>
      mergeUserData(authUser, userProfiles[index])
    );

    // 如果有邮箱或姓名筛选参数，进行过滤
    const filteredUsers = email
      ? usersData.filter((user) => {
          const searchTerm = email.toLowerCase();
          const emailMatch = user.email
            ?.toLowerCase()
            .includes(searchTerm);
          const nameMatch = user.fullName
            ?.toLowerCase()
            .includes(searchTerm);
          return emailMatch || nameMatch;
        })
      : usersData;

    return NextResponse.json({
      users: filteredUsers,
      totalCount: filteredUsers.length,
    });

  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "ユーザー情報の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

// 设置此API路由为动态路由，不进行静态生成
export const dynamic = "force-dynamic"; 
