<?php
// ============================================================
// register.php — QuickServe User Registration
// Handles new customer account creation
// Endpoint: POST /backend/api/register.php
// ============================================================

session_start();
header('Content-Type: application/json');
require_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

/**
 * POST /register.php
 * Creates a new customer account with validation
 * Request body: { full_name, username, email, password, phone }
 * Response: { success: true/false, message, user: { id, username, full_name, email, role } }
 */
if ($method === 'POST') {
    // Parse JSON input from frontend
    $data = json_decode(file_get_contents('php://input'), true);

    // Extract and trim form fields
    $full_name = trim($data['full_name'] ?? '');
    $username  = trim($data['username'] ?? '');
    $email     = trim($data['email'] ?? '');
    $password  = $data['password'] ?? '';
    $phone     = trim($data['phone'] ?? '');

    // Validate required fields are not empty
    if (empty($full_name) || empty($username) || empty($email) || empty($password)) {
        echo json_encode(['success' => false, 'message' => 'Please fill in all required fields']);
        exit;
    }

    // Validate password minimum length (6 characters)
    if (strlen($password) < 6) {
        echo json_encode(['success' => false, 'message' => 'Password must be at least 6 characters']);
        exit;
    }

    // Check if username or email already exists in database
    $check = $pdo->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
    $check->execute([$username, $email]);
    if ($check->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Username or email already exists']);
        exit;
    }

    // Hash password using bcrypt for secure storage
    $hash = password_hash($password, PASSWORD_DEFAULT);

    try {
        // Insert new user with 'customer' role (default for registrations)
        $stmt = $pdo->prepare("INSERT INTO users (username, email, password, role, full_name, phone, status) VALUES (?, ?, ?, 'customer', ?, ?, 'active')");
        $stmt->execute([$username, $email, $hash, $full_name, $phone]);
        $newId = $pdo->lastInsertId();

        // Auto-login after successful registration (set PHP session)
        $_SESSION['user_id']    = $newId;
        $_SESSION['username']   = $username;
        $_SESSION['full_name']  = $full_name;
        $_SESSION['email']      = $email;
        $_SESSION['role']       = 'customer';

        // Return success with user data for frontend
        echo json_encode([
            'success' => true,
            'message' => 'Account created successfully',
            'user'    => [
                'id'        => $newId,
                'username'  => $username,
                'full_name' => $full_name,
                'email'     => $email,
                'role'      => 'customer'
            ]
        ]);
    } catch (PDOException $e) {
        // Catch database errors (duplicate keys, connection issues, etc.)
        echo json_encode(['success' => false, 'message' => 'Registration failed. Please try again.']);
    }
    exit;
}

// Reject any non-POST requests
echo json_encode(['success' => false, 'message' => 'Method not allowed']);