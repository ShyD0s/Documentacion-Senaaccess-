<?php

namespace App\Services;

use App\Models\Passkey;
use App\Models\User;
use App\Models\WebauthnChallenge;
use Cose\Algorithms;
use ParagonIE\ConstantTime\Base64UrlSafe;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\Serializer\SerializerInterface;
use Webauthn\AttestationStatement\AttestationStatementSupportManager;
use Webauthn\AttestationStatement\NoneAttestationStatementSupport;
use Webauthn\AuthenticatorAssertionResponse;
use Webauthn\AuthenticatorAssertionResponseValidator;
use Webauthn\AuthenticatorAttestationResponse;
use Webauthn\AuthenticatorAttestationResponseValidator;
use Webauthn\AuthenticatorSelectionCriteria;
use Webauthn\CeremonyStep\CeremonyStepManager;
use Webauthn\CeremonyStep\CeremonyStepManagerFactory;
use Webauthn\Counter\ThrowExceptionIfInvalid;
use Webauthn\CredentialRecord;
use Webauthn\Denormalizer\WebauthnSerializerFactory;
use Webauthn\PublicKeyCredentialCreationOptions;
use Webauthn\PublicKeyCredentialDescriptor;
use Webauthn\PublicKeyCredentialParameters;
use Webauthn\PublicKeyCredentialRequestOptions;
use Webauthn\PublicKeyCredentialRpEntity;
use Webauthn\PublicKeyCredentialUserEntity;

/**
 * Huella digital en la web (WebAuthn / passkey).
 *
 * El patron es el mismo del movil: la biometria nunca sale del dispositivo.
 * En la web la clave privada la guarda el autenticador de la plataforma
 * (Windows Hello, Touch ID, huella de Android) y el servidor solo valida
 * la firma con la clave publica que se registro en el momento del alta.
 */
class PasskeyService
{
    private const VIGENCIA_RETO_MINUTOS = 5;

    private ?SerializerInterface $serializer = null;

    /**
     * Identificador de la parte que confia (RP ID). Por defecto el dominio
     * de la peticion; se puede fijar con WEBAUTHN_RP_ID en produccion.
     */
    public function rpId(Request $request): string
    {
        $configurado = config('webauthn.rp_id') ?: env('WEBAUTHN_RP_ID');

        return $configurado ?: $request->getHost();
    }

    /**
     * Origenes admitidos: el de la peticion mas los declarados en config.
     */
    public function origenesAdmitidos(Request $request): array
    {
        $origenes = config('webauthn.allowed_origins', []);

        if ($request->headers->get('Origin')) {
            $origenes[] = rtrim($request->headers->get('Origin'), '/');
        }

        $origenes[] = rtrim(config('app.url'), '/');

        return array_values(array_unique(array_filter($origenes)));
    }

    public function serializer(): SerializerInterface
    {
        if ($this->serializer === null) {
            $factory = new WebauthnSerializerFactory(
                AttestationStatementSupportManager::create([new NoneAttestationStatementSupport()])
            );
            $this->serializer = $factory->create();
        }

        return $this->serializer;
    }

    /**
     * Ceremonia de alta: no valida contador (la credencial es nueva).
     */
    private function gestorCeremoniaRegistro(Request $request): CeremonyStepManager
    {
        $factory = $this->factoryCeremonia($request);

        return $factory->creationCeremony();
    }

    /**
     * Ceremonia de autenticacion: valida el contador (detecta clones).
     */
    private function gestorCeremoniaPeticion(Request $request): CeremonyStepManager
    {
        $factory = $this->factoryCeremonia($request);

        return $factory->requestCeremony();
    }

    private function factoryCeremonia(Request $request): CeremonyStepManagerFactory
    {
        $factory = new CeremonyStepManagerFactory();
        $factory->setCounterChecker(new ThrowExceptionIfInvalid());
        $factory->setAllowedOrigins($this->origenesAdmitidos($request));
        $factory->setSecuredRelyingPartyId([$this->rpId($request)]);

        return $factory;
    }

    /**
     * Genera un reto de un solo uso y lo guarda (5 minutos de vigencia).
     */
    public function crearReto(string $tipo, ?User $usuario = null): string
    {
        $reto = Str::random(64);

        WebauthnChallenge::create([
            'reto' => $reto,
            'tipo' => $tipo,
            'fk_id_usuario' => $usuario?->id_usuario,
            'expira_en' => now()->addMinutes(self::VIGENCIA_RETO_MINUTOS),
        ]);

        return $reto;
    }

    /**
     * Consume el reto: lo devuelve si es valido y lo borra (un solo uso).
     */
    public function consumirReto(string $reto, string $tipo): ?WebauthnChallenge
    {
        $challenge = WebauthnChallenge::where('reto', $reto)->where('tipo', $tipo)->first();

        if (!$challenge) {
            return null;
        }

        $challenge->delete();

        if ($challenge->estaVencido()) {
            return null;
        }

        return $challenge;
    }

    private function entidadRp(Request $request): PublicKeyCredentialRpEntity
    {
        return PublicKeyCredentialRpEntity::create(
            config('webauthn.rp_name', 'SenaAccess'),
            $this->rpId($request)
        );
    }

    private function entidadUsuario(User $usuario): PublicKeyCredentialUserEntity
    {
        return PublicKeyCredentialUserEntity::create(
            $usuario->user_email,
            base64_encode((string) $usuario->id_usuario),
            trim($usuario->user_name . ' ' . $usuario->user_lastname) ?: $usuario->user_email
        );
    }

    private function algoritmos(): array
    {
        return [
            PublicKeyCredentialParameters::createPk(Algorithms::COSE_ALGORITHM_ES256),
            PublicKeyCredentialParameters::createPk(Algorithms::COSE_ALGORITHM_RS256),
        ];
    }

    /**
     * Opciones de registro de una credencial nueva.
     */
    public function opcionesRegistro(Request $request, User $usuario): array
    {
        $reto = $this->crearReto('registro', $usuario);

        $opciones = PublicKeyCredentialCreationOptions::create(
            $this->entidadRp($request),
            $this->entidadUsuario($usuario),
            $reto,
            $this->algoritmos(),
            AuthenticatorSelectionCriteria::create(
                null,
                AuthenticatorSelectionCriteria::USER_VERIFICATION_REQUIREMENT_REQUIRED,
                AuthenticatorSelectionCriteria::RESIDENT_KEY_REQUIREMENT_PREFERRED
            ),
            'none',
            $this->credencialesComoLista($usuario),
            120000
        );

        return [
            'reto' => $reto,
            'opciones' => $this->serializer()->serialize($opciones, 'json'),
        ];
    }

    /**
     * Verifica el alta de la credencial y la guarda.
     */
    public function registrarCredencial(Request $request, User $usuario, string $reto, array $respuesta, string $nombreDispositivo): ?Passkey
    {
        $challenge = $this->consumirReto($reto, 'registro');

        if (!$challenge || (int) $challenge->fk_id_usuario !== (int) $usuario->id_usuario) {
            return null;
        }

        $opciones = PublicKeyCredentialCreationOptions::create(
            $this->entidadRp($request),
            $this->entidadUsuario($usuario),
            $reto,
            $this->algoritmos(),
            AuthenticatorSelectionCriteria::create(
                null,
                AuthenticatorSelectionCriteria::USER_VERIFICATION_REQUIREMENT_REQUIRED,
                AuthenticatorSelectionCriteria::RESIDENT_KEY_REQUIREMENT_PREFERRED
            ),
            'none',
            [],
            120000
        );

        $attestation = $this->serializer()->denormalize(
            $respuesta,
            AuthenticatorAttestationResponse::class,
            'json'
        );

        $validador = AuthenticatorAttestationResponseValidator::create($this->gestorCeremoniaRegistro($request));
        $credencial = $validador->check($attestation, $opciones, $this->rpId($request));

        // El id de la credencial se guarda en base64url sin relleno (el mismo
        // texto que entrega el navegador) para poder compararlo sin ambiguedad.
        $credentialId = rtrim(Base64UrlSafe::encode($credencial->publicKeyCredentialId), '=');

        return Passkey::updateOrCreate(
            ['credential_id' => $credentialId],
            [
                'fk_id_usuario' => $usuario->id_usuario,
                'credencial' => $this->serializer()->serialize($credencial, 'json'),
                'contador' => (int) $credencial->counter,
                'nombre_dispositivo' => $nombreDispositivo ?: 'Este dispositivo',
                'transportes' => $this->transportes($respuesta['transports'] ?? []),
            ]
        );
    }

    /**
     * Opciones de autenticacion: reto nuevo, sin credenciales forzadas
     * (el autenticador elige la que tenga guardada en este dispositivo).
     */
    public function opcionesAutenticacion(Request $request): array
    {
        $reto = $this->crearReto('autenticacion');

        $opciones = PublicKeyCredentialRequestOptions::create(
            $reto,
            $this->rpId($request),
            [],
            PublicKeyCredentialRequestOptions::USER_VERIFICATION_REQUIREMENT_REQUIRED,
            120000
        );

        return [
            'reto' => $reto,
            'opciones' => $this->serializer()->serialize($opciones, 'json'),
        ];
    }

    /**
     * Verifica la firma de la huella y devuelve el usuario dueno de la credencial.
     */
    public function autenticar(Request $request, string $reto, string $credentialId, array $respuesta): ?User
    {
        $challenge = $this->consumirReto($reto, 'autenticacion');

        if (!$challenge) {
            return null;
        }

        if (!$credentialId) {
            return null;
        }

        $passkey = Passkey::where('credential_id', $credentialId)->first();

        if (!$passkey || !$passkey->credencial) {
            return null;
        }

        $opciones = PublicKeyCredentialRequestOptions::create(
            $reto,
            $this->rpId($request),
            [PublicKeyCredentialDescriptor::create(
                PublicKeyCredentialDescriptor::CREDENTIAL_TYPE_PUBLIC_KEY,
                // La libreria compara el id en crudo (el serializador lo
                // convierte a base64url cuando se lo envia al navegador).
                $this->idEnCrudo($credentialId)
            )],
            PublicKeyCredentialRequestOptions::USER_VERIFICATION_REQUIREMENT_REQUIRED,
            120000
        );

        $assertion = $this->serializer()->denormalize(
            $respuesta,
            AuthenticatorAssertionResponse::class,
            'json'
        );

        // La credencial guardada es un JSON: se deserializa completa (clave
        // publica, contador, aaguid y ruta de confianza).
        $registro = $this->serializer()->deserialize(
            $passkey->credencial,
            CredentialRecord::class,
            'json'
        );

        $validador = AuthenticatorAssertionResponseValidator::create($this->gestorCeremoniaPeticion($request));
        $credencial = $validador->check(
            $registro,
            $assertion,
            $opciones,
            $this->rpId($request),
            $registro->userHandle ?: null
        );

        $passkey->update([
            'contador' => (int) $credencial->counter,
            'ultimo_uso_en' => now(),
        ]);

        return $passkey->user;
    }

    /**
     * Convierte un id de credencial en base64url a su forma en crudo.
     */
    private function idEnCrudo(string $credentialId): string
    {
        return Base64UrlSafe::decode(rtrim($credentialId, '='));
    }

    /**
     * Los transportes llegan como lista y se guardan separados por coma.
     */
    private function transportes($transportes): ?string
    {
        if (is_string($transportes)) {
            $transportes = array_filter(array_map('trim', explode(',', $transportes)));
        }

        if (!is_array($transportes) || count($transportes) === 0) {
            return null;
        }

        return implode(',', $transportes);
    }

    private function credencialesComoLista(User $usuario): array
    {
        $lista = [];

        foreach (Passkey::where('fk_id_usuario', $usuario->id_usuario)->get() as $credencial) {
            $lista[] = PublicKeyCredentialDescriptor::create(
                PublicKeyCredentialDescriptor::CREDENTIAL_TYPE_PUBLIC_KEY,
                $this->idEnCrudo($credencial->credential_id),
                $credencial->transportes ? explode(',', $credencial->transportes) : []
            );
        }

        return $lista;
    }
}
