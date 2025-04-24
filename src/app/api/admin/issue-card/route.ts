import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { ROOM_DEVICE_MAPPING } from "@/types/room";
import { RoomCardStatus } from "@/types/reservation";
import crypto from "crypto";
import QRCode from "qrcode";
// @ts-ignore
import bwipjs from "bwip-js";

// 确保Firebase Admin已初始化
initAdmin();

// 卡片管理API URL
const CARD_API_URL =
  process.env.CARD_API_URL ||
  "https://identify.access.networks.stayforge.io/card/add";
const CARD_API_TOKEN = process.env.CARD_API_TOKEN || "stayforge_test_token_123";

// 客户端ID
const CLIENT_ID = "client_etoehotel";

// 使用测试模式（不调用实际API）
const USE_TEST_MODE = true;

// 房间号对应的房间类型映射
const roomNumberToType: { [key: string]: string } = {
  room_101: "tototo",
  room_102: "fuuu",
  room_103: "zabuun",
  room_104: "toron",
  room_201: "sauna_suite",
  room_202: "slow_room",
  room_203: "slow_room",
  room_204: "slow_room",
  room_205: "slow_room",
  room_206: "slow_room",
  room_301: "slow_room",
  room_302: "slow_room",
  room_303: "slow_room",
  room_304: "slow_room",
  room_305: "slow_room",
};

// 生成随机卡号并检查是否已存在
const generateUniqueCardNumber = async (
  db: FirebaseFirestore.Firestore
): Promise<string> => {
  // 最多尝试10次生成不重复的卡号
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 生成随机卡号
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(8).toString("hex").toUpperCase();
    const cardNumber = `${timestamp}${randomBytes}`;

    console.log(`尝试生成卡号 (${attempt + 1}/${maxAttempts}): ${cardNumber}`);

    // 检查数据库中是否已存在该卡号
    const existingCards = await db
      .collection("roomCards")
      .where("cardNumber", "==", cardNumber)
      .limit(1)
      .get();

    if (existingCards.empty) {
      console.log(`已生成唯一卡号: ${cardNumber}`);
      return cardNumber;
    }

    console.log(`卡号 ${cardNumber} 已存在，重新生成...`);
  }

  // 如果多次尝试后仍然无法生成唯一卡号，则抛出错误
  throw new Error("无法生成唯一的卡号，请稍后重试");
};

// 使用bwip-js生成PDF417条形码
const generateBarcode = async (cardNumber: string): Promise<string> => {
  try {
    // 使用bwip-js生成PDF417条形码
    const png = await bwipjs.toBuffer({
      bcid: "pdf417", // PDF417二维条形码
      text: cardNumber, // 卡号
      scale: 3, // 3x缩放
      height: 10, // 条形码高度，单位：mm
      columns: 3, // 数据列数
      compact: false, // 非紧凑模式
      includetext: false, // 不显示文本
    });

    // 转换为base64
    const base64 = `data:image/png;base64,${png.toString("base64")}`;
    return base64;
  } catch (error) {
    console.error("使用bwip-js生成条形码时出错:", error);
    return "";
  }
};

// 生成二维码
const generateQRCode = async (cardNumber: string): Promise<string> => {
  try {
    // 生成二维码的数据URL
    const qrDataURL = await QRCode.toDataURL(cardNumber, {
      errorCorrectionLevel: "H",
      width: 300,
      margin: 1,
    });
    return qrDataURL;
  } catch (error) {
    console.error("生成二维码时出错:", error);
    return "";
  }
};

// 获取Firebase Timestamp
const getFirebaseTimestamp = (date: Date) => {
  return Timestamp.fromDate(date);
};

// 创建房间卡
const createRoomCard = async (
  physicalRoomId: string,
  reservationId: string,
  startDateTime: Date,
  endDateTime: Date
): Promise<{
  cardNumber: string;
  cardKey: string;
  barcode: string;
  qrcode: string;
} | null> => {
  try {
    const db = getFirestore();

    // 生成卡号
    const cardNumber = await generateUniqueCardNumber(db);

    // 确定设备ID
    const deviceId = ROOM_DEVICE_MAPPING[physicalRoomId];
    if (!deviceId) {
      throw new Error(`未找到物理房间 ${physicalRoomId} 的设备ID`);
    }

    let cardKey = cardNumber;
    let barcode = "";

    if (!USE_TEST_MODE) {
      try {
        console.log("准备调用外部API创建卡片...");

        // 获取API令牌
        const apiToken = CARD_API_TOKEN;

        if (!apiToken) {
          throw new Error("无法获取API令牌");
        }

        // 请求卡API创建卡
        const cardData = {
          number: cardNumber,
          name: `ETOE-${reservationId}`,
          devices: [deviceId],
          start_at: getFirebaseTimestamp(startDateTime),
          end_at: getFirebaseTimestamp(endDateTime),
          owner_client_id: CLIENT_ID,
          symbol_type: "pdf417",
        };

        // 调用API
        const response = await fetch(CARD_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
            "X-Environment": "standard",
          },
          body: JSON.stringify(cardData),
        });

        console.log("API响应状态:", response.status);

        if (!response.ok) {
          const errText = await response.text();
          console.error(`外部API调用失败: ${response.status} - ${errText}`);
          throw new Error(`创建卡失败: ${response.status} - ${errText}`);
        }

        const cardResponse = await response.json();

        // 使用外部API返回的卡片密钥
        cardKey = cardResponse.number;

        // 如果API返回了条形码图像，使用它
        if (cardResponse.symbol_image_base64) {
          console.log("使用API返回的条形码图像");
          barcode = `data:image/png;base64,${cardResponse.symbol_image_base64}`;
        } else {
          // 否则使用简单的条形码表示
          barcode = await generateBarcode(cardNumber);
        }
      } catch (error) {
        console.error("外部API错误:", error);
        // 在API调用失败的情况下，继续使用本地生成的卡号和条形码
        console.log("使用本地生成的卡号作为备选方案");
        barcode = await generateBarcode(cardNumber);
      }
    } else {
      // 测试模式，使用本地生成的条形码
      console.log("测试模式：使用本地生成的条形码");
      barcode = await generateBarcode(cardNumber);
    }

    // 生成二维码
    const qrcode = await generateQRCode(cardNumber);

    return {
      cardNumber,
      cardKey,
      barcode,
      qrcode,
    };
  } catch (error) {
    console.error("创建房间卡时出错:", error);
    return null;
  }
};

export async function POST(req: Request) {
  try {
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

    // 检查管理员权限
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }

    // 解析请求体
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return NextResponse.json(
        { error: "リクエストボディの解析に失敗しました" },
        { status: 400 }
      );
    }

    const {
      reservationId,
      physicalRoomId,
      bookingDate,
      reservationTime,
      startDateTime,
      endDateTime,
      roomType,
      slowRoomTime,
      isSetPlanSlowRoom,
    } = requestBody;

    // 验证请求参数
    if (
      !reservationId ||
      !physicalRoomId ||
      (!bookingDate && !startDateTime) ||
      (!reservationTime && !startDateTime && !isSetPlanSlowRoom)
    ) {
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      );
    }

    // 获取数据库实例
    const db = getFirestore();

    // 获取预约信息
    const reservationDoc = await db
      .collection("reservations")
      .doc(reservationId)
      .get();

    if (!reservationDoc.exists) {
      return NextResponse.json(
        { error: "予約が見つかりません" },
        { status: 404 }
      );
    }

    // 确定要使用的房间类型 - 如果是套餐的Slow Room，使用slow_room类型
    const effectiveRoomType = isSetPlanSlowRoom
      ? "slow_room"
      : roomType || reservationDoc.data()?.roomType;

    // 解析预约时间 - 优先使用startDateTime和endDateTime
    let effectiveStartDateTime: Date | undefined;
    let effectiveEndDateTime: Date | undefined;

    try {
      // 如果前端直接传递了startDateTime和endDateTime时间戳，优先使用这些
      if (startDateTime && endDateTime) {
        console.log("使用startDateTime和endDateTime字段:", {
          startDateTime,
          endDateTime,
        });

        // 处理时间戳对象
        if (typeof startDateTime === "object") {
          const startSeconds =
            startDateTime._seconds || startDateTime.seconds || 0;
          const endSeconds = endDateTime._seconds || endDateTime.seconds || 0;

          effectiveStartDateTime = new Date(startSeconds * 1000);
          effectiveEndDateTime = new Date(endSeconds * 1000);
        } else {
          // 如果是时间戳数字
          effectiveStartDateTime = new Date(startDateTime);
          effectiveEndDateTime = new Date(endDateTime);
        }
      } else {
        // 否则，需要从bookingDate和reservationTime中解析
        // 首先获取预约日期
        let bookingDateObj: Date;

        // 处理bookingDate（可能是字符串日期或Timestamp对象）
        if (typeof bookingDate === "string") {
          // 移除可能包含的"年月日"字样
          const cleanDate = bookingDate
            .replace(/年|月/g, "-")
            .replace(/日/g, "");

          bookingDateObj = new Date(cleanDate);

          // 如果解析失败，尝试使用预约文档中的bookingDate
          if (isNaN(bookingDateObj.getTime())) {
            const reservationData = reservationDoc.data();
            if (reservationData && reservationData.bookingDate) {
              const dbBookingDate = reservationData.bookingDate;
              const seconds =
                dbBookingDate._seconds || dbBookingDate.seconds || 0;
              bookingDateObj = new Date(seconds * 1000);
            } else {
              throw new Error("无法解析预约日期");
            }
          }
        } else if (
          typeof bookingDate === "object" &&
          (bookingDate._seconds || bookingDate.seconds)
        ) {
          // 如果是Timestamp对象
          const seconds = bookingDate._seconds || bookingDate.seconds;
          bookingDateObj = new Date(seconds * 1000);
        } else {
          // 尝试从预约文档获取日期
          const reservationData = reservationDoc.data();
          if (reservationData && reservationData.bookingDate) {
            const dbBookingDate = reservationData.bookingDate;
            const seconds =
              dbBookingDate._seconds || dbBookingDate.seconds || 0;
            bookingDateObj = new Date(seconds * 1000);
          } else {
            throw new Error("无法解析预约日期");
          }
        }

        console.log(
          "使用bookingDate字段（Timestamp）:",
          bookingDateObj.toISOString()
        );

        // 然后解析时间
        if (effectiveRoomType === "slow_room" && !isSetPlanSlowRoom) {
          console.log("处理slow_room类型的预约");

          // 对于普通Slow Room预约，检查预约文档中的时间
          const reservationData = reservationDoc.data();

          // 尝试使用预约文档中的startDateTime和endDateTime
          if (
            reservationData &&
            reservationData.startDateTime &&
            reservationData.endDateTime
          ) {
            const dbStart = reservationData.startDateTime;
            const dbEnd = reservationData.endDateTime;

            const startSeconds = dbStart._seconds || dbStart.seconds || 0;
            const endSeconds = dbEnd._seconds || dbEnd.seconds || 0;

            effectiveStartDateTime = new Date(startSeconds * 1000);
            effectiveEndDateTime = new Date(endSeconds * 1000);

            console.log("使用startDateTime和endDateTime字段:", {
              startDateTime: effectiveStartDateTime.toISOString(),
              endDateTime: effectiveEndDateTime.toISOString(),
            });
          } else if (reservationTime) {
            // 如果没有，尝试用reservationTime解析
            console.log("使用预约时间:", reservationTime);
            let startTime, endTime;

            // 处理不同分隔符
            if (reservationTime.includes("〜")) {
              [startTime, endTime] = reservationTime.split("〜");
            } else if (reservationTime.includes("-")) {
              [startTime, endTime] = reservationTime.split("-");
            } else {
              // 没有分隔符，使用默认时间
              effectiveStartDateTime = new Date(bookingDateObj);
              effectiveStartDateTime.setHours(8, 0, 0, 0);

              effectiveEndDateTime = new Date(bookingDateObj);
              effectiveEndDateTime.setHours(22, 0, 0, 0);

              console.log("无法解析时间格式，使用默认时间");
            }

            if (startTime && endTime) {
              const startMatch = startTime.match(/(\d+):(\d+)/);
              const endMatch = endTime.match(/(\d+):(\d+)/);

              if (startMatch && endMatch) {
                const startHour = parseInt(startMatch[1]);
                const startMinute = parseInt(startMatch[2]);
                const endHour = parseInt(endMatch[1]);
                const endMinute = parseInt(endMatch[2]);

                effectiveStartDateTime = new Date(bookingDateObj);
                effectiveStartDateTime.setHours(startHour, startMinute, 0, 0);

                effectiveEndDateTime = new Date(bookingDateObj);
                effectiveEndDateTime.setHours(endHour, endMinute, 0, 0);
              }
            }
          } else {
            // 如果所有尝试都失败，使用默认Slow Room时间
            effectiveStartDateTime = new Date(bookingDateObj);
            effectiveStartDateTime.setHours(8, 0, 0, 0);

            effectiveEndDateTime = new Date(bookingDateObj);
            effectiveEndDateTime.setHours(22, 0, 0, 0);
          }
        } else if (isSetPlanSlowRoom && slowRoomTime) {
          // 处理套餐的Slow Room
          console.log("处理套餐Slow Room时间:", slowRoomTime);

          // 尝试从预约文档中获取Slow Room时间
          const reservationData = reservationDoc.data();
          if (
            reservationData &&
            reservationData.slowRoomStartDateTime &&
            reservationData.slowRoomEndDateTime
          ) {
            const dbStart = reservationData.slowRoomStartDateTime;
            const dbEnd = reservationData.slowRoomEndDateTime;

            const startSeconds = dbStart._seconds || dbStart.seconds || 0;
            const endSeconds = dbEnd._seconds || dbEnd.seconds || 0;

            effectiveStartDateTime = new Date(startSeconds * 1000);
            effectiveEndDateTime = new Date(endSeconds * 1000);
          } else {
            // 否则，解析slowRoomTime
            let slowStartTime, slowEndTime;

            if (slowRoomTime.includes("〜")) {
              [slowStartTime, slowEndTime] = slowRoomTime.split("〜");
            } else if (slowRoomTime.includes("-")) {
              [slowStartTime, slowEndTime] = slowRoomTime.split("-");
            } else {
              // 没有分隔符，使用默认时间
              effectiveStartDateTime = new Date(bookingDateObj);
              effectiveStartDateTime.setHours(10, 0, 0, 0);

              effectiveEndDateTime = new Date(bookingDateObj);
              effectiveEndDateTime.setHours(12, 0, 0, 0);
            }

            if (slowStartTime && slowEndTime) {
              const startMatch = slowStartTime.match(/(\d+):(\d+)/);
              const endMatch = slowEndTime.match(/(\d+):(\d+)/);

              if (startMatch && endMatch) {
                const startHour = parseInt(startMatch[1]);
                const startMinute = parseInt(startMatch[2]);
                const endHour = parseInt(endMatch[1]);
                const endMinute = parseInt(endMatch[2]);

                effectiveStartDateTime = new Date(bookingDateObj);
                effectiveStartDateTime.setHours(startHour, startMinute, 0, 0);

                effectiveEndDateTime = new Date(bookingDateObj);
                effectiveEndDateTime.setHours(endHour, endMinute, 0, 0);
              }
            }
          }
        } else {
          // 常规预约
          console.log("处理常规预约时间:", reservationTime);

          // 尝试使用预约文档中的时间
          const reservationData = reservationDoc.data();
          if (
            reservationData &&
            reservationData.startDateTime &&
            reservationData.endDateTime
          ) {
            const dbStart = reservationData.startDateTime;
            const dbEnd = reservationData.endDateTime;

            const startSeconds = dbStart._seconds || dbStart.seconds || 0;
            const endSeconds = dbEnd._seconds || dbEnd.seconds || 0;

            effectiveStartDateTime = new Date(startSeconds * 1000);
            effectiveEndDateTime = new Date(endSeconds * 1000);
          } else if (reservationTime) {
            // 否则解析reservationTime
            let startTime, endTime;

            if (reservationTime.includes("〜")) {
              [startTime, endTime] = reservationTime.split("〜");
            } else if (reservationTime.includes("-")) {
              [startTime, endTime] = reservationTime.split("-");
            } else {
              throw new Error("无效的预约时间格式");
            }

            const startMatch = startTime.match(/(\d+):(\d+)/);
            const endMatch = endTime.match(/(\d+):(\d+)/);

            if (!startMatch || !endMatch) {
              throw new Error("无效的时间格式");
            }

            const startHour = parseInt(startMatch[1]);
            const startMinute = parseInt(startMatch[2]);
            const endHour = parseInt(endMatch[1]);
            const endMinute = parseInt(endMatch[2]);

            effectiveStartDateTime = new Date(bookingDateObj);
            effectiveStartDateTime.setHours(startHour, startMinute, 0, 0);

            effectiveEndDateTime = new Date(bookingDateObj);
            effectiveEndDateTime.setHours(endHour, endMinute, 0, 0);
          } else {
            throw new Error("缺少预约时间信息");
          }
        }
      }

      // 确保时间参数有值
      if (!effectiveStartDateTime || !effectiveEndDateTime) {
        throw new Error("无法确定有效的预约时间范围");
      }

      // 打印最终解析的时间
      console.log("最终预约时间范围:", {
        startDateTime: effectiveStartDateTime.toISOString(),
        endDateTime: effectiveEndDateTime.toISOString(),
      });

      // 检查是否有效
      if (
        isNaN(effectiveStartDateTime.getTime()) ||
        isNaN(effectiveEndDateTime.getTime())
      ) {
        throw new Error("无效的时间范围");
      }
    } catch (error) {
      console.error("解析预约时间出错:", error);
      return NextResponse.json(
        { error: "予約時間の解析に失敗しました" },
        { status: 400 }
      );
    }

    // 检查预约是否已经分配过房间
    const existingAssignments = await db
      .collection("roomAssignments")
      .where("reservationId", "==", reservationId)
      .where("physicalRoomId", "==", physicalRoomId)
      .limit(1)
      .get();

    if (!existingAssignments.empty) {
      return NextResponse.json(
        { error: "この予約はすでに部屋が割り当てられています" },
        { status: 400 }
      );
    }

    // 获取房间号对应房间类型的映射
    const matchingRoomIds = Object.entries(roomNumberToType)
      .filter(([roomId, type]) => type === effectiveRoomType)
      .map(([roomId]) => roomId);

    console.log(
      `房间类型 ${effectiveRoomType} 对应的物理房间IDs:`,
      matchingRoomIds
    );

    // 先检查房间是否已分配
    // 获取预约当天的开始和结束时间戳（日本时间）
    const bookingDateOnly = new Date(effectiveStartDateTime);
    bookingDateOnly.setHours(0, 0, 0, 0);

    const nextDay = new Date(bookingDateOnly);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setMilliseconds(nextDay.getMilliseconds() - 1); // 23:59:59.999

    console.log("查询房间分配，日期范围:", {
      dayStart: bookingDateOnly.toISOString(),
      dayEnd: nextDay.toISOString(),
    });

    // 获取当天所有活跃的房间分配
    const existingAssignmentsSnapshot = await db
      .collection("roomAssignments")
      .where("physicalRoomId", "==", physicalRoomId)
      .where("status", "==", "active")
      .get();

    // 检查是否有与当前预约时间重叠的分配
    const hasOverlap = existingAssignmentsSnapshot.docs.some((doc) => {
      const assignment = doc.data();

      // 解析分配记录的时间
      let assignmentStartObj, assignmentEndObj;

      // 处理不同格式的日期时间
      if (
        typeof assignment.startDateTime === "object" &&
        assignment.startDateTime.seconds
      ) {
        // 如果是Firestore Timestamp
        assignmentStartObj = new Date(assignment.startDateTime.seconds * 1000);
        assignmentEndObj = new Date(assignment.endDateTime.seconds * 1000);
      } else if (typeof assignment.startDateTime === "number") {
        // 如果是数字时间戳
        assignmentStartObj = new Date(assignment.startDateTime);
        assignmentEndObj = new Date(assignment.endDateTime);
      } else {
        // 如果是ISO字符串
        assignmentStartObj = new Date(assignment.startDateTime);
        assignmentEndObj = new Date(assignment.endDateTime);
      }

      console.log(
        `检查房间 ${physicalRoomId} 时间段冲突:`,
        `已分配: ${assignmentStartObj.toISOString()} - ${assignmentEndObj.toISOString()}`,
        `请求: ${effectiveStartDateTime.toISOString()} - ${effectiveEndDateTime.toISOString()}`
      );

      // 检查时间段重叠
      const hasTimeOverlap =
        assignmentStartObj < effectiveEndDateTime &&
        assignmentEndObj > effectiveStartDateTime;

      if (hasTimeOverlap) {
        console.log(
          `检测到时间段重叠！房间 ${physicalRoomId} 在请求的时间段已被预订`
        );
      }

      return hasTimeOverlap;
    });

    if (hasOverlap) {
      return NextResponse.json(
        { error: "指定した時間にこの部屋は既に予約されています" },
        { status: 400 }
      );
    }

    // 创建房间分配记录
    const roomAssignmentRef = await db.collection("roomAssignments").add({
      reservationId,
      roomType: effectiveRoomType,
      physicalRoomId: physicalRoomId,
      startDateTime: getFirebaseTimestamp(effectiveStartDateTime),
      endDateTime: getFirebaseTimestamp(effectiveEndDateTime),
      status: "active",
      createdAt: getFirebaseTimestamp(new Date()),
      updatedAt: getFirebaseTimestamp(new Date()),
    });

    console.log("最终卡片有效时间范围:", {
      startDateTime: effectiveStartDateTime.toISOString(),
      endDateTime: effectiveEndDateTime.toISOString(),
    });

    // 生成房间卡
    const roomCard = await createRoomCard(
      physicalRoomId,
      reservationId,
      effectiveStartDateTime,
      effectiveEndDateTime
    );

    if (!roomCard) {
      return NextResponse.json(
        { error: "カード生成に失敗しました" },
        { status: 500 }
      );
    }

    // 保存房间卡信息
    const cardRef = await db.collection("roomCards").add({
      reservationId,
      cardNumber: roomCard.cardNumber,
      cardKey: roomCard.cardKey,
      barcode: roomCard.barcode,
      qrcode: roomCard.qrcode,
      physicalRoomId: physicalRoomId,
      deviceId: ROOM_DEVICE_MAPPING[physicalRoomId] || "",
      startAt: getFirebaseTimestamp(effectiveStartDateTime),
      endAt: getFirebaseTimestamp(effectiveEndDateTime),
      status: RoomCardStatus.ACTIVE,
      createdAt: getFirebaseTimestamp(new Date()),
      updatedAt: getFirebaseTimestamp(new Date()),
      issuedBy: decodedToken.uid,
    });

    // 获取新增的卡片ID
    const card = {
      id: cardRef.id,
      ...roomCard,
      physicalRoomId,
      deviceId: ROOM_DEVICE_MAPPING[physicalRoomId] || "",
      startAt: {
        seconds: getFirebaseTimestamp(effectiveStartDateTime).seconds,
        nanoseconds: getFirebaseTimestamp(effectiveStartDateTime).nanoseconds,
      },
      endAt: {
        seconds: getFirebaseTimestamp(effectiveEndDateTime).seconds,
        nanoseconds: getFirebaseTimestamp(effectiveEndDateTime).nanoseconds,
      },
      status: RoomCardStatus.ACTIVE,
    };

    return NextResponse.json({
      success: true,
      message: "カードが正常に発行されました",
      card,
    });
  } catch (error) {
    console.error("Error issuing card:", error);
    return NextResponse.json(
      { error: "カード発行中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
