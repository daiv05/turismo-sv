<?php

namespace App\Domain\Places;

use RuntimeException;

/** The builder service could not be reached or failed; the request can be retried. */
class BuilderUnavailable extends RuntimeException {}
