<?php
session_start();
header('Content-Type: application/json');
require_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $username = trim($data['username'] ?? '');
    $password = $data['password'] ?? '';

    if (empty($username) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Username and password are required']);
        exit;
    }

    // Allow login with username OR email
    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? OR email = ?");
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password'])) {
        // Check status only if the column exists (safe for older DB schemas)
        $userStatus = $user['status'] ?? 'active';
        if ($userStatus !== 'active') {
            echo json_encode(['success' => false, 'message' => 'Account is inactive. Contact admin.']);
            exit;
        }
        $_SESSION['user_id']    = $user['id'];
        $_SESSION['username']   = $user['username'];
        $_SESSION['full_name']  = $user['full_name'];
        $_SESSION['email']      = $user['email'];
        $_SESSION['role']      = $user['role'];

        echo json_encode([
            'success' => true,
            'user'    => [
                'id'        => $user['id'],
                'username'  => $user['username'],
                'full_name' => $user['full_name'],
                'email'     => $user['email'],
                'role'      => $user['role']
            ]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid username or password']);
    }
} elseif ($method === 'GET') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'success' => true,
            'user'    => [
                'id'        => $_SESSION['user_id'],
                'username'  => $_SESSION['username'],
                'full_name' => $_SESSION['full_name'] ?? null,
                'email'     => $_SESSION['email'] ?? null,
                'role'      => $_SESSION['role']
            ]
        ]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
}