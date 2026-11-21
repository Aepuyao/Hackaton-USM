# Plan de trabajo: MVP de navegación con video – USM Casa Central

**Duración:** 5 horas · **Equipo:** 3 personas · **Stack:** HTML/JS puro + Leaflet, sin backend

> **Objetivo clave:** a la hora 2 el flujo A→B tiene que funcionar de punta a punta, aunque sea con videos falsos.

---

## 1. Problema y solución

- **Problema:** a los alumnos nuevos y a los visitantes les cuesta orientarse en el campus Casa Central.
- **Solución:** el usuario elige un **origen (A)** y un **destino (B)**, y la app muestra:
  1. Un mapa con la ruta trazada.
  2. Una secuencia continua de videos cortos con el recorrido.
- **Modelo:** el campus es un **grafo conexo**. Los nodos son edificios o hitos y las aristas son los tramos entre vecinos, cada una con su video. La ruta se calcula con Dijkstra y se encadenan los videos de cada tramo.

---

## 2. Arquitectura mínima viable

```
/index.html        ← UI: 2 selects + mapa + reproductor
/app.js            ← Dijkstra + dibujo de la ruta + cola de videos
/graph.json        ← nodos y aristas (la fuente de verdad)
/videos/A__B.mp4   ← un clip por arista y por sentido
```

| Pieza | Elección | Por qué |
|---|---|---|
| Mapa | **Leaflet + OpenStreetMap** con lat/lng reales | Se instala con 1 `<script>` y no pide API key. Plan B: plano como imagen con `L.CRS.Simple` |
| Ruta | `L.polyline` con las coordenadas de los nodos del camino | Son 3 líneas de código |
| Camino más corto | Dijkstra en JS (~30 líneas), sin librería | El grafo tiene unos 12 nodos |
| Peso de arista | **Duración del clip en segundos** | "Más corto" = "menos tiempo caminando", sin medir distancias |
| Video | Un solo `<video>` que en `ended` carga el siguiente clip de la cola | Parece un video continuo sin editar ni unir nada |
| Deploy | GitHub Pages o Netlify | URL pública en 2 minutos |
| Media | Celular en horizontal, comprimido a 720p con ffmpeg | Cada clip queda en unos 2–5 MB |

### Esquema de `graph.json` (se congela en los primeros 20 minutos)

```json
{
  "nodes": [
    { "id": "acceso", "name": "Acceso principal Av. España", "lat": -33.0350, "lng": -71.5960 }
  ],
  "edges": [
    { "from": "acceso", "to": "biblioteca", "video": "videos/acceso__biblioteca.mp4", "seconds": 35 },
    { "from": "biblioteca", "to": "acceso", "video": "videos/biblioteca__acceso.mp4", "seconds": 33 }
  ]
}
```

> ⚠️ **Las aristas son dirigidas.** Hay que grabar ida y vuelta: reproducir al revés no funciona bien en el navegador.
> Las coordenadas y los nombres son de ejemplo; hay que reemplazarlos por los reales.

### Compresión de videos

```bash
for f in raw/*.mp4; do
  ffmpeg -i "$f" -vf scale=-2:720 -c:v libx264 -preset veryfast -crf 28 -an "videos/$(basename "$f")"
done
```

---

## 3. Roles

| Persona | Rol | Foco |
|---|---|---|
| **P1** | Frontend/Mapa | Leaflet, selects, polyline, diseño responsivo |
| **P2** | Lógica/Grafo | JSON, Dijkstra, reproductor secuencial, deploy |
| **P3** | Contenido/Media | Nodos, coordenadas, grabación y compresión (en terreno) |

---

## 4. Cronograma hora por hora

| Hora | P1 (Front) | P2 (Lógica) | P3 (Media) | 🎯 Hito |
|---|---|---|---|---|
| **0:00–0:20** | *Todos juntos:* definir 8 a 12 nodos, dibujar el grafo en papel, congelar el esquema JSON y elegir **2 rutas demo "doradas"** | | | Esquema congelado |
| **0:20–1:00** | Esqueleto HTML, Leaflet centrado en el campus, marcadores desde el JSON | Dijkstra + `graph.json` mock con videos de relleno | Coordenadas reales de cada nodo y un clip de prueba | **H1:** el mapa muestra los nodos |
| **1:00–2:00** | Selects A/B, botón "Ir", polyline de la ruta | Cola de video en `ended` + overlay "Tramo 2/4: X → Y" | Grabar primero las aristas de las rutas doradas (ida y vuelta) | **H2:** A→B funciona con videos falsos |
| **2:00–3:00** | Resaltar el tramo activo + marcador "estás aquí" | Script ffmpeg por lotes + validador del grafo | Grabar el resto y subir el primer lote | **H3:** ruta dorada #1 con videos reales |
| **3:00–4:00** | Diseño responsivo para celular | Precarga, fallback de errores y deploy | Cerrar grabaciones, regrabar los clips malos y completar el JSON | **H4 (3:45):** URL pública · 🔒 **freeze a las 4:00** |
| **4:00–5:00** | Pulido visual, título y logo | Bug bash: probar todas las rutas A→B | Grabar el video de respaldo de la demo | Pitch ensayado 2 veces + demo offline como plan B |

**Regla:** si un hito no se cumple a su hora, se recorta alcance (menos nodos) y no se mueve el hito.

---

## 5. Qué NO hacer 🚫

- **Login, usuarios, favoritos o historial.** Nadie los va a evaluar.
- **Backend o base de datos.** El JSON estático alcanza.
- **Unir videos en el servidor** (ffmpeg concat, streaming). La cola en el cliente da el mismo efecto.
- **Panel para editar el grafo.** Se edita el JSON a mano.
- **GPS o geolocalización en vivo.** Los permisos y la precisión fallan en la demo.
- **Navegación indoor** por pisos o salas. Solo edificios y hitos exteriores.
- **Rutas alternativas o A\*.** Dijkstra sobre 12 nodos es instantáneo.
- **Caminos curvos reales.** La línea recta entre nodos basta.
- **Reproducir videos al revés** para ahorrarse la vuelta. Se ve raro y falla en Safari.
- **Editar videos** con transiciones, música o subtítulos quemados. El overlay HTML basta.
- **Framework con build** (Next, Angular) si no lo dominan todos.
- **Agregar nodos después de las 4:00.** Es la forma más típica de romper una demo.

---

## 6. Pitch

Abran con una ruta dorada en vivo y después muestren el grafo (en papel o como diapositiva). Eso demuestra que la solución escala a todo el campus.
