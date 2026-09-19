import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  CalendarDots, Check, ClipboardText, Flask, MagnifyingGlass, PencilSimple,
  Plus, Trash, UserPlus, UsersThree, X
} from "@phosphor-icons/react";
import type { Lesson } from "@/lib/lesson.functions";
import {
  listStudentTracking, mutateReceipt, mutateStudent,
  type StudentReceipt, type StudentRecord
} from "@/lib/student.functions";

type Grade=10|11|12;
type Course="chemistry"|"physics";
type StudentDraft={name:string;grade:Grade;groupName:string;note:string};
const emptyStudent:StudentDraft={name:"",grade:10,groupName:"",note:""};
const today=()=>new Date().toISOString().slice(0,10);
const courseName:Record<Course,string>={chemistry:"الكيمياء",physics:"الفيزياء"};

export function StudentTracker({lessons,online,refreshKey,chemistryColor,physicsColor,onUnauthorized}:{
  lessons:Lesson[];online:boolean;refreshKey:number;chemistryColor:string;physicsColor:string;onUnauthorized:()=>void;
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
  async function saveReceipt(input:{studentIds:string[];lessonId:string;worksheet:boolean;memo:boolean;receivedAt:string;note:string;mode:"replace"|"merge"}){
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
  const theme={"--chemistry":chemistryColor,"--physics":physicsColor} as CSSProperties;

  return <section className="student-workspace" style={theme}>
    <div className="student-heading">
      <div><span className="eyebrow">دفتر تسليمك الذكي</span><h3>متابعة الطلاب</h3><p>سجّل استلام أوراق الدرس أو المذكرة وارْجع إلى السجل في أي وقت.</p></div>
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
  const chem=progress("chemistry"),phys=progress("physics");
  return <article className="student-card">
    <div className="student-card-head">
      <span className="student-avatar">{student.name.trim().charAt(0)||"ط"}</span>
      <div><h4>{student.name}</h4><p>الصف {student.grade}{student.groupName?` · ${student.groupName}`:""}</p></div>
      <button className="icon-action" aria-label="تعديل الطالب" onClick={onEdit}><PencilSimple/></button>
    </div>
    {student.note&&<p className="student-note">{student.note}</p>}
    <div className="student-progress-grid">
      <CourseProgress course="chemistry" value={chem}/>
      <CourseProgress course="physics" value={phys}/>
    </div>
    <div className="student-card-actions">
      <button className="receipt-action" onClick={onReceipt}><Plus weight="bold"/> تسجيل استلام</button>
      <button onClick={()=>setOpen(v=>!v)}>{open?"إخفاء السجل":`السجل (${receipts.length})`}</button>
    </div>
    {open&&<div className="receipt-history">
      {receipts.length?receipts.map(r=><div className="receipt-record" key={r.id}>
        <span className={`course-dot ${r.subject}`}/>
        <div><b>{r.lessonTitle}</b><small>{courseName[r.subject]} · {r.receivedAt}</small><p>{[r.worksheet&&"أوراق الدرس",r.memo&&"المذكرة"].filter(Boolean).join(" + ")}{r.note?` — ${r.note}`:""}</p></div>
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

function ReceiptModal({student,lessons,existing,busy,onClose,onSave}:{student:StudentRecord;lessons:Lesson[];existing:StudentReceipt[];busy:boolean;onClose:()=>void;onSave:(v:{studentIds:string[];lessonId:string;worksheet:boolean;memo:boolean;receivedAt:string;note:string;mode:"replace"|"merge"})=>Promise<boolean>}){
  const available=lessons.filter(l=>l.grade===student.grade&&(l.subject==="chemistry"||l.subject==="physics"));
  const [course,setCourse]=useState<Course>("chemistry");
  const courseLessons=available.filter(l=>l.subject===course);
  const [lessonId,setLessonId]=useState(courseLessons[0]?.id??"");
  const current=existing.find(r=>r.studentId===student.id&&r.lessonId===lessonId);
  const [worksheet,setWorksheet]=useState(true),[memo,setMemo]=useState(false),[date,setDate]=useState(today()),[note,setNote]=useState("");
  useEffect(()=>{setLessonId(courseLessons[0]?.id??"")},[course]);
  useEffect(()=>{setWorksheet(current?.worksheet??true);setMemo(current?.memo??false);setDate(current?.receivedAt??today());setNote(current?.note??"")},[lessonId]);
  return <Modal title={`تسجيل استلام — ${student.name}`} onClose={onClose}>
    <form className="student-form" onSubmit={e=>{e.preventDefault();if(lessonId&&(worksheet||memo))void onSave({studentIds:[student.id],lessonId,worksheet,memo,receivedAt:date,note,mode:"replace"})}}>
      <CourseChoices value={course} onChange={setCourse}/>
      <label>الدرس<select required value={lessonId} onChange={e=>setLessonId(e.target.value)}><option value="">اختر الدرس</option>{courseLessons.map(l=><option key={l.id} value={l.id}>{l.title}</option>)}</select></label>
      <MaterialChoices worksheet={worksheet} memo={memo} setWorksheet={setWorksheet} setMemo={setMemo}/>
      <div className="form-row"><label>تاريخ الاستلام<input type="date" required value={date} onChange={e=>setDate(e.target.value)}/></label><label>ملاحظة (اختياري)<input maxLength={300} value={note} onChange={e=>setNote(e.target.value)}/></label></div>
      {current&&<p className="editing-note">يوجد سجل لهذا الدرس؛ الحفظ سيحدّثه.</p>}
      <ModalActions busy={busy||!lessonId||(!worksheet&&!memo)} onClose={onClose} label="حفظ الاستلام"/>
    </form>
  </Modal>
}

function BatchPanel({students,lessons,busy,onSave}:{students:StudentRecord[];lessons:Lesson[];busy:boolean;onSave:(v:{studentIds:string[];lessonId:string;worksheet:boolean;memo:boolean;receivedAt:string;note:string;mode:"replace"|"merge"})=>Promise<boolean>}){
  const [grade,setGrade]=useState<Grade>(10),[course,setCourse]=useState<Course>("chemistry"),[lessonId,setLessonId]=useState("");
  const [worksheet,setWorksheet]=useState(true),[memo,setMemo]=useState(false),[date,setDate]=useState(today()),[note,setNote]=useState("");
  const [chosen,setChosen]=useState<string[]>([]);
  const eligible=students.filter(s=>s.grade===grade);
  const courseLessons=lessons.filter(l=>l.grade===grade&&l.subject===course);
  useEffect(()=>{setLessonId(courseLessons[0]?.id??"");setChosen([])},[grade,course]);
  const toggle=(id:string)=>setChosen(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
  async function submit(e:FormEvent){e.preventDefault();if(!chosen.length||!lessonId||(!worksheet&&!memo))return;const ok=await onSave({studentIds:chosen,lessonId,worksheet,memo,receivedAt:date,note,mode:"merge"});if(ok)setChosen([])}
  return <form className="batch-panel" onSubmit={submit}>
    <div className="batch-heading"><div><span className="eyebrow">إجراء سريع</span><h4>تسجيل استلام لعدة طلاب</h4><p>اختر الصف والدرس ثم حدد الطلاب الذين استلموا.</p></div><span className="batch-count">{chosen.length} محدد</span></div>
    <div className="batch-settings">
      <label>الصف<select value={grade} onChange={e=>setGrade(Number(e.target.value) as Grade)}><option value={10}>الصف 10</option><option value={11}>الصف 11</option><option value={12}>الصف 12</option></select></label>
      <div className="batch-course"><span>المادة</span><CourseChoices value={course} onChange={setCourse}/></div>
      <label className="wide-field">الدرس<select value={lessonId} onChange={e=>setLessonId(e.target.value)}><option value="">اختر الدرس</option>{courseLessons.map(l=><option value={l.id} key={l.id}>{l.title}</option>)}</select></label>
      <div className="wide-field"><MaterialChoices worksheet={worksheet} memo={memo} setWorksheet={setWorksheet} setMemo={setMemo}/></div>
      <label>التاريخ<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
      <label>ملاحظة (اختياري)<input maxLength={300} value={note} onChange={e=>setNote(e.target.value)}/></label>
    </div>
    <div className="batch-students">
      <div><h5>طلاب الصف {grade}</h5>{eligible.length>0&&<button type="button" onClick={()=>setChosen(chosen.length===eligible.length?[]:eligible.map(s=>s.id))}>{chosen.length===eligible.length?"إلغاء تحديد الكل":"تحديد الكل"}</button>}</div>
      {eligible.length?<div className="student-check-list">{eligible.map(s=><label key={s.id}><input type="checkbox" checked={chosen.includes(s.id)} onChange={()=>toggle(s.id)}/><span className="student-checkmark"><Check weight="bold"/></span><span><b>{s.name}</b><small>{s.groupName||"بدون مجموعة"}</small></span></label>)}</div>:<p className="history-empty">لا يوجد طلاب في هذا الصف بعد.</p>}
    </div>
    <button className="batch-submit" disabled={busy||!chosen.length||!lessonId||(!worksheet&&!memo)}><Check weight="bold"/> حفظ الاستلام لـ {chosen.length} طالب</button>
  </form>
}

function CourseChoices({value,onChange}:{value:Course;onChange:(v:Course)=>void}){return <div className="course-choice"><button type="button" className={value==="chemistry"?"active chemistry":""} onClick={()=>onChange("chemistry")}><Flask/> الكيمياء</button><button type="button" className={value==="physics"?"active physics":""} onClick={()=>onChange("physics")}><span className="physics-mark">φ</span> الفيزياء</button></div>}
function MaterialChoices({worksheet,memo,setWorksheet,setMemo}:{worksheet:boolean;memo:boolean;setWorksheet:(v:boolean)=>void;setMemo:(v:boolean)=>void}){return <fieldset className="material-choices"><legend>ما الذي استلمه؟</legend><label className={worksheet?"active":""}><input type="checkbox" checked={worksheet} onChange={e=>setWorksheet(e.target.checked)}/><Check/> أوراق الدرس</label><label className={memo?"active":""}><input type="checkbox" checked={memo} onChange={e=>setMemo(e.target.checked)}/><Check/> المذكرة</label></fieldset>}
function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){return <div className="student-modal-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className="student-modal" role="dialog" aria-modal="true" aria-label={title}><header><h3>{title}</h3><button aria-label="إغلاق" onClick={onClose}><X/></button></header>{children}</section></div>}
function ModalActions({busy,onClose,label}:{busy:boolean;onClose:()=>void;label:string}){return <div className="modal-actions"><button type="button" onClick={onClose}>إلغاء</button><button className="save-action" disabled={busy}>{busy?"جار الحفظ…":label}</button></div>}
function EmptyStudents({onAdd}:{onAdd:()=>void}){return <div className="student-empty-state"><UsersThree weight="duotone"/><h4>ابدأ بإضافة أول طالب</h4><p>بعد ذلك ستتمكن من تسجيل أوراق الدروس والمذكرات له.</p><button onClick={onAdd}><Plus/> إضافة طالب</button></div>}
