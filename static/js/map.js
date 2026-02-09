var map;
var startPoint = null;
var places = [];
var routingControls = [];
var routeDecorators = [];
var allRoutePlaces = [];

var routeColors = ["#e74c3c", "#3498db", "#2ecc71"];
var travelSpeed = { foot: 2.5, driving: 20 };


// Detiene a Leaflet pedir imágenes de marcadores por defecto (que no se usan en este proyecto) y evita errores 404 en la consola.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: '', iconUrl: '', shadowUrl: '' });


document.addEventListener("DOMContentLoaded", function () {

    map = L.map('map', {
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        dragging: true,
        tap: true
    }).setView([19.4326, -99.1332], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    map.on('click', function(e) {
        if (startPoint) map.removeLayer(startPoint);
        startPoint = L.circleMarker(e.latlng, {
            radius: 7,
            color: "#111",
            fillColor: "#2ecc71",
            fillOpacity: 1
        }).addTo(map).bindPopup("Start").openPopup();
    });

    fetch('/static/data/places.json')
        .then(res => res.json())
        .then(data => places = data);
});


// ================= Carga y muestra las rutas según los filtros seleccionados =================
function loadPlaces() {
    if (!startPoint) return alert("Click a start location on the map.");

    routingControls.forEach(rc => map.removeControl(rc));

    routeDecorators.forEach(r => {
        if (!r) return;
        map.removeLayer(r.line);
        map.removeLayer(r.decorator);
        if (r.markers) r.markers.forEach(m => map.removeLayer(m));
    });

    routingControls = [];
    routeDecorators = [];
    allRoutePlaces = [];
    document.getElementById("schedules").innerHTML = "";

    let purpose = document.getElementById("purpose").value;
    let mode = document.getElementById("transport").value === "foot" ? "foot" : "driving";
    let filtered = places.filter(p => !purpose || p.purpose === purpose);

    for (let i=0;i<3;i++) generateRouteOption(filtered.slice(), mode, i);
}


// ================= Generar ruta =================
function generateRouteOption(list, mode, index) {

    let startMinutes = getMinutesFromInput("startTime");
    let endMinutes = getMinutesFromInput("endTime");
    if (endMinutes <= startMinutes) endMinutes = 23*60+59;

    let currentTime = startMinutes;
    let current = startPoint.getLatLng();

    // Rutas ordenadas por distancia (cercanas, lejanas o aleatorias) para cada opción
    if (index === 0)
        list.sort((a,b)=>map.distance(current,[a.latitude,a.longitude]) - map.distance(current,[b.latitude,b.longitude]));
    else if (index === 1)
        list.sort((a,b)=>map.distance(current,[b.latitude,b.longitude]) - map.distance(current,[a.latitude,a.longitude]));
    else
        list.sort((a,b)=>map.distance(current,[a.latitude,a.longitude]) * (0.7+Math.random()*0.6));

    let waypoints = [current];
    let visitTimes = [];
    let usedPlaces = [];

    while (list.length) {
        let next = list.shift();
        let visitTime = Math.round(next.visit_time/2);

        let distKm = map.distance(current,[next.latitude,next.longitude])/1000;
        let travelTime = Math.round((distKm / travelSpeed[mode]) * 60);

        if (currentTime + travelTime + visitTime > endMinutes) break;

        waypoints.push(L.latLng(next.latitude,next.longitude));
        visitTimes.push({place:next, visitTime, travelTime});
        usedPlaces.push(next.name);

        currentTime += travelTime + visitTime;
        current = L.latLng(next.latitude,next.longitude);
    }

    // Filtrar visitas repetidas (si una ruta incluye un lugar más de una vez, solo se muestra la primera visita y se ignoran las siguientes)
    let filteredVisits = [];
    let filteredWaypoints = [waypoints[0]];

    visitTimes.forEach((v,i) => {
        let count = allRoutePlaces.filter(x => x === v.place.name).length;
        if (count < 2) {
            filteredVisits.push(v);
            filteredWaypoints.push(waypoints[i+1]);
            allRoutePlaces.push(v.place.name);
        }
    });

    if (filteredVisits.length === 0) return;

    visitTimes = filteredVisits;
    waypoints = filteredWaypoints;

    let scheduleHTML = `<div class="schedule" onclick="focusRoute(${index})"><h4 style="color:${routeColors[index]}">Route ${index+1}</h4>`;
    
    let rc = L.Routing.control({
        show:false,
        addWaypoints:false,
        draggableWaypoints:false,
        fitSelectedRoutes:false,
        routeWhileDragging:false,
        containerClassName:'hidden-routing',
        waypoints: waypoints,
        router: L.Routing.osrmv1({
            serviceUrl:'https://router.project-osrm.org/route/v1',
            profile: mode
        }),
        lineOptions:{styles:[]},
        createMarker:()=>null
    })
    .on('routesfound', function(e){

        let coords = e.routes[0].coordinates;

        let line = L.polyline(coords,{
            color:routeColors[index],
            weight:5,
            opacity:0.9
        }).addTo(map);

        let decorator = L.polylineDecorator(line,{
            patterns:[{
                offset:25,
                repeat:70,
                symbol:L.Symbol.arrowHead({
                    pixelSize:8,
                    polygon:false,
                    pathOptions:{color:routeColors[index]}
                })
            }]
        }).addTo(map);

        let markers = [];

        visitTimes.forEach(v => {

            let marker = L.circleMarker(
                [v.place.latitude, v.place.longitude],
                {
                    radius:7,
                    color:routeColors[index],
                    fillColor:routeColors[index],
                    fillOpacity:0.9
                }
            )
            .bindPopup(`<b>${v.place.name}</b><br>Visit: ${v.visitTime} min`)
            .addTo(map);

            // Mostrar el nombre del lugar como tooltip permanente al lado del marcador, con estilo personalizado
            marker.bindTooltip(
                v.place.name,
                {
                    permanent: true,
                    direction: "right",
                    offset: [10, 0],
                    opacity: 0.6,
                    className: "place-label"
                }
            );

            markers.push(marker);
        });


        routeDecorators[index] = {line, decorator, markers};

        let t = startMinutes;
        visitTimes.forEach(v=>{
            scheduleHTML += `🚗 ${formatTime(t)}–${formatTime(t+=v.travelTime)} Travel<br>`;
            scheduleHTML += `🏛 ${formatTime(t)}–${formatTime(t+=v.visitTime)} ${v.place.name}<br>`;
        });

        scheduleHTML += "</div>";
        document.getElementById("schedules").insertAdjacentHTML("beforeend",scheduleHTML);
    }).addTo(map);

    routingControls.push(rc);
}


// ================= Resaltar ruta seleccionada =================
function focusRoute(selectedIndex){
    routeDecorators.forEach((r,i)=>{
        if (!r) return;
        let active = i===selectedIndex;
        r.line.setStyle({opacity:active?1:0.15, weight:active?7:4});
        r.decorator.setPatterns(active?[{
            offset:25,
            repeat:70,
            symbol:L.Symbol.arrowHead({pixelSize:8,polygon:false,pathOptions:{color:routeColors[i]}})
        }]:[]);
        r.markers.forEach(m => m.setStyle({opacity:active?1:0.2, fillOpacity:active?0.9:0.2}));
    });
}


// ================= Funciones auxiliares (arreglar bugs de tiempo) =================
function getMinutesFromInput(id){
    let [h,m]=document.getElementById(id).value.split(":").map(Number);
    return h*60+m;
}

function formatTime(min){
    let h=Math.floor(min/60)%24;
    let m=min%60;
    let ampm=h>=12?"PM":"AM";
    let displayH=h%12||12;
    return `${displayH}:${String(m).padStart(2,'0')} ${ampm}`;
}
