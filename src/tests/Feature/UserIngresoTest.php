<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use App\Models\Ingreso;
use Carbon\Carbon;

class UserIngresoTest extends TestCase
{
    use DatabaseTransactions;

    /**
     * Prueba que un usuario puede consultar sus propios ingresos.
     */
    public function test_user_can_get_their_own_ingresos(): void
    {
        $user = $this->createTestUser('aprendiz');

        Ingreso::create([
            'ingreso_datetime' => Carbon::now('America/Bogota'),
            'ingreso_place' => 'Entrada Principal',
            'fk_id_user' => $user->id_usuario,
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/my-ingresos');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json());
        $this->assertEquals('Entrada Principal', $response->json()[0]['ingreso_place']);
    }

    /**
     * Prueba que un administrador puede listar todos los usuarios del sistema.
     */
    public function test_admin_can_list_all_users(): void
    {
        $admin = $this->createAdminUser();
        $this->createTestUser('aprendiz');
        $this->createTestUser('instructor');

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/users');

        $response->assertStatus(200);
        $this->assertIsArray($response->json());
        $this->assertGreaterThanOrEqual(3, count($response->json()));
    }

    /**
     * Prueba que un administrador puede consultar todos los registros de ingreso del centro.
     */
    public function test_admin_can_get_all_ingresos(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->createTestUser('aprendiz');

        Ingreso::create([
            'ingreso_datetime' => Carbon::now('America/Bogota'),
            'ingreso_place' => 'Portería 1',
            'fk_id_user' => $user->id_usuario,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/ingresos');

        $response->assertStatus(200);
        $this->assertIsArray($response->json());
    }

    /**
     * Prueba que un usuario puede actualizar su información de perfil.
     */
    public function test_user_can_update_their_profile(): void
    {
        $user = $this->createTestUser('aprendiz');
        Sanctum::actingAs($user);

        $response = $this->putJson('/api/my-profile', [
            'user_identification' => $user->user_identification,
            'user_name' => 'Nombre Actualizado',
            'user_lastname' => 'Apellido Actualizado',
            'user_email' => $user->user_email,
            'user_coursenumber' => 2901234,
            'user_program' => 'Diseño Multimedia',
        ]);

        $response->assertStatus(200);

        $this->assertDatabaseHas('usuarios', [
            'id_usuario' => $user->id_usuario,
            'user_name' => 'Nombre Actualizado',
            'user_program' => 'Diseño Multimedia',
        ]);
    }
}
