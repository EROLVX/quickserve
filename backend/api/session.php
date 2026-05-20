<?php
// api/session.php
// Include this at the top of any protected page
session_start();

if (!isset($_SESSION['user_id'])) {
    header('Content-Type: application/json');
    echo json_encode(['success'=>false, 'message'=>'Unauthorized', 'redirect'=>'login.html']);
    exit;
}

$user = [
    'id'        => $_SESSION['user_id'],
    'username'  => $_SESSION['username'],
    'full_name' => $_SESSION['full_name'],
    'email'     => $_SESSION['email'],
    'role'      => $_SESSION['role']
];