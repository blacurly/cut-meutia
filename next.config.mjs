// Daycare photos are served from Supabase Storage: the public bucket
// "daycare-public-media" and the private, moderated bucket "daycare-gallery".
// The host comes from the environment, not the code.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname;
  } catch {
    return null;
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Turbopack scoped to this checkout when it is nested inside another
  // project folder that also contains a package-lock.json.
  turbopack: {
    root: process.cwd(),
  },
  images: {
    // daycare-gallery is private: approved photos arrive as short-lived
    // signed URLs (?token=...), so the query string must stay allowed there.
    remotePatterns: supabaseHost
      ? [
        { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/daycare-public-media/**", search: "" },
        { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/sign/daycare-gallery/**" },
      ]
      : [],
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
