<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Predictivo de accesos: contrato del endpoint de superadmin.
// Sin BD local cada test se marca como skipped (igual que ParidadTest).
class PrediccionTest extends TestCase
{
    private array $uidsCreados = [];

    protected function setUp(): void
    {
        parent::setUp();
        try {
            DB::connection()->getPdo();
        } catch (\Throwable $e) {
            $this->markTestSkipped('Sin BD local disponible: ' . $e->getMessage());
        }
    }

    protected function tearDown(): void
    {
        foreach ($this->uidsCreados as $uid) {
            DB::table('personal_access_tokens')->where('tokenable_id', $uid)->delete();
            DB::table('ingresos')->where('fk_id_user', $uid)->delete();
            DB::table('usuarios')->where('id_usuario', $uid)->delete();
        }
        parent::tearDown();
    }

    private function crearUsuario(string $rol): User
    {
        $uniq = uniqid();
        $user = User::create([
            'user_identification' => 'PRE' . substr($uniq, -10),
            'user_name' => 'Predic',
            'user_lastname' => 'Test',
            'user_email' => 'prediccion+' . $uniq . '@gmail.com',
            'user_password' => Hash::make('Clave1234'),
            'user_documento_tipo' => 'CC',
            'estado_cuenta' => 'aprobada',
            'fk_id_rol' => Role::where('rol_name', $rol)->value('id_rol'),
        ]);
        $this->uidsCreados[] = $user->id_usuario;
        return $user->fresh();
    }

    public function test_prediccion_rechaza_rol_no_admin(): void
    {
        Sanctum::actingAs($this->crearUsuario('Aprendiz'));
        $this->getJson('/api/admin/prediccion')->assertStatus(403);
    }

    public function test_prediccion_superadmin_responde_contrato(): void
    {
        Sanctum::actingAs($this->crearUsuario('Superadmin'));
        $r = $this->getJson('/api/admin/prediccion')->assertOk();
        // Con pocos días: aviso honesto. Con historia suficiente: predicciones+MAE/R².
        if ($r->json('aviso')) {
            $r->assertJsonStructure(['aviso', 'filas']);
        } else {
            $r->assertJsonStructure(['predicciones', 'mae', 'r2', 'filas', 'entrenado_en'])
                ->assertJsonCount(7, 'predicciones');
        }
    }
}
