// Fictional, opt-in caregiver demo. Never an authentication or permission source.
export const caregiverDaycareId = "kasih-bunda";
export const emptyCaregiver = { enabled:false, seeded:false, journals:[], replies:[], responses:[], documents:[], business:null };
export const activityTypes = {checkin:"Kedatangan",play:"Bermain & belajar",meal:"Makan",sleep:"Istirahat"};
export const exampleReviews = [
  {id:"example-sustri",daycareId:caregiverDaycareId,author:"Bunda Sustri · contoh",rating:5,text:"Pengasuhnya sabar dan ruang bermain bersih. Catatan harian membantu kami mengikuti kegiatan anak.",createdAt:"2026-10-24T08:00:00+07:00"},
  {id:"example-rama",daycareId:caregiverDaycareId,author:"Ayah Rama · contoh",rating:3,text:"Kegiatan anak menyenangkan. Informasi perubahan jadwal penjemputan masih bisa disampaikan lebih awal.",createdAt:"2026-10-23T08:00:00+07:00"},
];

export function normalizeCaregiver(value) {
  const object=v=>v&&typeof v==="object"&&!Array.isArray(v);
  const text=v=>typeof v==="string";
  const dated=v=>text(v)&&Number.isFinite(Date.parse(v));
  const date=v=>text(v)&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  const list=(key,check)=>Array.isArray(value?.[key])?value[key].filter(v=>object(v)&&check(v)).slice(0,100):[];
  if(!object(value))return emptyCaregiver;
  return {
    enabled:value.enabled===true,seeded:value.seeded===true,
    journals:list("journals",v=>text(v.id)&&v.daycareId===caregiverDaycareId&&Array.isArray(v.childIds)&&v.childIds.every(text)&&Object.hasOwn(activityTypes,v.type)&&text(v.title)&&text(v.body)&&date(v.date)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v.time)&&["draft","published"].includes(v.status)&&dated(v.createdAt)),
    replies:list("replies",v=>text(v.reviewId)&&text(v.text)&&dated(v.createdAt)),
    responses:list("responses",v=>text(v.incidentId)&&text(v.text)&&["reviewing","closed"].includes(v.status)&&dated(v.createdAt)),
    documents:list("documents",v=>text(v.id)&&text(v.number)&&text(v.issuer)&&date(v.expires)&&text(v.filename)&&dated(v.createdAt)),
    business:object(value.business)&&["name","address","hours","description","phone"].every(k=>text(value.business[k]))&&Array.isArray(value.business.facilities)&&value.business.facilities.every(text)?value.business:null,
  };
}
