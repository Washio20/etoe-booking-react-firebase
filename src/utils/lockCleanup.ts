import { db } from "@/utils/firebase";
import { collection, query, where, getDocs, writeBatch, Timestamp } from "firebase/firestore";

// 清理过期锁定的工具函数
export async function cleanupExpiredLocks(): Promise<number> {
  try {
    // 查询所有过期的锁定记录
    const expiredQuery = query(
      collection(db, "reservation_locks"),
      where("expiresAt", "<=", Timestamp.now())
    );

    const expiredSnapshot = await getDocs(expiredQuery);
    
    if (expiredSnapshot.empty) {
      console.log("没有过期锁定需要清理");
      return 0;
    }

    // 批量删除（Firestore批量操作限制500条）
    const batches = [];
    let currentBatch = writeBatch(db);
    let operationCount = 0;
    let totalDeleted = 0;

    expiredSnapshot.docs.forEach((doc) => {
      currentBatch.delete(doc.ref);
      operationCount++;
      totalDeleted++;

      // 每499个操作创建新批次（留一个位置给安全边界）
      if (operationCount === 499) {
        batches.push(currentBatch);
        currentBatch = writeBatch(db);
        operationCount = 0;
      }
    });

    // 添加最后一个批次
    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // 执行所有批次
    for (const batch of batches) {
      await batch.commit();
    }

    console.log(`成功清理 ${totalDeleted} 个过期锁定记录`);
    return totalDeleted;

  } catch (error) {
    console.error("清理过期锁定失败:", error);
    throw error;
  }
}

// 在应用启动时或定期调用的清理函数
export function startPeriodicCleanup(intervalMinutes: number = 30) {
  const cleanup = async () => {
    try {
      await cleanupExpiredLocks();
    } catch (error) {
      console.error("定期清理失败:", error);
    }
  };

  // 立即执行一次
  cleanup();

  // 设置定期执行
  const intervalMs = intervalMinutes * 60 * 1000;
  return setInterval(cleanup, intervalMs);
}