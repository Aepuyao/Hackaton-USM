# Hackaton-USM

# Equipo "Capitan Epuyao"

Los integrantes de este equipo son:
* Alonso Epuyao
* Cristobal Cayuqueo
* Christian Mauch

## Descripcion del prototipo

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

## Idiomas

La página está en español, inglés, francés y alemán (selector 🌐 arriba a la derecha).
Se recuerda la elección; la primera vez se usa el idioma del navegador. También se puede
forzar con `?lang=en`, `?lang=fr` o `?lang=de`.

- Textos de la interfaz: `js/i18n.js` (`STRINGS`). Para agregar un texto, ponerlo en los 4 idiomas.
- Nombres de lugares: en `graph.json`, `"names": { "en": …, "fr": …, "de": … }` en cada nodo.
  Si falta una traducción se muestra el nombre en español (el validador avisa).

## Comandos útiles

**Los nodos (landmarks) se editan a mano en `graph.json`; las aristas las genera
`tools/build-walk-paths.py`** a partir de la red peatonal de OpenStreetMap
(`tools/osm-ways.json`). Solo conecta landmarks vecinos: si el camino de X a Y pasa
cerca de Z, la ruta va X → Z → Y. Después de agregar o mover un nodo:

```bash
python3 tools/build-walk-paths.py  # regenera aristas (path + seconds)
bash tools/make-mock-videos.sh     # clips de relleno para aristas nuevas
node tools/validate-graph.mjs
```

Para revisar todos los tramos en el mapa: `http://localhost:8000/?revisar`.

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

Para ver los cinco clips grabados en el campus, elige un tramo en **Tramos grabados** y pulsa **Ir**. Por ejemplo, prueba **Edificio A → Ingeniería Comercial**. Los demás tramos pueden usar videos de prueba. Para ver una toma sin caminar, deja desactivada la reproducción por movimiento.

Marca las aristas con una grabación real como `"recorded": true` en `graph.json` para que aparezcan en ese selector.

```bash
for f in raw/*.mp4; do
  ffmpeg -i "$f" -vf scale=-2:720 -c:v libx264 -preset veryfast -crf 28 -movflags +faststart -an "videos/$(basename "$f")"
done
```

## Notas

- El `<video>` debe llevar `muted playsinline`, y la reproducción debe partir después de que el usuario toque "Ir"; si no, el celular bloquea el autoplay.
- Solo se suben a git los clips comprimidos (`videos/`). Los originales (`raw/`) no se suben.

## Reproducción por movimiento

El recorrido se reproduce normalmente al abrir la app. Activa **Reproducción automática por movimiento** para que el video avance cuando el GPS confirme que estás caminando. Si se pierde temporalmente la señal, el video espera lecturas fiables. Si el navegador no ofrece geolocalización o el permiso se deniega, la app usa la reproducción normal.

Para probarlo sin caminar, abre [http://localhost:8000/?mockGps=1](http://localhost:8000/?mockGps=1). Elige un recorrido, pulsa **Ir**, activa el interruptor y usa **Mover** y **Detener**. La simulación sigue la línea del recorrido elegido y el indicador cambia después de varias lecturas. Puedes ajustar la velocidad desde el mismo panel.

Con el control por movimiento activo, la app mide la polilínea y muestra la distancia restante y la velocidad de avance. La duración de cada clip representa la longitud de su tramo. El reproductor ajusta la tasa según la distancia pendiente y la velocidad GPS, y pasa al siguiente clip cuando la ubicación alcanza el fin del tramo. La llegada se estima dentro de la precisión del GPS. Para que el recorrido se vea natural, graba cada clip de extremo a extremo a un ritmo uniforme.

Con el control por movimiento activo, cada tramo empieza con una vista previa de 17 segundos a 1× para orientar la salida. Los clips breves muestran una vista previa proporcional. Después, la reproducción continúa desde ese punto según el avance GPS.

El seguimiento acepta una desviación lateral de 18 a 30 m según la precisión del GPS. Una vez sobre el recorrido, se toleran 5 m adicionales antes de pausarlo por desvío.
