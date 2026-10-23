<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class CleanExpiredTokens extends Command
{
    protected $signature = 'tokens:clean';
    protected $description = 'Elimina tokens de recuperación expirados o ya usados';

    public function handle(): int
    {
        $deleted = DB::table('token_recovery')
            ->where('token_used', true)
            ->orWhere('token_exp', '<', now())
            ->delete();

        $this->info("Se eliminaron {$deleted} tokens expirados/usados.");
        return Command::SUCCESS;
    }
}
