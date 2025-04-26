/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // 添加这些配置
  experimental: {
    // 将这些包标记为外部包，避免构建时验证
    serverComponentsExternalPackages: ['firebase-admin', 'stripe'],
  },
  // 添加对Google字体的处理
  optimizeFonts: false, // 禁用字体优化
  
  // 添加 rewrites 配置，处理 Firebase 邮箱验证链接
  async rewrites() {
    return [
      {
        // 捕获 Firebase 邮箱验证链接
        source: '/__/auth/action',
        destination: '/api/verify-email'
      }
    ];
  },
};

export default nextConfig;
