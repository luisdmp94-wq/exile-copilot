# Plan hasta la 1.0 y después (acordado el 24-11-2026)

**Idea:** el producto es el mentor. La web es su memoria (lee el personaje y
tiene los datos del juego). La ventanita es donde vivirá mientras se juega.

**Cómo se trabaja:** una tarea por chat. Al acabar cada tarea se marca aquí
con `[x]`, se apunta el resultado en una línea y se le da a Luis el prompt de
la siguiente. Nada se sube sin su sí.

## Etapa 1 · hasta el 10-12: que no falle

### Semana 1 (24 al 30 de noviembre)

- [x] **1. Medir el Mentor con dos personajes novatos** que no sean la Liche de
  Luis (por ejemplo un guerrero y una arquera, nivel 10-25). Veinte preguntas
  de novato, diez por personaje. Resultado en `docs/MEDICION-MENTOR-2.md`:
  bien / a medias / mal, y por qué. **Umbral: 8 de cada 10 bien.**
  → Hecho el 24-11: **5 bien, 3 a medias, 12 mal. No llega al umbral.** No inventó
  nada. Falla por no saber lo básico del juego y por no reconocer frases. Sin
  medir con IA: la clave local de Groq da 401.
- [x] **2. Arreglar la respuesta floja** de la «primera gema de asistencia»
  (propone veneno para Descarga de caos).
  → Hecho el 24-11: la primera gema ya propone lo que funciona siempre
  (Destrucción controlada, Lanzamiento rápido I, Rebote III) y dice dónde
  ponerla. Sin decir el grado, enseña grado I hasta nivel 14 y hasta II desde
  el 15, y lo avisa. Medición repetida: G2 pasa a bien, **6 de 20**.
- [x] **3. Guardar las preguntas que el Mentor no sabe contestar** (antes,
  comprobar si ya se guardan). Sin texto personal: solo la pregunta y el motivo.
  → Hecho el 24-11: no se guardaban (solo un contador sin texto). Ahora se apunta
  la pregunta, el motivo, el idioma y cuántas veces llega; sin sesión, personaje
  ni hora. Luis las lee en `/estadisticas`, con su clave, en «Preguntas que el
  Mentor no supo contestar». Se borran a los 90 días sin repetirse. El aviso de
  privacidad de la web lo dice.
- [ ] **4. Escribir las reglas que falten** según la medición de la tarea 1
  (lista ordenada en `docs/MEDICION-MENTOR-2.md`, «Reglas que faltan»).
- [ ] **5. Si la tarea 1 llega al umbral: el Mentor al centro de la portada**
  (caja para preguntar arriba, con el personaje ya cargado). Si no llega, se
  queda donde está y sube en enero.
  → La tarea 1 no llegó (5 de 20). Salvo que Luis diga otra cosa, queda para enero.
- [ ] **6. Botón de donación** discreto.
- [ ] **7. Recorrer como novato las tres puertas** (guías, revisión rápida,
  árbol con PoB2) y arreglar cada atasco.

### Semana 2 (1 al 7 de diciembre)

- [ ] **8. Dos o tres personas reales** que no conozcan la web la usan y Luis
  mira sin ayudar. Arreglar donde se atasquen.
- [ ] **9. Textos del lanzamiento escritos:** guía de Steam actualizada,
  Discusiones de Steam, Discord, Reddit y el directo.
- [ ] **10. Ensayo del día del parche** con `docs/DIA-DE-LA-1.0.md`.

### Del 8 al 10 de diciembre

- [ ] **11. Congelar:** batería completa y ningún cambio de última hora.

### Tareas de Luis

- [ ] Encender la copia en R2 (pasos en `docs/DEPLOYMENT.md`).
- [ ] Poner la clave nueva de Groq en su `.env` local.

## Etapa 2 · 11 al 25 de diciembre: lanzar y medir

- Día 11: primero los datos al día, después avisar.
- Difusión donde funcionó: Steam en español, Reddit para novatos, Discords
  hispanos y el directo.
- Luis juega la 1.0 preguntando al Mentor de la web. Cada pregunta que falle
  es una regla que falta.
- Día 25: cuántos entran, cuántos vuelven, cuántas preguntas recibe el Mentor
  y cuántas no sabe contestar.

## Etapa 3 · desde enero: el mentor

- El Mentor en el centro (si no subió ya en la tarea 5).
- Las reglas deciden y la IA solo explica. Crece con las preguntas reales.
- El Mentor dentro de la ventanita: preguntar sin salir del juego, en español.
- Dinero: donaciones. Una IA mejor, solo con límite de uso.

## Lo que no se hace antes de la 1.0

- El Mentor dentro de la ventanita (instalador, aviso de Windows, sin probar
  por nadie más).
- Funciones nuevas fuera de esta lista sin que Luis lo pida.
