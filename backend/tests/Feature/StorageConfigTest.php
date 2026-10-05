<?php

it('serves stored files publicly because models, thumbnails and tiles are public assets', function () {
    expect(config('filesystems.disks.s3.visibility'))->toBe('public');
});

it('gives the browser a public base URL for stored files', function () {
    config(['filesystems.disks.s3.url' => 'http://localhost:8333/turismo']);

    expect(Storage::disk('s3')->url('models/1/v1/model.glb'))->toBe('http://localhost:8333/turismo/models/1/v1/model.glb');
});
