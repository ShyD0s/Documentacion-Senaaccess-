<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use App\Models\Ingreso;

class QrAccessControlTest extends TestCase
{
    use DatabaseTransactions;

    /**
     * Prueba que cualquier usuario autenticado puede obtener su token QR dinámico.
     */
    public function test_authenticated_user_can_get_dynamic_qr_token(): void
    {
        $user = $this->createTestUser('aprendiz');
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/my-qr-token');

        $response->assertStatus(200)
            ->assertJsonStructure([
                'app',
                'ver',
                'id_usuario',
                'user_identification',
                'user_name',
                'user_email',
                'role',
                'time_window',
                'timestamp',
                'expires_in',
                'window_seconds',
                'token',
            ]);

        $data = $response->json();
        $this->assertEquals('SENA_ACCESS', $data['app']);
        $this->assertEquals(2, $data['ver']);
        $this->assertEquals($user->id_usuario, $data['id_usuario']);

        // Verificar validez del token HMAC con la app key
        $appKey = config('app.key') ?: 'sena_access_secret_key';
        $expectedToken = hash_hmac('sha256', "{$user->id_usuario}:{$user->user_identification}:{$data['time_window']}", $appKey);
        $this->assertTrue(hash_equals($expectedToken, $data['token']));
    }

    /**
     * Prueba que usuarios no autenticados no pueden obtener el token QR.
     */
    public function test_unauthenticated_user_cannot_get_qr_token(): void
    {
        $response = $this->getJson('/api/my-qr-token');
        $response->assertStatus(401);
    }

    /**
     * Prueba que un Administrador puede escanear un QR dinámico válido y registrar el ingreso.
     */
    public function test_admin_can_scan_valid_dynamic_qr_and_register_ingreso(): void
    {
        $admin = $this->createAdminUser();
        $aprendiz = $this->createTestUser('aprendiz');

        // Generar payload dinámico fresco para el aprendiz
        $timeWindow = (int) floor(time() / 30);
        $appKey = config('app.key') ?: 'sena_access_secret_key';
        $token = hash_hmac('sha256', "{$aprendiz->id_usuario}:{$aprendiz->user_identification}:{$timeWindow}", $appKey);

        $qrPayload = [
            'app' => 'SENA_ACCESS',
            'ver' => 2,
            'id_usuario' => $aprendiz->id_usuario,
            'user_identification' => $aprendiz->user_identification,
            'user_name' => "{$aprendiz->user_name} {$aprendiz->user_lastname}",
            'role' => 'aprendiz',
            'time_window' => $timeWindow,
            'timestamp' => time(),
            'token' => $token,
        ];

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/ingresos/scan', [
            'qr_data' => json_encode($qrPayload),
            'ingreso_place' => 'Entrada Principal Test'
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'is_dynamic' => true,
            ]);

        // Verificar que el ingreso fue creado en la base de datos
        $this->assertDatabaseHas('ingresos', [
            'fk_id_user' => $aprendiz->id_usuario,
            'ingreso_place' => 'Entrada Principal Test',
        ]);
    }

    /**
     * Prueba que el escáner rechaza códigos QR expirados.
     */
    public function test_admin_scan_rejects_expired_dynamic_qr(): void
    {
        $admin = $this->createAdminUser();
        $aprendiz = $this->createTestUser('aprendiz');

        // Ventana de tiempo vieja (hace más de 2 minutos)
        $expiredWindow = (int) floor(time() / 30) - 5;
        $appKey = config('app.key') ?: 'sena_access_secret_key';
        $token = hash_hmac('sha256', "{$aprendiz->id_usuario}:{$aprendiz->user_identification}:{$expiredWindow}", $appKey);

        $expiredPayload = [
            'app' => 'SENA_ACCESS',
            'ver' => 2,
            'id_usuario' => $aprendiz->id_usuario,
            'user_identification' => $aprendiz->user_identification,
            'role' => 'aprendiz',
            'time_window' => $expiredWindow,
            'token' => $token,
        ];

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/ingresos/scan', [
            'qr_data' => json_encode($expiredPayload),
            'ingreso_place' => 'Entrada Principal'
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
                'expired' => true,
            ]);
    }

    /**
     * Prueba que el escáner rechaza códigos QR con token alterado o no auténtico.
     */
    public function test_admin_scan_rejects_tampered_token(): void
    {
        $admin = $this->createAdminUser();
        $aprendiz = $this->createTestUser('aprendiz');

        $timeWindow = (int) floor(time() / 30);
        $tamperedPayload = [
            'app' => 'SENA_ACCESS',
            'ver' => 2,
            'id_usuario' => $aprendiz->id_usuario,
            'user_identification' => $aprendiz->user_identification,
            'time_window' => $timeWindow,
            'token' => 'token_falso_alterado_1234567890',
        ];

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/ingresos/scan', [
            'qr_data' => json_encode($tamperedPayload),
            'ingreso_place' => 'Entrada Principal'
        ]);

        $response->assertStatus(422)
            ->assertJson([
                'success' => false,
            ]);
    }

    /**
     * Prueba que el administrador puede registrar ingreso mediante documento como respaldo.
     */
    public function test_admin_can_register_ingreso_by_document_fallback(): void
    {
        $admin = $this->createAdminUser();
        $aprendiz = $this->createTestUser('aprendiz');

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/ingresos/scan', [
            'qr_data' => $aprendiz->user_identification,
            'ingreso_place' => 'Portería Peatonal'
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
            ]);

        $this->assertDatabaseHas('ingresos', [
            'fk_id_user' => $aprendiz->id_usuario,
            'ingreso_place' => 'Portería Peatonal',
        ]);
    }

    /**
     * Prueba que usuarios no administradores/instructores no tienen acceso al endpoint de escaneo.
     */
    public function test_aprendiz_cannot_access_scan_endpoint(): void
    {
        $aprendiz = $this->createTestUser('aprendiz');
        Sanctum::actingAs($aprendiz);

        $response = $this->postJson('/api/admin/ingresos/scan', [
            'qr_data' => 'DOC12345',
            'ingreso_place' => 'Entrada Principal'
        ]);

        $response->assertStatus(403);
    }
}
