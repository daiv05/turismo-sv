@extends('seo.app')
@section('content')
<main>
    <h1>{{ $zone->name }}</h1>
    <ul>
        @foreach($places as $place)
        <li><a href="/lugar/{{ $place->slug }}">{{ $place->name }}</a></li>
        @endforeach
    </ul>
</main>
@endsection
