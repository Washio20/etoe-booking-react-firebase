import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 设置时区为日本时区
process.env.TZ = "Asia/Tokyo";

export async function GET() {
  try {
    const now = new Date();

    // 创建一个东京时间的日期对象进行对比
    const tokyoDate = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
    );

    return NextResponse.json({
      serverTime: {
        iso: now.toISOString(),
        utc: now.toUTCString(),
        local: now.toString(),
        localeDateString: now.toLocaleDateString(),
        localeTimeString: now.toLocaleTimeString(),
        timestamp: now.getTime(),
        timezone: {
          offset: now.getTimezoneOffset(),
          offsetHours: -now.getTimezoneOffset() / 60,
          processEnvTZ: process.env.TZ || "未设置",
        },
        tokyoTime: {
          date: tokyoDate.toString(),
          hours: tokyoDate.getHours(),
          minutes: tokyoDate.getMinutes(),
        },
      },
    });
  } catch (error) {
    console.error("获取服务器时间失败:", error);
    return NextResponse.json({ error: "获取服务器时间失败" }, { status: 500 });
  }
}
