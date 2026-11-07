/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Turbopack scoped to this checkout when it is nested inside another
  // project folder that also contains a package-lock.json.
  turbopack: {
    root: process.cwd(),
  },
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
