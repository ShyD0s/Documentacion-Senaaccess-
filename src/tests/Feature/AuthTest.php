<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;

class AuthTest extends TestCase
{
    use DatabaseTransactions;

    /**
     * Prueba inicio de sesión exitoso con credenciales correctas.
     */
    public function test_user_can_login_with_valid_credentials(): void
    {
        $user = $this->createTestUser('aprendiz');

        $response = $this->postJson('/api/login', [
            'user_email' => $user->user_email,
            'user_password' => 'password123',
        ]);

        $response->assertStatus(200)
            ->assertJsonStructure([
                'message',
                'user',
                'role',
                'access_token',
                'token_type'
            ]);

        // Verificar que el inicio de sesión registró un ingreso automático
        $this->assertDatabaseHas('ingresos', [
            'fk_id_user' => $user->id_usuario,
        ]);
    }

    /**
     * Prueba que el login falla con contraseña incorrecta.
     */
    public function test_user_cannot_login_with_invalid_password(): void
    {
        $user = $this->createTestUser('aprendiz');

        $response = $this->postJson('/api/login', [
            'user_email' => $user->user_email,
            'user_password' => 'contraseña_incorrecta',
        ]);

        $response->assertStatus(401)
            ->assertJson([
                'message' => 'Credenciales incorrectas'
            ]);
    }

    /**
     * Prueba el registro y acceso de usuarios invitados.
     */
    public function test_guest_can_register_and_creates_ingreso(): void
    {
        $this->getOrCreateRole('invitado');

        $doc = 'INV' . rand(100000, 999999);
        $response = $this->postJson('/api/register-guest', [
            'user_identification' => $doc,
            'user_name' => 'Carlos Invitado',
        ]);

        $response->assertStatus(201)
            ->assertJsonStructure([
                'message',
                'user'
            ]);

        $this->assertDatabaseHas('usuarios', [
            'user_identification' => $doc,
            'user_name' => 'Carlos Invitado',
        ]);

        $this->assertDatabaseHas('ingresos', [
            'ingreso_place' => 'Acceso Invitado',
        ]);
    }

    /**
     * Prueba que un usuario autenticado puede cerrar sesión.
     */
    public function test_authenticated_user_can_logout(): void
    {
        $user = $this->createTestUser('aprendiz');
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/logout');

        $response->assertStatus(200)
            ->assertJson([
                'message' => 'Sesión cerrada'
            ]);
    }
}
