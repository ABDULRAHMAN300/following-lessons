import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  Atom,
  CaretDown,
  CaretUp,
  Check,
  CloudArrowDown,
  CloudCheck,
  ClipboardText,
  Flask,
  Key,
  Leaf,
  LockKey,
  MagnifyingGlass,
  PaintBrushBroad,
  PencilSimple,
  Plus,
  SignOut,
  Trash,
  UsersThree,
  WaveSine,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import { ScrollScrub } from "@/components/scroll-scrub/scroll-scrub";
import { StudentTracker } from "@/components/student-tracker";
import { scrollScrubScenes, scrollScrubTheme } from "@/scroll-scrub-scenes";
import { appearancePresets, defaultAppearance, type Appearance } from "@/lib/appearance";
import {
  authenticateOwner,
  generateRecoveryCode,
  getAppearance,
  getAuthState,
  listLessons,
  mutateLesson,
  resetPassword,
  updateAppearance,
  type Lesson,
} from "@/lib/lesson.functions";
import { describeRequestError } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Index });

type Subject = "chemistry" | "physics" | "integrated";
type SciencePart = "" | "physics" | "chemistry";
type Filter = "all" | "open" | "done";
type LessonMutation =
  | { action: "create"; subject: Subject; grade: 10 | 11 | 12; title: string; part: SciencePart }
  | { action: "update"; id: string; title?: string; completed?: boolean }
  | { action: "delete"; id: string }
  | { action: "bulk_create"; subject: Subject; grade: 10 | 11 | 12; part: SciencePart; titles: string[] }
  | { action: "reorder"; id: string; direction: "up" | "down" };

const subjects: Array<{ id: Subject; name: string; note: string; grades: Array<10 | 11 | 12> }> = [
  { id: "chemistry", name: "الكيمياء", note: "المادة والتفاعلات", grades: [10, 11, 12] },
  { id: "physics", name: "الفيزياء", note: "الحركة والطاقة", grades: [10, 11, 12] },
  { id: "integrated", name: "العلوم المتكاملة", note: "روابط العلوم", grades: [10] },
];

const scienceParts = [
  { id: "physics", title: "الجزء الأول", label: "فيزياء" },
  { id: "chemistry", title: "الجزء الثاني", label: "كيمياء" },
] as const;

function SubjectIcon({ subject }: { subject: Subject }) {
  return subject === "chemistry" ? (
    <Flask weight="duotone" />
  ) : subject === "physics" ? (
    <Atom weight="duotone" />
  ) : (
    <Leaf weight="duotone" />
  );
}

function Index() {
  return (
    <main className="site-shell">
      <header className="site-nav">
        <a className="brand-lockup" href="#learning-orbit" aria-label="Following Lessons">
          <span className="brand-orbit">
            <span />
          </span>
          <b>Following Lessons</b>
        </a>
        <a className="nav-entry" href="#workspace">
          افتح مساحة المتابعة
        </a>
      </header>
      <section className="journey" aria-label="مقدمة متحركة">
        <ScrollScrub scenes={scrollScrubScenes} theme={scrollScrubTheme} />
        <a className="hero-entry" href="#workspace">
          ابدأ المتابعة <CloudArrowDown weight="bold" />
        </a>
      </section>
      <Workspace />
    </main>
  );
}

function Workspace() {
  const [auth, setAuth] = useState<"loading" | "guest" | "ready">("loading");
  const [setupRequired, setSetupRequired] = useState(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [subject, setSubject] = useState<Subject>("chemistry");
  const [grade, setGrade] = useState<10 | 11 | 12>(10);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sync, setSync] = useState<"idle" | "syncing" | "saved">("idle");
  const [online, setOnline] = useState(true);
  const [error, setError] = useState("");
  const [appearance, setAppearance] = useState<Appearance>(defaultAppearance);
  const [appearanceDraft, setAppearanceDraft] = useState<Appearance>(defaultAppearance);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [workspaceView, setWorkspaceView] = useState<"lessons" | "students">("lessons");
  const [studentRefreshKey, setStudentRefreshKey] = useState(0);
  const [recoveryPanelOpen, setRecoveryPanelOpen] = useState(false);
  const savedTimer = useRef<number | null>(null);

  function markSaved() {
    if (savedTimer.current) window.clearTimeout(savedTimer.current);
    setSync("saved");
    savedTimer.current = window.setTimeout(() => setSync("idle"), 1600);
  }

  async function loadWorkspace(options?: { quiet?: boolean }) {
    if (!options?.quiet) setSync("syncing");
    try {
      const [lessonData, appearanceData] = await Promise.all([listLessons(), getAppearance()]);
      if (!lessonData.ok || !appearanceData.ok) {
        setAuth("guest");
        setSync("idle");
        return;
      }
      setLessons(lessonData.lessons);
      setAppearance(appearanceData.appearance);
      setAppearanceDraft(appearanceData.appearance);
      setError("");
      markSaved();
    } catch (err) {
      if (!options?.quiet)
        setError(describeRequestError(err, "تعذر جلب الدروس بسبب خطأ غير متوقع. حاول لاحقًا."));
      setSync("idle");
    }
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => {
      setOnline(true);
      if (auth === "ready") void loadWorkspace({ quiet: true });
    };
    const handleOffline = () => setOnline(false);
    const handleFocus = () => {
      if (auth === "ready" && navigator.onLine) void loadWorkspace({ quiet: true });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") handleFocus();
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (savedTimer.current) window.clearTimeout(savedTimer.current);
    };
  }, [auth]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await getAuthState();
        setSetupRequired(data.setupRequired);
        setAuth(data.authenticated ? "ready" : "guest");
        if (data.authenticated) await loadWorkspace();
      } catch (err) {
        setError(describeRequestError(err, "تعذر التحقق من حالة الدخول بسبب خطأ غير متوقع. حاول لاحقًا."));
        setAuth("guest");
      }
    })();
  }, []);

  const selected = useMemo(
    () => lessons.filter((lesson) => lesson.subject === subject && lesson.grade === grade).sort((a, b) => a.position - b.position),
    [lessons, subject, grade],
  );
  const visible = useMemo(
    () =>
      selected.filter(
        (lesson) =>
          (filter === "all" || (filter === "done" ? lesson.completed : !lesson.completed)) &&
          lesson.title.toLocaleLowerCase("ar").includes(query.trim().toLocaleLowerCase("ar")),
      ),
    [selected, filter, query],
  );
  const completed = selected.filter((lesson) => lesson.completed).length;
  const percent = selected.length ? Math.round((completed / selected.length) * 100) : 0;
  // Reordering swaps positions in the full, unfiltered list — only safe (and
  // only meaningful) to offer while no search/filter is narrowing the view.
  const reorderEnabled = filter === "all" && query.trim() === "";
  const activeAppearance = appearanceOpen ? appearanceDraft : appearance;
  const subjectColors: Record<Subject, string> = {
    chemistry: activeAppearance.chemistryColor,
    physics: activeAppearance.physicsColor,
    integrated: activeAppearance.integratedColor,
  };
  const appearanceStyle = {
    "--forest": activeAppearance.primaryColor,
    "--subject": workspaceView === "students" ? activeAppearance.primaryColor : subjectColors[subject],
    "--chemistry": activeAppearance.chemistryColor,
    "--physics": activeAppearance.physicsColor,
    "--integrated": activeAppearance.integratedColor,
    "--deep": `color-mix(in srgb, ${activeAppearance.primaryColor} 78%, black)`,
    "--mist": activeAppearance.backgroundColor,
    "--paper": `color-mix(in srgb, ${activeAppearance.backgroundColor} 35%, white)`,
    "--coral": activeAppearance.accentColor,
    "--coral-dark": `color-mix(in srgb, ${activeAppearance.accentColor} 78%, black)`,
    "--line": `color-mix(in srgb, ${activeAppearance.primaryColor} 22%, ${activeAppearance.backgroundColor})`,
  } as CSSProperties;

  if (auth === "loading") {
    return (
      <section id="workspace" className="workspace loading-shell" aria-label="جار التحميل">
        <div className="skeleton skeleton-banner" />
        <div className="skeleton-grid">
          {[1, 2, 3].map((item) => (
            <div className="skeleton skeleton-card" key={item} />
          ))}
        </div>
      </section>
    );
  }

  if (auth === "guest") {
    return (
      <AuthPanel
        setupRequired={setupRequired}
        onReady={async () => {
          setAuth("ready");
          setSetupRequired(false);
          await loadWorkspace();
        }}
      />
    );
  }

  async function mutate(payload: LessonMutation) {
    if (!navigator.onLine) {
      setError("لا يوجد اتصال بالإنترنت. لم يتم تغيير بياناتك.");
      return null;
    }
    setError("");
    setSync("syncing");
    try {
      const data = await mutateLesson({ data: payload });
      if (!data.ok) {
        if ("code" in data && data.code === "unauthorized") setAuth("guest");
        setError(data.error ?? "تعذر حفظ التغيير");
        setSync("idle");
        return null;
      }
      markSaved();
      return data;
    } catch (err) {
      setError(describeRequestError(err, "حدث خطأ غير متوقع أثناء الحفظ. بياناتك السابقة ما زالت محفوظة."));
      setSync("idle");
      return null;
    }
  }

  async function addLesson(title: string, part: SciencePart) {
    const result = await mutate({ action: "create", subject, grade, title, part: subject === "integrated" ? part : "" });
    if (result && "lesson" in result && result.lesson) await loadWorkspace({ quiet: true });
    return Boolean(result);
  }

  async function updateLesson(id: string, patch: { title?: string; completed?: boolean }) {
    const result = await mutate({ action: "update", id, ...patch });
    if (result && "lesson" in result && result.lesson) {
      const updatedLesson = result.lesson;
      setLessons((current) => current.map((lesson) => (lesson.id === id ? updatedLesson : lesson)));
    }
    return Boolean(result);
  }

  async function deleteLesson(id: string) {
    const result = await mutate({ action: "delete", id });
    if (result) setLessons((current) => current.filter((lesson) => lesson.id !== id));
    return Boolean(result);
  }

  async function bulkAddLessons(titles: string[], part: SciencePart) {
    const result = await mutate({ action: "bulk_create", subject, grade, part: subject === "integrated" ? part : "", titles });
    const created = result && "lessons" in result ? (result.lessons?.length ?? 0) : 0;
    if (created) await loadWorkspace({ quiet: true });
    return created;
  }

  async function reorderLesson(id: string, direction: "up" | "down") {
    const result = await mutate({ action: "reorder", id, direction });
    if (result && "lessons" in result && result.lessons?.length) {
      const updatedById = new Map(result.lessons.map((lesson) => [lesson.id, lesson]));
      setLessons((current) => current.map((lesson) => updatedById.get(lesson.id) ?? lesson));
    }
    return Boolean(result);
  }
  async function saveAppearance(next: Appearance) {
    setError("");
    setSync("syncing");
    try {
      const data = await updateAppearance({ data: next });
      if (!data.ok) {
        if ("code" in data && data.code === "unauthorized") setAuth("guest");
        setError(data.error ?? "تعذر حفظ الألوان");
        setSync("idle");
        return false;
      }
      setAppearance(data.appearance);
      setAppearanceDraft(data.appearance);
      setAppearanceOpen(false);
      markSaved();
      return true;
    } catch (err) {
      setError(describeRequestError(err, "تعذر حفظ الألوان بسبب خطأ غير متوقع. حاول لاحقًا."));
      setSync("idle");
      return false;
    }
  }

  async function logout() {
    try {
      await authenticateOwner({ data: { action: "logout" } });
    } finally {
      setLessons([]);
      setAuth("guest");
    }
  }

  const activeSubject = subjects.find((item) => item.id === subject)!;

  return (
    <section id="workspace" className="workspace" style={appearanceStyle}>
      <div className="workspace-inner">
        <header className="workspace-banner">
          <div className="banner-copy">
            <span className="eyebrow">{workspaceView === "lessons" ? "مساحة خاصة ومزامنة تلقائية" : "سجل الاستلام والمذكرات"}</span>
            <h2>{workspaceView === "lessons" ? "مخطط الدروس" : "متابعة الطلاب"}</h2>
            <p>{workspaceView === "lessons" ? "اختر المادة والصف، ثم أضف الدروس وحدّث إنجازها بلمسة واحدة." : "أضف الطلاب وسجّل استلام المذكرة بصورة فردية أو جماعية."}</p>
          </div>
          {workspaceView === "lessons" ? (
            <div className="progress-wrap" aria-label={`اكتمل ${percent}%`}>
              <div className="progress-ring" style={{ "--progress": `${percent * 3.6}deg` } as CSSProperties}>
                <strong>{percent}%</strong><span>مكتمل</span>
              </div>
              <div className="progress-caption"><b>{completed} من {selected.length}</b><span>في {activeSubject.name} للصف {grade}</span></div>
            </div>
          ) : (
            <div className="student-banner-mark"><UsersThree weight="duotone" /><b>فردي وجماعي</b><span>سجل واضح على كل أجهزتك</span></div>
          )}
        </header>

        <div className="workspace-topline">
          <div className={`sync-note${online ? "" : " offline"}`} aria-live="polite">
            {!online ? (
              <>
                <WifiSlash weight="bold" /> غير متصل — لن تضيع بياناتك
              </>
            ) : sync === "syncing" ? (
              <>
                <CloudArrowDown className="spin-soft" /> جار المزامنة
              </>
            ) : (
              <>
                <CloudCheck weight="fill" /> {sync === "saved" ? "تم الحفظ" : "محفوظ على أجهزتك"}
              </>
            )}
          </div>
          <div className="account-actions">
            <button
              type="button"
              onClick={() => {
                setAppearanceDraft(appearance);
                setAppearanceOpen(true);
              }}
            >
              <PaintBrushBroad /> <span>المظهر</span>
            </button>
            <button type="button" onClick={() => { void loadWorkspace(); setStudentRefreshKey((value) => value + 1); }} aria-label="تحديث البيانات">
              <CloudArrowDown /> <span className="action-label">تحديث</span>
            </button>
            <button type="button" onClick={() => setRecoveryPanelOpen(true)}>
              <Key /> <span>رمز الاسترجاع</span>
            </button>
            <button type="button" onClick={() => void logout()}>
              <SignOut /> <span>خروج</span>
            </button>
          </div>
        </div>

        <div className="workspace-switch" role="tablist" aria-label="أقسام التطبيق">
          <button type="button" role="tab" aria-selected={workspaceView === "lessons"} className={workspaceView === "lessons" ? "active" : ""} onClick={() => setWorkspaceView("lessons")}><ClipboardText weight="duotone" /> الدروس</button>
          <button type="button" role="tab" aria-selected={workspaceView === "students"} className={workspaceView === "students" ? "active" : ""} onClick={() => setWorkspaceView("students")}><UsersThree weight="duotone" /> متابعة الطلاب</button>
        </div>
        {workspaceView === "lessons" ? (<>
        <nav className="subject-rail" aria-label="المواد">
          {subjects.map((item, itemIndex) => {
            const count = lessons.filter((lesson) => lesson.subject === item.id).length;
            const itemColor = subjectColors[item.id];
            return (
              <button
                type="button"
                key={item.id}
                className={item.id === subject ? "subject-card active" : "subject-card"}
                style={{ "--subject-color": itemColor } as CSSProperties}
                onClick={() => {
                  setSubject(item.id);
                  setGrade(item.grades[0]);
                  setFilter("all");
                  setQuery("");
                }}
              >
                <span className="subject-number">0{itemIndex + 1}</span>
                <SubjectIcon subject={item.id} />
                <span>
                  <b>{item.name}</b>
                  <small>{item.note}</small>
                </span>
                <em>{count} درس</em>
              </button>
            );
          })}
        </nav>

        <div className="lesson-workspace">
          <div className="lesson-heading">
            <div>
              <h3>{activeSubject.name}</h3>
            </div>
            <div className="grade-tabs" aria-label="اختيار الصف">
              {activeSubject.grades.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={grade === value ? "active" : ""}
                  onClick={() => setGrade(value)}
                >
                  الصف {value}
                </button>
              ))}
            </div>
          </div>
          <AddLesson subject={subject} onAdd={addLesson} onBulkAdd={bulkAddLessons} />
          <div className="lesson-tools">
            <label className="search-box">
              <MagnifyingGlass />
              <span className="sr-only">ابحث عن درس</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ابحث في الدروس"
              />
            </label>
            <div className="filter-tabs">
              {(
                [
                  ["all", "الكل"],
                  ["open", "قيد العمل"],
                  ["done", "مكتمل"],
                ] as Array<[Filter, string]>
              ).map(([id, label]) => (
                <button
                  type="button"
                  className={filter === id ? "active" : ""}
                  onClick={() => setFilter(id)}
                  key={id}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="lesson-list" aria-busy={sync === "syncing"}>
            {subject === "integrated"
              ? scienceParts.map((part) => {
                  const partLessons = visible.filter((lesson) => lesson.part === part.id);
                  if (!partLessons.length) return null;
                  return (
                    <section className={"science-part-section " + part.id} key={part.id}>
                      <header className="science-part-heading">
                        <span>{part.title}</span>
                        <b>{part.label}</b>
                        <small>{partLessons.length} درس</small>
                      </header>
                      {partLessons.map((lesson, partIndex) => (
                        <LessonRow
                          key={lesson.id}
                          lesson={lesson}
                          index={selected.findIndex((item) => item.id === lesson.id)}
                          onUpdate={updateLesson}
                          onDelete={deleteLesson}
                          onReorder={reorderEnabled ? reorderLesson : undefined}
                          canMoveUp={reorderEnabled && partIndex > 0}
                          canMoveDown={reorderEnabled && partIndex < partLessons.length - 1}
                        />
                      ))}
                    </section>
                  );
                })
              : visible.map((lesson, visibleIndex) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    index={selected.findIndex((item) => item.id === lesson.id)}
                    onUpdate={updateLesson}
                    onDelete={deleteLesson}
                    onReorder={reorderEnabled ? reorderLesson : undefined}
                    canMoveUp={reorderEnabled && visibleIndex > 0}
                    canMoveDown={reorderEnabled && visibleIndex < visible.length - 1}
                  />
                ))}
            {!visible.length && <EmptyState hasLessons={selected.length > 0} />}
          </div>
        </div>
        </>) : (
          <StudentTracker lessons={lessons} online={online} refreshKey={studentRefreshKey} chemistryColor={activeAppearance.chemistryColor} physicsColor={activeAppearance.physicsColor} integratedColor={activeAppearance.integratedColor} onUnauthorized={() => setAuth("guest")} />
        )}
      </div>

      {appearanceOpen && (
        <AppearancePanel
          value={appearanceDraft}
          onChange={setAppearanceDraft}
          onClose={() => setAppearanceOpen(false)}
          onSave={saveAppearance}
        />
      )}

      {recoveryPanelOpen && (
        <RecoveryCodePanel
          onClose={() => setRecoveryPanelOpen(false)}
          onUnauthorized={() => setAuth("guest")}
        />
      )}
    </section>
  );
}

function RecoveryCodePanel({
  onClose,
  onUnauthorized,
}: {
  onClose: () => void;
  onUnauthorized: () => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const data = await generateRecoveryCode();
      if (!data.ok) {
        if ("code" in data && data.code === "unauthorized") onUnauthorized();
        setError(data.error ?? "تعذر توليد رمز الاسترجاع");
        return;
      }
      setCode(data.recoveryCode);
      setSaved(false);
    } catch (err) {
      setError(describeRequestError(err, "تعذر توليد رمز الاسترجاع بسبب خطأ غير متوقع. حاول لاحقًا."));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in this context — the code is still visible to copy by hand.
    }
  }

  return (
    <div
      className="appearance-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="appearance-panel" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
        <header>
          <div>
            <span className="eyebrow">لو نسيت كلمة المرور</span>
            <h3 id="recovery-title">رمز الاسترجاع</h3>
          </div>
          <button type="button" className="appearance-close" onClick={onClose} aria-label="إغلاق">
            <X />
          </button>
        </header>
        <p>
          رمز الاسترجاع هو طريقتك لاستعادة الدخول لو نسيت كلمة المرور، بدون الحاجة لأي بريد إلكتروني. كل مرة تولّد فيها رمزًا جديدًا، الرمز القديم يتوقف عن العمل فورًا.
        </p>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        {code ? (
          <>
            <div className="recovery-code-display" dir="ltr">
              <code>{code}</code>
              <button type="button" onClick={() => void copy()}>
                {copied ? <Check weight="bold" /> : "نسخ"}
              </button>
            </div>
            <label className="recovery-confirm">
              <input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
              <span>حفظت هذا الرمز في مكان آمن (مثل ملاحظاتي أو مدير كلمات المرور)</span>
            </label>
          </>
        ) : (
          <p className="recovery-empty">لا يوجد رمز استرجاع مُفعّل بعد لهذا الحساب. اضغط "توليد رمز" لإنشاء واحد الآن.</p>
        )}
        <footer>
          <button type="button" className="appearance-reset" onClick={() => void generate()} disabled={busy}>
            {busy ? "لحظة..." : code ? "توليد رمز جديد" : "توليد رمز"}
          </button>
          <button type="button" className="appearance-save" onClick={onClose} disabled={Boolean(code) && !saved}>
            {code ? "تم، إغلاق" : "إغلاق"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function AppearancePanel({
  value,
  onChange,
  onClose,
  onSave,
}: {
  value: Appearance;
  onChange: (appearance: Appearance) => void;
  onClose: () => void;
  onSave: (appearance: Appearance) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function save() {
    setBusy(true);
    await onSave(value);
    setBusy(false);
  }

  return (
    <div
      className="appearance-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="appearance-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appearance-title"
      >
        <header>
          <div>
            <span className="eyebrow">تخصيص سريع</span>
            <h3 id="appearance-title">إعدادات المظهر</h3>
          </div>
          <button
            type="button"
            className="appearance-close"
            onClick={onClose}
            aria-label="إغلاق إعدادات المظهر"
          >
            <X />
          </button>
        </header>
        <p>اختر مجموعة جاهزة أو عدّل الألوان. ستشاهد النتيجة مباشرة قبل الحفظ.</p>

        <div className="palette-grid" aria-label="مجموعات ألوان جاهزة">
          {appearancePresets.map((preset) => {
            const active =
              preset.primaryColor === value.primaryColor &&
              preset.accentColor === value.accentColor &&
              preset.backgroundColor === value.backgroundColor &&
              preset.chemistryColor === value.chemistryColor &&
              preset.physicsColor === value.physicsColor &&
              preset.integratedColor === value.integratedColor;
            return (
              <button
                type="button"
                key={preset.name}
                className={active ? "palette-choice active" : "palette-choice"}
                onClick={() =>
                  onChange({
                    primaryColor: preset.primaryColor,
                    accentColor: preset.accentColor,
                    backgroundColor: preset.backgroundColor,
                    chemistryColor: preset.chemistryColor,
                    physicsColor: preset.physicsColor,
                    integratedColor: preset.integratedColor,
                  })
                }
              >
                <span className="palette-swatches" aria-hidden="true">
                  <i style={{ backgroundColor: preset.primaryColor }} />
                  <i style={{ backgroundColor: preset.accentColor }} />
                  <i style={{ backgroundColor: preset.backgroundColor }} />
                </span>
                <b>{preset.name}</b>
                {active && <Check weight="bold" />}
              </button>
            );
          })}
        </div>

        <h4 className="appearance-group-title">ألوان الواجهة</h4>
        <div className="color-fields">
          <ColorField
            label="اللون الرئيسي"
            hint="اختر لونًا داكنًا"
            value={value.primaryColor}
            onChange={(primaryColor) => onChange({ ...value, primaryColor })}
          />
          <ColorField
            label="لون التمييز"
            hint="للأزرار وعلامات الإنجاز"
            value={value.accentColor}
            onChange={(accentColor) => onChange({ ...value, accentColor })}
          />
          <ColorField
            label="لون الخلفية"
            hint="يفضل لونًا فاتحًا"
            value={value.backgroundColor}
            onChange={(backgroundColor) => onChange({ ...value, backgroundColor })}
          />
        </div>

        <h4 className="appearance-group-title">ألوان المواد</h4>
        <div className="color-fields subject-color-fields">
          <ColorField
            label="الكيمياء"
            hint="بطاقات ودروس الكيمياء"
            value={value.chemistryColor}
            onChange={(chemistryColor) => onChange({ ...value, chemistryColor })}
          />
          <ColorField
            label="الفيزياء"
            hint="بطاقات ودروس الفيزياء"
            value={value.physicsColor}
            onChange={(physicsColor) => onChange({ ...value, physicsColor })}
          />
          <ColorField
            label="العلوم المتكاملة"
            hint="بطاقات ودروس العلوم المتكاملة"
            value={value.integratedColor}
            onChange={(integratedColor) => onChange({ ...value, integratedColor })}
          />
        </div>

        <footer>
          <button
            type="button"
            className="appearance-reset"
            onClick={() => onChange(defaultAppearance)}
          >
            استعادة الافتراضي
          </button>
          <button
            type="button"
            className="appearance-save"
            disabled={busy}
            onClick={() => void save()}
          >
            {busy ? "جار الحفظ..." : "حفظ ومزامنة الألوان"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="color-field">
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
      <span>
        <b>{label}</b>
        <small>{hint}</small>
      </span>
      <code>{value.toUpperCase()}</code>
    </label>
  );
}

type AuthMode = "auth" | "recover" | "show-code";

function AuthPanel({
  setupRequired,
  onReady,
}: {
  setupRequired: boolean;
  onReady: () => Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [revealedCode, setRevealedCode] = useState("");
  const [codeContext, setCodeContext] = useState<"setup" | "reset">("setup");
  const [codeSaved, setCodeSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await authenticateOwner({
        data: { action: setupRequired ? "setup" : "login", email, password },
      });
      if (!data.ok) {
        setError(data.error ?? "تعذر تسجيل الدخول");
        return;
      }
      if (setupRequired && "recoveryCode" in data && data.recoveryCode) {
        setRevealedCode(data.recoveryCode);
        setCodeContext("setup");
        setCodeSaved(false);
        setMode("show-code");
        return;
      }
      await onReady();
    } catch (err) {
      setError(
        describeRequestError(
          err,
          setupRequired
            ? "تعذر إنشاء الحساب بسبب خطأ غير متوقع. حاول لاحقًا."
            : "حدث خطأ غير متوقع أثناء تسجيل الدخول. حاول لاحقًا، وإذا استمر تواصل للدعم الفني.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  async function submitRecover(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين");
      return;
    }
    setBusy(true);
    try {
      const data = await resetPassword({ data: { code: recoveryCodeInput, password: newPassword } });
      if (!data.ok) {
        setError(data.error ?? "تعذر إعادة تعيين كلمة المرور");
        return;
      }
      setRevealedCode(data.recoveryCode);
      setCodeContext("reset");
      setCodeSaved(false);
      setMode("show-code");
    } catch (err) {
      setError(describeRequestError(err, "تعذر إعادة تعيين كلمة المرور بسبب خطأ غير متوقع. حاول لاحقًا."));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(revealedCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable in this context — the code is still visible to copy by hand.
    }
  }

  if (mode === "show-code") {
    return (
      <section id="workspace" className="workspace auth-section">
        <div className="auth-shell">
          <div className="auth-visual">
            <img src="/assets/brand/cover-scene.png" alt="" role="presentation" />
            <div>
              <WaveSine weight="duotone" />
              <span>مساحتك العلمية، على كل أجهزتك</span>
            </div>
          </div>
          <div className="auth-card">
            <span className="auth-icon">
              <Key weight="duotone" />
            </span>
            <h2>{codeContext === "setup" ? "احفظ رمز الاسترجاع" : "رمز الاسترجاع الجديد"}</h2>
            <p>
              {codeContext === "setup"
                ? "هذا الرمز هو طريقتك الوحيدة لاستعادة الدخول لو نسيت كلمة المرور مستقبلًا. يظهر مرة واحدة فقط الآن."
                : "تم تحديث رمز الاسترجاع. الرمز القديم لم يعد صالحًا — احفظ هذا الرمز الجديد بدلًا منه."}
            </p>
            <div className="recovery-code-display" dir="ltr">
              <code>{revealedCode}</code>
              <button type="button" onClick={() => void copyCode()}>
                {copied ? <Check weight="bold" /> : "نسخ"}
              </button>
            </div>
            <label className="recovery-confirm">
              <input type="checkbox" checked={codeSaved} onChange={(event) => setCodeSaved(event.target.checked)} />
              <span>حفظت هذا الرمز في مكان آمن (مثل ملاحظاتي أو مدير كلمات المرور)</span>
            </label>
            <button className="auth-submit" disabled={!codeSaved} onClick={() => void onReady()}>
              متابعة
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (mode === "recover") {
    return (
      <section id="workspace" className="workspace auth-section">
        <div className="auth-shell">
          <div className="auth-visual">
            <img src="/assets/brand/cover-scene.png" alt="" role="presentation" />
            <div>
              <WaveSine weight="duotone" />
              <span>مساحتك العلمية، على كل أجهزتك</span>
            </div>
          </div>
          <form className="auth-card" onSubmit={(event) => void submitRecover(event)}>
            <span className="auth-icon">
              <Key weight="duotone" />
            </span>
            <h2>استرجاع الدخول</h2>
            <p>أدخل رمز الاسترجاع الذي حفظته، ثم اختر كلمة مرور جديدة.</p>
            <label>
              رمز الاسترجاع
              <input
                dir="ltr"
                required
                value={recoveryCodeInput}
                onChange={(event) => setRecoveryCodeInput(event.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
              />
            </label>
            <label>
              كلمة المرور الجديدة
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <small>10 أحرف على الأقل</small>
            </label>
            <label>
              تأكيد كلمة المرور
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </label>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <button className="auth-submit" disabled={busy}>
              {busy ? "لحظة..." : "إعادة تعيين وتسجيل الدخول"}
            </button>
            <button
              type="button"
              className="auth-back-link"
              onClick={() => {
                setMode("auth");
                setError("");
              }}
            >
              رجوع لتسجيل الدخول
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section id="workspace" className="workspace auth-section">
      <div className="auth-shell">
        <div className="auth-visual">
          <img src="/assets/brand/cover-scene.png" alt="" role="presentation" />
          <div>
            <WaveSine weight="duotone" />
            <span>مساحتك العلمية، على كل أجهزتك</span>
          </div>
        </div>
        <form className="auth-card" onSubmit={(event) => void submit(event)}>
          <span className="auth-icon">
            <LockKey weight="duotone" />
          </span>
          <h2>{setupRequired ? "أنشئ حسابك الخاص" : "مرحبًا بعودتك"}</h2>
          <p>
            {setupRequired
              ? "هذا الحساب يُنشأ مرة واحدة، وبعدها تصبح المساحة لك وحدك."
              : "سجّل الدخول لتظهر دروسك المحدثة على هذا الجهاز."}
          </p>
          <label>
            البريد الإلكتروني
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            كلمة المرور
            <input
              type="password"
              autoComplete={setupRequired ? "new-password" : "current-password"}
              minLength={10}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <small>10 أحرف على الأقل</small>
          </label>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <button className="auth-submit" disabled={busy}>
            {busy ? "لحظة..." : setupRequired ? "إنشاء المساحة" : "دخول"}
          </button>
          {!setupRequired && (
            <button type="button" className="auth-forgot-link" onClick={() => { setMode("recover"); setError(""); }}>
              نسيت كلمة المرور؟
            </button>
          )}
        </form>
      </div>
    </section>
  );
}

function AddLesson({
  subject,
  onAdd,
  onBulkAdd,
}: {
  subject: Subject;
  onAdd: (title: string, part: SciencePart) => Promise<boolean>;
  onBulkAdd: (titles: string[], part: SciencePart) => Promise<number>;
}) {
  const [title, setTitle] = useState("");
  const [part, setPart] = useState<Exclude<SciencePart, "">>("physics");
  const [busy, setBusy] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const bulkTitles = bulkText.split("\n").map((line) => line.trim()).filter(Boolean);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setBusy(true);
    if (await onAdd(clean, subject === "integrated" ? part : "")) setTitle("");
    setBusy(false);
  }

  async function submitBulk(event: FormEvent) {
    event.preventDefault();
    if (!bulkTitles.length) return;
    setBulkBusy(true);
    setBulkMessage("");
    const created = await onBulkAdd(bulkTitles, subject === "integrated" ? part : "");
    setBulkBusy(false);
    if (created > 0) {
      setBulkMessage(created === 1 ? "تمت إضافة درس واحد." : `تمت إضافة ${created} دروس.`);
      setBulkText("");
      window.setTimeout(() => {
        setBulkOpen(false);
        setBulkMessage("");
      }, 1400);
    }
  }

  return (
    <div className={"add-lesson-wrap" + (subject === "integrated" ? " integrated" : "")}>
      {subject === "integrated" && (
        <div className="science-part-tabs" role="group" aria-label="اختر جزء العلوم المتكاملة">
          {scienceParts.map((item) => (
            <button
              type="button"
              key={item.id}
              className={part === item.id ? "active " + item.id : ""}
              onClick={() => setPart(item.id)}
            >
              <span>{item.title}</span>
              <b>{item.label}</b>
            </button>
          ))}
        </div>
      )}
      <form className="add-lesson" onSubmit={(event) => void submit(event)}>
        <span>
          <Plus weight="bold" />
        </span>
        <label>
          <span className="sr-only">اسم الدرس</span>
          <input
            maxLength={140}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={subject === "integrated" ? "أضف درسًا إلى جزء " + (part === "physics" ? "الفيزياء" : "الكيمياء") : "اكتب اسم درس جديد"}
          />
        </label>
        <button disabled={busy || !title.trim()}>{busy ? "يُضاف..." : "إضافة الدرس"}</button>
      </form>
      <button type="button" className="bulk-add-toggle" onClick={() => setBulkOpen((value) => !value)}>
        <ClipboardText weight="bold" /> {bulkOpen ? "إغلاق الإضافة الجماعية" : "إضافة عدة دروس دفعة واحدة"}
      </button>
      {bulkOpen && (
        <form className="bulk-add-form" onSubmit={(event) => void submitBulk(event)}>
          <label>
            <span className="sr-only">عناوين الدروس، كل درس بسطر مستقل</span>
            <textarea
              rows={5}
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={"اكتب عنوان كل درس بسطر مستقل، مثال:\nالدرس الأول\nالدرس الثاني\nالدرس الثالث"}
            />
          </label>
          <div className="bulk-add-actions">
            <span>{bulkTitles.length} درس جاهز للإضافة</span>
            <button disabled={bulkBusy || !bulkTitles.length}>{bulkBusy ? "يُضاف..." : "إضافة الكل"}</button>
          </div>
          {bulkMessage && (
            <p className="bulk-add-success" role="status">
              {bulkMessage}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function LessonRow({
  lesson,
  index,
  onUpdate,
  onDelete,
  onReorder,
  canMoveUp,
  canMoveDown,
}: {
  lesson: Lesson;
  index: number;
  onUpdate: (id: string, patch: { title?: string; completed?: boolean }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onReorder?: (id: string, direction: "up" | "down") => Promise<boolean>;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lesson.title);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reordering, setReordering] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    await onUpdate(lesson.id, { completed: !lesson.completed });
    setBusy(false);
  }

  async function move(direction: "up" | "down") {
    if (!onReorder || busy || reordering) return;
    setReordering(true);
    await onReorder(lesson.id, direction);
    setReordering(false);
  }

  async function save() {
    const clean = draft.trim();
    if (!clean) return;
    if (clean !== lesson.title) {
      setBusy(true);
      const saved = await onUpdate(lesson.id, { title: clean });
      setBusy(false);
      if (!saved) return;
    }
    setEditing(false);
  }

  async function remove() {
    setBusy(true);
    const deleted = await onDelete(lesson.id);
    if (!deleted) setBusy(false);
  }

  return (
    <article
      className={`${lesson.completed ? "lesson-row complete" : "lesson-row"}${busy ? " busy" : ""}`}
    >
      <span className="lesson-index">{String(index + 1).padStart(2, "0")}</span>
      <button
        className="complete-toggle"
        type="button"
        disabled={busy}
        onClick={() => void toggle()}
        aria-label={lesson.completed ? "إلغاء الاكتمال" : "وضع علامة مكتمل"}
      >
        {lesson.completed && <Check weight="bold" />}
      </button>
      <div className="lesson-name">
        {editing ? (
          <input
            aria-label="تعديل اسم الدرس"
            autoFocus
            maxLength={140}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void save();
              if (event.key === "Escape") {
                setDraft(lesson.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <button type="button" disabled={busy} onClick={() => void toggle()}>
            <b>{lesson.title}</b>
            <small>{lesson.completed ? "اكتمل التصميم" : "لم يكتمل بعد"}</small>
          </button>
        )}
      </div>
      <div className="row-actions">
        {onReorder && (
          <span className="lesson-reorder">
            <button
              type="button"
              disabled={!canMoveUp || busy || reordering}
              onClick={() => void move("up")}
              aria-label="نقل الدرس للأعلى"
            >
              <CaretUp weight="bold" />
            </button>
            <button
              type="button"
              disabled={!canMoveDown || busy || reordering}
              onClick={() => void move("down")}
              aria-label="نقل الدرس للأسفل"
            >
              <CaretDown weight="bold" />
            </button>
          </span>
        )}
        {editing ? (
          <>
            <button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() => void save()}
              aria-label="حفظ"
            >
              <Check />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft(lesson.title);
                setEditing(false);
              }}
              aria-label="إلغاء"
            >
              <X />
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(true)}
            aria-label="تعديل اسم الدرس"
          >
            <PencilSimple />
          </button>
        )}
        {confirming ? (
          <span className="delete-confirm">
            <button type="button" disabled={busy} onClick={() => void remove()}>
              حذف
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)}>
              إلغاء
            </button>
          </span>
        ) : (
          <button
            className="delete-trigger"
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
            aria-label="حذف الدرس"
          >
            <Trash />
          </button>
        )}
      </div>
    </article>
  );
}

function EmptyState({ hasLessons }: { hasLessons: boolean }) {
  return (
    <div className="empty-state">
      <img src="/assets/brand/empty-state.png" alt="" role="presentation" />
      <div>
        <h4>{hasLessons ? "لا توجد نتائج مطابقة" : "ابدأ بأول درس"}</h4>
        <p>
          {hasLessons
            ? "غيّر البحث أو مرشح الحالة."
            : "اكتب اسم الدرس في الأعلى، ويمكنك إضافة أي عدد تحتاجه."}
        </p>
      </div>
    </div>
  );
}
