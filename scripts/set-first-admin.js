/**
 * 管理员用户管理脚本
 *
 * 使用方法:
 * 1. 确保 .env.local 文件中包含所有 Firebase Admin SDK 的必要环境变量
 * 2. 添加管理员: node scripts/set-first-admin.js add your-user-email@example.com
 * 3. 删除管理员: node scripts/set-first-admin.js remove your-user-email@example.com
 * 4. 查看用户状态: node scripts/set-first-admin.js check your-user-email@example.com
 */

// 加载环境变量
require("dotenv").config({ path: ".env.local" });

const admin = require("firebase-admin");

// 初始化 Firebase Admin SDK
const app = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    // 替换私钥中的换行符
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }),
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

async function manageAdmin() {
  try {
    // 获取命令行参数
    const action = process.argv[2]; // add, remove, check
    const userEmail = process.argv[3];

    if (!action || !userEmail || !["add", "remove", "check"].includes(action)) {
      console.error(
        "请提供正确的操作和用户邮箱。\n" +
          "示例:\n" +
          "- 添加管理员: node scripts/set-first-admin.js add your-user-email@example.com\n" +
          "- 删除管理员: node scripts/set-first-admin.js remove your-user-email@example.com\n" +
          "- 查看用户状态: node scripts/set-first-admin.js check your-user-email@example.com"
      );
      process.exit(1);
    }

    // 通过邮箱查找用户
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(userEmail);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        console.error(
          `错误: 未找到邮箱为 ${userEmail} 的用户。请确认该用户已在系统中注册。`
        );
      } else {
        console.error(`查找用户时出错: ${error.message}`);
      }
      process.exit(1);
    }

    // 根据操作处理管理员权限
    switch (action) {
      case "add":
        // 设置用户为管理员
        await admin.auth().setCustomUserClaims(userRecord.uid, { admin: true });
        console.log(
          `✅ 成功将用户 ${userEmail} (${userRecord.uid}) 设置为管理员！`
        );
        break;

      case "remove":
        // 删除管理员权限
        await admin
          .auth()
          .setCustomUserClaims(userRecord.uid, { admin: false });
        console.log(
          `✅ 成功移除用户 ${userEmail} (${userRecord.uid}) 的管理员权限！`
        );
        break;

      case "check":
        // 什么都不做，只显示用户状态
        console.log(`正在查看用户 ${userEmail} (${userRecord.uid}) 的状态`);
        break;
    }

    // 获取更新后的自定义声明以显示当前状态
    const updatedUser = await admin.auth().getUser(userRecord.uid);

    // 输出用户信息
    console.log("\n用户信息:");
    console.log(`- 用户ID: ${updatedUser.uid}`);
    console.log(`- 邮箱: ${updatedUser.email}`);
    console.log(`- 邮箱已验证: ${updatedUser.emailVerified}`);
    console.log(`- 显示名称: ${updatedUser.displayName || "未设置"}`);
    console.log(
      `- 管理员状态: ${updatedUser.customClaims?.admin === true ? "是" : "否"}`
    );
  } catch (error) {
    console.error("操作失败:", error);
    process.exit(1);
  } finally {
    // 关闭 Firebase Admin 连接
    await admin.app().delete();
  }
}

// 运行脚本
manageAdmin();
