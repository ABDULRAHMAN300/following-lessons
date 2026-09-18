import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  Atom,
  Check,
  CloudArrowDown,
  CloudCheck,
  Flask,
  Leaf,
  LockKey,
  MagnifyingGlass,
  PaintBrushBroad,
  PencilSimple,
  Plus,
  SignOut,
  Trash,
  WaveSine,
  WifiSlash,
  X,
} from "@phosphor-icons/react";
import { ScrollScrub } from "@/components/scroll-scrub/scroll-scrub";
import { scrollScrubScenes, scrollScrubTheme } from "@/scroll-scrub-scenes";
import { appearancePresets, defaultAppearance, type Appearance } from "@/lib/appearance";
import {
  authenticateOwner,
  getAppearance,
  getAuthState,
  listLessons,
  mutateLesson,
  updateAppearance,
  type Lesson,
} from "@/lib/lesson.functions";

export const Route = createFileRoute("/")({ component: Index });

type Subject = "chemistry" | "physics" | "integrated";
type Filter = "all" | "open" | "done";
type LessonMutation =
  | { action: "create"; subject: Subject; grade: 10 | 11 | 12; title: string }
  | { action: "update"; id: string; title?: string; completed?: boolean }
  | { action: "delete"; id: string };

const subjects: Array<{ id: Subject; name: string; note: string; grades: Array<10 | 11 | 12> }> = [
  { id: "chemistry", name: "الكيمياء", note: "المادة والتفاعلات", grades: [10, 11, 12] },
  { id: "physics", name: "الفيزياء", note: "الحركة والطاقة", grades: [10, 11, 12] },
  { id: "integrated", name: "العلوم المتكاملة", note: "روابط العلوم", grades: [10] },
];

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
          افتح مساحة الدروس
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
    } catch {
      if (!options?.quiet) setError("تعذر جلب الدروس. تحقق من الاتصال ثم حاول مجددًا.");
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
      } catch {
        setError("تعذر الاتصال بالخادم. حاول مجددًا.");
        setAuth("guest");
      }
    })();
  }, []);

  const selected = useMemo(
    () => lessons.filter((lesson) => lesson.subject === subject && lesson.grade === grade),
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
  const activeAppearance = appearanceOpen ? appearanceDraft : appearance;
  const appearanceStyle = {
    "--forest": activeAppearance.primaryColor,
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
      return "lesson" in data && data.lesson ? data.lesson : true;
    } catch {
      setError("تعذر حفظ التغيير. بياناتك السابقة ما زالت محفوظة.");
      setSync("idle");
      return null;
    }
  }

  async function addLesson(title: string) {
    const result = await mutate({ action: "create", subject, grade, title });
    if (result && result !== true) setLessons((current) => [...current, result]);
    return Boolean(result);
  }

  async function updateLesson(id: string, patch: { title?: string; completed?: boolean }) {
    const result = await mutate({ action: "update", id, ...patch });
    if (result && result !== true) {
      setLessons((current) => current.map((lesson) => (lesson.id === id ? result : lesson)));
    }
    return Boolean(result);
  }

  async function deleteLesson(id: string) {
    const result = await mutate({ action: "delete", id });
    if (result) setLessons((current) => current.filter((lesson) => lesson.id !== id));
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
    } catch {
      setError("تعذر حفظ الألوان. حاول مجددًا عند استقرار الاتصال.");
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
            <span className="eyebrow">مساحة خاصة ومزامنة تلقائية</span>
            <h2>مخطط الدروس</h2>
            <p>اختر المادة والصف، ثم أضف الدروس وحدّث إنجازها بلمسة واحدة.</p>
          </div>
          <div className="progress-wrap" aria-label={`اكتمل ${percent}%`}>
            <div
              className="progress-ring"
              style={{ "--progress": `${percent * 3.6}deg` } as CSSProperties}
            >
              <strong>{percent}%</strong>
              <span>مكتمل</span>
            </div>
            <div className="progress-caption">
              <b>
                {completed} من {selected.length}
              </b>
              <span>
                في {activeSubject.name} للصف {grade}
              </span>
            </div>
          </div>
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
            <button type="button" onClick={() => void loadWorkspace()} aria-label="تحديث الدروس">
              <CloudArrowDown /> <span className="action-label">تحديث</span>
            </button>
            <button type="button" onClick={() => void logout()}>
              <SignOut /> <span>خروج</span>
            </button>
          </div>
        </div>

        <nav className="subject-rail" aria-label="المواد">
          {subjects.map((item, itemIndex) => {
            const count = lessons.filter((lesson) => lesson.subject === item.id).length;
            return (
              <button
                type="button"
                key={item.id}
                className={item.id === subject ? "subject-card active" : "subject-card"}
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
          <AddLesson onAdd={addLesson} />
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
            {visible.map((lesson, index) => (
              <LessonRow
                key={lesson.id}
                lesson={lesson}
                index={index}
                onUpdate={updateLesson}
                onDelete={deleteLesson}
              />
            ))}
            {!visible.length && <EmptyState hasLessons={selected.length > 0} />}
          </div>
        </div>
      </div>

      {appearanceOpen && (
        <AppearancePanel
          value={appearanceDraft}
          onChange={setAppearanceDraft}
          onClose={() => setAppearanceOpen(false)}
          onSave={saveAppearance}
        />
      )}
    </section>
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
              preset.backgroundColor === value.backgroundColor;
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

function AuthPanel({
  setupRequired,
  onReady,
}: {
  setupRequired: boolean;
  onReady: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      await onReady();
    } catch {
      setError("تعذر الاتصال بالخادم. حاول مجددًا.");
    } finally {
      setBusy(false);
    }
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
        </form>
      </div>
    </section>
  );
}

function AddLesson({ onAdd }: { onAdd: (title: string) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setBusy(true);
    if (await onAdd(clean)) setTitle("");
    setBusy(false);
  }

  return (
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
          placeholder="اكتب اسم درس جديد"
        />
      </label>
      <button disabled={busy || !title.trim()}>{busy ? "يُضاف..." : "إضافة الدرس"}</button>
    </form>
  );
}

function LessonRow({
  lesson,
  index,
  onUpdate,
  onDelete,
}: {
  lesson: Lesson;
  index: number;
  onUpdate: (id: string, patch: { title?: string; completed?: boolean }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(lesson.title);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    await onUpdate(lesson.id, { completed: !lesson.completed });
    setBusy(false);
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
