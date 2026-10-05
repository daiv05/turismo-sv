<?php

namespace App\Domain\Places;

enum ModelStatus: string
{
    case Queued = 'queued';
    case Generating = 'generating';
    case Draft = 'draft';
    case Approved = 'approved';
    case Rejected = 'rejected';
    case Failed = 'failed';
}
