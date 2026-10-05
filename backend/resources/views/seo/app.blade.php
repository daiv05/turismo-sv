<!doctype html>
<html lang="{{ $locale }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }} · Turismo SV</title>
    <meta name="description" content="{{ $description }}">
    <link rel="canonical" href="{{ $canonical }}">
    <link rel="alternate" hreflang="es" href="{{ $canonical }}?lang=es">
    <link rel="alternate" hreflang="en" href="{{ $canonical }}?lang=en">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Turismo SV">
    <meta property="og:title" content="{{ $title }}">
    <meta property="og:description" content="{{ $description }}">
    <meta property="og:url" content="{{ $canonical }}">
    <meta property="og:image" content="{{ $image }}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="theme-color" content="#0F47AF">
    <link rel="manifest" href="/manifest.webmanifest">
    @isset($jsonLd)
    <script type="application/ld+json">{!! json_encode($jsonLd, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP) !!}</script>
    @endisset
    {!! $assets !!}
</head>
<body>
<div id="app">
    @yield('content')
</div>
</body>
</html>
