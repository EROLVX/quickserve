-- QuickServe Database
-- Import this via phpMyAdmin

CREATE DATABASE IF NOT EXISTS quickserve CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE quickserve;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','staff') DEFAULT 'staff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image_url VARCHAR(255) DEFAULT NULL,
    status ENUM('available','unavailable') DEFAULT 'available',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(20) NOT NULL UNIQUE,
    customer_name VARCHAR(100) DEFAULT 'Guest',
    order_type ENUM('dine_in','take_out') NOT NULL,
    status ENUM('pending','preparing','ready','completed','cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_created (created_at)
);

CREATE TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    payment_method ENUM('cash','card','gcash') DEFAULT 'cash',
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending','paid','failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    message TEXT NOT NULL,
    type ENUM('status_update','ready','general') DEFAULT 'general',
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE queue_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Default admin (password: password)
INSERT INTO users (username, password, role) VALUES 
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

-- Sample categories
INSERT INTO categories (name, description) VALUES
('Rice Meals', 'Hearty rice-based meals'),
('Noodles', 'Delicious noodle dishes'),
('Snacks', 'Light bites and sides'),
('Drinks', 'Beverages and refreshments');

-- Sample products
INSERT INTO products (category_id, name, description, price, status) VALUES
(1, 'Chicken Adobo', 'Classic Filipino chicken adobo with rice', 85.00, 'available'),
(1, 'Pork Sinigang', 'Sour tamarind soup with pork and vegetables', 90.00, 'available'),
(1, 'Beef Steak', 'Bistek Tagalog with onions and calamansi', 95.00, 'available'),
(2, 'Pancit Canton', 'Stir-fried egg noodles with vegetables', 70.00, 'available'),
(2, 'Spaghetti', 'Filipino-style sweet spaghetti', 65.00, 'available'),
(3, 'Lumpiang Shanghai', 'Crispy fried spring rolls', 50.00, 'available'),
(3, 'French Fries', 'Crispy golden fries', 45.00, 'available'),
(4, 'Iced Tea', 'Refreshing house blend iced tea', 35.00, 'available'),
(4, 'Bottled Water', '500ml purified water', 20.00, 'available'),
(4, 'Softdrink', 'Canned soda', 30.00, 'available');

-- Add reservation status to orders
ALTER TABLE orders MODIFY COLUMN status ENUM('pending','preparing','ready','completed','cancelled','reserved','approved','rejected') DEFAULT 'pending';

-- Add reservation fields
ALTER TABLE orders ADD COLUMN reservation_date DATE NULL AFTER order_type;
ALTER TABLE orders ADD COLUMN reservation_time TIME NULL AFTER reservation_date;
ALTER TABLE orders ADD COLUMN downpayment_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount;
ALTER TABLE orders ADD COLUMN downpayment_paid DECIMAL(10,2) DEFAULT 0.00 AFTER downpayment_amount;
ALTER TABLE orders ADD COLUMN admin_notes TEXT NULL AFTER downpayment_paid;

-- Update payments table to track downpayments
ALTER TABLE payments ADD COLUMN payment_type ENUM('downpayment','full') DEFAULT 'full'; 

-- ============================================================
-- QUICKSERVE DATABASE UPDATES (Clean XAMPP Version)
-- Run this in phpMyAdmin after your original schema
-- ============================================================

USE quickserve;

-- 1. UPDATE users table
ALTER TABLE users 
  MODIFY COLUMN role ENUM('admin','staff','customer') DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS email VARCHAR(100) NULL UNIQUE AFTER username,
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(100) NULL AFTER email,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NULL AFTER full_name,
  ADD COLUMN IF NOT EXISTS status ENUM('active','inactive') DEFAULT 'active' AFTER role;

-- 2. UPDATE orders: add 'reservation' to existing order_type
ALTER TABLE orders 
  MODIFY COLUMN order_type ENUM('dine_in','take_out','reservation') NOT NULL DEFAULT 'dine_in';

-- 3. ADD new columns to orders
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER id,
  ADD COLUMN IF NOT EXISTS customer_email VARCHAR(100) NULL AFTER customer_name,
  ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20) NULL AFTER customer_email;

-- 4. ADD foreign key (clean MariaDB syntax)
ALTER TABLE orders DROP FOREIGN KEY IF EXISTS fk_orders_user;
ALTER TABLE orders 
  ADD CONSTRAINT fk_orders_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- 5. Session tokens table
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    session_token VARCHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 7. Demo accounts (password = "password")
INSERT IGNORE INTO users (username, email, password, role, full_name, status) VALUES 
('customer1', 'customer@demo.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'customer', 'Juan Dela Cruz', 'active'),
('staff1', 'staff@demo.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'staff', 'Staff Member', 'active');

-- 8. Optional: sample product images
UPDATE IGNORE products SET image_url = 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400' WHERE name = 'Chicken Adobo';
UPDATE IGNORE products SET image_url = 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400' WHERE name = 'Pork Sinigang';
UPDATE IGNORE products SET image_url = 'https://images.unsplash.com/photo-1432139509613-5c4258d4d8f4?w=400' WHERE name = 'Beef Steak';


-- QuickServe Database Fix
-- Run this in phpMyAdmin to ensure user_id is properly set up
-- Safe to run even if columns already exist

USE quickserve;

-- Ensure user_id column exists in orders
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS user_id INT NULL AFTER id;

-- Add foreign key if not exists (safe ignore)
ALTER TABLE orders DROP FOREIGN KEY IF EXISTS fk_orders_user;
ALTER TABLE orders 
  ADD CONSTRAINT fk_orders_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Ensure full_name and email exist on users
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS email VARCHAR(100) NULL UNIQUE AFTER username,
  ADD COLUMN IF NOT EXISTS full_name VARCHAR(100) NULL AFTER email,
  ADD COLUMN IF NOT EXISTS status ENUM('active','inactive') DEFAULT 'active' AFTER role;

-- Ensure role includes customer
ALTER TABLE users 
  MODIFY COLUMN role ENUM('admin','staff','customer') DEFAULT 'customer';

-- Ensure orders status includes reservation statuses
ALTER TABLE orders MODIFY COLUMN status 
  ENUM('pending','preparing','ready','completed','cancelled','reserved','approved','rejected') 
  DEFAULT 'pending';

-- Ensure reservation columns exist
ALTER TABLE orders 
  ADD COLUMN IF NOT EXISTS reservation_date DATE NULL AFTER order_type,
  ADD COLUMN IF NOT EXISTS reservation_time TIME NULL AFTER reservation_date,
  ADD COLUMN IF NOT EXISTS downpayment_amount DECIMAL(10,2) DEFAULT 0.00 AFTER total_amount,
  ADD COLUMN IF NOT EXISTS downpayment_paid DECIMAL(10,2) DEFAULT 0.00 AFTER downpayment_amount,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT NULL AFTER downpayment_paid;

-- Ensure order_type includes reservation
ALTER TABLE orders 
  MODIFY COLUMN order_type ENUM('dine_in','take_out','reservation') NOT NULL DEFAULT 'dine_in';

-- Activity logs (for admin auth tracking)
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Demo admin account (password: password) - safe to run, IGNORE if exists
INSERT IGNORE INTO users (username, email, full_name, password, role, status) VALUES 
('admin1', 'admin@quickserve.com', 'Admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'active');