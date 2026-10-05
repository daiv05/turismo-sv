<?php

namespace App\Domain\Categories;

enum CategoryKind: string
{
    case Attraction = 'attraction';
    case Service = 'service';
    case Commerce = 'commerce';
}
