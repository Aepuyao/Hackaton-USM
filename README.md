# Hackaton-USM

MVP de navegación con video para el campus Casa Central de la USM. El usuario elige un origen (A) y un destino (B), y la app muestra la ruta en un mapa junto con una secuencia de videos del recorrido.

## Tecnologías

| Para qué | Tecnología | Por qué |
|---|---|---|
| Página | HTML + CSS + JavaScript puro (`index.html` + `app.js`) | Sin npm, sin build ni configuración |
| Mapa | [Leaflet](https://leafletjs.com/) por CDN + tiles de OpenStreetMap | 1 `<script>` y no pide API key |
| Datos | `graph.json` estático (nodos y aristas) | No hace falta backend ni base de datos |
| Ruta | Dijkstra implementado a mano (~30 líneas) | El grafo es chico (~12 nodos) |
| Video | `<video>` HTML5 nativo, con una cola de clips que avanza en el evento `ended` | Se ve continuo sin unir videos |
| Compresión | ffmpeg (H.264, 720p, sin audio) | Clips de 2–5 MB cada uno |
| Servidor local | Live Server (VS Code) o `python3 -m http.server` | `fetch()` no funciona con `file://` |
| Deploy | GitHub Pages | URL pública en 2 minutos |

**No usamos:** frameworks (React, Next, Angular), backend, Google Maps API, TypeScript ni GPS.

## Estructura

```
index.html               ← UI: selects A/B + mapa + reproductor (P1)
app.js                   ← conecta UI, mapa y lógica (P1)
js/route.js              ← carga del grafo + Dijkstra (P2)
js/player.js             ← reproductor secuencial con precarga y fallback (P2)
graph.json               ← nodos y aristas (fuente de verdad)
videos/A__B.mp4          ← un clip por arista y por sentido
logica.html              ← página de prueba de la lógica, sin mapa
tests/                   ← tests de Dijkstra
tools/validate-graph.mjs ← validador del grafo
tools/make-mock-videos.sh← genera clips de relleno para aristas sin video
```

## API de lógica (para `app.js`)

```js
import { loadGraph, route, pathNodes, totalSeconds } from './js/route.js';
import { createPlayer } from './js/player.js';

const graph = await loadGraph('graph.json');

const player = createPlayer({
  container: document.getElementById('player'), // div donde se insertan los <video>
  overlay: document.getElementById('overlay'),  // muestra "Tramo 2/4: X → Y"
  graph,
  onSegment: (i, edge) => { /* resaltar tramo i en el mapa (F5) */ },
  onFinish: () => {},
});

// Dentro del click de "Ir" (necesario para el autoplay en celular):
const edges = route(graph, a, b);      // [aristas] · [] si a === b · null si no hay camino
const latlngs = pathNodes(graph, edges).map(n => [n.lat, n.lng]); // para L.polyline
player.play(edges);
```

Los `<video>` que crea el reproductor tienen la clase `route-video`, así que se pueden estilar con CSS (por ejemplo `width: 100%`).

## Comandos útiles

```bash
node --test 'tests/*.test.mjs'     # tests de Dijkstra
node tools/validate-graph.mjs      # revisar graph.json y videos
bash tools/make-mock-videos.sh     # clips de relleno para aristas sin video
```

## Correr en local

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Comprimir videos

```bash
for f in raw/*.mp4; do
  ffmpeg -i "$f" -vf scale=-2:720 -c:v libx264 -preset veryfast -crf 28 -movflags +faststart -an "videos/$(basename "$f")"
done
```

## Notas

- El `<video>` debe llevar `muted playsinline`, y la reproducción debe partir después de que el usuario toque "Ir"; si no, el celular bloquea el autoplay.
- Solo se suben a git los clips comprimidos (`videos/`). Los originales (`raw/`) no se suben.
