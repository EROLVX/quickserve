<?php
/**
 * users.php — QuickServe User Management API
 * Provides CRUD for admin account management.
 * 
 * Methods:
 *   GET    → List all users (admin only)
 *   POST   → Create user (admin only)
 *   PUT    → Update user (admin only)
 *   DELETE → Delete user (admin only)
 */

session_start();
header('Content-Type: application/json');
require_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

// ── Admin Authorization Guard ───────────────────────────────
if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

// ── GET: List Users ─────────────────────────────────────────
if ($method === 'GET') {
    $stmt = $pdo->query("
        SELECT id, username, full_name, email, role, status, created_at 
        FROM users 
        ORDER BY created_at DESC
    ");
    echo json_encode(['success' => true, 'users' => $stmt->fetchAll()]);
    exit;
}

// ── POST: Create User ───────────────────────────────────────
if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $username = trim($data['username'] ?? '');
    $fullName = trim($data['full_name'] ?? '');
    $email    = trim($data['email'] ?? '');
    $password = $data['password'] ?? '';
    $role     = $data['role'] ?? 'customer';
    $status   = $data['status'] ?? 'active';
    
    // Validate required fields
    if (empty($username) || empty($fullName) || empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Username, full name, email and password are required']);
        exit;
    }
    
    // Validate role
    $validRoles = ['admin', 'staff', 'customer'];
    if (!in_array($role, $validRoles)) {
        echo json_encode(['success' => false, 'message' => 'Invalid role']);
        exit;
    }
    
    $hash = password_hash($password, PASSWORD_DEFAULT);
    
    $stmt = $pdo->prepare("
        INSERT INTO users (username, full_name, email, password, role, status) 
        VALUES (?, ?, ?, ?, ?, ?)
    ");
    
    try {
        $stmt->execute([$username, $fullName, $email, $hash, $role, $status]);
        echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            echo json_encode(['success' => false, 'message' => 'Username or email already exists']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
        }
    }
    exit;
}

// ── PUT: Update User ────────────────────────────────────────
if ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    $id = intval($data['id'] ?? 0);
    $fullName = trim($data['full_name'] ?? '');
    $email    = trim($data['email'] ?? '');
    $role     = $data['role'] ?? 'customer';
    $status   = $data['status'] ?? 'active';
    
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid user ID']);
        exit;
    }
    
    // Build dynamic update query
    $fields = ["full_name = ?", "email = ?", "role = ?", "status = ?"];
    $params = [$fullName, $email, $role, $status];
    
    // Only update password if provided
    if (!empty($data['password'])) {
        $fields[] = "password = ?";
        $params[] = password_hash($data['password'], PASSWORD_DEFAULT);
    }
    
    $params[] = $id;
    $sql = "UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?";
    $stmt = $pdo->prepare($sql);
    
    try {
        $stmt->execute($params);
        echo json_encode(['success' => true]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            echo json_encode(['success' => false, 'message' => 'Email already in use']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Database error']);
        }
    }
    exit;
}

// ── DELETE: Delete User ─────────────────────────────────────
if ($method === 'DELETE') {
    $id = intval($_GET['id'] ?? 0);
    
    if ($id <= 0) {
        echo json_encode(['success' => false, 'message' => 'Invalid user ID']);
        exit;
    }
    
    // Prevent admin from deleting their own account
    if (isset($_SESSION['user_id']) && $id == $_SESSION['user_id']) {
        echo json_encode(['success' => false, 'message' => 'You cannot delete your own account']);
        exit;
    }
    
    $stmt = $pdo->prepare("DELETE FROM users WHERE id = ?");
    $stmt->execute([$id]);
    
    echo json_encode(['success' => true]);
    exit;
}

// ── Fallback ────────────────────────────────────────────────
echo json_encode(['success' => false, 'message' => 'Method not allowed']);