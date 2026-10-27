/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  experimental: {
    // 사진이 들어 있는 엑셀(10MB 이상), ERP 계정내역 엑셀도 올릴 수 있게
    serverActions: { bodySizeLimit: '60mb' },
    middlewareClientMaxBodySize: '60mb',
  },
};

export default nextConfig;
