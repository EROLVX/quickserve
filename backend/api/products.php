<?php
session_start();
header('Content-Type: application/json');
require_once '../config/database.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $category = $_GET['category'] ?? null;
    $search = $_GET['search'] ?? null;
    
    $sql = "SELECT p.*, c.name as category_name FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1";
    $params = [];
    
    if ($category && $category !== 'all') {
        $sql .= " AND c.name = ?";
        $params[] = $category;
    }
    if ($search) {
        $sql .= " AND (p.name LIKE ? OR p.description LIKE ?)";
        $params[] = "%$search%";
        $params[] = "%$search%";
    }
    $sql .= " ORDER BY p.created_at DESC";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    echo json_encode(['success' => true, 'products' => $stmt->fetchAll()]);
}
elseif ($method === 'POST') {
    // Check admin
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        echo json_encode(['success' => false, 'message' => 'Unauthorized']); 
        exit;
    }

    $id = $_POST['id'] ?? null;
    $name = trim($_POST['name'] ?? '');
    $category_id = !empty($_POST['category_id']) ? intval($_POST['category_id']) : null;
    $description = trim($_POST['description'] ?? '');
    $price = floatval($_POST['price'] ?? 0);
    $status = $_POST['status'] ?? 'available';
    
    // Handle image upload
    $imageUrl = $_POST['existing_image'] ?? null;
    if (!empty($_FILES['image']['name'])) {
        $uploadDir = '../../frontend/assets/images/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);
        
        $ext = pathinfo($_FILES['image']['name'], PATHINFO_EXTENSION);
        $filename = uniqid() . '.' . $ext;
        $target = $uploadDir . $filename;
        
        if (move_uploaded_file($_FILES['image']['tmp_name'], $target)) {
            $imageUrl = 'assets/images/' . $filename;
        }
    }

    if (empty($name) || $price <= 0) {
        echo json_encode(['success' => false, 'message' => 'Name and valid price required']);
        exit;
    }

    if ($id) {
        // Update
        $stmt = $pdo->prepare("UPDATE products SET category_id=?, name=?, description=?, price=?, status=?, image_url=? WHERE id=?");
        $stmt->execute([$category_id, $name, $description, $price, $status, $imageUrl, $id]);
    } else {
        // Insert
        $stmt = $pdo->prepare("INSERT INTO products (category_id, name, description, price, status, image_url) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$category_id, $name, $description, $price, $status, $imageUrl]);
    }
    
    echo json_encode(['success' => true]);
}
elseif ($method === 'DELETE') {
    if (!isset($_SESSION['role']) || $_SESSION['role'] !== 'admin') {
        echo json_encode(['success' => false, 'message' => 'Unauthorized']); exit;
    }
    $id = $_GET['id'] ?? 0;
    $stmt = $pdo->prepare("DELETE FROM products WHERE id = ?");
    $stmt->execute([$id]);
    echo json_encode(['success' => true]);
}
?>