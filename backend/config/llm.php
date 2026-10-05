<?php

$input = env('LLM_PRICE_INPUT');

return [
    'pricing' => $input === null ? null : [
        'input' => (float) $input,
        'output' => (float) env('LLM_PRICE_OUTPUT', 0),
        'cache_read' => (float) env('LLM_PRICE_CACHE_READ', 0),
        'cache_write' => (float) env('LLM_PRICE_CACHE_WRITE', 0),
    ],
];
