ALTER TABLE lessons
ADD COLUMN part TEXT NOT NULL DEFAULT ''
CHECK (part IN ('', 'physics', 'chemistry'));

WITH
  owner AS (
    SELECT id
    FROM users
    WHERE singleton = 1
    LIMIT 1
  ),
  seed(part, title, sort_order) AS (
    VALUES
      ('physics', 'علم الفيزياء', 0),
      ('physics', 'الكميات الفيزيائية', 1),
      ('physics', 'الكميات الفيزيائية العددية والمتجهة', 2),
      ('physics', 'معادلات الحركة المتسارعة بانتظام في خط مستقيم', 3),
      ('physics', 'السقوط الحر', 4),
      ('chemistry', 'علم الكيمياء', 5),
      ('chemistry', 'تطور النماذج الذرية', 6),
      ('chemistry', 'أعداد الكم', 7),
      ('chemistry', 'قواعد الترتيب الإلكتروني في الذرات', 8),
      ('chemistry', 'تطبيقات على قواعد الترتيب الإلكتروني', 9),
      ('chemistry', 'تطور الجدول الدوري', 10),
      ('chemistry', 'الميول الدورية (التدرج في الخواص)', 11),
      ('chemistry', 'الترتيب الإلكتروني', 12),
      ('chemistry', 'الرابطة الأيونية', 13),
      ('chemistry', 'خواص المركبات الأيونية', 14),
      ('chemistry', 'الرابطة التساهمية', 15)
  )
INSERT INTO lessons (
  id,
  owner_id,
  subject,
  part,
  grade,
  title,
  completed,
  position,
  created_at,
  updated_at
)
SELECT
  lower(hex(randomblob(4))) || '-' ||
  lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-8' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6))),
  owner.id,
  'integrated',
  seed.part,
  10,
  seed.title,
  0,
  seed.sort_order,
  datetime('now'),
  datetime('now')
FROM seed
CROSS JOIN owner
WHERE NOT EXISTS (
  SELECT 1
  FROM lessons existing
  WHERE existing.owner_id = owner.id
    AND existing.subject = 'integrated'
    AND existing.grade = 10
    AND existing.title = seed.title
);
