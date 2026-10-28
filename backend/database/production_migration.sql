-- ============================================================
-- Crop Recommendation System - MySQL Database Schema
-- ============================================================

CREATE DATABASE IF NOT EXISTS crop_recommendation_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE crop_recommendation_db;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  state VARCHAR(100),
  district VARCHAR(100),
  village VARCHAR(100),
  preferred_language VARCHAR(30) DEFAULT 'English',
  role ENUM('user','admin') DEFAULT 'user',
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_email (email),
  INDEX idx_status (status)
);

-- ============================================================
-- ADMINS (separate table for security)
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','superadmin') DEFAULT 'admin',
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- FARMS
-- ============================================================
CREATE TABLE IF NOT EXISTS farms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  farm_name VARCHAR(150) NOT NULL,
  area DECIMAL(10,2),
  area_unit ENUM('acres','hectares','bigha','guntha') DEFAULT 'acres',
  soil_type VARCHAR(80),
  irrigation_type VARCHAR(80),
  state VARCHAR(100),
  district VARCHAR(100),
  village VARCHAR(100),
  latitude DECIMAL(10,6),
  longitude DECIMAL(10,6),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id)
);

-- ============================================================
-- SOIL RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS soil_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  farm_id INT NOT NULL,
  nitrogen DECIMAL(8,2) COMMENT 'kg/ha',
  phosphorus DECIMAL(8,2) COMMENT 'kg/ha',
  potassium DECIMAL(8,2) COMMENT 'kg/ha',
  ph DECIMAL(4,2),
  moisture DECIMAL(6,2) COMMENT 'percent',
  organic_carbon DECIMAL(6,3) COMMENT 'percent',
  ec DECIMAL(6,3) COMMENT 'dS/m',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
  INDEX idx_farm_id (farm_id)
);

-- ============================================================
-- SOIL IMAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS soil_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  farm_id INT NOT NULL,
  user_id INT NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255),
  file_type VARCHAR(50),
  file_size INT COMMENT 'bytes',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================================
-- CROP HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS crop_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  farm_id INT NOT NULL,
  crop_name VARCHAR(100) NOT NULL,
  season ENUM('Kharif','Rabi','Zaid','Year-round') NOT NULL,
  year INT NOT NULL,
  yield_amount DECIMAL(10,2),
  yield_unit VARCHAR(20) DEFAULT 'quintals',
  area_cultivated DECIMAL(10,2),
  irrigation_used VARCHAR(100),
  fertilizer_info TEXT,
  crop_performance ENUM('Poor','Average','Good','Excellent'),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
  INDEX idx_farm_id (farm_id)
);

-- ============================================================
-- WEATHER RECORDS (snapshot stored with recommendation)
-- ============================================================
CREATE TABLE IF NOT EXISTS weather_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  latitude DECIMAL(10,6),
  longitude DECIMAL(10,6),
  state VARCHAR(100),
  district VARCHAR(100),
  temperature DECIMAL(5,2),
  humidity DECIMAL(5,2),
  rainfall DECIMAL(7,2),
  wind_speed DECIMAL(5,2),
  forecast_json JSON,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MARKET PRICES (loaded from CSV)
-- ============================================================
CREATE TABLE IF NOT EXISTS market_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  state VARCHAR(100),
  district VARCHAR(100),
  market VARCHAR(150),
  commodity VARCHAR(150),
  variety VARCHAR(100),
  grade VARCHAR(50),
  arrival_date DATE,
  min_price DECIMAL(10,2),
  max_price DECIMAL(10,2),
  modal_price DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_state (state),
  INDEX idx_commodity (commodity),
  INDEX idx_district (district),
  INDEX idx_arrival_date (arrival_date)
);

-- ============================================================
-- MODEL VERSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS model_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model_name VARCHAR(100) NOT NULL,
  version VARCHAR(50) NOT NULL,
  training_date DATE,
  dataset_name VARCHAR(200),
  num_records INT,
  features_used JSON,
  metrics JSON,
  model_file_path VARCHAR(500),
  status ENUM('active','archived','training') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- RECOMMENDATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  farm_id INT NOT NULL,
  soil_record_id INT,
  weather_record_id INT,
  model_version_id INT,
  recommended_crop VARCHAR(100) NOT NULL,
  model_confidence DECIMAL(5,2) COMMENT 'percentage 0-100',
  weather_snapshot JSON,
  market_snapshot JSON,
  input_features JSON,
  season VARCHAR(50),
  status ENUM('saved','deleted') DEFAULT 'saved',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
  FOREIGN KEY (soil_record_id) REFERENCES soil_records(id) ON DELETE SET NULL,
  FOREIGN KEY (model_version_id) REFERENCES model_versions(id) ON DELETE SET NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);

-- ============================================================
-- RECOMMENDATION ALTERNATIVES
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendation_alternatives (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recommendation_id INT NOT NULL,
  crop_name VARCHAR(100) NOT NULL,
  score DECIMAL(5,4) COMMENT '0.0 to 1.0 probability',
  rank_position TINYINT NOT NULL,
  FOREIGN KEY (recommendation_id) REFERENCES recommendations(id) ON DELETE CASCADE,
  INDEX idx_recommendation_id (recommendation_id)
);

-- ============================================================
-- SHAP EXPLANATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS shap_explanations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recommendation_id INT NOT NULL,
  feature_name VARCHAR(100) NOT NULL,
  shap_value DECIMAL(10,6) NOT NULL,
  feature_value DECIMAL(12,4),
  impact_direction ENUM('positive','negative','neutral') DEFAULT 'neutral',
  FOREIGN KEY (recommendation_id) REFERENCES recommendations(id) ON DELETE CASCADE,
  INDEX idx_recommendation_id (recommendation_id)
);

-- ============================================================
-- ACTIVITY LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  admin_id INT,
  action VARCHAR(200) NOT NULL,
  entity_type VARCHAR(50),
  entity_id INT,
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at)
);


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
