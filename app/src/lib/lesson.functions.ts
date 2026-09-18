import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  clearAuthFailures,
  clearSession,
  createSession,
  database,
  expireSessionCookies,
  getSessionUser,
  hashPassword,
  isRateLimited,
  recordAuthFailure,
  setSessionCookies,
  verifyPassword,
} from "./auth.server";
import { defaultAppearance, type Appearance } from "./appearance";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email().max(180),
  password: z.string().min(10).max(128),
});
const authSchema = z.discriminatedUnion("action", [
  credentials.extend({ action: z.literal("setup") }),
  credentials.extend({ action: z.literal("login") }),
  z.object({ action: z.literal("logout") }),
]);
const subject = z.enum(["chemistry", "physics", "integrated"]);
const lessonCreate = z.object({
  action: z.literal("create"),
  subject,
  grade: z.union([z.literal(10), z.literal(11), z.literal(12)]),
  title: z.string().trim().min(1).max(140),
});
const lessonUpdate = z
  .object({
    action: z.literal("update"),
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(140).optional(),
    completed: z.boolean().optional(),
  })
  .refine((v) => v.title !== undefined || v.completed !== undefined);
const lessonDelete = z.object({ action: z.literal("delete"), id: z.string().uuid() });
const lessonMutation = z.discriminatedUnion("action", [
  lessonCreate,
  lessonDelete,
  z.object({
    action: z.literal("update"),
    id: z.string().uuid(),
    title: z.string().trim().min(1).max(140).optional(),
    completed: z.boolean().optional(),
  }),
]);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const appearanceMutation = z.object({
  primaryColor: hexColor,
  accentColor: hexColor,
  backgroundColor: hexColor,
});

export type Lesson = {
  id: string;
  subject: "chemistry" | "physics" | "integrated";
  grade: 10 | 11 | 12;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};
type Row = Omit<Lesson, "completed"> & { completed: number };
const present = (row: Row): Lesson => ({ ...row, completed: Boolean(row.completed) });
const validScope = (value: { subject: string; grade: number }) =>
  value.subject === "integrated" ? value.grade === 10 : [10, 11, 12].includes(value.grade);

export const getAuthState = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser(getRequest());
  const row = await database()
    .prepare("SELECT COUNT(*) AS count FROM users")
    .first<{ count: number }>();
  return { authenticated: Boolean(user), setupRequired: Number(row?.count ?? 0) === 0 };
});

export const authenticateOwner = createServerFn({ method: "POST" })
  .validator(authSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    if (data.action === "logout") {
      await clearSession(request);
      expireSessionCookies();
      return { ok: true as const };
    }
    if (await isRateLimited(request))
      return { ok: false as const, error: "محاولات كثيرة. حاول بعد 15 دقيقة" };
    const { action, email, password } = data;
    if (action === "setup") {
      const existing = await database()
        .prepare("SELECT id FROM users LIMIT 1")
        .first<{ id: string }>();
      if (existing) return { ok: false as const, error: "تم إنشاء الحساب الخاص بالفعل" };
      const id = crypto.randomUUID(),
        { hash, salt } = await hashPassword(password);
      try {
        await database()
          .prepare(
            "INSERT INTO users(id,singleton,email,password_hash,password_salt) VALUES(?,1,?,?,?)",
          )
          .bind(id, email, hash, salt)
          .run();
      } catch {
        return { ok: false as const, error: "تم إنشاء الحساب الخاص بالفعل" };
      }
      const token = await createSession(id);
      setSessionCookies(token);
      await clearAuthFailures(request);
      return { ok: true as const };
    }
    const user = await database()
      .prepare("SELECT id,password_hash,password_salt FROM users WHERE email=?")
      .bind(email)
      .first<{ id: string; password_hash: string; password_salt: string }>();
    const valid = user
      ? await verifyPassword(password, user.password_hash, user.password_salt)
      : (await hashPassword(password), false);
    if (!user || !valid) {
      await recordAuthFailure(request);
      return { ok: false as const, error: "بيانات الدخول غير صحيحة" };
    }
    const token = await createSession(user.id);
    setSessionCookies(token);
    await clearAuthFailures(request);
    return { ok: true as const };
  });

export const listLessons = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser(getRequest());
  if (!user) return { ok: false as const, code: "unauthorized" as const, lessons: [] as Lesson[] };
  const result = await database()
    .prepare(
      "SELECT id,subject,grade,title,completed,position,created_at,updated_at FROM lessons WHERE owner_id=? ORDER BY subject,grade,position,created_at",
    )
    .bind(user.id)
    .all<Row>();
  return { ok: true as const, lessons: (result.results ?? []).map(present) };
});

export const getAppearance = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser(getRequest());
  if (!user)
    return { ok: false as const, code: "unauthorized" as const, appearance: defaultAppearance };
  const row = await database()
    .prepare(
      "SELECT primary_color AS primaryColor,accent_color AS accentColor,background_color AS backgroundColor FROM appearance_settings WHERE owner_id=?",
    )
    .bind(user.id)
    .first<Appearance>();
  return { ok: true as const, appearance: row ?? defaultAppearance };
});

export const updateAppearance = createServerFn({ method: "POST" })
  .validator(appearanceMutation)
  .handler(async ({ data }) => {
    const user = await getSessionUser(getRequest());
    if (!user)
      return { ok: false as const, code: "unauthorized" as const, error: "يلزم تسجيل الدخول" };
    await database()
      .prepare(
        "INSERT INTO appearance_settings(owner_id,primary_color,accent_color,background_color,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET primary_color=excluded.primary_color,accent_color=excluded.accent_color,background_color=excluded.background_color,updated_at=excluded.updated_at",
      )
      .bind(
        user.id,
        data.primaryColor,
        data.accentColor,
        data.backgroundColor,
        new Date().toISOString(),
      )
      .run();
    return { ok: true as const, appearance: data };
  });

export const mutateLesson = createServerFn({ method: "POST" })
  .validator(lessonMutation)
  .handler(async ({ data }) => {
    const user = await getSessionUser(getRequest());
    if (!user)
      return { ok: false as const, code: "unauthorized" as const, error: "يلزم تسجيل الدخول" };
    if (data.action === "create") {
      if (!validScope(data)) return { ok: false as const, error: "بيانات الدرس غير صالحة" };
      const next = await database()
        .prepare(
          "SELECT COALESCE(MAX(position),-1)+1 AS value FROM lessons WHERE owner_id=? AND subject=? AND grade=?",
        )
        .bind(user.id, data.subject, data.grade)
        .first<{ value: number }>();
      const id = crypto.randomUUID(),
        now = new Date().toISOString(),
        position = Number(next?.value ?? 0);
      await database()
        .prepare(
          "INSERT INTO lessons(id,owner_id,subject,grade,title,completed,position,created_at,updated_at) VALUES(?,?,?,?,?,0,?,?,?)",
        )
        .bind(id, user.id, data.subject, data.grade, data.title, position, now, now)
        .run();
      return {
        ok: true as const,
        lesson: present({
          id,
          subject: data.subject,
          grade: data.grade,
          title: data.title,
          completed: 0,
          position,
          created_at: now,
          updated_at: now,
        }),
      };
    }
    if (data.action === "delete") {
      await database()
        .prepare("DELETE FROM lessons WHERE id=? AND owner_id=?")
        .bind(data.id, user.id)
        .run();
      return { ok: true as const };
    }
    const parsed = lessonUpdate.safeParse(data);
    if (!parsed.success) return { ok: false as const, error: "تعذر تحديث الدرس" };
    const current = await database()
      .prepare(
        "SELECT id,subject,grade,title,completed,position,created_at,updated_at FROM lessons WHERE id=? AND owner_id=?",
      )
      .bind(data.id, user.id)
      .first<Row>();
    if (!current) return { ok: false as const, error: "الدرس غير موجود" };
    const title = data.title ?? current.title,
      completed = data.completed === undefined ? current.completed : Number(data.completed),
      now = new Date().toISOString();
    await database()
      .prepare("UPDATE lessons SET title=?,completed=?,updated_at=? WHERE id=? AND owner_id=?")
      .bind(title, completed, now, current.id, user.id)
      .run();
    return {
      ok: true as const,
      lesson: present({ ...current, title, completed, updated_at: now }),
    };
  });
