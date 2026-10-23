<?php

namespace Tests\Feature;

use App\Models\Ingreso;
use App\Models\Role;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Puerta de acceso: Entrada de ayer no bloquea la de hoy (adiós al loop
// "ya entré" → login → pide QR), PIN corto de respaldo y fechas con zona.
// Sin BD local cada test se marca como skipped (igual que ParidadTest).
class AccesoPuertaTest extends TestCase
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
            DB::table('pines_acceso')->where('fk_creado_por', $uid)->delete();
            DB::table('usuarios')->where('id_usuario', $uid)->delete();
        }
        DB::table('pines_acceso')->delete();
        parent::tearDown();
    }

    private function crearUsuario(string $rol): User
    {
        $uniq = uniqid();
        $user = User::create([
            'user_identification' => 'PUE' . substr($uniq, -10),
            'user_name' => 'Puerta',
            'user_lastname' => 'Test',
            'user_email' => 'puerta+' . $uniq . '@gmail.com',
            'user_password' => Hash::make('Clave1234'),
            'user_documento_tipo' => 'CC',
            'estado_cuenta' => 'aprobada',
            'fk_id_rol' => Role::where('rol_name', $rol)->value('id_rol'),
        ]);
        $this->uidsCreados[] = $user->id_usuario;
        return $user->fresh();
    }

    // Firma un QR de acceso igual que AccesoQrController::payload().
    private function qrFirmado(string $tipo): string
    {
        $ventana = intdiv(Carbon::now()->timestamp, 30);
        $base = base64_encode(json_encode(['app' => 'SENA_ACCESS', 'acceso' => $tipo, 'sede' => 'CCyS', 'ventana' => $ventana]));
        return $base . '.' . hash_hmac('sha256', $base, config('app.key'));
    }

    public function test_entrada_ayer_no_bloquea_entrada_hoy(): void
    {
        $apr = $this->crearUsuario('Aprendiz');
        Ingreso::create([
            'ingreso_datetime' => Carbon::now('America/Bogota')->subDay(),
            'ingreso_place' => 'CCyS',
            'ingreso_type' => 'Entrada',
            'fk_id_user' => $apr->id_usuario,
        ]);
        Sanctum::actingAs($apr);

        $this->postJson('/api/acceso/validar', ['qr_payload' => $this->qrFirmado('entrada')])
            ->assertStatus(201)
            ->assertJsonPath('ingreso.ingreso_type', 'Entrada');

        // La puerta (Entrada de hoy) ya se cumple.
        $hoy = Carbon::now('America/Bogota')->toDateString();
        $this->assertTrue(Ingreso::where('fk_id_user', $apr->id_usuario)
            ->where('ingreso_type', 'Entrada')
            ->whereDate('ingreso_datetime', $hoy)->exists());
    }

    public function test_entrada_duplicada_hoy_no_crea_otra(): void
    {
        $apr = $this->crearUsuario('Aprendiz');
        Ingreso::create([
            'ingreso_datetime' => Carbon::now('America/Bogota'),
            'ingreso_place' => 'CCyS',
            'ingreso_type' => 'Entrada',
            'fk_id_user' => $apr->id_usuario,
        ]);
        Sanctum::actingAs($apr);

        $this->postJson('/api/acceso/validar', ['qr_payload' => $this->qrFirmado('entrada')])
            ->assertOk()
            ->assertJsonPath('duplicado', true);
        $this->assertSame(1, Ingreso::where('fk_id_user', $apr->id_usuario)->count());
    }

    public function test_pin_entrada_generar_y_validar(): void
    {
        $apr = $this->crearUsuario('Aprendiz');
        Sanctum::actingAs($this->crearUsuario('Superadmin'));
        $pin = $this->postJson('/api/admin/pines-acceso', ['tipo' => 'entrada'])
            ->assertStatus(201)
            ->assertJsonPath('tipo', 'entrada')
            ->json('pin');
        $this->assertMatchesRegularExpression('/^\d{6}$/', $pin);

        Sanctum::actingAs($apr);
        $this->postJson('/api/acceso/validar-pin', ['pin' => $pin])
            ->assertStatus(201)
            ->assertJsonPath('ingreso.ingreso_type', 'Entrada');

        // Un solo uso.
        $this->postJson('/api/acceso/validar-pin', ['pin' => $pin])->assertStatus(400);
        $this->postJson('/api/acceso/validar-pin', ['pin' => '000000'])->assertStatus(404);
    }

    public function test_pin_solo_lo_genera_porteria(): void
    {
        Sanctum::actingAs($this->crearUsuario('Aprendiz'));
        $this->postJson('/api/admin/pines-acceso', ['tipo' => 'entrada'])->assertStatus(403);
    }

    public function test_ingreso_datetime_trae_zona(): void
    {
        $apr = $this->crearUsuario('Aprendiz');
        Ingreso::create([
            'ingreso_datetime' => Carbon::now('America/Bogota'),
            'ingreso_place' => 'CCyS',
            'ingreso_type' => 'Entrada',
            'fk_id_user' => $apr->id_usuario,
        ]);
        Sanctum::actingAs($apr);
        $fecha = $this->getJson('/api/my-ingresos')->assertOk()->json('0.ingreso_datetime');
        $this->assertMatchesRegularExpression('/T.*(-05:00|\+00:00|Z)/', $fecha);
    }
}
