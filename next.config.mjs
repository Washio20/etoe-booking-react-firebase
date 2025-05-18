/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // 禁用React的StrictMode
  reactStrictMode: false,
  // 添加这些配置
  experimental: {
    // 将这些包标记为外部包，避免构建时验证
    serverComponentsExternalPackages: ['firebase-admin', 'stripe'],
  },
  // 添加对Google字体的处理
  optimizeFonts: false, // 禁用字体优化
  
  // 添加图片域名配置
  images: {
    domains: ['firebasestorage.googleapis.com'],
  },
  
  // 在生产环境中设置资源前缀
  assetPrefix: process.env.NODE_ENV === 'production' 
    ? process.env.NEXT_PUBLIC_BASE_URL || 'https://book.etoehotel.com'
    : undefined,
  
  // 添加 rewrites 配置，处理 Firebase 邮箱验证链接
  async rewrites() {
    return [
      {
        // 捕获 Firebase 默认邮箱验证链接
        source: '/__/auth/action',
        destination: '/auth/action'
      },
      {
        // 捕获 Firebase 密码重置链接（兼容旧的URL模式）
        source: '/__/auth/handler',
        destination: '/auth/action'
      }
    ];
  },
};

export default nextConfig;
