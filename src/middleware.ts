// 由于已经在Firebase控制台中设置了自定义Action URL，
// 不再需要中间件捕获Firebase域名的认证链接
// 这个文件可以保留供将来使用，但目前不执行任何操作

import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // 所有请求正常处理
  return NextResponse.next();
}

// 移除匹配器配置，因为我们不再需要捕获特定路径
export const config = {
  matcher: [],
};
