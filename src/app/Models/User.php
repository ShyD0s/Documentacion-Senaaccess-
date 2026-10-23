<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Facades\URL;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $table = 'usuarios';
    protected $primaryKey = 'id_usuario';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'user_identification',
        'user_name',
        'user_lastname',
        'user_email',
        'user_password',
        'email_verified_at',
        'two_factor_enabled',
        'trusted_device_id',
        'user_coursenumber',
        'user_program',
        'user_documento_tipo',
        'user_telefono',
        'fk_id_rol',
        'estado_cuenta',
        'profile_photo_path',
        'guest_qr_token',
        'guest_qr_expires_at',
        'guest_qr_used',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'user_password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'user_password' => 'hashed',
        'email_verified_at' => 'datetime',
        'two_factor_enabled' => 'boolean',
        'guest_qr_expires_at' => 'datetime',
        'guest_qr_used' => 'boolean',
    ];

    public function getAuthPassword()
    {
        return $this->user_password;
    }

    public function getEmailForVerification()
    {
        return $this->user_email;
    }

    public function hasVerifiedEmail()
    {
        return !is_null($this->email_verified_at);
    }

    public function markEmailAsVerified()
    {
        $this->forceFill(['email_verified_at' => $this->freshTimestamp()])->save();
        return $this;
    }

    public function sendEmailVerificationNotification()
    {
        try {
            $url = URL::temporarySignedRoute(
                'verification.verify',
                now()->addMinutes(60),
                ['id' => $this->getKey(), 'hash' => sha1($this->getEmailForVerification())]
            );
            $this->notify(new \App\Notifications\VerifyEmailSena($url));
        } catch (\Throwable $e) {
            // Si el transporte de correo falla, el registro no debe colgarse ni devolver error:
            // la cuenta se crea igual y el correo puede reenviarse desde la app más tarde.
            \Illuminate\Support\Facades\Log::error("No se pudo enviar el correo de verificacion: " . $e->getMessage());
        }
    }

    public function role()
    {
        return $this->belongsTo(Role::class, 'fk_id_rol', 'id_rol');
    }

    public function ingresos()
    {
        return $this->hasMany(Ingreso::class, 'fk_id_user', 'id_usuario');
    }

    public function ingreso_equipos()
    {
        return $this->hasMany(IngresoEquipo::class, 'fk_id_usuario', 'id_usuario');
    }

    public function novedades()
    {
        return $this->hasMany(Novedad::class, 'fk_id_usuario', 'id_usuario');
    }

    public function notificaciones()
    {
        return $this->hasMany(Notificacion::class, 'fk_id_usuario', 'id_usuario');
    }

    public function token_recovery()
    {
        return $this->hasMany(TokenRecovery::class, 'fk_id_usuario', 'id_usuario');
    }
    /**
     * Sube una imagen a Cloudinary y actualiza el campo profile_photo_path.
     * 
     * @param \Illuminate\Http\UploadedFile $file
     * @return string URL de la imagen subida
     */
    public function updateProfilePhoto($file)
    {
        $path = $file->storeOnCloudinary('avatars')->getSecurePath();
        $this->update(['profile_photo_path' => $path]);
        return $path;
    }
}