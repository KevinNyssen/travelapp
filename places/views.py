from django.shortcuts import render
from .models import Place
import json


def home(request):
    places = list(Place.objects.values())
    return render(request, "places/home.html", {
        "places_json": json.dumps(places)
    })
