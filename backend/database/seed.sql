-- ============================================================
-- Seed Script - Admin + sample model version
-- ============================================================
USE crop_recommendation_db;

-- Default Admin Account
-- Password: Admin@123 (bcrypt hash)
INSERT IGNORE INTO admins (name, email, password_hash, role, status)
VALUES (
  'System Admin',
  'admin@cropai.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGEqR8UqjLKGGYOkf5p0.rF8a9i',
  'superadmin',
  'active'
);

-- Default Model Version (before training)
INSERT IGNORE INTO model_versions (model_name, version, status, features_used, metrics)
VALUES (
  'Ensemble (RF + XGBoost + LightGBM)',
  'v1.0-pending',
  'training',
  '["N","P","K","temperature","humidity","ph","rainfall"]',
  NULL
);

SELECT 'Database seeded successfully.' AS message;
SELECT 'Admin login: admin@cropai.com / Admin@123' AS info;
