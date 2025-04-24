import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { initAdmin } from "@/utils/firebase-admin";
import { ROOM_DEVICE_MAPPING } from "@/types/room";
import { RoomCardStatus } from "@/types/reservation";
import crypto from "crypto";
import JsBarcode from "jsbarcode";
import { DOMImplementation, XMLSerializer } from "xmldom";
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
    // PDF417是一种高密度、高容量的二维条形码
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

export async function POST(req: Request) {
  try {
    // 获取授权头部
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("缺少授权头或格式不正确:", authHeader);
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
      console.log("Firebase令牌验证成功，用户ID:", decodedToken.uid);
    } catch (error) {
      console.error("Firebase token verification failed:", error);
      return NextResponse.json(
        { error: "認証トークンが無効です" },
        { status: 401 }
      );
    }

    // 检查是否为管理员 - 使用与reservations API相同的方法
    const userRecord = await getAuth().getUser(decodedToken.uid);
    const customClaims = userRecord.customClaims || {};

    if (!customClaims.admin) {
      console.error("用户不是管理员:", decodedToken.uid);
      return NextResponse.json(
        { error: "管理者権限が必要です" },
        { status: 403 }
      );
    }
    console.log("管理员权限验证通过");

    // 解析请求体
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      console.error("请求体解析失败:", error);
      return NextResponse.json(
        { error: "リクエストボディの解析に失敗しました" },
        { status: 400 }
      );
    }

    const { physicalRoomId, reservationId, startDateTime, endDateTime } =
      requestBody;

    // 验证请求参数
    if (!physicalRoomId || !reservationId || !startDateTime || !endDateTime) {
      console.error("缺少必要参数:", {
        physicalRoomId,
        reservationId,
        startDateTime,
        endDateTime,
      });
      return NextResponse.json(
        { error: "必須パラメータが不足しています" },
        { status: 400 }
      );
    }

    // 确定设备ID
    const deviceId = ROOM_DEVICE_MAPPING[physicalRoomId];
    if (!deviceId) {
      return NextResponse.json(
        { error: `未知の部屋ID: ${physicalRoomId}` },
        { status: 400 }
      );
    }

    // 获取数据库实例
    const db = getFirestore();

    // 生成唯一卡号
    const cardNumber = await generateUniqueCardNumber(db);

    let cardKey = cardNumber;
    let barcode = "";

    try {
      console.log("准备调用外部API创建卡片...");

      // 请求卡API创建卡 - 直接使用原始日期字符串，它已经是正确格式的日本时间
      const cardData = {
        number: cardNumber,
        name: `ETOE-MANUAL-${reservationId}`,
        devices: [deviceId],
        start_at: startDateTime, // 直接使用，已经是正确格式的日本时间
        end_at: endDateTime, // 直接使用，已经是正确格式的日本时间
        owner_client_id: CLIENT_ID,
        symbol_type: "pdf417",
      };

      // 调用API
      const response = await fetch(CARD_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CARD_API_TOKEN}`,
          "Content-Type": "application/json",
          "X-Environment": "standard",
        },
        body: JSON.stringify(cardData),
      });

      console.log("API响应状态:", response.status);

      if (!response.ok) {
        const errText = await response.text();
        console.error(`外部API调用失败: ${response.status} - ${errText}`);
        throw new Error(
          `カード作成に失敗しました: ${response.status} - ${errText}`
        );
      }

      const cardResponse = await response.json();

      // 使用外部API返回的卡片密钥
      cardKey = cardResponse.number;

      // 如果API返回了条形码图像，使用它替代本地生成的条形码
      if (cardResponse.symbol_image_base64) {
        console.log("使用API返回的条形码图像");
        barcode = `data:image/png;base64,${cardResponse.symbol_image_base64}`;
      } else {
        // 只有在API没有返回条形码图像时才生成本地条形码
        try {
          barcode = await generateBarcode(cardNumber);
        } catch (barcodeError) {
          console.error("本地条形码生成失败:", barcodeError);
        }
      }
    } catch (error) {
      console.error("外部APIエラー:", error);

      // 在API调用失败的情况下，继续使用本地生成的卡号
      console.log("使用本地生成的卡号作为备选方案");
      // 生成本地条形码
      try {
        barcode = await generateBarcode(cardNumber);
      } catch (barcodeError) {
        console.error("本地条形码生成失败:", barcodeError);
      }
    }

    // 生成二维码
    const qrcode = await generateQRCode(cardNumber);

    // 创建卡片数据
    const cardData = {
      cardNumber,
      cardKey,
      barcode,
      qrcode,
      physicalRoomId,
      deviceId,
      startAt: startDateTime,
      endAt: endDateTime,
      status: RoomCardStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reservationId,
      isManuallyCreated: true,
      createdBy: decodedToken.uid,
    };

    // 获取新增的卡片ID
    const card = {
      id: `temp_${Date.now()}`,
      ...cardData,
    };

    return NextResponse.json({
      success: true,
      message: "カードが正常に発行されました",
      card,
    });
  } catch (error) {
    console.error("Error generating card:", error);
    return NextResponse.json(
      { error: "カード発行中にエラーが発生しました" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
