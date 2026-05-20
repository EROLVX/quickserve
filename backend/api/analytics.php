<?php
session_start();
header('Content-Type: application/json');
require_once '../config/database.php';

if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']); exit;
}

// Daily sales for last 7 days
$dailySales = $pdo->query("
    SELECT DATE(created_at) as date, SUM(total_amount) as total, COUNT(*) as count 
    FROM orders 
    WHERE status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY) 
    GROUP BY DATE(created_at) 
    ORDER BY date
")->fetchAll();

// Weekly revenue (last 4 weeks)
$weeklyRevenue = $pdo->query("
    SELECT CONCAT('Week ', WEEK(created_at)) as label, SUM(total_amount) as total 
    FROM orders 
    WHERE status != 'cancelled' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 4 WEEK) 
    GROUP BY YEARWEEK(created_at) 
    ORDER BY YEARWEEK(created_at)
")->fetchAll();

// Popular products
$popularProducts = $pdo->query("
    SELECT p.name, SUM(oi.quantity) as total_qty, SUM(oi.subtotal) as revenue 
    FROM order_items oi 
    JOIN products p ON oi.product_id = p.id 
    JOIN orders o ON oi.order_id = o.id 
    WHERE o.status != 'cancelled' 
    GROUP BY oi.product_id 
    ORDER BY total_qty DESC 
    LIMIT 6
")->fetchAll();

// Status summary
$statusSummary = $pdo->query("
    SELECT status, COUNT(*) as count 
    FROM orders 
    GROUP BY status
")->fetchAll();

// Hourly distribution for today
$hourlyToday = $pdo->query("
    SELECT HOUR(created_at) as hour, COUNT(*) as count 
    FROM orders 
    WHERE DATE(created_at) = CURDATE() 
    GROUP BY HOUR(created_at) 
    ORDER BY hour
")->fetchAll();

echo json_encode([
    'success' => true,
    'daily_sales' => $dailySales,
    'weekly_revenue' => $weeklyRevenue,
    'popular_products' => $popularProducts,
    'status_summary' => $statusSummary,
    'hourly_today' => $hourlyToday
]);
?>