<?php
$host = '127.0.0.1';
$db   = 'senaaccess';
$user = 'root';
$pass = '';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $users = [
        ['admin@gmail.com', 'Admin', 'Principal', '123456', 1, 0, 'Administración'],
        ['instructor@gmail.com', 'Instructor', 'Principal', '123456', 2, 0, 'Instructoría'],
        ['aprendiz@gmail.com', 'Aprendiz', 'Principal', '123456', 3, 0, 'Formación'],
    ];

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM usuarios WHERE user_email = ?");
    $insert = $pdo->prepare("INSERT INTO usuarios (user_email, user_name, user_lastname, user_password, fk_id_rol, user_coursenumber, user_program) VALUES (?, ?, ?, ?, ?, ?, ?)");

    $created = 0;
    foreach ($users as $u) {
        $stmt->execute([$u[0]]);
        if ($stmt->fetchColumn() == 0) {
            $hash = password_hash($u[3], PASSWORD_BCRYPT);
            $insert->execute([$u[0], $u[1], $u[2], $hash, $u[4], $u[5], $u[6]]);
            echo "Creado: {$u[0]}<br>";
            $created++;
        } else {
            echo "Ya existe: {$u[0]}<br>";
        }
    }

    if ($created === 0) {
        echo "<br>Los 3 usuarios ya existen. No se creó ninguno nuevo.";
    }

    echo "<br><br>✅ Listo. <a href='login.php'>Ir al login</a>";
} catch (PDOException $e) {
    die("Error de conexión: " . $e->getMessage());
}
