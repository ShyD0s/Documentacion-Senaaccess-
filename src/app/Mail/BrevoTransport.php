<?php

namespace App\Mail;

use GuzzleHttp\Client;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\MessageConverter;

class BrevoTransport extends AbstractTransport
{
    public function __construct(
        private readonly string $apiKey,
        private readonly string $fromEmail,
        private readonly string $fromName,
    ) {
        parent::__construct();
    }

    public function __toString(): string
    {
        return 'brevo';
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());

        $to = [];
        foreach ($email->getTo() as $address) {
            $recipient = ['email' => $address->getAddress()];
            if ($address->getName() !== '') {
                $recipient['name'] = $address->getName();
            }
            $to[] = $recipient;
        }

        $payload = [
            'sender' => [
                'name' => $this->fromName,
                'email' => $this->fromEmail,
            ],
            'to' => $to,
            'subject' => $email->getSubject(),
        ];

        $html = (string) ($email->getHtmlBody() ?: $email->getTextBody());
        if ($html !== '') {
            $payload['htmlContent'] = $html;
        }
        $text = (string) $email->getTextBody();
        if ($text !== '') {
            $payload['textContent'] = $text;
        }

        $client = new Client(['timeout' => 15]);
        $client->post('https://api.brevo.com/v3/smtp/email', [
            'headers' => [
                'api-key' => $this->apiKey,
                'Accept' => 'application/json',
                'Content-Type' => 'application/json',
            ],
            'json' => $payload,
        ]);
    }
}