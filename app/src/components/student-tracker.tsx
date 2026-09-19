import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  CalendarDots, Check, ClipboardText, Flask, Leaf, MagnifyingGlass, PencilSimple,
  Plus, Trash, UserPlus, UsersThree, X
} from "@phosphor-icons/react";
import type { Lesson } from "@/lib/lesson.functions";
import {
  listStudentTracking, mutateReceipt, mutateStudent,
  type StudentReceipt, type StudentRecord
} from "@/lib/student.functions";

type Grade=10|11|12;
type Course="chemistry"|"physics"|"integrated";
type StudentDraft={name:string;grade:Grade;groupName:string;note:string};
type ReceiptDraft={studentIds:string[];lessonId:string;receivedAt:string;note:string;mode:"replace"|"merge"};
const emptyStudent:StudentDraft={name:"",grade:10,groupName:"",note:""};
const pad=(value:number)=>String(value).padStart(2,"0");
const today=()=>{
  const value=new Date();
  return `${value.getFullYear()}-${pad(value.getMonth()+1)}-${pad(value.getDate())}`;
};
const formatDate=(iso:string)=>{
  const [year,month,day]=iso.split("-").map(Number);
  return year&&month&&day?`${day}/${month}/${year}`:iso;
};
const parseDate=(value:string)=>{
  const match=/^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(value);
  if(!match)return null;
  const day=Number(match[1]),month=Number(match[2]),year=Number(match[3]);
  const parsed=new Date(Date.UTC(year,month-1,day));
  if(parsed.getUTCFullYear()!==year||parsed.getUTCMonth()!==month-1||parsed.getUTCDate()!==day)return null;
  return `${year}-${pad(month)}-${pad(day)}`;
};
const courseName:Record<Course,string>={chemistry:"الكيمياء",physics:"الفيزياء",integrated:"العلوم المتكاملة"};
const lessonName=(lesson:Lesson)=>lesson.subject==="integrated"?(lesson.part==="physics"?"فيزياء · ":"كيمياء · ")+lesson.title:lesson.title;

export function StudentTracker({lessons,online,refreshKey,chemistryColor,physicsColor,integratedColor,onUnauthorized}:{
  lessons:Lesson[];online:boolean;refreshKey:number;chemistryColor:string;physicsColor:string;integratedColor:string;onUnauthorized:()=>void;
}){
  const [students,setStudents]=useState<StudentRecord[]>([]);
  const [receipts,setReceipts]=useState<StudentReceipt[]>([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [view,setView]=useState<"students"|"batch">("students");
  const [query,setQuery]=useState("");
  const [grade,setGrade]=useState<"all"|Grade>("all");
  const [studentModal,setStudentModal]=useState<{student?:StudentRecord}|null>(null);
  const [receiptModal,setReceiptModal]=useState<StudentRecord|null>(null);

  async function load(quiet=false){
    if(!quiet)setLoading(true);
    try{
      const data=await listStudentTracking();
      if(!data.ok){onUnauthorized();return}
      setStudents(data.students);setReceipts(data.receipts);setError("");
    }catch{setError("تعذر تحميل متابعة الطلاب. حاول مرة أخرى.")}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[refreshKey]);
  useEffect(()=>{
    const refresh=()=>{if(document.visibilityState==="visible"&&navigator.onLine)void load(true)};
    window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",refresh);
    return()=>{window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",refresh)}
  },[]);

  async function saveStudent(draft:StudentDraft,id?:string){
    if(!online){setError("يلزم الاتصال بالإنترنت للحفظ.");return false}
    setBusy(true);setError("");
    try{
      const data=await mutateStudent({data:id?{action:"update",id,...draft}:{action:"create",...draft}});
      if(!data.ok){if("code" in data)onUnauthorized();setError(data.error);return false}
      if("student" in data&&data.student){
        setStudents(current=>id?current.map(s=>s.id===id?data.student:s):[...current,data.student].sort((a,b)=>a.grade-b.grade||a.name.localeCompare(b.name,"ar")));
      }
      setStudentModal(null);return true;
    }catch{setError("تعذر حفظ الطالب.");return false}
    finally{setBusy(false)}
  }
  async function deleteStudent(student:StudentRecord){
    if(!confirm(`حذف «${student.name}» وسجل استلامه بالكامل؟`))return;
    if(!online){setError("يلزم الاتصال بالإنترنت للحذف.");return}
    setBusy(true);
    try{
      const data=await mutateStudent({data:{action:"delete",id:student.id}});
      if(!data.ok){if("code" in data)onUnauthorized();setError(data.error);return}
      setStudents(current=>current.filter(s=>s.id!==student.id));
      setReceipts(current=>current.filter(r=>r.studentId!==student.id));
    }catch{setError("تعذر حذف الطالب.")}
    finally{setBusy(false)}
  }
  async function saveReceipt(input:ReceiptDraft){
    if(!online){setError("يلزم الاتصال بالإنترنت للحفظ.");return false}
    setBusy(true);setError("");
    try{
      const data=await mutateReceipt({data:{action:"save",...input}});
      if(!data.ok){if("code" in data)onUnauthorized();setError(data.error);return false}
      await load(true);setReceiptModal(null);return true;
    }catch{setError("تعذر حفظ الاستلام.");return false}
    finally{setBusy(false)}
  }
  async function deleteReceipt(receipt:StudentReceipt){
    if(!confirm("حذف سجل الاستلام هذا؟"))return;
    setBusy(true);
    try{
      const data=await mutateReceipt({data:{action:"delete",id:receipt.id}});
      if(!data.ok){if("code" in data)onUnauthorized();setError(data.error);return}
      setReceipts(current=>current.filter(r=>r.id!==receipt.id));
    }catch{setError("تعذر حذف سجل الاستلام.")}
    finally{setBusy(false)}
  }

  const visible=useMemo(()=>students.filter(s=>(grade==="all"||s.grade===grade)&&(`${s.name} ${s.groupName}`).toLocaleLowerCase("ar").includes(query.trim().toLocaleLowerCase("ar"))),[students,grade,query]);
  const todayCount=receipts.filter(r=>r.receivedAt===today()).length;
  const tracked=new Set(receipts.map(r=>r.studentId)).size;
  const theme={"--chemistry":chemistryColor,"--physics":physicsColor,"--integrated":integratedColor} as CSSProperties;

  return <section className="student-workspace" style={theme}>
    <div className="student-heading">
      <div><span className="eyebrow">دفتر تسليمك الذكي</span><h3>متابعة الطلاب</h3><p>سجّل استلام المذكرة وتابع تقدّم كل طالب في أي وقت.</p></div>
      <button className="student-primary-action" onClick={()=>setStudentModal({})}><UserPlus weight="bold"/> إضافة طالب</button>
    </div>
    <div className="student-stats">
      <article><UsersThree weight="duotone"/><span><b>{students.length}</b><small>إجمالي الطلاب</small></span></article>
      <article><CalendarDots weight="duotone"/><span><b>{todayCount}</b><small>استلام اليوم</small></span></article>
      <article><Check weight="bold"/><span><b>{tracked}</b><small>لديهم سجل</small></span></article>
    </div>
    <div className="student-view-tabs" role="tablist">
      <button role="tab" aria-selected={view==="students"} className={view==="students"?"active":""} onClick={()=>setView("students")}><UsersThree/> سجل الطلاب</button>
      <button role="tab" aria-selected={view==="batch"} className={view==="batch"?"active":""} onClick={()=>setView("batch")}><ClipboardText/> تسجيل جماعي</button>
    </div>
    {error&&<p className="student-notice" role="alert">{error}</p>}
    {loading?<div className="student-loading">جار تحميل سجل الطلاب…</div>:view==="students"?<>
      <div className="student-filters">
        <label className="student-search"><MagnifyingGlass/><span className="sr-only">بحث</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث باسم الطالب أو المجموعة"/></label>
        <div className="grade-tabs" aria-label="تصفية الصف">{(["all",10,11,12] as const).map(g=><button key={g} className={grade===g?"active":""} onClick={()=>setGrade(g)}>{g==="all"?"الكل":`الصف ${g}`}</button>)}</div>
      </div>
      {visible.length?<div className="student-grid">{visible.map(student=><StudentCard key={student.id} student={student} receipts={receipts.filter(r=>r.studentId===student.id)} lessons={lessons} onEdit={()=>setStudentModal({student})} onReceipt={()=>setReceiptModal(student)} onDelete={()=>void deleteStudent(student)} onDeleteReceipt={r=>void deleteReceipt(r)} busy={busy}/>)}</div>:<EmptyStudents onAdd={()=>setStudentModal({})}/>}
    </>:<BatchPanel students={students} lessons={lessons} busy={busy} onSave={saveReceipt}/>}
    {studentModal&&<StudentModal student={studentModal.student} busy={busy} onClose={()=>setStudentModal(null)} onSave={saveStudent}/>}
    {receiptModal&&<ReceiptModal student={receiptModal} lessons={lessons} existing={receipts} busy={busy} onClose={()=>setReceiptModal(null)} onSave={saveReceipt}/>}
  </section>
}

function StudentCard({student,receipts,lessons,onEdit,onReceipt,onDelete,onDeleteReceipt,busy}:{
  student:StudentRecord;receipts:StudentReceipt[];lessons:Lesson[];onEdit:()=>void;onReceipt:()=>void;onDelete:()=>void;onDeleteReceipt:(r:StudentReceipt)=>void;busy:boolean
}){
  const [open,setOpen]=useState(false);
  const progress=(course:Course)=>{
    const total=lessons.filter(l=>l.grade===student.grade&&l.subject===course).length;
    const done=new Set(receipts.filter(r=>r.subject===course).map(r=>r.lessonId)).size;
    return {done,total,pct:total?Math.round(done/total*100):0};
  };
  const chem=progress("chemistry"),phys=progress("physics"),integrated=progress("integrated");
  return <article className="student-card">
    <div className="student-card-head">
      <span className="student-avatar">{student.name.trim().charAt(0)||"ط"}</span>
      <div><h4>{student.name}</h4><p>الصف {student.grade}{student.groupName?` · ${student.groupName}`:""}</p></div>
      <button className="icon-action" aria-label="تعديل الطالب" onClick={onEdit}><PencilSimple/></button>
    </div>
    {student.note&&<p className="student-note">{student.note}</p>}
    <div className={"student-progress-grid" + (student.grade===10?" three-courses":"")}>
      <CourseProgress course="chemistry" value={chem}/>
      <CourseProgress course="physics" value={phys}/>
      {student.grade===10&&<CourseProgress course="integrated" value={integrated}/>}
    </div>
    <div className="student-card-actions">
      <button className="receipt-action" onClick={onReceipt}><Plus weight="bold"/> تسجيل استلام</button>
      <button onClick={()=>setOpen(v=>!v)}>{open?"إخفاء السجل":`السجل (${receipts.length})`}</button>
    </div>
    {open&&<div className="receipt-history">
      {receipts.length?receipts.map(r=><div className="receipt-record" key={r.id}>
        <span className={`course-dot ${r.subject}`}/>
        <div><b>{r.lessonTitle}</b><small>{courseName[r.subject]} · {formatDate(r.receivedAt)}</small><p>المذكرة{r.note?` — ${r.note}`:""}</p></div>
        <button disabled={busy} aria-label="حذف السجل" onClick={()=>onDeleteReceipt(r)}><Trash/></button>
      </div>):<p className="history-empty">لا يوجد استلام مسجل بعد.</p>}
    </div>}
    <button className="student-delete" disabled={busy} onClick={onDelete}><Trash/> حذف الطالب</button>
  </article>
}
function CourseProgress({course,value}:{course:Course;value:{done:number;total:number;pct:number}}){
  return <div className={`student-course-progress ${course}`}><span><b>{courseName[course]}</b><small>{value.done} / {value.total}</small></span><div><i style={{width:`${value.pct}%`}}/></div></div>
}

function StudentModal({student,busy,onClose,onSave}:{student?:StudentRecord;busy:boolean;onClose:()=>void;onSave:(d:StudentDraft,id?:string)=>Promise<boolean>}){
  const [draft,setDraft]=useState<StudentDraft>(student?{name:student.name,grade:student.grade,groupName:student.groupName,note:student.note}:emptyStudent);
  return <Modal title={student?"تعديل بيانات الطالب":"إضافة طالب"} onClose={onClose}>
    <form className="student-form" onSubmit={e=>{e.preventDefault();void onSave(draft,student?.id)}}>
      <label>اسم الطالب<input autoFocus required maxLength={120} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="اكتب الاسم الكامل"/></label>
      <div className="form-row"><label>الصف<select value={draft.grade} onChange={e=>setDraft({...draft,grade:Number(e.target.value) as Grade})}><option value={10}>الصف 10</option><option value={11}>الصف 11</option><option value={12}>الصف 12</option></select></label><label>المجموعة (اختياري)<input maxLength={60} value={draft.groupName} onChange={e=>setDraft({...draft,groupName:e.target.value})} placeholder="مثال: أ"/></label></div>
      <label>ملاحظة (اختياري)<textarea maxLength={400} value={draft.note} onChange={e=>setDraft({...draft,note:e.target.value})} placeholder="أي ملاحظة خاصة بالمتابعة"/></label>
      <ModalActions busy={busy} onClose={onClose} label={student?"حفظ التعديل":"إضافة الطالب"}/>
    </form>
  </Modal>
}

function ReceiptModal({student,lessons,existing,busy,onClose,onSave}:{student:StudentRecord;lessons:Lesson[];existing:StudentReceipt[];busy:boolean;onClose:()=>void;onSave:(v:ReceiptDraft)=>Promise<boolean>}){
  const available=lessons.filter(l=>l.grade===student.grade&&(l.subject==="chemistry"||l.subject==="physics"||l.subject==="integrated"));
  const [course,setCourse]=useState<Course>("chemistry");
  const courseLessons=available.filter(l=>l.subject===course);
  const [lessonId,setLessonId]=useState(courseLessons[0]?.id??"");
  const current=existing.find(r=>r.studentId===student.id&&r.lessonId===lessonId);
  const [dateText,setDateText]=useState(formatDate(today())),[dateError,setDateError]=useState(""),[note,setNote]=useState("");
  useEffect(()=>{setLessonId(courseLessons[0]?.id??"")},[course]);
  useEffect(()=>{setDateText(formatDate(current?.receivedAt??today()));setDateError("");setNote(current?.note??"")},[lessonId]);
  function submit(e:FormEvent){
    e.preventDefault();
    const receivedAt=parseDate(dateText);
    if(!receivedAt){setDateError("اكتب التاريخ بالصيغة: 19/9/2026");return}
    if(lessonId)void onSave({studentIds:[student.id],lessonId,receivedAt,note,mode:"replace"});
  }
  return <Modal title={`تسجيل استلام — ${student.name}`} onClose={onClose}>
    <form className="student-form" onSubmit={submit}>
      <CourseChoices value={course} onChange={setCourse} showIntegrated={student.grade===10}/>
      <label>الدرس<select required value={lessonId} onChange={e=>setLessonId(e.target.value)}><option value="">اختر الدرس</option>{courseLessons.map(l=><option key={l.id} value={l.id}>{lessonName(l)}</option>)}</select></label>
      <div className="memo-only-note"><Check weight="bold"/><span><b>المذكرة</b><small>سيُسجّل هذا الدرس وكل الدروس السابقة له تلقائيًا.</small></span></div>
      <div className="form-row"><label>تاريخ الاستلام<input dir="ltr" inputMode="numeric" required value={dateText} onChange={e=>{setDateText(e.target.value);setDateError("")}} placeholder="19/9/2026"/>{dateError&&<small className="date-error" role="alert">{dateError}</small>}</label><label>ملاحظة (اختياري)<input maxLength={300} value={note} onChange={e=>setNote(e.target.value)}/></label></div>
      {current&&<p className="editing-note">يوجد سجل لهذا الدرس؛ الحفظ سيحدّثه ويثبّت الدروس السابقة.</p>}
      <ModalActions busy={busy||!lessonId} onClose={onClose} label="حفظ الاستلام"/>
    </form>
  </Modal>
}
function BatchPanel({students,lessons,busy,onSave}:{students:StudentRecord[];lessons:Lesson[];busy:boolean;onSave:(v:ReceiptDraft)=>Promise<boolean>}){
  const [grade,setGrade]=useState<Grade>(10),[course,setCourse]=useState<Course>("chemistry"),[lessonId,setLessonId]=useState("");
  const [dateText,setDateText]=useState(formatDate(today())),[dateError,setDateError]=useState(""),[note,setNote]=useState("");
  const [chosen,setChosen]=useState<string[]>([]);
  const eligible=students.filter(s=>s.grade===grade);
  const courseLessons=lessons.filter(l=>l.grade===grade&&l.subject===course);
  useEffect(()=>{if(grade!==10&&course==="integrated")setCourse("chemistry")},[grade,course]);
  useEffect(()=>{setLessonId(courseLessons[0]?.id??"");setChosen([])},[grade,course]);
  const toggle=(id:string)=>setChosen(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  async function submit(e:FormEvent){
    e.preventDefault();
    const receivedAt=parseDate(dateText);
    if(!receivedAt){setDateError("اكتب التاريخ بالصيغة: 19/9/2026");return}
    if(!chosen.length||!lessonId)return;
    const ok=await onSave({studentIds:chosen,lessonId,receivedAt,note,mode:"merge"});
    if(ok)setChosen([]);
  }
  return <form className="batch-panel" onSubmit={submit}>
    <div className="batch-heading"><div><span className="eyebrow">إجراء سريع</span><h4>تسجيل استلام لعدة طلاب</h4><p>اختر الصف والدرس ثم حدد الطلاب الذين استلموا المذكرة.</p></div><span className="batch-count">{chosen.length} محدد</span></div>
    <div className="batch-settings">
      <label>الصف<select value={grade} onChange={e=>setGrade(Number(e.target.value) as Grade)}><option value={10}>الصف 10</option><option value={11}>الصف 11</option><option value={12}>الصف 12</option></select></label>
      <div className="batch-course"><span>المادة</span><CourseChoices value={course} onChange={setCourse} showIntegrated={grade===10}/></div>
      <label className="wide-field">الدرس<select value={lessonId} onChange={e=>setLessonId(e.target.value)}><option value="">اختر الدرس</option>{courseLessons.map(l=><option value={l.id} key={l.id}>{lessonName(l)}</option>)}</select></label>
      <div className="wide-field memo-only-note"><Check weight="bold"/><span><b>المذكرة</b><small>سيُسجّل الدرس المختار وكل الدروس السابقة له لكل طالب محدد.</small></span></div>
      <label>التاريخ<input dir="ltr" inputMode="numeric" value={dateText} onChange={e=>{setDateText(e.target.value);setDateError("")}} placeholder="19/9/2026"/>{dateError&&<small className="date-error" role="alert">{dateError}</small>}</label>
      <label>ملاحظة (اختياري)<input maxLength={300} value={note} onChange={e=>setNote(e.target.value)}/></label>
    </div>
    <div className="batch-students">
      <div><h5>طلاب الصف {grade}</h5>{eligible.length>0&&<button type="button" onClick={()=>setChosen(chosen.length===eligible.length?[]:eligible.map(s=>s.id))}>{chosen.length===eligible.length?"إلغاء تحديد الكل":"تحديد الكل"}</button>}</div>
      {eligible.length?<div className="student-check-list">{eligible.map(s=><label key={s.id}><input type="checkbox" checked={chosen.includes(s.id)} onChange={()=>toggle(s.id)}/><span className="student-checkmark"><Check weight="bold"/></span><span><b>{s.name}</b><small>{s.groupName||"بدون مجموعة"}</small></span></label>)}</div>:<p className="history-empty">لا يوجد طلاب في هذا الصف بعد.</p>}
    </div>
    <button className="batch-submit" disabled={busy||!chosen.length||!lessonId}><Check weight="bold"/> حفظ الاستلام لـ {chosen.length} طالب</button>
  </form>
}
function CourseChoices({value,onChange,showIntegrated}:{value:Course;onChange:(v:Course)=>void;showIntegrated:boolean}){return <div className={"course-choice" + (showIntegrated?" three-courses":"")}><button type="button" className={value==="chemistry"?"active chemistry":""} onClick={()=>onChange("chemistry")}><Flask/> الكيمياء</button><button type="button" className={value==="physics"?"active physics":""} onClick={()=>onChange("physics")}><span className="physics-mark">φ</span> الفيزياء</button>{showIntegrated&&<button type="button" className={value==="integrated"?"active integrated":""} onClick={()=>onChange("integrated")}><Leaf/> العلوم المتكاملة</button>}</div>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){return <div className="student-modal-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="student-modal" role="dialog" aria-modal="true" aria-label={title}><header><h3>{title}</h3><button aria-label="إغلاق" onClick={onClose}><X/></button></header>{children}</section></div>}
function ModalActions({busy,onClose,label}:{busy:boolean;onClose:()=>void;label:string}){return <div className="modal-actions"><button type="button" onClick={onClose}>إلغاء</button><button className="save-action" disabled={busy}>{busy?"جار الحفظ…":label}</button></div>}
function EmptyStudents({onAdd}:{onAdd:()=>void}){return <div className="student-empty-state"><UsersThree weight="duotone"/><h4>ابدأ بإضافة أول طالب</h4><p>بعد ذلك ستتمكن من تسجيل استلام المذكرة له.</p><button onClick={onAdd}><Plus/> إضافة طالب</button></div>}
