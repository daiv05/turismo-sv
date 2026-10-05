<?php

namespace App\Console\Commands;

use App\Domain\Zones\Zone;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CreateAdmin extends Command
{
    protected $signature = 'admin:create {email} {--name=} {--super : Create a super admin} {--zone=* : Zone slugs for a zone admin} {--password= : Password, generated when omitted}';

    protected $description = 'Create a super admin or a zone admin for the panel';

    public function handle(): int
    {
        $email = (string) $this->argument('email');
        $super = (bool) $this->option('super');
        $slugs = (array) $this->option('zone');

        if (User::where('email', $email)->exists()) {
            $this->error("A user with the email {$email} already exists.");

            return self::FAILURE;
        }
        if (! $super && $slugs === []) {
            $this->error('A zone admin needs at least one --zone.');

            return self::FAILURE;
        }
        $zones = Zone::whereIn('slug', $slugs)->get();
        if ($zones->count() !== count(array_unique($slugs))) {
            $this->error('Unknown zone: '.implode(', ', array_diff($slugs, $zones->pluck('slug')->all())));

            return self::FAILURE;
        }

        $generated = $this->option('password') === null;
        $password = $generated ? Str::password(20, symbols: false) : (string) $this->option('password');
        if (strlen($password) < 12) {
            $this->error('The password must have at least 12 characters.');

            return self::FAILURE;
        }

        $user = User::create(['name' => $this->option('name') ?: Str::before($email, '@'), 'email' => $email, 'password' => Hash::make($password)]);
        $user->assignRole($super ? 'super_admin' : 'zone_admin');
        $user->zones()->sync($zones->pluck('id'));

        $this->info("Created {$email} as ".($super ? 'super_admin' : 'zone_admin').'.');
        if ($generated) {
            $this->line("Password: {$password}");
        }

        return self::SUCCESS;
    }
}
