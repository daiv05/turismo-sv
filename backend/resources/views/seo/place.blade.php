@extends('seo.app')
@section('content')
<main>
    <h1>{{ $place->name }}</h1>
    <p>{{ $place->category->name }}</p>
    @if($place->summary)<p>{{ $place->summary }}</p>@endif
    @if($place->description)<p>{{ $place->description }}</p>@endif
</main>
@endsection
