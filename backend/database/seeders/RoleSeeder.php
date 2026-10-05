<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['super_admin', 'zone_admin'] as $role) {
            Role::findOrCreate($role);
        }
    }
}
