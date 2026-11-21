# Issues: MVP de navegación con video – USM Casa Central

**Total estimado:** 490 min de trabajo, repartidos en 3 personas × 5 h (≈ 900 min). El margen es a propósito.

| Área | Responsable | Issues | Minutos |
|---|---|---|---|
| 🗺️ Frontend | P1 | F1–F6 | 145 |
| 🧠 Lógica/Grafo | P2 | L1–L6 | 150 |
| 🎥 Contenido/Media | P3 | M1–M6 | 195 |

**Orden crítico:** L1 → (F1, F2, L2) → (F3, F4, L3) → M3 → integración de videos reales → L6

---

## 🗺️ Frontend

### F1 · Esqueleto de la app y mapa base
**Labels:** `frontend` · **Estimado:** 20 min · **Hora:** 1

Crear `index.html` con Leaflet y tiles de OpenStreetMap, centrado en Casa Central.

**Criterio de aceptación**
- [ ] El mapa carga sin errores en la consola
- [ ] El zoom inicial muestra el campus completo

---

### F2 · Renderizar los nodos desde el JSON
**Labels:** `frontend` · **Estimado:** 20 min · **Hora:** 1 · **Depende de:** L1

Hacer `fetch('graph.json')` y dibujar un marcador con popup (nombre) por cada nodo.

**Criterio de aceptación**
- [ ] Agregar un nodo al JSON hace que aparezca en el mapa sin tocar código

---

### F3 · Selector de origen y destino
**Labels:** `frontend` · **Estimado:** 20 min · **Hora:** 2

Dos `<select>` poblados desde los nodos y un botón "Ir".

**Criterio de aceptación**
- [ ] No permite elegir A = B
- [ ] "Ir" llama a `route(a, b)` y pasa el resultado al mapa y al reproductor

---

### F4 · Dibujar la ruta en el mapa
**Labels:** `frontend` · **Estimado:** 25 min · **Hora:** 2 · **Depende de:** L2

Dibujar un `L.polyline` con las coordenadas de los nodos del camino y ajustar el zoom con `fitBounds`. Al pedir una ruta nueva se borra la anterior.

**Criterio de aceptación**
- [ ] Para cualquier A→B se ve la línea completa y el zoom se ajusta a ella
- [ ] No quedan rutas anteriores dibujadas

---

### F5 · Resaltar el tramo activo
**Labels:** `frontend` · **Estimado:** 30 min · **Hora:** 3 · **Depende de:** L3

Cambiar el color del segmento según el clip que se está reproduciendo, con un marcador "estás aquí" en el nodo de inicio del tramo.

**Criterio de aceptación**
- [ ] Al pasar al clip 2, se resalta el tramo 2 en el mapa

---

### F6 · Diseño responsivo para celular
**Labels:** `frontend` · **Estimado:** 30 min · **Hora:** 4

En pantallas angostas, el mapa va arriba y el video abajo.

**Criterio de aceptación**
- [ ] Se usa bien en un celular real, en vertical
- [ ] El video no se sale de la pantalla

---

## 🧠 Lógica/Grafo

### L1 · Esquema y mock de `graph.json`
**Labels:** `logica` `bloqueante` · **Estimado:** 15 min · **Hora:** 1

Definir el esquema (`nodes`: id, name, lat, lng · `edges`: from, to, video, seconds) y crear un mock con 5 nodos y videos de relleno.

**Criterio de aceptación**
- [ ] P1 y P2 pueden trabajar sin esperar a P3
- [ ] El esquema queda congelado y comunicado al equipo

---

### L2 · Dijkstra
**Labels:** `logica` · **Estimado:** 30 min · **Hora:** 1 · **Depende de:** L1

`route(a, b)` devuelve la lista ordenada de aristas del camino más corto, con peso = `seconds`.

**Criterio de aceptación**
- [ ] Caso probado: nodos adyacentes
- [ ] Caso probado: nodos lejanos
- [ ] Caso probado: sin camino → `null`

---

### L3 · Reproductor secuencial
**Labels:** `logica` `video` · **Estimado:** 40 min · **Hora:** 2 · **Depende de:** L2

Un solo `<video>` con una cola de clips. En `ended` carga y reproduce el siguiente. Overlay HTML con "Tramo 2/4: X → Y".

**Criterio de aceptación**
- [ ] Una ruta de 4 tramos se reproduce completa sin hacer clic
- [ ] El overlay muestra el tramo correcto en cada momento

---

### L4 · Precarga y fallback
**Labels:** `logica` `video` · **Estimado:** 30 min · **Hora:** 4

Precargar el siguiente clip con un `<video>` oculto. Si un clip da error, saltar al siguiente.

**Criterio de aceptación**
- [ ] No hay pantallazo negro de más de 1 s entre clips
- [ ] Un video faltante no rompe la demo

---

### L5 · Validador del grafo
**Labels:** `logica` `tooling` · **Estimado:** 20 min · **Hora:** 3

Script que revisa que existan todos los archivos de video, que cada arista tenga su sentido contrario y que el grafo sea conexo.

**Criterio de aceptación**
- [ ] Corre en menos de 1 s y lista los problemas encontrados

---

### L6 · Deploy
**Labels:** `logica` `deploy` · **Estimado:** 15 min · **Hora:** 4

Publicar en GitHub Pages o Netlify.

**Criterio de aceptación**
- [ ] La URL funciona en un celular con datos móviles (no solo en el wifi de la U)

---

## 🎥 Contenido/Media

### M1 · Definir nodos y coordenadas
**Labels:** `media` `bloqueante` · **Estimado:** 30 min · **Hora:** 1

Elegir entre 8 y 12 hitos reconocibles del campus y tomar su lat/lng real (clic derecho en Google Maps).

**Criterio de aceptación**
- [ ] Todos los nodos están en el JSON
- [ ] Sus coordenadas caen sobre el lugar correcto del mapa

---

### M2 · Guía de grabación
**Labels:** `media` · **Estimado:** 10 min · **Hora:** 1

Celular en horizontal, zoom 1x, caminar a ritmo normal, empezar y terminar **encuadrando el hito**.

**Criterio de aceptación**
- [ ] Un clip de prueba aprobado por el equipo

---

### M3 · Grabar las rutas doradas
**Labels:** `media` `prioridad` · **Estimado:** 50 min · **Hora:** 2

Grabar las aristas de las 2 rutas demo, en ambos sentidos.

**Criterio de aceptación**
- [ ] Clips en la carpeta con el formato `origen__destino.mp4`
- [ ] Duración anotada en `seconds`

---

### M4 · Grabar el resto de aristas
**Labels:** `media` · **Estimado:** 70 min · **Horas:** 3–4

Completar el grafo, en ambos sentidos.

**Criterio de aceptación**
- [ ] Cada arista del JSON tiene su clip
- [ ] El validador (L5) pasa sin errores

---

### M5 · Compresión en lote
**Labels:** `media` `tooling` · **Estimado:** 20 min · **Hora:** 3

ffmpeg a 720p, sin audio, H.264.

**Criterio de aceptación**
- [ ] Ningún clip pesa más de 6 MB
- [ ] Todos se reproducen en Chrome y Safari

---

### M6 · Video de respaldo de la demo
**Labels:** `media` `demo` · **Estimado:** 15 min · **Hora:** 5

Grabar la pantalla con la ruta dorada completa funcionando.

**Criterio de aceptación**
- [ ] El archivo está guardado en 2 computadores
