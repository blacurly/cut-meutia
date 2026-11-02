import test from "node:test";
import assert from "node:assert/strict";
import { daycares } from "../data/daycares.js";
import { activeEnrollments, availableSlots, createEnrollment, decodeDemo, defaultFilters, emptyDemo, filterDaycares, filterQuery, getDaycare, parseFilters, toggleCompare, transitionEnrollment, validISODate, validateAttachments, validateChild, validateEnrollment } from "./parent.js";

const today="2026-10-31";
const initial=()=>({...structuredClone(emptyDemo),member:true});
const form={daycareId:"kasih-bunda",childId:"",childName:"Arka Pratama",dob:"2024-05-10",packageId:"full",startDate:today,consent:true};

test("hierarchical location query rejects invalid and inherited keys",()=>{
  assert.equal(parseFilters({province:"Jawa Timur",city:"Gresik",district:"Kebomas"}).district,"Kebomas");
  assert.equal(parseFilters({province:"Jawa Timur",city:"Bandung",district:"Coblong"}).city,"");
  assert.equal(parseFilters({province:"__proto__",city:"constructor"}).province,"");
  assert.equal(parseFilters({q:["a","b"],score:"NaN",price:"-1"}).price,500000);
});
test("combined filters and sorting match the actual fixture data",()=>{
  const filters=parseFilters({province:"Jawa Timur",city:"Gresik",district:"Kebomas",facilities:"cctv,doctor",ratio:"3",sort:"price"});
  assert.deepEqual(filterDaycares(filters).map(d=>d.id),["pelangi-kecil"]);
  assert.deepEqual(parseFilters(new URLSearchParams(filterQuery(filters))),filters);
  const prices=filterDaycares({...defaultFilters,sort:"price"}).map(d=>d.price);
  assert.deepEqual(prices,[...prices].sort((a,b)=>a-b));
  assert.equal(filterDaycares({...defaultFilters,q:"not a real daycare"}).length,0);
});
test("comparison cannot exceed three entries and supports removal",()=>{
  let state=initial();for(const d of daycares.slice(0,3))state=toggleCompare(state,d.id);
  assert.throws(()=>toggleCompare(state,daycares[3].id),/Maksimal 3/);
  state=toggleCompare(state,daycares[0].id);assert.equal(state.compare.length,2);
  assert.throws(()=>toggleCompare(state,"missing"),/tidak tersedia/);
});
test("calendar dates, child ages and enrollment prerequisites are validated",()=>{
  assert.equal(validISODate("2026-02-30"),false);assert.equal(validISODate("2024-02-29"),true);
  assert.ok(validateChild({name:"Arka",dob:"2026-09-01"},today).dob);
  assert.ok(validateEnrollment({...form,startDate:"2026-02-30"},initial(),today).startDate);
  assert.ok(validateEnrollment({...form,consent:false},initial(),today).consent);
  assert.ok(validateEnrollment({...form,daycareId:"rumah-ceria"},initial(),today).daycareId);
  assert.ok(validateEnrollment({...form,daycareId:"mentari-pagi"},initial(),today).daycareId);
  assert.ok(validateEnrollment({...form,childId:"missing"},initial(),today).childId);
});
test("enrollment transitions unlock active childcare only after approval",()=>{
  let state=createEnrollment(initial(),form,today);const id=state.enrollments[0].id;
  assert.equal(activeEnrollments(state).length,0);assert.equal(state.notifications.length,1);
  assert.throws(()=>transitionEnrollment(state,id,"active"),/tidak tersedia/);
  state=transitionEnrollment(state,id,"approved");assert.equal(availableSlots(getDaycare(form.daycareId),state),3);
  state=transitionEnrollment(state,id,"active");assert.equal(activeEnrollments(state).length,1);
  assert.equal(availableSlots(getDaycare(form.daycareId),state),3);
  assert.throws(()=>transitionEnrollment(state,id,"cancelled"),/tidak tersedia/);
});
test("duplicates and double-active childcare are blocked",()=>{
  let state=createEnrollment(initial(),form,today);const id=state.enrollments[0].id;
  assert.throws(()=>createEnrollment(state,form,today),/sudah tersedia/);
  state=transitionEnrollment(transitionEnrollment(state,id,"approved"),id,"active");
  state=createEnrollment(state,{...form,childId:state.children[0].id,daycareId:"tunas-bangsa"},today);
  const second=state.enrollments[0].id;state=transitionEnrollment(state,second,"approved");
  assert.throws(()=>transitionEnrollment(state,second,"active"),/sudah terhubung/);
});
test("approval cannot overbook demo capacity and cancellation releases a reservation",()=>{
  let state=initial();for(let i=0;i<5;i++)state=createEnrollment(state,{...form,childName:`Anak Contoh ${i}`},today);
  const ids=state.enrollments.map(e=>e.id);for(const id of ids.slice(0,4))state=transitionEnrollment(state,id,"approved");
  assert.equal(availableSlots(getDaycare(form.daycareId),state),0);
  assert.throws(()=>transitionEnrollment(state,ids[4],"approved"),/penuh/);
  state=transitionEnrollment(state,ids[0],"cancelled");assert.equal(availableSlots(getDaycare(form.daycareId),state),1);
});
test("corrupt local data recovers to a safe empty demo",()=>{
  assert.deepEqual(decodeDemo("broken"),emptyDemo);
  assert.deepEqual(decodeDemo(JSON.stringify({...initial(),profile:"bad"})),emptyDemo);
  assert.deepEqual(decodeDemo(JSON.stringify({...initial(),enrollments:[{id:"unknown"}]})),emptyDemo);
  const state=createEnrollment(initial(),form,today);assert.deepEqual(decodeDemo(JSON.stringify(state)),state);
});
test("upload selection rejects unsupported types, oversize and too many files",()=>{
  assert.equal(validateAttachments([{type:"application/pdf",size:1024}]),"");
  assert.ok(validateAttachments([{type:"text/html",size:100}]));
  assert.ok(validateAttachments([{type:"image/png",size:6*1024*1024}]));
  assert.ok(validateAttachments(Array(5).fill({type:"image/png",size:100})));
  assert.equal(validateAttachments([{type:"video/mp4",size:1024}],"evidence"),"");
});
test("local store falls back to memory when browser quota prevents a write",async()=>{
  const previousWindow=Object.getOwnPropertyDescriptor(globalThis,"window");const previousStorage=Object.getOwnPropertyDescriptor(globalThis,"localStorage");
  const values=new Map();let fail=true;let signals=0;
  Object.defineProperty(globalThis,"window",{configurable:true,value:new EventTarget()});
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:key=>values.get(key)||null,setItem:(key,value)=>{if(fail)throw new Error("QuotaExceededError");values.set(key,value);}}});
  try {const store=await import("../services/parent-demo-store.js");const unsubscribe=store.subscribe(()=>signals++);store.updateDemo(s=>({...s,member:true}));assert.equal(JSON.parse(store.getSnapshot()).member,true);assert.equal(store.hasPersistence(),false);assert.equal(signals,1);fail=false;store.updateDemo(()=>structuredClone(emptyDemo));assert.equal(store.hasPersistence(),true);assert.equal(JSON.parse(store.getSnapshot()).member,false);unsubscribe();}
  finally {if(previousWindow)Object.defineProperty(globalThis,"window",previousWindow);else delete globalThis.window;if(previousStorage)Object.defineProperty(globalThis,"localStorage",previousStorage);else delete globalThis.localStorage;}
});
