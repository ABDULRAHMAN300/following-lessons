WITH
  owner AS (
    SELECT id
    FROM users
    WHERE singleton = 1
    LIMIT 1
  ),
  seed(grade, title, sort_order) AS (
    VALUES
      (10, 'معادلات الحركة المتسارعة بانتظام في خط مستقيم', 1),
      (10, 'السقوط الحر', 2),
      (10, 'خصائص المتجهات', 3),
      (10, 'جمع المتجهات وتحليلها', 4),
      (10, 'ضرب المتجهات', 5),
      (10, 'حركة المقذوفات', 6),
      (11, 'الكميات العددية والكميات المتجهة', 1),
      (11, 'تحليل المتجهات', 2),
      (11, 'حركة القذيفة', 3),
      (11, 'وصف الحركة الدائرية', 4),
      (11, 'القوة الجاذبة المركزية', 5),
      (11, 'القوة الطاردة المركزية', 6),
      (11, 'مركز الثقل', 7),
      (11, 'مركز الكتلة', 8),
      (11, 'تحديد موضع مركز الكتلة أو مركز الثقل', 9),
      (11, 'انقلاب الأجسام', 10),
      (11, 'الاتزان (الثبات)', 11),
      (11, 'مركز ثقل جسم الإنسان', 12),
      (12, 'الشغل', 1),
      (12, 'الشغل والطاقة', 2),
      (12, 'حفظ (بقاء) الطاقة', 3),
      (12, 'عزم الدوران (عزم القوة)', 4),
      (12, 'القصور الذاتي الدوراني', 5),
      (12, 'كمية الحركة والدفع', 6),
      (12, 'حفظ (بقاء) كمية الحركة والتصادمات', 7)
  )
INSERT INTO lessons (
  id,
  owner_id,
  subject,
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
  'physics',
  seed.grade,
  seed.title,
  0,
  (
    SELECT COALESCE(MAX(existing_position.position), -1)
    FROM lessons existing_position
    WHERE existing_position.owner_id = owner.id
      AND existing_position.subject = 'physics'
      AND existing_position.grade = seed.grade
  ) + seed.sort_order,
  datetime('now'),
  datetime('now')
FROM seed
CROSS JOIN owner
WHERE NOT EXISTS (
  SELECT 1
  FROM lessons existing
  WHERE existing.owner_id = owner.id
    AND existing.subject = 'physics'
    AND existing.grade = seed.grade
    AND existing.title = seed.title
);
