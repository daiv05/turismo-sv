<?php

use App\Models\User;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Role::findOrCreate('super_admin');
    Role::findOrCreate('zone_admin');
});

it('lets admins into the panel', function (string $role) {
    $user = User::factory()->create()->assignRole($role);

    $this->actingAs($user)->get('/admin')->assertOk();
})->with(['super_admin', 'zone_admin']);

it('keeps users without an admin role out of the panel', function () {
    $this->actingAs(User::factory()->create())->get('/admin')->assertForbidden();
});

it('redirects guests to the login page', function () {
    $this->get('/admin')->assertRedirect('/admin/login');
});
