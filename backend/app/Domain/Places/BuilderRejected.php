<?php

namespace App\Domain\Places;

use RuntimeException;

/** The builder service understood the request and refused it; retrying will not help. */
class BuilderRejected extends RuntimeException
{
    /**
     * @param  list<array{rule?: string, path?: string, message?: string}>  $violations
     */
    public function __construct(string $message, public readonly array $violations = [])
    {
        parent::__construct($message);
    }
}
