<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

// Robustez del API: rutas inexistentes, sesión ausente y huella digital.
// Antes una ruta /api/* desconocida devolvia el HTML del SPA con estado 200
// (el movil recibia una pagina en vez de un error) y una peticion sin token
// reventaba con 500 por una redireccion a una ruta "login" que no existe.
class ApiRobustezTest extends TestCase
{
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
        DB::table('webauthn_challenges')->delete();
        DB::table('webauthn_credentials')->delete();
        parent::tearDown();
    }

    public function test_ruta_api_inexistente_responde_json_404()
    {
        $respuesta = $this->getJson('/api/ruta-que-no-existe');

        $respuesta->assertStatus(404);
        $respuesta->assertHeader('Content-Type', 'application/json');
        $respuesta->assertJsonPath('message', 'Recurso no encontrado.');
    }

    public function test_ruta_protegida_sin_token_responde_401_y_no_500()
    {
        $respuesta = $this->getJson('/api/admin/roles');

        $respuesta->assertStatus(401);
        $respuesta->assertJsonPath('message', 'No autenticado o sesión expirada.');
    }

    public function test_ruta_protegida_sin_token_tambien_json_en_navegador()
    {
        // Sin cabecera Accept el backend debe seguir respondiendo JSON, no HTML.
        $respuesta = $this->get('/api/admin/ingresos');

        $respuesta->assertStatus(401);
        $this->assertStringContainsString('application/json', $respuesta->headers->get('Content-Type'));
    }

    public function test_opciones_de_huella_exigen_sesion()
    {
        $this->postJson('/api/huellas/registro/opciones')->assertStatus(401);
    }

    public function test_opciones_de_huella_de_ingreso_devuelven_reto()
    {
        $respuesta = $this->postJson('/api/huellas/login/opciones');

        $respuesta->assertStatus(200);
        $respuesta->assertJsonStructure(['message', 'reto', 'opciones']);
        $this->assertNotEmpty($respuesta->json('reto'));
        $this->assertNotEmpty($respuesta->json('opciones.challenge'));
    }

    public function test_huella_registrada_con_reto_invalido_responde_422()
    {
        Sanctum::actingAs($this->usuarioSuperadmin(), [], 'sanctum');

        $respuesta = $this->postJson('/api/huellas/registro', [
            'reto' => 'reto-que-no-existe',
            'id' => 'credencial-falsa',
            'type' => 'public-key',
            'response' => ['clientDataJSON' => 'x', 'attestationObject' => 'y'],
        ]);

        $respuesta->assertStatus(422);
        $respuesta->assertJsonPath('message', 'El reto de registro no es valido o ya expiro.');
    }

    public function test_huella_ingreso_con_reto_invalido_responde_401()
    {
        $respuesta = $this->postJson('/api/huellas/login', [
            'reto' => 'reto-que-no-existe',
            'id' => 'credencial-falsa',
            'type' => 'public-key',
            'response' => ['clientDataJSON' => 'x', 'authenticatorData' => 'y', 'signature' => 'z'],
        ]);

        $respuesta->assertStatus(401);
    }

    public function test_limite_de_intentos_responde_en_espanol()
    {
        // El mensaje de Laravel venia en ingles ("Too Many Attempts.").
        for ($i = 0; $i < 8; $i++) {
            $respuesta = $this->postJson('/api/login', [
                'user_email' => 'nadie@sena.edu.co',
                'user_password' => 'clave-equivocada',
            ]);
        }

        $respuesta->assertStatus(429);
        $respuesta->assertJsonPath('message', 'Demasiados intentos. Espera un momento y vuelve a intentarlo.');
    }

    public function test_perfil_guarda_con_correo_del_centro_sin_cambiarlo()
    {
        // Las cuentas del centro (@sena.edu.co) no estan en el whitelist de
        // dominios: si se validara igual, no podrian guardar su perfil.
        $usuario = $this->usuarioSuperadmin();
        Sanctum::actingAs($usuario, [], 'sanctum');

        $respuesta = $this->post('/api/my-profile', [
            '_method' => 'PUT',
            'user_identification' => $usuario->user_identification,
            'user_name' => $usuario->user_name,
            'user_lastname' => $usuario->user_lastname,
            'user_email' => $usuario->user_email,
        ]);

        $respuesta->assertStatus(200);
        $this->assertSame($usuario->user_email, $respuesta->json('user_email'));
    }

    public function test_perfil_rechaza_correo_nuevo_fuera_del_whitelist()
    {
        $usuario = $this->usuarioSuperadmin();
        Sanctum::actingAs($usuario, [], 'sanctum');

        $respuesta = $this->post('/api/my-profile', [
            '_method' => 'PUT',
            'user_identification' => $usuario->user_identification,
            'user_name' => $usuario->user_name,
            'user_lastname' => $usuario->user_lastname,
            'user_email' => 'correo@inventado.example',
        ]);

        $respuesta->assertStatus(422);
        $respuesta->assertJsonValidationErrors('user_email');
    }

    private function usuarioSuperadmin()
    {
        return \App\Models\User::where('fk_id_rol', 1)->first() ?: \App\Models\User::first();
    }
}
