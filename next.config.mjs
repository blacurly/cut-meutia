/** @type {import('next').NextConfig} */
const nextConfig = {
  redirects() {
    return [
      { source: "/admin/verifikasi-izin", destination: "/admin/verifikasi-legal", permanent: false },
      { source: "/admin/eskalasi-insiden", destination: "/admin/insiden", permanent: false },
      { source: "/laporan/tambah", destination: "/laporan", permanent: false },
      { source: "/detail", destination: "/pencarian", permanent: false },
    ];
  },
};

export default nextConfig;
