ALTER TABLE appearance_settings ADD COLUMN chemistry_color TEXT NOT NULL DEFAULT '#d95d6a' CHECK(length(chemistry_color) = 7 AND substr(chemistry_color, 1, 1) = '#');
ALTER TABLE appearance_settings ADD COLUMN physics_color TEXT NOT NULL DEFAULT '#3f73c7' CHECK(length(physics_color) = 7 AND substr(physics_color, 1, 1) = '#');
ALTER TABLE appearance_settings ADD COLUMN integrated_color TEXT NOT NULL DEFAULT '#3f8f68' CHECK(length(integrated_color) = 7 AND substr(integrated_color, 1, 1) = '#');
