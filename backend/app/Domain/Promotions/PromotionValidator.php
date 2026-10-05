<?php

namespace App\Domain\Promotions;

use Illuminate\Validation\ValidationException;

/**
 * Invariants of a promotion that must hold however it is saved: a sensible window and a sprite that the viewer
 * can actually draw.
 */
final class PromotionValidator
{
    /** @throws ValidationException */
    public function validate(Promotion $promotion): void
    {
        $errors = [];

        if ($promotion->starts_at === null || $promotion->ends_at === null || ! $promotion->ends_at->greaterThan($promotion->starts_at)) {
            $errors['ends_at'][] = 'The promotion must end after it starts.';
        }

        $type = $promotion->sprite_type ?? 'static';
        if (in_array($type, ['static', 'spritesheet'], true) && blank($promotion->sprite_path)) {
            $errors['sprite_path'][] = 'An image is required for this sprite type.';
        }
        if ($type === 'spritesheet') {
            $cfg = config('promotions.spritesheet');
            $frames = (int) $promotion->sprite_frames;
            $cells = (int) $promotion->sprite_cols * (int) $promotion->sprite_rows;
            if ($frames < $cfg['min_frames'] || $frames > $cfg['max_frames']) {
                $errors['sprite_frames'][] = "A spritesheet needs between {$cfg['min_frames']} and {$cfg['max_frames']} frames.";
            } elseif ($cells < $frames) {
                $errors['sprite_cols'][] = 'The grid has fewer cells than frames.';
            }
            if ($promotion->sprite_fps < $cfg['min_fps'] || $promotion->sprite_fps > $cfg['max_fps']) {
                $errors['sprite_fps'][] = "Frames per second must be between {$cfg['min_fps']} and {$cfg['max_fps']}.";
            }
        }
        if ($type === 'template') {
            $this->validateTemplate($promotion, $errors);
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    /** @param  array<string, list<string>>  $errors */
    private function validateTemplate(Promotion $promotion, array &$errors): void
    {
        $templates = config('promotions.templates');
        $key = $promotion->template_key;
        if (! $key || ! isset($templates[$key])) {
            $errors['template_key'][] = 'Choose one of the available templates.';

            return;
        }

        $data = (array) ($promotion->template_data ?? []);
        foreach ($templates[$key]['data'] as $field => $rule) {
            $value = $data[$field] ?? null;
            if ($value === null || $value === '') {
                if ($rule['required']) {
                    $errors['template_data'][] = "{$field} is required for this template.";
                }

                continue;
            }
            if ($rule['type'] === 'int' && (! is_numeric($value) || (int) $value != $value || $value < $rule['min'] || $value > $rule['max'])) {
                $errors['template_data'][] = "{$field} must be a whole number between {$rule['min']} and {$rule['max']}.";
            }
            if ($rule['type'] === 'string' && (! is_string($value) || mb_strlen($value) > $rule['max'])) {
                $errors['template_data'][] = "{$field} must be text of up to {$rule['max']} characters.";
            }
        }
    }
}
