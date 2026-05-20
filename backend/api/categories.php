<?php
session_start();
header('Content-Type: application/json');
require_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $pdo->query("SELECT * FROM categories ORDER BY name");
    echo json_encode(['success' => true, 'categories' => $stmt->fetchAll()]);
} elseif ($method === 'POST') {
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        echo json_encode(['success' => false, 'message' => 'Unauthorized']);
        exit;
    }
    $data = json_decode(file_get_contents('php://input'), true);
    $stmt = $pdo->prepare("INSERT INTO categories (name, description) VALUES (?, ?)");
    $stmt->execute([$data['name'], $data['description']]);
    echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
}
?>