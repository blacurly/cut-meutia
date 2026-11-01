import { activityTypes, caregiverDaycareId, exampleReviews } from "../data/caregiver.js";
import { facilities } from "../data/daycares.js";
import { addNotification, availableSlots, createEnrollment, getDaycare, todayISO, transitionEnrollment, validISODate } from "./parent.js";

export const managedDaycare = getDaycare(caregiverDaycareId);
export const managedEnrollments = state => state.enrollments.filter(e=>e.daycareId===caregiverDaycareId);
export const managedChildren = state => state.children.filter(c=>managedEnrollments(state).some(e=>e.childId===c.id&&e.status==="active"));
export const managedReviews = state => [...state.reviews.filter(r=>r.daycareId===caregiverDaycareId).map(r=>({...r,author:`${state.profile.name} · lokal`})),...exampleReviews];
export const businessProfile = state => state.caregiver.business || {...managedDaycare,phone:"081234567890"};
function requireDemo(state) { if(!state.caregiver?.enabled)throw new Error("Aktifkan mode demo Pengelola terlebih dahulu."); }
function clean(value) { return typeof value==="string"?value.trim():""; }
export function reviewEnrollment(state,id,status,note="") {
  requireDemo(state);
  const entry=managedEnrollments(state).find(e=>e.id===id);
  if(!entry)throw new Error("Pengajuan ini bukan milik daycare demo yang dikelola.");
  if(!["approved","rejected"].includes(status))throw new Error("Pengelola hanya dapat menerima atau menolak pengajuan.");
  const text=clean(note);
  if(text.length>500||(status==="rejected"&&text.length<10))throw new Error("Isi alasan penolakan 10–500 karakter.");
  const next=transitionEnrollment(state,id,status);
  return {...next,enrollments:next.enrollments.map(e=>e.id===id?{...e,caregiverNote:text}:e)};
}
export function seedCaregiverDemo(state,today=todayISO()) {
  requireDemo(state);
  if(state.caregiver.seeded)return state;
  if(availableSlots(managedDaycare,state)<2)throw new Error("Diperlukan dua slot contoh. Anda tetap dapat menggunakan pengajuan yang sudah tersedia.");
  const dob=`${Number(today.slice(0,4))-2}-01-15`;
  let next={...state,member:true};
  for(const [name,active] of [["Arka Contoh Pengelola",true],["Kirana Contoh Pengelola",false]]) {
    const form={daycareId:caregiverDaycareId,childName:name,dob,packageId:"full",startDate:today,consent:true};
    next=createEnrollment(next,form,today);
    if(active){const id=next.enrollments[0].id;next=transitionEnrollment(next,id,"approved");next=transitionEnrollment(next,id,"active");}
  }
  return {...next,member:state.member,caregiver:{...next.caregiver,seeded:true}};
}
export function draftNarrative(type) {
  const texts={checkin:"Anak mengikuti penyambutan pagi dan bersiap menjalani rutinitas bersama pengasuh.",play:"Anak mengikuti kegiatan bermain terarah. Tambahkan pengamatan faktual tentang aktivitas dan respons anak.",meal:"Anak mengikuti jadwal makan. Tambahkan menu, porsi, dan catatan yang benar-benar diamati.",sleep:"Anak mengikuti waktu istirahat. Tambahkan jam mulai, jam selesai, dan pengamatan pengasuh."};
  return texts[type]||texts.play;
}
export function saveJournal(state,form,publish=false,now=new Date()) {
  requireDemo(state);
  const today=new Date(now.getTime()+7*3600000).toISOString().slice(0,10);
  const currentTime=new Date(now.getTime()+7*3600000).toISOString().slice(11,16);
  const childIds=[...new Set(Array.isArray(form.childIds)?form.childIds:[])];
  if(!childIds.length||!childIds.every(id=>managedChildren(state).some(c=>c.id===id)))throw new Error("Pilih minimal satu anak aktif dari daycare ini.");
  if(!validISODate(form.date)||form.date>today||!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)||(form.date===today&&form.time>currentTime))throw new Error("Tanggal dan jam kegiatan harus valid dan tidak berada di masa depan.");
  if(childIds.some(id=>!managedEnrollments(state).some(e=>e.childId===id&&e.status==="active"&&e.startDate<=form.date)))throw new Error("Tanggal kegiatan tidak boleh mendahului awal pengasuhan anak.");
  if(!Object.hasOwn(activityTypes,form.type)||clean(form.title).length<3||clean(form.title).length>100||clean(form.body).length<20||clean(form.body).length>2000)throw new Error("Isi kategori, judul 3–100 karakter, dan catatan 20–2000 karakter.");
  if(publish&&form.reviewed!==true)throw new Error("Tinjau narasi dan konfirmasikan publikasi terlebih dahulu.");
  const existing=form.id?state.caregiver.journals.find(j=>j.id===form.id):null;
  if(form.id&&(!existing||existing.status!=="draft"))throw new Error("Hanya draf yang masih tersedia yang dapat diubah.");
  const journal={id:existing?.id||crypto.randomUUID(),daycareId:caregiverDaycareId,childIds,type:form.type,title:clean(form.title),body:clean(form.body),date:form.date,time:form.time,status:publish?"published":"draft",createdAt:existing?.createdAt||now.toISOString(),updatedAt:now.toISOString(),publishedAt:publish?now.toISOString():null,caregiver:"Mbak Siti · demo",image:null};
  const next={...state,caregiver:{...state.caregiver,journals:[journal,...state.caregiver.journals.filter(j=>j.id!==journal.id)]}};
  return publish?addNotification(next,"Logbook pengelola tersedia pada demo","/catatan-harian"):next;
}
export function deleteJournalDraft(state,id) {
  requireDemo(state);
  if(!state.caregiver.journals.some(j=>j.id===id&&j.status==="draft"))throw new Error("Hanya draf yang dapat dihapus.");
  return {...state,caregiver:{...state.caregiver,journals:state.caregiver.journals.filter(j=>j.id!==id)}};
}
export function parentJournals(state,childId,daycareId,date) {
  if(!state.enrollments.some(e=>e.childId===childId&&e.daycareId===daycareId&&e.status==="active"&&e.startDate<=date))return [];
  return state.caregiver.journals.filter(j=>j.status==="published"&&j.daycareId===daycareId&&j.childIds.includes(childId)&&j.date===date);
}
export function saveReviewReply(state,reviewId,text) {
  requireDemo(state);
  if(!managedReviews(state).some(r=>r.id===reviewId))throw new Error("Ulasan tidak tersedia untuk daycare ini.");
  if(clean(text).length<10||clean(text).length>1000)throw new Error("Isi balasan 10–1000 karakter.");
  const reply={reviewId,text:clean(text),createdAt:new Date().toISOString()};
  return addNotification({...state,caregiver:{...state.caregiver,replies:[reply,...state.caregiver.replies.filter(r=>r.reviewId!==reviewId)]}},"Balasan pengelola disimpan pada demo","/ulasan");
}
export function respondIncident(state,id,text,status) {
  requireDemo(state);
  const report=state.incidents.find(r=>r.id===id&&r.daycareId===caregiverDaycareId);
  if(!report)throw new Error("Laporan tidak tersedia untuk daycare ini.");
  if(report.status==="closed")throw new Error("Laporan sudah ditutup pada demo.");
  if(!["reviewing","closed"].includes(status)||clean(text).length<20||clean(text).length>1500)throw new Error("Pilih status dan isi tindak lanjut 20–1500 karakter.");
  const response={incidentId:id,text:clean(text),status,createdAt:new Date().toISOString()};
  return addNotification({...state,incidents:state.incidents.map(r=>r.id===id?{...r,status}:r),caregiver:{...state.caregiver,responses:[response,...state.caregiver.responses]}},"Tindak lanjut pengelola tersedia pada laporan demo","/laporan");
}
export function saveBusiness(state,form) {
  requireDemo(state);
  if(clean(form.name).length<3||clean(form.name).length>100||clean(form.address).length<10||clean(form.address).length>250||clean(form.hours).length<5||clean(form.hours).length>120||clean(form.description).length<30||clean(form.description).length>1500||!/^\+?[0-9\s-]{8,18}$/.test(clean(form.phone)))throw new Error("Lengkapi nama, alamat, jam layanan, deskripsi (minimal 30 karakter), dan telepon yang valid.");
  const business={name:clean(form.name),address:clean(form.address),hours:clean(form.hours),description:clean(form.description),phone:clean(form.phone),facilities:[...new Set((form.facilities||[]).filter(f=>Object.hasOwn(facilities,f)))]};
  return {...state,caregiver:{...state.caregiver,business}};
}
export function saveLegalDocument(state,form,file,today=todayISO()) {
  requireDemo(state);
  if(!file||!["application/pdf","image/jpeg","image/png"].includes(file.type)||file.size>5*1024*1024||file.size<=0)throw new Error("Pilih satu PDF, JPG, atau PNG berukuran maksimal 5 MB.");
  if(clean(form.number).length<4||clean(form.number).length>100||clean(form.issuer).length<3||clean(form.issuer).length>150||!validISODate(form.expires)||form.expires<today)throw new Error("Isi nomor izin, penerbit, dan tanggal berlaku yang belum kedaluwarsa.");
  if(form.consent!==true)throw new Error("Konfirmasikan penggunaan dokumen contoh.");
  const document={id:crypto.randomUUID(),number:clean(form.number),issuer:clean(form.issuer),expires:form.expires,filename:file.name.slice(0,200),status:"local",createdAt:new Date().toISOString()};
  return {...state,caregiver:{...state.caregiver,documents:[document,...state.caregiver.documents].slice(0,20)}};
}
