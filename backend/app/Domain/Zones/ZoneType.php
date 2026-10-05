<?php

namespace App\Domain\Zones;

enum ZoneType: string
{
    case Country = 'country';
    case Department = 'department';
    case Municipality = 'municipality';
    case TouristDistrict = 'tourist_district';
}
