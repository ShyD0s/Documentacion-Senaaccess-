<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class TwoFactorCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public $code;
    public $aprobarUrl;
    public $denegarUrl;
    public $challengeId;
    public $nombre;

    /**
     * Create a new message instance.
     */
    public function __construct($code, $aprobarUrl, $denegarUrl, $challengeId = null, $nombre = '')
    {
        $this->code = $code;
        $this->aprobarUrl = $aprobarUrl;
        $this->denegarUrl = $denegarUrl;
        $this->challengeId = $challengeId;
        $this->nombre = $nombre;
    }

    /**
     * Get the message envelope.
     */
    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Tu código SENA Access es ' . $this->code . ' — vence en 10 minutos',
        );
    }

    /**
     * Get the message content definition.
     */
    public function content(): Content
    {
        return new Content(
            view: 'emails.two_factor_code',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array<int, \Illuminate\Mail\Mailables\Attachment>
     */
    public function attachments(): array
    {
        return [];
    }
}