<?php
// api/auth.php
// Simple authentication API for QuickServe
session_start();
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// DB config — adjust for your XAMPP
$host = 'localhost';
$db   = 'quickserve';
$user = 'root';
$pass = '';          // default XAMPP password is empty
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
    http_response_code(500);
    echo json_encode(['success'=>false, 'message'=>'Database connection failed']);
    exit;
}

$action = $_GET['action'] ?? '';

// ── LOGIN ────────────────────────────────────────────────────
if ($action === 'login') {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = trim($input['username'] ?? '');
    $password = $input['password'] ?? '';

    if (!$username || !$password) {
        echo json_encode(['success'=>false, 'message'=>'Please fill in all fields']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT id, username, full_name, email, role, password, status FROM users WHERE username=? OR email=? LIMIT 1");
    $stmt->execute([$username, $username]);
    $user = $stmt->fetch();

    if (!$user) {
        echo json_encode(['success'=>false, 'message'=>'Account not found']);
        exit;
    }

    if ($user['status'] !== 'active') {
        echo json_encode(['success'=>false, 'message'=>'Account is inactive']);
        exit;
    }

    if (!password_verify($password, $user['password'])) {
        echo json_encode(['success'=>false, 'message'=>'Wrong password']);
        exit;
    }

    // Set session
    $_SESSION['user_id']    = $user['id'];
    $_SESSION['username']   = $user['username'];
    $_SESSION['full_name']  = $user['full_name'];
    $_SESSION['email']      = $user['email'];
    $_SESSION['role']       = $user['role'];

    // Log activity
    $pdo->prepare("INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, 'login', ?, ?)")
        ->execute([$user['id'], 'User logged in', $_SERVER['REMOTE_ADDR'] ?? '']);

    echo json_encode([
        'success'   => true,
        'message'   => 'Login successful',
        'user'      => [
            'id'        => $user['id'],
            'username'  => $user['username'],
            'full_name' => $user['full_name'],
            'email'     => $user['email'],
            'role'      => $user['role']
        ]
    ]);
    exit;
}

// ── REGISTER (Customer only) ─────────────────────────────────
if ($action === 'register') {
    $input = json_decode(file_get_contents('php://input'), true);
    $full_name = trim($input['full_name'] ?? '');
    $username  = trim($input['username'] ?? '');
    $email     = trim($input['email'] ?? '');
    $password  = $input['password'] ?? '';
    $phone     = trim($input['phone'] ?? '');

    if (!$full_name || !$username || !$email || !$password) {
        echo json_encode(['success'=>false, 'message'=>'Please fill in all required fields']);
        exit;
    }

    if (strlen($password) < 6) {
        echo json_encode(['success'=>false, 'message'=>'Password must be at least 6 characters']);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    try {
        $stmt = $pdo->prepare("INSERT INTO users (username, email, password, role, full_name, phone, status) VALUES (?, ?, ?, 'customer', ?, ?, 'active')");
        $stmt->execute([$username, $email, $hash, $full_name, $phone]);
        $newId = $pdo->lastInsertId();

        $_SESSION['user_id']   = $newId;
        $_SESSION['username']  = $username;
        $_SESSION['full_name'] = $full_name;
        $_SESSION['email']     = $email;
        $_SESSION['role']      = 'customer';

        echo json_encode([
            'success' => true,
            'message' => 'Account created! Welcome to QuickServe.',
            'user'    => [
                'id'        => $newId,
                'username'  => $username,
                'full_name' => $full_name,
                'email'     => $email,
                'role'      => 'customer'
            ]
        ]);
    } catch (PDOException $e) {
        if ($e->getCode() == 23000) {
            echo json_encode(['success'=>false, 'message'=>'Username or email already exists']);
        } else {
            echo json_encode(['success'=>false, 'message'=>'Registration failed. Please try again.']);
        }
    }
    exit;
}

// ── CHECK SESSION ────────────────────────────────────────────
if ($action === 'me') {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'success' => true,
            'user'    => [
                'id'        => $_SESSION['user_id'],
                'username'  => $_SESSION['username'],
                'full_name' => $_SESSION['full_name'],
                'email'     => $_SESSION['email'],
                'role'      => $_SESSION['role']
            ]
        ]);
    } else {
        echo json_encode(['success'=>false, 'message'=>'Not logged in']);
    }
    exit;
}

// ── LOGOUT ───────────────────────────────────────────────────
if ($action === 'logout') {
    if (isset($_SESSION['user_id'])) {
        $pdo->prepare("INSERT INTO activity_logs (user_id, action, details, ip_address) VALUES (?, 'logout', ?, ?)")
            ->execute([$_SESSION['user_id'], 'User logged out', $_SERVER['REMOTE_ADDR'] ?? '']);
    }
    session_destroy();
    echo json_encode(['success'=>true, 'message'=>'Logged out successfully']);
    exit;
}

// ── DEFAULT ──────────────────────────────────────────────────
echo json_encode(['success'=>false, 'message'=>'Invalid action']);