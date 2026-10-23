<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class UserQrSecurityTest extends TestCase
{
    /**
     * Verifica que el cálculo de ventanas de tiempo de 30 segundos sea consistente y predecible.
     */
    public function test_time_window_calculation_accuracy(): void
    {
        $windowSeconds = 30;

        // Para t = 90 y t = 119, la ventana debe ser la misma (90 / 30 = 3, 119 / 30 = 3)
        $t1 = 90;
        $t2 = 119;
        $this->assertEquals((int) floor($t1 / $windowSeconds), (int) floor($t2 / $windowSeconds));

        // Para t = 120, pasa a la siguiente ventana (4)
        $t3 = 120;
        $this->assertEquals(4, (int) floor($t3 / $windowSeconds));
    }

    /**
     * Verifica que la generación y comparación segura de HMAC SHA-256 funcione correctamente.
     */
    public function test_hmac_token_security_and_verification(): void
    {
        $secretKey = 'test_secret_key_sena_access';
        $userId = 42;
        $doc = '1002345678';
        $timeWindow = 59000000;

        $token = hash_hmac('sha256', "{$userId}:{$doc}:{$timeWindow}", $secretKey);

        // Validación idéntica usando hash_equals
        $validToken = hash_hmac('sha256', "{$userId}:{$doc}:{$timeWindow}", $secretKey);
        $this->assertTrue(hash_equals($validToken, $token));

        // Si cambia el documento, el token no coincide
        $tamperedDocToken = hash_hmac('sha256', "{$userId}:9999999999:{$timeWindow}", $secretKey);
        $this->assertFalse(hash_equals($tamperedDocToken, $token));

        // Si cambia la ventana de tiempo, el token no coincide
        $tamperedWindowToken = hash_hmac('sha256', "{$userId}:{$doc}:" . ($timeWindow + 1), $secretKey);
        $this->assertFalse(hash_equals($tamperedWindowToken, $token));
    }
}
