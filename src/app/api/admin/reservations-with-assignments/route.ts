import { NextResponse } from "next/server";
import { initAdmin } from "@/utils/firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import * as admin from "firebase-admin";
import { Reservation, FirestoreTimestamp } from "@/types/reservation";
import { 
  toDate,
  isReservationDateMatch
} from "@/utils/date";

// 确保Firebase Admin已初始化
initAdmin();

// 扩展Reservation接口以包含房间分配状态
interface ExtendedReservation extends Reservation {
  hasRoomAssignment?: boolean;
  hasSlowRoomAssignment?: boolean; 
  cardEmailSent?: boolean;
  userFullName?: string;
}

// 获取带有房间分配状态的预约列表
export async function GET(request: Request) {
  try {
    // 获取授权头部
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "認証トークンが必要です" },
        { status: 401 }
      );
    }

    // 提取令牌
    const idToken = authHeader.split("Bearer ")[1];

    // 验证Firebase ID令牌
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      console.error("Firebase token verification failed:", error);
      return NextResponse.json(
        { error: "認証トークンが無効です" },
        { status: 401 }
      );
    }

    // 检查是否为管理员
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return NextResponse.json(
        { error: "管理者権限がありません" },
        { status: 403 }
      );
    }

    // 获取所有预约
    const db = getFirestore();

    // 获取URL查询参数
    const url = new URL(request.url);
    
    // 设置较大的默认值以一次性获取更多数据
    const limit = 500;
    
    // 只获取邮箱和日期参数，这是房卡发行页面使用的
    const email = url.searchParams.get("email");
    const date = url.searchParams.get("date"); // YYYY-MM-DD 格式

    // 日期处理 - 解析为Date对象
    let searchDate = null;
    if (date) {
      try {
        searchDate = new Date(date);
        // 验证日期有效性
        if (isNaN(searchDate.getTime())) {
          searchDate = null;
          console.error("无效的日期格式:", date);
        } else {
          console.log(`解析日期 ${date} -> ${searchDate.toISOString()}`);
        }
      } catch (error) {
        console.error("日期解析错误:", error);
      }
    }

    // 添加调试日志
    console.log("查询参数:", {
      limit,
      email,
      date,
      searchDate: searchDate?.toISOString(),
    });

    // 创建基础查询 - 始终过滤支付状态为paid，不返回已取消的预约
    const reservationsRef = db.collection("reservations");
    
    // 构建查询条件
    let query = reservationsRef.where("paymentStatus", "==", "paid");
    
    // 邮箱搜索
    if (email) {
      query = query
        .where("userEmail", ">=", email)
        .where("userEmail", "<=", email + "\uf8ff"); // 使用Firebase的范围查询
    }
    
    // 日期过滤
    if (searchDate) {
      try {
        // 设置日期范围为当天的开始和结束
        const startOfDay = new Date(searchDate);
        startOfDay.setHours(0, 0, 0, 0);
        
        const endOfDay = new Date(searchDate);
        endOfDay.setHours(23, 59, 59, 999);
        
        console.log("使用日期范围:", startOfDay, "to", endOfDay);
        
        query = query
          .where("bookingDate", ">=", startOfDay)
          .where("bookingDate", "<=", endOfDay);          
      } catch (error) {
        console.error("设置日期查询条件时出错:", error);
      }
    }
    
    // 添加排序和限制
    query = query.orderBy("createdAt", "desc").limit(limit);
    
    // 执行查询
    const allReservationsSnapshot = await query.get();
    console.log(`查询返回 ${allReservationsSnapshot.size} 条记录`);

    // 转换查询结果
    let reservations: ExtendedReservation[] = allReservationsSnapshot.docs.map(
      (doc) => {
        const data = doc.data();
        
        return {
          id: doc.id,
          ...data,
          // 确保客户端可以使用createdAt
          createdAt: data.createdAt,
          // 时间字段处理
          bookingDate: data.bookingDate || null,
          startDateTime: data.startDateTime || null,
          endDateTime: data.endDateTime || null,
          slowRoomStartDateTime: data.slowRoomStartDateTime || null,
          slowRoomEndDateTime: data.slowRoomEndDateTime || null,
          // 确保价格字段正确
          price: data.price || 0,
          // 初始化房间分配状态，稍后填充
          hasRoomAssignment: false,
          hasSlowRoomAssignment: false,
          // 保持原始的cardEmailSent值
          cardEmailSent: data.cardEmailSent === true,
          // 确保所有必要属性都存在
          userId: data.userId || "",
          userEmail: data.userEmail || "",
          roomType: data.roomType || "",
          paymentStatus: data.paymentStatus || "",
        } as ExtendedReservation;
      }
    );

    // 获取所有预约的房间分配信息 - 批量查询
    const reservationIds = reservations.map(res => res.id);
    
    // 检查是否有预约ID
    if (reservationIds.length > 0) {
      try {
        // 由于Firestore的'in'操作限制为最多10个元素，分批查询
        const batchSize = 10;
        const batches = [];
        
        for (let i = 0; i < reservationIds.length; i += batchSize) {
          const batch = reservationIds.slice(i, i + batchSize);
          batches.push(batch);
        }
        
        // 创建分配信息的映射，以预约ID为键
        const assignmentsMap: { [reservationId: string]: any } = {};
        
        // 分批执行查询
        for (const batch of batches) {
          // 使用reservationId字段查询，而不是文档ID
          const assignmentsQuery = await db.collection("roomAssignments")
            .where("reservationId", "in", batch)
            .get();
          
          console.log(`批量查询房间分配状态 - 批次大小: ${batch.length}, 结果数量: ${assignmentsQuery.size}`);
          
          assignmentsQuery.forEach(doc => {
            const data = doc.data();
            // 使用reservationId作为键
            if (data && data.reservationId) {
              // 如果已有此预约ID的记录，合并到数组中
              if (assignmentsMap[data.reservationId]) {
                if (!assignmentsMap[data.reservationId].assignments) {
                  // 第一次合并，将现有记录转换为assignments数组格式
                  assignmentsMap[data.reservationId] = {
                    assignments: [assignmentsMap[data.reservationId]],
                    cardEmailSent: assignmentsMap[data.reservationId].cardEmailSent
                  };
                }
                // 添加到assignments数组
                assignmentsMap[data.reservationId].assignments.push(data);
              } else {
                // 第一条记录，直接保存
                assignmentsMap[data.reservationId] = data;
              }
            }
          });
        }
        
        console.log(`从数据库获取到 ${Object.keys(assignmentsMap).length} 个房间分配记录`);

        // 并行处理所有预约 - 添加用户全名和房间分配状态
        const enhancedReservationsPromises = reservations.map(
          async (reservation) => {
            let enhancedReservation = {...reservation};
            
            // 处理用户全名
            if (!reservation.userFullName && reservation.userId) {
              const userId = reservation.userId;
              try {
                // 直接查询Firestore users表
                const userDoc = await db.collection("users").doc(userId).get();

                if (userDoc.exists) {
                  const userData = userDoc.data();
                  if (userData && userData.fullName) {
                    enhancedReservation.userFullName = userData.fullName;
                  }
                }
              } catch (error) {
                console.error(`获取用户ID ${userId} 信息失败:`, error);
              }
            }
            
            // 处理房间分配状态
            const assignmentData = assignmentsMap[reservation.id];
            if (assignmentData) {
              console.log(`预约 ${reservation.id} 的分配数据存在`);
              
              let assignments = [];
              
              // 判断数据结构
              if (Array.isArray(assignmentData.assignments)) {
                // 已经是数组格式
                assignments = assignmentData.assignments;
              } else if (assignmentData.roomType) {
                // 单个记录，但没有assignments数组
                assignments = [assignmentData];
              }
              
              // 更新分配状态
              const hasMainRoomAssignment = assignments.some(
                (assignment: any) => assignment.roomType === reservation.roomType
              );
              
              // 检查是否有Slow Room分配
              const hasSlowRoomAssignment = reservation.slowRoomAsSetPlan &&
                assignments.some(
                  (assignment: any) => assignment.roomType === "slow_room"
                );
              
              // 邮件发送状态直接从预约记录中获取
              const cardEmailSent = reservation.cardEmailSent === true;
              
              // 添加房间分配状态
              enhancedReservation.hasRoomAssignment = hasMainRoomAssignment;
              enhancedReservation.hasSlowRoomAssignment = hasSlowRoomAssignment;
              enhancedReservation.cardEmailSent = cardEmailSent;
            }
            
            return enhancedReservation;
          }
        );

        // 等待所有预约处理完成
        reservations = await Promise.all(enhancedReservationsPromises);
      } catch (error) {
        console.error("批量获取房间分配状态失败:", error);
      }
    }

    // 再次确认不返回已取消的预约
    reservations = reservations.filter((res) => res.paymentStatus === "paid");

    return NextResponse.json({
      reservations,
      total: reservations.length
    });
  } catch (error) {
    console.error("Error retrieving reservations with assignments:", error);
    return NextResponse.json(
      { error: "予約と部屋割り当て情報の取得中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic"; 