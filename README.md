# Mis juegos

Central de juegos de mesa digitales para jugar en un solo teléfono, tablet o computador. Es una web instalable (PWA): abre en cualquier navegador, se instala como app y funciona sin internet.

## Juegos

- **Ambicioso**: dados, 2 o más jugadores. Se lanzan 4 dados; los 1 y los 5 suman, los tríos y pókeres también. Si ningún dado sirve es *sancocho* y se pierde lo acumulado en el turno.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173/mis-juegos/
npm test         # pruebas de las reglas
npm run build    # genera dist/
```

## Estructura

```
src/
  central/            pantallas de la central: juegos, historial, jugadores, ajustes
  motor/              piezas comunes: contrato de juegos, azar con semilla, guardado
  ui/                 dados, estilos, sonidos y vibración, agitar, quién empieza
  juegos/
    catalogo.ts       lista de juegos de la central
    ambicioso/
      reglas/         lógica pura del juego y sus pruebas
      pantallas/      interfaz del juego
```

Cada juego expone sus reglas como una función pura `aplicar(estado, accion)`. Así se prueban sin interfaz y, más adelante, el modo en línea podrá usar las mismas reglas en un servidor.

Para agregar un juego: crea `src/juegos/<id>/` con `reglas/` y `pantallas/`, y agrégalo a `src/juegos/catalogo.ts`.

## Publicación

Cada merge a `main` publica la web en GitHub Pages con la Action `publicar.yml`. La primera vez hay que activar Pages en *Settings → Pages → Source: GitHub Actions*.

Todo se guarda en el teléfono (partidas, jugadores, historial). No hay servidor ni base de datos, así que no tiene costo.
