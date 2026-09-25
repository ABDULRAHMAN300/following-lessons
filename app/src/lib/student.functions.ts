import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { database, getSessionUser } from "./auth.server";

const gradeSchema=z.union([z.literal(10),z.literal(11),z.literal(12)]);
const isoDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
  const [year,month,day]=value.split("-").map(Number);
  const parsed=new Date(Date.UTC(year,month-1,day));
  return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day;
},{message:"تاريخ الاستلام غير صحيح"});
const studentMutation=z.discriminatedUnion("action",[
  z.object({action:z.literal("create"),name:z.string().trim().min(1).max(120),grade:gradeSchema,groupName:z.string().trim().max(60).default(""),note:z.string().trim().max(400).default("")}),
  z.object({action:z.literal("update"),id:z.string().uuid(),name:z.string().trim().min(1).max(120),grade:gradeSchema,groupName:z.string().trim().max(60).default(""),note:z.string().trim().max(400).default("")}),
  z.object({action:z.literal("delete"),id:z.string().uuid()})
]);
const receiptSave=z.object({
  action:z.literal("save"),studentIds:z.array(z.string().uuid()).min(1).max(250),lessonId:z.string().uuid(),
  receivedAt:isoDate,note:z.string().trim().max(300).default(""),mode:z.enum(["replace","merge"])
});
const receiptMutation=z.union([receiptSave,z.object({action:z.literal("delete"),id:z.string().uuid()})]);

export type StudentRecord={id:string;name:string;grade:10|11|12;groupName:string;note:string;createdAt:string;updatedAt:string};
export type StudentReceipt={id:string;studentId:string;lessonId:string;lessonTitle:string;subject:"chemistry"|"physics"|"integrated";grade:10|11|12;memo:boolean;receivedAt:string;note:string;createdAt:string;updatedAt:string};
type StudentRow={id:string;name:string;grade:10|11|12;group_name:string;note:string;created_at:string;updated_at:string};
type ReceiptRow={id:string;student_id:string;lesson_id:string;lesson_title:string;subject:"chemistry"|"physics"|"integrated";grade:10|11|12;memo_received:number;received_at:string;note:string;created_at:string;updated_at:string};
type LessonTarget={id:string;subject:"chemistry"|"physics"|"integrated";grade:10|11|12;position:number};
const studentOut=(r:StudentRow):StudentRecord=>({id:r.id,name:r.name,grade:r.grade,groupName:r.group_name,note:r.note,createdAt:r.created_at,updatedAt:r.updated_at});
const receiptOut=(r:ReceiptRow):StudentReceipt=>({id:r.id,studentId:r.student_id,lessonId:r.lesson_id,lessonTitle:r.lesson_title,subject:r.subject,grade:r.grade,memo:Boolean(r.memo_received),receivedAt:r.received_at,note:r.note,createdAt:r.created_at,updatedAt:r.updated_at});

export const listStudentTracking=createServerFn({method:"GET"}).handler(async()=>{
  const user=await getSessionUser(getRequest());
  if(!user)return {ok:false as const,code:"unauthorized" as const,students:[] as StudentRecord[],receipts:[] as StudentReceipt[]};
  const [students,receipts]=await Promise.all([
    database().prepare("SELECT id,name,grade,group_name,note,created_at,updated_at FROM students WHERE owner_id=? ORDER BY grade,name").bind(user.id).all<StudentRow>(),
    database().prepare("SELECT r.id,r.student_id,r.lesson_id,l.title AS lesson_title,l.subject,l.grade,r.memo_received,r.received_at,r.note,r.created_at,r.updated_at FROM student_receipts r JOIN lessons l ON l.id=r.lesson_id WHERE r.owner_id=? ORDER BY r.received_at DESC,r.created_at DESC").bind(user.id).all<ReceiptRow>()
  ]);
  return {ok:true as const,students:(students.results??[]).map(studentOut),receipts:(receipts.results??[]).map(receiptOut)};
});

export const mutateStudent=createServerFn({method:"POST"}).validator(studentMutation).handler(async({data})=>{
  const user=await getSessionUser(getRequest());
  if(!user)return {ok:false as const,code:"unauthorized" as const,error:"يلزم تسجيل الدخول"};
  if(data.action==="delete"){
    await database().prepare("DELETE FROM students WHERE id=? AND owner_id=?").bind(data.id,user.id).run();
    return {ok:true as const};
  }
  const now=new Date().toISOString();
  if(data.action==="create"){
    const id=crypto.randomUUID();
    await database().prepare("INSERT INTO students(id,owner_id,name,grade,group_name,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)").bind(id,user.id,data.name,data.grade,data.groupName,data.note,now,now).run();
    return {ok:true as const,student:{id,name:data.name,grade:data.grade,groupName:data.groupName,note:data.note,createdAt:now,updatedAt:now} satisfies StudentRecord};
  }
  const found=await database().prepare("SELECT id FROM students WHERE id=? AND owner_id=?").bind(data.id,user.id).first();
  if(!found)return {ok:false as const,error:"الطالب غير موجود"};
  await database().prepare("UPDATE students SET name=?,grade=?,group_name=?,note=?,updated_at=? WHERE id=? AND owner_id=?").bind(data.name,data.grade,data.groupName,data.note,now,data.id,user.id).run();
  const old=await database().prepare("SELECT created_at FROM students WHERE id=? AND owner_id=?").bind(data.id,user.id).first<{created_at:string}>();
  return {ok:true as const,student:{id:data.id,name:data.name,grade:data.grade,groupName:data.groupName,note:data.note,createdAt:old?.created_at??now,updatedAt:now} satisfies StudentRecord};
});

export const mutateReceipt=createServerFn({method:"POST"}).validator(receiptMutation).handler(async({data})=>{
  const user=await getSessionUser(getRequest());
  if(!user)return {ok:false as const,code:"unauthorized" as const,error:"يلزم تسجيل الدخول"};
  if(data.action==="delete"){
    await database().prepare("DELETE FROM student_receipts WHERE id=? AND owner_id=?").bind(data.id,user.id).run();
    return {ok:true as const};
  }
  const lesson=await database().prepare("SELECT id,subject,grade,position FROM lessons WHERE id=? AND owner_id=? AND subject IN ('chemistry','physics','integrated')").bind(data.lessonId,user.id).first<LessonTarget>();
  if(!lesson)return {ok:false as const,error:"الدرس غير موجود"};
  const earlier=await database().prepare("SELECT id FROM lessons WHERE owner_id=? AND subject=? AND grade=? AND position<=? ORDER BY position,created_at").bind(user.id,lesson.subject,lesson.grade,lesson.position).all<{id:string}>();
  const lessonIds=(earlier.results??[]).map(row=>row.id);
  if(!lessonIds.includes(data.lessonId))return {ok:false as const,error:"تعذر تحديد تسلسل الدروس"};

  const uniqueStudentIds=[...new Set(data.studentIds)];
  const marks=uniqueStudentIds.map(()=>"?").join(",");
  const valid=await database().prepare(`SELECT id FROM students WHERE owner_id=? AND grade=? AND id IN (${marks})`).bind(user.id,lesson.grade,...uniqueStudentIds).all<{id:string}>();
  const ids=(valid.results??[]).map(row=>row.id);
  if(ids.length!==uniqueStudentIds.length)return {ok:false as const,error:"بعض الطلاب لا ينتمون إلى صف الدرس"};

  const now=new Date().toISOString();
  const statements=ids.flatMap(studentId=>lessonIds.map(lessonId=>{
    const isSelected=lessonId===data.lessonId;
    const note=isSelected?data.note:"";
    const replaceSelected=data.mode==="replace"&&isSelected;
    const sql=replaceSelected
      ?"INSERT INTO student_receipts(id,owner_id,student_id,lesson_id,worksheet_received,memo_received,received_at,note,created_at,updated_at) VALUES(?,?,?,?,0,1,?,?,?,?) ON CONFLICT(student_id,lesson_id) DO UPDATE SET worksheet_received=0,memo_received=1,received_at=excluded.received_at,note=excluded.note,updated_at=excluded.updated_at"
      :"INSERT INTO student_receipts(id,owner_id,student_id,lesson_id,worksheet_received,memo_received,received_at,note,created_at,updated_at) VALUES(?,?,?,?,0,1,?,?,?,?) ON CONFLICT(student_id,lesson_id) DO UPDATE SET worksheet_received=0,memo_received=1,received_at=excluded.received_at,note=CASE WHEN excluded.note='' THEN student_receipts.note ELSE excluded.note END,updated_at=excluded.updated_at";
    return database().prepare(sql).bind(crypto.randomUUID(),user.id,studentId,lessonId,data.receivedAt,note,now,now);
  }));
  await database().batch(statements);
  return {ok:true as const,count:statements.length,lessonCount:lessonIds.length};
});
