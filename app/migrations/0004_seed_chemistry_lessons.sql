WITH
  owner AS (
    SELECT id
    FROM users
    WHERE singleton = 1
    LIMIT 1
  ),
  seed(grade, title, sort_order) AS (
    VALUES
      (10, 'قواعد الترتيب الإلكتروني في الذرات', 1),
      (10, 'تطبيقات على قواعد الترتيب الإلكتروني', 2),
      (10, 'تطور الجدول الدوري', 3),
      (10, 'تقسيم العناصر', 4),
      (10, 'الميول الدورية (التدرج في الخواص)', 5),
      (10, 'الترتيب الإلكتروني', 6),
      (10, 'الرابطة الأيونية والمركبات الأيونية', 7),
      (10, 'خواص المركبات الأيونية', 8),
      (10, 'الرابطة التساهمية والمركبات التساهمية', 9),
      (10, 'خواص المركبات التساهمية', 10),
      (10, 'الرابطة التناسقية', 11),
      (11, 'الماء كمذيب قوي', 1),
      (11, 'المحاليل المائية', 2),
      (11, 'الأنظمة المائية غير المتجانسة', 3),
      (11, 'التفاعلات في المحاليل المائية', 4),
      (11, 'العوامل المؤثرة على الذوبانية في المحاليل', 5),
      (11, 'تركيب المحاليل', 6),
      (11, 'الحسابات المتعلقة بالخواص المجمعة للمحاليل', 7),
      (11, 'التغيرات الحرارية', 8),
      (12, 'الغازات المثالية', 1),
      (12, 'سرعة التفاعل', 2),
      (12, 'التفاعلات العكسية والاتزان الكيميائي', 3),
      (12, 'تحديد إمكانية حدوث تفاعل ما', 4),
      (12, 'وصف الأحماض والقواعد', 5),
      (12, 'تسمية الأحماض والقواعد', 6),
      (12, 'كاتيونات الهيدروجين والحموضة', 7),
      (12, 'قوة الأحماض والقواعد', 8)
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
  'chemistry',
  seed.grade,
  seed.title,
  0,
  (
    SELECT COALESCE(MAX(existing_position.position), -1)
    FROM lessons existing_position
    WHERE existing_position.owner_id = owner.id
      AND existing_position.subject = 'chemistry'
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
    AND existing.subject = 'chemistry'
    AND existing.grade = seed.grade
    AND existing.title = seed.title
);
