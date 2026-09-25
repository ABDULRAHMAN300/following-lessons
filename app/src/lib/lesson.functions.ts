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
  hashRecoveryCode,
  isRateLimited,
  randomRecoveryCode,
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
const resetPasswordSchema = z.object({
  code: z.string().trim().min(1).max(64),
  password: z.string().min(10).max(128),
});
const subject = z.enum(["chemistry", "physics", "integrated"]);
const lessonPart = z.enum(["", "physics", "chemistry"]);
const lessonCreate = z.object({
  action: z.literal("create"),
  subject,
  grade: z.union([z.literal(10), z.literal(11), z.literal(12)]),
  title: z.string().trim().min(1).max(140),
  part: lessonPart.default(""),
});
const lessonUpdateShape = {
  action: z.literal("update") as z.ZodLiteral<"update">,
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(140).optional(),
  completed: z.boolean().optional(),
};
const lessonUpdate = z
  .object(lessonUpdateShape)
  .refine((v) => v.title !== undefined || v.completed !== undefined);
const lessonDelete = z.object({ action: z.literal("delete"), id: z.string().uuid() });
const lessonBulkCreate = z.object({
  action: z.literal("bulk_create"),
  subject,
  grade: z.union([z.literal(10), z.literal(11), z.literal(12)]),
  part: lessonPart.default(""),
  titles: z.array(z.string().trim().min(1).max(140)).min(1).max(100),
});
const lessonReorder = z.object({
  action: z.literal("reorder"),
  id: z.string().uuid(),
  direction: z.enum(["up", "down"]),
});
const lessonMutation = z.discriminatedUnion("action", [
  lessonCreate,
  lessonDelete,
  z.object(lessonUpdateShape),
  lessonBulkCreate,
  lessonReorder,
]);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const appearanceMutation = z.object({
  primaryColor: hexColor,
  accentColor: hexColor,
  backgroundColor: hexColor,
  chemistryColor: hexColor,
  physicsColor: hexColor,
  integratedColor: hexColor,
});

export type Lesson = {
  id: string;
  subject: "chemistry" | "physics" | "integrated";
  part: "" | "physics" | "chemistry";
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
        { hash, salt } = await hashPassword(password),
        recoveryCode = randomRecoveryCode(),
        recoveryCodeHash = await hashRecoveryCode(recoveryCode);
      try {
        await database()
          .prepare(
            "INSERT INTO users(id,singleton,email,password_hash,password_salt,recovery_code_hash) VALUES(?,1,?,?,?,?)",
          )
          .bind(id, email, hash, salt, recoveryCodeHash)
          .run();
      } catch {
        return { ok: false as const, error: "تم إنشاء الحساب الخاص بالفعل" };
      }
      const token = await createSession(id);
      setSessionCookies(token);
      await clearAuthFailures(request);
      return { ok: true as const, recoveryCode };
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

export const resetPassword = createServerFn({ method: "POST" })
  .validator(resetPasswordSchema)
  .handler(async ({ data }) => {
    const request = getRequest();
    if (await isRateLimited(request))
      return { ok: false as const, error: "محاولات كثيرة. حاول بعد 15 دقيقة" };
    const codeHash = await hashRecoveryCode(data.code);
    const user = await database()
      .prepare("SELECT id FROM users WHERE recovery_code_hash=?")
      .bind(codeHash)
      .first<{ id: string }>();
    if (!user) {
      await recordAuthFailure(request);
      return { ok: false as const, error: "رمز الاسترجاع غير صحيح" };
    }
    const { hash, salt } = await hashPassword(data.password);
    const newRecoveryCode = randomRecoveryCode();
    const newRecoveryCodeHash = await hashRecoveryCode(newRecoveryCode);
    await database()
      .prepare("UPDATE users SET password_hash=?,password_salt=?,recovery_code_hash=? WHERE id=?")
      .bind(hash, salt, newRecoveryCodeHash, user.id)
      .run();
    // A recovery reset can follow a lost/compromised device — drop every
    // existing session so the new password actually locks prior access out.
    await database().prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id).run();
    const token = await createSession(user.id);
    setSessionCookies(token);
    await clearAuthFailures(request);
    return { ok: true as const, recoveryCode: newRecoveryCode };
  });

export const generateRecoveryCode = createServerFn({ method: "POST" }).handler(async () => {
  const user = await getSessionUser(getRequest());
  if (!user) return { ok: false as const, code: "unauthorized" as const, error: "يلزم تسجيل الدخول" };
  const recoveryCode = randomRecoveryCode();
  const recoveryCodeHash = await hashRecoveryCode(recoveryCode);
  await database()
    .prepare("UPDATE users SET recovery_code_hash=? WHERE id=?")
    .bind(recoveryCodeHash, user.id)
    .run();
  return { ok: true as const, recoveryCode };
});

export const listLessons = createServerFn({ method: "GET" }).handler(async () => {
  const user = await getSessionUser(getRequest());
  if (!user) return { ok: false as const, code: "unauthorized" as const, lessons: [] as Lesson[] };
  const result = await database()
    .prepare(
      "SELECT id,subject,part,grade,title,completed,position,created_at,updated_at FROM lessons WHERE owner_id=? ORDER BY subject,grade,position,created_at",
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
      "SELECT primary_color AS primaryColor,accent_color AS accentColor,background_color AS backgroundColor,chemistry_color AS chemistryColor,physics_color AS physicsColor,integrated_color AS integratedColor FROM appearance_settings WHERE owner_id=?",
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
        "INSERT INTO appearance_settings(owner_id,primary_color,accent_color,background_color,chemistry_color,physics_color,integrated_color,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET primary_color=excluded.primary_color,accent_color=excluded.accent_color,background_color=excluded.background_color,chemistry_color=excluded.chemistry_color,physics_color=excluded.physics_color,integrated_color=excluded.integrated_color,updated_at=excluded.updated_at",
      )
      .bind(
        user.id,
        data.primaryColor,
        data.accentColor,
        data.backgroundColor,
        data.chemistryColor,
        data.physicsColor,
        data.integratedColor,
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
      const part = data.subject === "integrated" ? data.part : "";
      if (data.subject === "integrated" && !part)
        return { ok: false as const, error: "اختر جزء العلوم المتكاملة" };

      let position: number;
      let shift = false;
      if (data.subject === "integrated" && part === "physics") {
        const firstChemistry = await database()
          .prepare(
            "SELECT MIN(position) AS value FROM lessons WHERE owner_id=? AND subject='integrated' AND grade=? AND part='chemistry'",
          )
          .bind(user.id, data.grade)
          .first<{ value: number | null }>();
        if (firstChemistry?.value != null) {
          position = Number(firstChemistry.value);
          shift = true;
        } else {
          const next = await database()
            .prepare(
              "SELECT COALESCE(MAX(position),-1)+1 AS value FROM lessons WHERE owner_id=? AND subject=? AND grade=?",
            )
            .bind(user.id, data.subject, data.grade)
            .first<{ value: number }>();
          position = Number(next?.value ?? 0);
        }
      } else {
        const next = await database()
          .prepare(
            "SELECT COALESCE(MAX(position),-1)+1 AS value FROM lessons WHERE owner_id=? AND subject=? AND grade=?",
          )
          .bind(user.id, data.subject, data.grade)
          .first<{ value: number }>();
        position = Number(next?.value ?? 0);
      }

      const id = crypto.randomUUID(),
        now = new Date().toISOString();
      const insert = database()
        .prepare(
          "INSERT INTO lessons(id,owner_id,subject,part,grade,title,completed,position,created_at,updated_at) VALUES(?,?,?,?,?,?,0,?,?,?)",
        )
        .bind(id, user.id, data.subject, part, data.grade, data.title, position, now, now);
      if (shift) {
        await database().batch([
          database()
            .prepare(
              "UPDATE lessons SET position=position+1 WHERE owner_id=? AND subject='integrated' AND grade=? AND position>=?",
            )
            .bind(user.id, data.grade, position),
          insert,
        ]);
      } else {
        await insert.run();
      }
      return {
        ok: true as const,
        lesson: present({
          id,
          subject: data.subject,
          part,
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
    if (data.action === "bulk_create") {
      if (!validScope(data)) return { ok: false as const, error: "بيانات الدرس غير صالحة" };
      const part = data.subject === "integrated" ? data.part : "";
      if (data.subject === "integrated" && !part)
        return { ok: false as const, error: "اختر جزء العلوم المتكاملة" };
      const titles = data.titles.map((title) => title.trim()).filter((title) => title.length > 0);
      if (!titles.length) return { ok: false as const, error: "أدخل عنوان درس واحد على الأقل" };

      let startPosition: number;
      let shift = false;
      if (data.subject === "integrated" && part === "physics") {
        const firstChemistry = await database()
          .prepare(
            "SELECT MIN(position) AS value FROM lessons WHERE owner_id=? AND subject='integrated' AND grade=? AND part='chemistry'",
          )
          .bind(user.id, data.grade)
          .first<{ value: number | null }>();
        if (firstChemistry?.value != null) {
          startPosition = Number(firstChemistry.value);
          shift = true;
        } else {
          const next = await database()
            .prepare(
              "SELECT COALESCE(MAX(position),-1)+1 AS value FROM lessons WHERE owner_id=? AND subject=? AND grade=?",
            )
            .bind(user.id, data.subject, data.grade)
            .first<{ value: number }>();
          startPosition = Number(next?.value ?? 0);
        }
      } else {
        const next = await database()
          .prepare(
            "SELECT COALESCE(MAX(position),-1)+1 AS value FROM lessons WHERE owner_id=? AND subject=? AND grade=?",
          )
          .bind(user.id, data.subject, data.grade)
          .first<{ value: number }>();
        startPosition = Number(next?.value ?? 0);
      }

      const now = new Date().toISOString();
      const rows = titles.map((title, i) => ({
        id: crypto.randomUUID(),
        title,
        position: startPosition + i,
      }));
      const inserts = rows.map((row) =>
        database()
          .prepare(
            "INSERT INTO lessons(id,owner_id,subject,part,grade,title,completed,position,created_at,updated_at) VALUES(?,?,?,?,?,?,0,?,?,?)",
          )
          .bind(row.id, user.id, data.subject, part, data.grade, row.title, row.position, now, now),
      );
      if (shift) {
        await database().batch([
          database()
            .prepare(
              "UPDATE lessons SET position=position+? WHERE owner_id=? AND subject='integrated' AND grade=? AND position>=?",
            )
            .bind(titles.length, user.id, data.grade, startPosition),
          ...inserts,
        ]);
      } else {
        await database().batch(inserts);
      }
      return {
        ok: true as const,
        lessons: rows.map((row) =>
          present({
            id: row.id,
            subject: data.subject,
            part,
            grade: data.grade,
            title: row.title,
            completed: 0,
            position: row.position,
            created_at: now,
            updated_at: now,
          }),
        ),
      };
    }
    if (data.action === "reorder") {
      const current = await database()
        .prepare("SELECT id,subject,part,grade,position FROM lessons WHERE id=? AND owner_id=?")
        .bind(data.id, user.id)
        .first<{ id: string; subject: string; part: string; grade: number; position: number }>();
      if (!current) return { ok: false as const, error: "الدرس غير موجود" };
      const neighbor = await database()
        .prepare(
          data.direction === "up"
            ? "SELECT id,position FROM lessons WHERE owner_id=? AND subject=? AND grade=? AND part=? AND position<? ORDER BY position DESC,created_at DESC LIMIT 1"
            : "SELECT id,position FROM lessons WHERE owner_id=? AND subject=? AND grade=? AND part=? AND position>? ORDER BY position ASC,created_at ASC LIMIT 1",
        )
        .bind(user.id, current.subject, current.grade, current.part, current.position)
        .first<{ id: string; position: number }>();
      if (!neighbor) return { ok: true as const, lessons: [] as Lesson[] };
      const now = new Date().toISOString();
      await database().batch([
        database()
          .prepare("UPDATE lessons SET position=?,updated_at=? WHERE id=? AND owner_id=?")
          .bind(neighbor.position, now, current.id, user.id),
        database()
          .prepare("UPDATE lessons SET position=?,updated_at=? WHERE id=? AND owner_id=?")
          .bind(current.position, now, neighbor.id, user.id),
      ]);
      const updated = await database()
        .prepare(
          "SELECT id,subject,part,grade,title,completed,position,created_at,updated_at FROM lessons WHERE owner_id=? AND id IN (?,?)",
        )
        .bind(user.id, current.id, neighbor.id)
        .all<Row>();
      return { ok: true as const, lessons: (updated.results ?? []).map(present) };
    }
    const parsed = lessonUpdate.safeParse(data);
    if (!parsed.success) return { ok: false as const, error: "تعذر تحديث الدرس" };
    const current = await database()
      .prepare(
        "SELECT id,subject,part,grade,title,completed,position,created_at,updated_at FROM lessons WHERE id=? AND owner_id=?",
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
