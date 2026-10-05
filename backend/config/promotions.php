<?php

return [
    'templates' => [
        'percent-off' => ['label' => 'Percent off', 'data' => ['value' => ['type' => 'int', 'min' => 1, 'max' => 99, 'required' => true]]],
        'two-for-one' => ['label' => '2x1', 'data' => []],
        'new' => ['label' => 'New', 'data' => []],
        'free-gift' => ['label' => 'Free gift', 'data' => ['item' => ['type' => 'string', 'max' => 30, 'required' => false]]],
    ],
    'spritesheet' => ['min_frames' => 2, 'max_frames' => 64, 'min_fps' => 1, 'max_fps' => 30],
];
