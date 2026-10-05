<?php

it('keeps the backend palette in sync with the kit', function () {
    $source = file_get_contents(base_path('../kit/src/palette.ts'));
    preg_match_all("/^\s+(\w+): '(#[0-9A-F]{6})',/m", $source, $m);
    $kit = array_combine($m[1], $m[2]);

    expect(config('palette'))->toBe($kit);
});
