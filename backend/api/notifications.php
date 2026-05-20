<?php
session_start();
header('Content-Type: application/json');
require_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $orderId = $_GET['order_id'] ?? null;
    if ($orderId) {
        $stmt = $pdo->prepare("SELECT * FROM notifications WHERE order_id = ? ORDER BY created_at DESC");
        $stmt->execute([$orderId]);
    } else {
        $stmt = $pdo->query("SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50");
    }
    echo json_encode(['success' => true, 'notifications' => $stmt->fetchAll()]);
}
elseif ($method === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $id = $data['id'] ?? 0;
    $stmt = $pdo->prepare("UPDATE notifications SET is_read = 1 WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['success' => true]);
}
?>