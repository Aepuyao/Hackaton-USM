# Fotos de baños y cafeterías

Se referencian desde `restrooms.json` y `cafes.json`, en la lista `photos` de cada lugar.

Cafeterías: `kiosko.jpeg`, `cafe_cara.jpeg`, `cafe_c.jpeg`, `cafe_p.jpeg`.
Si falta una foto, el popup muestra "Foto pendiente".

Ejemplo (baños, con piso y hombres/mujeres):

```json
"photos": [
  { "src": "img/edificio_1a_hombre.jpeg", "floor": 1, "gender": "men" },
  { "src": "img/edificio_1a_mujer.jpeg",  "floor": 1, "gender": "women" }
]
```

- `floor` (opcional): número de piso, se muestra como "Piso 1" / "Floor 1"…
- `gender` (opcional): `"men"` o `"women"`. Sin `gender` (baño para todos) no lleva etiqueta.
- Con más de una foto, el popup muestra un carrusel ‹ ›.

Recomendado: menos de 300 KB por foto. Para achicar una:

    ffmpeg -i original.jpg -vf scale=1000:-2 -q:v 5 img/nombre.jpeg
