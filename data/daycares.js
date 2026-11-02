// Fictional fixtures for the explicitly labelled frontend demo. No live permits,
// reviews, capacity, geolocation, or AI assessment are represented by this data.
export const facilities = {
  cctv: "CCTV Online 24/7", doctor: "Dokter Visit Rutin", outdoor: "Outdoor Playground",
  access: "Fingerprint Access", meals: "Katering Gizi Organik",
};
export const regions = {
  "Jawa Timur": { Gresik: ["Kebomas", "Manyar"], Surabaya: ["Wonokromo", "Rungkut"] },
  "DKI Jakarta": { "Jakarta Selatan": ["Tebet", "Setiabudi"] },
  "Jawa Barat": { Bandung: ["Coblong", "Sukajadi"] },
};
export const roomImage = "/images/daycare-room.webp";
export const gardenImage = "/images/daycare-garden.webp";
const fixtures = [
  ["kasih-bunda", "Daycare Kasih Bunda", "Jawa Timur", "Gresik", "Kebomas", 1500000, 4, 4, 0.8, [30, 34, 30], true, ["cctv", "doctor", "outdoor", "access", "meals"], 4.8, 42],
  ["tunas-bangsa", "TPA Tunas Bangsa", "Jawa Timur", "Gresik", "Kebomas", 1200000, 6, 6, 1.2, [30, 30, 29], true, ["cctv", "outdoor", "meals"], 4.7, 28],
  ["pelangi-kecil", "Pelangi Kecil Daycare", "Jawa Timur", "Gresik", "Kebomas", 1800000, 3, 2, 1.8, [30, 35, 31], true, ["cctv", "doctor", "access", "meals"], 4.9, 36],
  ["rumah-ceria", "Rumah Ceria Manyar", "Jawa Timur", "Gresik", "Manyar", 1000000, 6, 0, 4.1, [30, 29, 25], true, ["cctv", "outdoor"], 4.5, 19],
  ["sahabat-kecil", "Sahabat Kecil Surabaya", "Jawa Timur", "Surabaya", "Wonokromo", 2200000, 4, 3, 28.2, [30, 33, 32], true, ["cctv", "doctor", "outdoor", "access"], 4.8, 51],
  ["mentari-pagi", "Mentari Pagi Rungkut", "Jawa Timur", "Surabaya", "Rungkut", 1350000, 6, 5, 34.5, [15, 29, 27], false, ["outdoor", "meals"], 4.3, 12],
  ["langkah-kecil", "Langkah Kecil Tebet", "DKI Jakarta", "Jakarta Selatan", "Tebet", 2800000, 3, 4, 655, [30, 35, 32], true, ["cctv", "doctor", "outdoor", "access", "meals"], 4.9, 64],
  ["rumah-tumbuh", "Rumah Tumbuh Setiabudi", "DKI Jakarta", "Jakarta Selatan", "Setiabudi", 2500000, 4, 2, 660, [30, 32, 29], true, ["cctv", "access", "meals"], 4.7, 31],
  ["bumi-bermain", "Bumi Bermain Bandung", "Jawa Barat", "Bandung", "Coblong", 1750000, 4, 5, 540, [30, 32, 30], true, ["cctv", "outdoor", "meals"], 4.8, 24],
  ["kuncup-harapan", "Kuncup Harapan Sukajadi", "Jawa Barat", "Bandung", "Sukajadi", 950000, 6, 3, 545, [15, 30, 28], false, ["outdoor", "meals"], 4.4, 16],
];
export const daycares = fixtures.map(([id, name, province, city, district, price, ratio, slots, distance, breakdown, verified, amenities, rating, reviewCount], index) => ({
  id, name, province, city, district, price, ratio, slots, distance, breakdown, verified, facilities: amenities, rating, reviewCount,
  score: breakdown.reduce((total, value) => total + value, 0),
  address: index === 0 ? "Jl. Dr. Wahidin No. 45, Kebomas" : `Jl. Taman Ceria No. ${12 + index}, ${district}`,
  image: index % 2 ? gardenImage : roomImage,
  gallery: [roomImage, gardenImage], permit: `DEMO-PAUD-${String(index + 1).padStart(3, "0")}`,
  hours: "Senin–Jumat, 07.00–18.00 WIB", ages: "6 bulan–6 tahun",
  description: `${name} adalah profil contoh daycare dengan kegiatan bermain, eksplorasi, dan rutinitas harian yang terstruktur. Kenali pilihan layanan, fasilitas, serta ringkasan keselamatannya sebelum memilih pengasuhan untuk si kecil.`,
  packages: [
    { id: "full", name: "Full Day", hours: "07.00–18.00", price, unit: "bulan" },
    { id: "half", name: "Half Day", hours: "07.00–12.00", price: Math.round(price * 0.65 / 50000) * 50000, unit: "bulan" },
    { id: "daily", name: "Harian", hours: "07.00–18.00", price: Math.round(price / 15 / 5000) * 5000, unit: "hari" },
  ],
}));
export const journalExamples = [
  { id: "arrival", time: "08:00", type: "checkin", title: "Datang dengan senyum", body: "Si kecil mengikuti penyambutan pagi dan mulai berkenalan dengan teman bermain.", caregiver: "Mbak Siti", image: null },
  { id: "play", time: "09:30", type: "play", title: "Eksplorasi bentuk & warna", body: "Bermain menyusun balok dan mengenal warna. Kegiatan melatih koordinasi serta kerja sama.", caregiver: "Mbak Siti", image: roomImage },
  { id: "meal", time: "12:15", type: "meal", title: "Waktunya makan siang", body: "Contoh menu hari ini: nasi, sup sayur, dan ayam. Catatan contoh: makan dengan lahap.", caregiver: "Mbak Rani", image: null },
  { id: "sleep", time: "13:00", type: "sleep", title: "Istirahat setelah bermain", body: "Contoh catatan: tidur siang selama 1,5 jam dalam suasana tenang.", caregiver: "Mbak Rani", image: null },
];
