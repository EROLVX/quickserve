<?php
session_start();
header('Content-Type: application/json');
require_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = $_GET['status'] ?? null;
    $isAdmin = (isset($_SESSION['role']) && $_SESSION['role'] === 'admin');
    $sessionUserId = $_SESSION['user_id'] ?? null;

    $sql = "SELECT * FROM orders";
    $params = [];
    $conditions = [];

    if ($isAdmin) {
        // Admin sees all orders, optionally filtered by status
        if ($status) { $conditions[] = "status = ?"; $params[] = $status; }
    } else if ($sessionUserId) {
        // Logged-in user sees only their own orders
        $conditions[] = "user_id = ?";
        $params[] = $sessionUserId;
        if ($status) { $conditions[] = "status = ?"; $params[] = $status; }
    } else {
        // Guest or unauthenticated — return empty
        echo json_encode(['success' => true, 'orders' => []]);
        exit;
    }

    if ($conditions) { $sql .= " WHERE " . implode(" AND ", $conditions); }
    $sql .= " ORDER BY created_at DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll();
    
    foreach ($orders as &$order) {
        $itemStmt = $pdo->prepare("SELECT oi.*, p.name as product_name, p.image_url 
            FROM order_items oi 
            JOIN products p ON oi.product_id = p.id 
            WHERE oi.order_id = ?");
        $itemStmt->execute([$order['id']]);
        $order['items'] = $itemStmt->fetchAll();
        
        // Get payment info
        $payStmt = $pdo->prepare("SELECT * FROM payments WHERE order_id = ?");
        $payStmt->execute([$order['id']]);
        $order['payment'] = $payStmt->fetch();
    }
    echo json_encode(['success' => true, 'orders' => $orders]);
}
elseif ($method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    $cart = $data['cart'] ?? [];
    $orderType = $data['order_type'] ?? 'dine_in';
    $customerName = trim($data['customer_name'] ?? 'Guest');
    $reservationDate = $data['reservation_date'] ?? null;
    $reservationTime = $data['reservation_time'] ?? null;
    $downpayment = floatval($data['downpayment_amount'] ?? 0);
    
    if (empty($cart)) {
        echo json_encode(['success' => false, 'message' => 'Cart is empty']); 
        exit;
    }
    
    // Calculate totals
    $total = 0;
    foreach ($cart as $item) $total += $item['price'] * $item['quantity'];
    
    // Downpayment validation for reservations
    $minDownpayment = 0;
    if ($orderType === 'reservation') {
        $minDownpayment = $total * 0.30; // 30% minimum
        if ($downpayment < $minDownpayment) {
            echo json_encode([
                'success' => false, 
                'message' => 'Reservation requires 30% downpayment (₱' . number_format($minDownpayment, 2) . ')'
            ]); 
            exit;
        }
    }
    
    $datePrefix = date('Ymd');
    $stmt = $pdo->prepare("SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY order_number DESC LIMIT 1");
    $stmt->execute(["QS-{$datePrefix}-%"]);
    $lastOrder = $stmt->fetch();
    
    $nextNumber = 1;
    if ($lastOrder) {
        $parts = explode('-', $lastOrder['order_number']);
        $lastNum = intval(end($parts));
        $nextNumber = $lastNum + 1;
    }
    
    $orderNumber = 'QS-' . $datePrefix . '-' . str_pad($nextNumber, 3, '0', STR_PAD_LEFT);
    
    // Status based on order type
    $initialStatus = ($orderType === 'reservation') ? 'reserved' : 'pending';
    
    $pdo->beginTransaction();
    try {
        // Attach order to logged-in user if session exists
        $sessionUserId = $_SESSION['user_id'] ?? null;

        $stmt = $pdo->prepare("INSERT INTO orders 
            (user_id, order_number, customer_name, order_type, reservation_date, reservation_time, 
            status, total_amount, downpayment_amount, downpayment_paid) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([
            $sessionUserId, $orderNumber, $customerName, $orderType, $reservationDate, $reservationTime,
            $initialStatus, $total, $downpayment, $downpayment
        ]);
        $orderId = $pdo->lastInsertId();
        
        $itemStmt = $pdo->prepare("INSERT INTO order_items 
            (order_id, product_id, quantity, price, subtotal) 
            VALUES (?, ?, ?, ?, ?)");
        foreach ($cart as $item) {
            $subtotal = $item['price'] * $item['quantity'];
            $itemStmt->execute([$orderId, $item['id'], $item['quantity'], $item['price'], $subtotal]);
        }
        
        // Payment record
        $payType = ($orderType === 'reservation') ? 'downpayment' : 'full';
        $payAmount = ($orderType === 'reservation') ? $downpayment : $total;
        $payStmt = $pdo->prepare("INSERT INTO payments 
            (order_id, payment_method, amount, status, payment_type) 
            VALUES (?, 'cash', ?, 'paid', ?)");
        $payStmt->execute([$orderId, $payAmount, $payType]);
        
        // Notification for admin
        if ($orderType === 'reservation') {
            $notifStmt = $pdo->prepare("INSERT INTO notifications 
                (order_id, message, type) 
                VALUES (?, ?, 'general')");
            $notifStmt->execute([$orderId, "New reservation #{$orderNumber} pending approval"]);
        }
        
        $pdo->commit();
        echo json_encode([
            'success' => true, 
            'order_number' => $orderNumber, 
            'order_id' => $orderId,
            'status' => $initialStatus,
            'requires_approval' => ($orderType === 'reservation')
        ]);
        
    } catch (Exception $e) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => $e->getMessage()]);
    }
}
elseif ($method === 'PUT') {
    if (!isset($_SESSION['role'])) {
        echo json_encode(['success' => false, 'message' => 'Unauthorized']); 
        exit;
    }
    $isAdmin = ($_SESSION['role'] === 'admin');
    $sessionUserId = $_SESSION['user_id'] ?? null;
    
    $data = json_decode(file_get_contents('php://input'), true);
    $orderId = intval($data['id'] ?? 0);
    $status = $data['status'] ?? '';
    $adminNotes = $data['admin_notes'] ?? null;
    
    $valid = ['pending','preparing','ready','completed','cancelled','reserved','approved','rejected'];
    if (!in_array($status, $valid)) {
        echo json_encode(['success' => false, 'message' => 'Invalid status']); 
        exit;
    }

    // Non-admin: can only cancel their own pending/reserved orders
    if (!$isAdmin) {
        if ($status !== 'cancelled') {
            echo json_encode(['success' => false, 'message' => 'Unauthorized']); exit;
        }
        $chk = $pdo->prepare("SELECT status, user_id FROM orders WHERE id = ?");
        $chk->execute([$orderId]);
        $existing = $chk->fetch();
        if (!$existing || $existing['user_id'] != $sessionUserId) {
            echo json_encode(['success' => false, 'message' => 'Unauthorized']); exit;
        }
        if (!in_array($existing['status'], ['pending','reserved'])) {
            echo json_encode(['success' => false, 'message' => 'Order cannot be cancelled']); exit;
        }
    }
    
    // Build update query
    $updateFields = ["status = ?"];
    $params = [$status];
    
    if ($adminNotes !== null) {
        $updateFields[] = "admin_notes = ?";
        $params[] = $adminNotes;
    }
    
    $params[] = $orderId;
    
    $stmt = $pdo->prepare("UPDATE orders SET " . implode(', ', $updateFields) . " WHERE id = ?");
    $stmt->execute($params);
    
    // Notifications based on status change
    $notifMsg = "Order status updated to {$status}";
    if ($status === 'approved') {
        $notifMsg = "Your reservation has been approved! Please pay remaining balance on arrival.";
    } elseif ($status === 'rejected') {
        $notifMsg = "Your reservation was declined. Refund will be processed.";
    } elseif ($status === 'ready') {
        $notifMsg = "Your order is ready for pickup!";
    }
    
    $notifType = ($status === 'ready') ? 'ready' : 'status_update';
    $notifStmt = $pdo->prepare("INSERT INTO notifications 
        (order_id, message, type) 
        VALUES (?, ?, ?)");
    $notifStmt->execute([$orderId, $notifMsg, $notifType]);
    
    echo json_encode(['success' => true]);
}
elseif ($method === 'DELETE') {
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        echo json_encode(['success' => false, 'message' => 'Unauthorized']); exit;
    }
    $id = intval($_GET['id'] ?? 0);
    if ($id <= 0) { echo json_encode(['success' => false, 'message' => 'Invalid ID']); exit; }
    try {
        // CASCADE delete (order_items, payments, notifications deleted by FK)
        $pdo->prepare("DELETE FROM orders WHERE id = ?")->execute([$id]);
        echo json_encode(['success' => true]);
    } catch (Exception $e) {
        echo json_encode(['success' => false, 'message' => 'Delete failed']);
    }
}
?>