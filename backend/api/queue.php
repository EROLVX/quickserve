<?php
header('Content-Type: application/json');
require_once '../config/database.php';

$stmt = $pdo->query("SELECT id, order_number, status, order_type, created_at 
                     FROM orders 
                     WHERE status IN ('pending','preparing','ready') 
                     ORDER BY FIELD(status, 'ready', 'preparing', 'pending'), created_at ASC");
$orders = $stmt->fetchAll();

$queue = ['pending' => [], 'preparing' => [], 'ready' => []];
foreach ($orders as $order) {
    $queue[$order['status']][] = $order;
}

echo json_encode(['success' => true, 'queue' => $queue]);
?>