<?php

namespace App\Domain\Places;

enum PlaceStatus: string
{
    case Draft = 'draft';
    case InReview = 'in_review';
    case Published = 'published';
    case Archived = 'archived';
}
