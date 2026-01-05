-- Create database and tables
CREATE DATABASE IF NOT EXISTS counseling;
USE counseling;

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150),
  email VARCHAR(150) UNIQUE,
  password VARCHAR(255),
  phone VARCHAR(50),
  highschool_marks_json TEXT,
  plus2_marks_json TEXT,
  branch_choice1 VARCHAR(100),
  branch_choice2 VARCHAR(100),
  allocated_branch VARCHAR(100),
  allocated_by_admin INT,
  accepted_allocation TINYINT DEFAULT 0,
  payment_receipt VARCHAR(255),
  payment_verified TINYINT DEFAULT 0,
  offer_generated TINYINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150),
  email VARCHAR(150) UNIQUE,
  password VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
