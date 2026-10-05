<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * Fixed grid shared with the frontend engine. Cell `{z}/{x}/{y}` covers scene meters
 * [x * size, (x + 1) * size) east and [y * size, (y + 1) * size) south of the scene origin.
 */
final class CellGrid
{
    private static ?array $origin = null;

    public function __construct(
        public readonly int $z,
        public readonly int $x,
        public readonly int $y,
    ) {}

    /**
     * @throws InvalidArgumentException When the key is not `{z}/{x}/{y}` or the level does not exist.
     */
    public static function parse(string $key): self
    {
        if (! preg_match('#^(\d+)/(-?\d+)/(-?\d+)$#', $key, $m)) {
            throw new InvalidArgumentException("Malformed cell key: {$key}");
        }
        if ((int) $m[1] >= count(config('cells.sizes'))) {
            throw new InvalidArgumentException("Unknown cell level in key: {$key}");
        }

        return new self((int) $m[1], (int) $m[2], (int) $m[3]);
    }

    public function key(): string
    {
        return "{$this->z}/{$this->x}/{$this->y}";
    }

    public function size(): int
    {
        return config('cells.sizes')[$this->z];
    }

    /**
     * SQL condition limiting `$column` (a WGS84 point) to this cell. The spatial index narrows candidates with
     * a densified envelope and an exact UTM comparison assigns each point to exactly one cell.
     *
     * @return array{0: string, 1: array<int, float>}
     */
    public function sqlWithin(string $column): array
    {
        [$e0, $n0] = self::origin();
        $size = $this->size();
        $minE = $e0 + $this->x * $size;
        $maxE = $minE + $size;
        $maxN = $n0 - $this->y * $size;
        $minN = $maxN - $size;
        $srid = (int) config('cells.srid');

        $sql = "ST_Intersects({$column}, ST_Transform(ST_Segmentize(ST_MakeEnvelope(?, ?, ?, ?, {$srid}), 250), 4326))"
            ." AND ST_X(ST_Transform({$column}, {$srid})) >= ? AND ST_X(ST_Transform({$column}, {$srid})) < ?"
            ." AND ST_Y(ST_Transform({$column}, {$srid})) > ? AND ST_Y(ST_Transform({$column}, {$srid})) <= ?";

        return [$sql, [$minE - 1, $minN - 1, $maxE + 1, $maxN + 1, $minE, $maxE, $minN, $maxN]];
    }

    /**
     * UTM coordinates of the scene origin.
     *
     * @return array{0: float, 1: float}
     */
    private static function origin(): array
    {
        if (self::$origin === null) {
            $o = config('cells.origin');
            $srid = (int) config('cells.srid');
            $row = DB::selectOne(
                "select ST_X(p) as e, ST_Y(p) as n from (select ST_Transform(ST_SetSRID(ST_MakePoint(?, ?), 4326), {$srid}) as p) t",
                [$o['lon'], $o['lat']],
            );
            self::$origin = [(float) $row->e, (float) $row->n];
        }

        return self::$origin;
    }
}
