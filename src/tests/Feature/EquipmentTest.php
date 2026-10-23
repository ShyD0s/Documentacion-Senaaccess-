<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Laravel\Sanctum\Sanctum;
use App\Models\IngresoEquipo;
use Carbon\Carbon;

class EquipmentTest extends TestCase
{
    use DatabaseTransactions;

    /**
     * Prueba que un usuario puede consultar sus propios equipos registrados.
     */
    public function test_user_can_get_their_own_equipment(): void
    {
        $user = $this->createTestUser('aprendiz');

        IngresoEquipo::create([
            'fk_id_usuario' => $user->id_usuario,
            'equipo_type' => 'Portátil',
            'equipo_brand' => 'Dell',
            'equipo_model' => 'Inspiron 15',
            'equipo_color' => 'Negro',
            'equipo_serial' => 'SN-DELL-12345',
            'equipo_observations' => 'Equipo personal de estudio',
            'entry_datetime' => Carbon::now('America/Bogota'),
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/my-equipment');

        $response->assertStatus(200);
        $this->assertCount(1, $response->json());
        $this->assertEquals('SN-DELL-12345', $response->json()[0]['equipo_serial']);
    }

    /**
     * Prueba que el administrador puede registrar un nuevo comprobante de equipo.
     */
    public function test_admin_can_create_equipment_voucher(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->createTestUser('aprendiz');

        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/admin/equipment', [
            'fk_id_usuario' => $user->id_usuario,
            'equipo_type' => 'Portátil',
            'equipo_brand' => 'Lenovo',
            'equipo_model' => 'ThinkPad L14',
            'equipo_color' => 'Gris',
            'equipo_serial' => 'SN-LENOVO-999',
            'equipo_observations' => 'Registrado en portería',
        ]);

        $response->assertStatus(201);

        $this->assertDatabaseHas('ingreso_equipos', [
            'fk_id_usuario' => $user->id_usuario,
            'equipo_serial' => 'SN-LENOVO-999',
            'equipo_brand' => 'Lenovo',
        ]);
    }

    /**
     * Prueba que el administrador puede eliminar un comprobante de equipo.
     */
    public function test_admin_can_delete_equipment_voucher(): void
    {
        $admin = $this->createAdminUser();
        $user = $this->createTestUser('aprendiz');

        $equipo = IngresoEquipo::create([
            'fk_id_usuario' => $user->id_usuario,
            'equipo_type' => 'Cámara',
            'equipo_brand' => 'Canon',
            'equipo_model' => 'EOS R50',
            'equipo_color' => 'Negro',
            'equipo_serial' => 'SN-CANON-888',
            'equipo_observations' => 'Para práctica de fotografía',
            'entry_datetime' => Carbon::now('America/Bogota'),
        ]);

        Sanctum::actingAs($admin);

        $response = $this->deleteJson("/api/admin/equipment/{$equipo->id_ingreso_equipo}");

        $response->assertStatus(200);

        $this->assertDatabaseMissing('ingreso_equipos', [
            'id_ingreso_equipo' => $equipo->id_ingreso_equipo,
        ]);
    }
}
