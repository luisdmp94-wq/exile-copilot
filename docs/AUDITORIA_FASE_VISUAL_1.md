# Auditoría — Fase Visual 1 («Expediente del personaje + Caso abierto»)

> Auditoría independiente de la maqueta de rediseño visual, contra `main` en
> `6d96538`. Fecha: 2026-08-21. **No se ha modificado código.**

## Alcance y método

La maqueta afirma cumplir unas «Secciones B, E, F, G y H» de una especificación
de la Fase Visual 1. **Esa especificación no está en el repositorio**: no
aparece en `docs/`, ni en `HANDOFF.md`, ni en ninguna de las ocho ramas. Por lo
tanto **no se ha podido verificar ninguna de las afirmaciones de conformidad**
de la sección «Relación de bloques» (nº 1 a nº 8). Quedan marcadas como *no
verificables* y deberían re-auditarse si aparece el documento.

Lo que sí se ha auditado, y contra qué:

1. **El código de `main`** — `src/App.tsx`, `src/components/EquipmentPanel.tsx`,
   `src/components/RecommendationCard.tsx`, `src/sections/*`, `shared/domain.ts`,
   `src/lib/format.ts`, `src/lib/equipment.ts`, `src/lib/ascendancyDisplay.ts`,
   `src/index.css`.
2. **Las invariantes de producto** — `docs/PRODUCT_VISION.md` («Patrón de
   respuesta» y «Límites innegociables») y `docs/PLAN.md`.
3. **La coherencia interna de la propia maqueta** y sus cifras de contraste.

## Veredicto

**No apta para implementar tal cual.** La dirección visual es correcta y encaja
con lo que pedía el HANDOFF, pero la maqueta suprime o pliega material que las
reglas de honestidad del producto obligan a mostrar, y contiene tres
contradicciones que no son de gusto sino de contrato: un resalte imposible, un
ejemplo que mezcla dos tipos de acción, y una sección entera del Hito 6B sin
mapear. Con los cinco bloqueantes resueltos, el resto es trabajo normal de
implementación.

Recuento: **5 bloqueantes, 9 importantes, 6 menores.**

---

## Bloqueantes

### B1 — Rompe el «Patrón de respuesta», que no admite excepciones

`docs/PRODUCT_VISION.md` fija el orden de toda recomendación «sin excepción»:
1 decisión, 2 motivo, 3 **datos usados**, 4 **confianza y procedencia**,
5 **coste, riesgo e irreversibilidad**, 6 una única acción siguiente, 7 detenerse
y pedir el resultado.

La maqueta deja visibles el 1, el 2 (solo en escritorio) y el 6. El 3 y el 4
caen dentro del acordeón cerrado «Evidencia y Limitaciones»; del 5 solo aparece
el coste, dentro de otro acordeón. En móvil los tres acordeones nacen cerrados,
así que el primer viewport muestra únicamente decisión y acción.

**Efecto:** la pantalla principal del producto deja de cumplir el patrón que
define el producto. **Corrección:** confianza, procedencia (`sources`), riesgo e
irreversibilidad son nivel 1, no plegables. Lo plegable es el detalle, no la
existencia del dato.

### B2 — Desaparecen los tres avisos de seguridad

`RecommendationCard.tsx:136-190` emite hoy tres bloques con `role="alert"`:
presupuesto superado, `mayLoseValuableMods` («Puede perder mods valiosos del
objeto actual») e `irreversible` («Acción irreversible: no podrás deshacerla»).

Ningún bloque de la maqueta los aloja. El sistema visual llega a definir
`#DC2626` para «Riesgo Crítico / Pérdida Irreversible» con pictograma `[!]`,
pero ese token no se usa en ninguna de las dos maquetas: se declara y se deja
huérfano.

**Efecto:** el jugador puede ejecutar una acción irreversible sin haber visto
nunca el aviso. Es el hallazgo más grave del lote. **Corrección:** los tres
avisos, en el primer viewport, por encima del CTA, nunca dentro de un acordeón.

### B3 — El resalte ámbar sobre una ranura vacía es imposible

La maqueta pinta el foco ámbar en «ANILLO 2 ◄ — Ranura vacía» (escritorio) y en
«ANILLO 2 — Ranura vacía» (móvil), y a la vez declara la regla correcta: el
resalte se condiciona a que `cell.item.id` esté en `relatedItemIds`.

El código hace exactamente eso: `EquipmentPanel.tsx:134` evalúa
`cell.item !== null && highlightedItemIds.has(cell.item.id)`, y una celda vacía
ni siquiera es un botón (`EquipmentPanel.tsx:255-275`). **Una ranura vacía no
puede estar señalada.** La maqueta ilustra su regla con el único caso que la
regla prohíbe.

**Corrección:** o se cambia el ejemplo a una ranura con objeto, o se define un
contrato nuevo para señalar huecos vacíos — que el motor **no** emite hoy,
porque `relatedItemIds` son ids de objetos existentes.

### B4 — El ejemplo del «Caso abierto» mezcla dos `actionKind`

`shared/domain.ts:313-317` define tres valores: `game_change`, `profile_sync`,
`session_gate`.

El texto de acción de la maqueta («Actualiza en Mi personaje los datos afectados
… después vuelve a generar recomendaciones») es una acción de datos:
`profile_sync`. En el código, ese tipo muestra un pie propio —«Acción de datos:
no modifica el juego ni se incluye en el archivo .build»— y **suprime** la
casilla «Ya la apliqué» (`RecommendationCard.tsx:262-266`). La maqueta lo
presenta sin ese pie y bajo un título de cambio de juego («Cubrir resistencias
elementales»), con el CTA primario.

Además la maqueta afirma que el CTA se rige por `actionKind === "game_change"`.
Falso: `RecommendationCard.tsx:218-229` muestra «Guardar como próximo paso» para
los tres tipos y solo lo **deshabilita** en `session_gate`.

**Efecto:** borra visualmente la distinción entre «cambia tu juego» y «corrige
tus datos», que es una de las defensas del producto contra decirle al usuario
que ha hecho algo que no ha hecho.

### B5 — La sesión adaptativa de decisión no está mapeada

`DecisionSessionSection` (628 líneas; el Hito 6B completo: freno determinista,
incógnitas críticas, restricciones, recursos protegidos, pausa y cierre) se
renderiza hoy en el área Mentor, entre el diario y la conversación
(`App.tsx:308-315`). La «Relación de bloques» de la maqueta no la menciona en
ninguno de sus ocho puntos.

Sin ella, lo que la maqueta llama «Caso abierto» no es el caso abierto: es la
recomendación de prioridad 1. También queda fuera el botón «Comprobar esto»
(`RecommendationCard.tsx:230-240`), que es la vía por la que nace una sesión.

**Corrección:** decidir explícitamente dónde vive la sesión en la nueva
jerarquía antes de tocar nada. Es el bloque con más lógica de todo el área.

---

## Importantes

### I1 — La celda del paperdoll pierde la procedencia por objeto

Hoy cada celda muestra rareza (punto de color + etiqueta) y el estado del dato
vía `describeItemDataState`, con tres tonos: oficial (esmeralda), interna
(azul), sin verificar (ámbar) — `EquipmentPanel.tsx:74-78` y `296-315`. La
maqueta reduce la celda a nombre + base y sustituye todo eso por un único
«(i) Limitaciones detectadas» global en la cabecera.

Agregar a nivel de personaje lo que hoy es por objeto choca con «Cuando falta un
dato, se dice que falta» (`PRODUCT_VISION.md`, Límites innegociables). El
indicador global puede añadirse; no puede reemplazar al de cada objeto.

### I2 — Colisión de paleta: el ámbar ya significa «sin verificar»

La maqueta reserva `#D97706` «exclusivamente para `relatedItemIds` y CTAs
primarios». Pero en el paperdoll el ámbar es hoy el tono de **dato sin
verificar** (`TONE_CLASSES["sin-verificar"] = "text-amber-300"`,
`EquipmentPanel.tsx:77`), y el ámbar es además el `--primary` del tema oscuro
(`src/index.css:44`, `42 92% 55%`).

Dos significados incompatibles en el mismo componente. Hay que reasignar uno de
los dos **antes** de escribir CSS, o el resalte de foco y la marca de dato
dudoso se confundirán en la misma celda.

### I3 — Contraste por debajo de AA en el color secundario

`#64748B` sobre el panel `#12151E` da **3.9:1**; sobre el fondo `#090A0F`,
**4.2:1**. El mínimo AA para texto normal es 4.5:1. Y la maqueta lo aplica a
11–13 px en «Ranura vacía», los nombres de base, la etiqueta de cada hueco y la
línea de limitaciones — justo el material que el producto necesita que se lea.

**Corrección:** subir ese gris (a partir de ~`#8A97AB` se supera 4.5:1 sobre
ambas superficies) o reservar `#64748B` para elementos no textuales.

### I4 — Desaparece el bloque «Diagnóstico» del equipo

`EquipmentPanel.tsx:172-196` publica seis contadores derivados (objetos
registrados, ranuras vacías, indicados por ti, sin fuente, modificadores sin
verificar, señalados) y dos textos que acotan el alcance del producto: «Solo tu
equipo real. Las pistas de una build objetivo importada no se muestran aquí» y
«Exile Copilot no calcula puntuaciones de build ni compara con el meta».

Esos dos textos son la defensa explícita contra convertirse en un dashboard del
meta (`PRODUCT_VISION.md`, «Qué NO es»). La maqueta no los recoge en ningún
bloque.

### I5 — La identidad inventa un formato de clase

La maqueta escribe «Demo Gemling | Mercenary | Nv. 70». La fixture trae
`ascendancy: "Gemling Legionnaire"` (`server/fixtures/demoSnapshot.json:5`), y
la regla de presentación es `describeAscendancy`
(`src/lib/ascendancyDisplay.ts:11-21`), que distingue tres realidades
—verificado, nombre no verificado con clase conocida, y no verificado— y muestra
**siempre el id crudo aparte**.

«Mercenary» a secas no sale de ese contrato: pierde la ascendencia y pierde el
estado de verificación.

### I6 — La maqueta móvil pierde el diagnóstico y no protege la ranura señalada

Dos problemas en la vista de 390 px:

- El bloque del caso abierto empieza directamente por el texto de acción: no hay
  ni el rótulo «DIAGNÓSTICO ACTUAL» ni el título. En escritorio sí existen. El
  paso 1 del patrón de respuesta (la decisión, en una frase) desaparece en el
  viewport donde más falta hace.
- El paperdoll se recorta a cuatro ranuras más «+ 6 ranuras más y Frascos (0)».
  No hay ninguna regla que garantice que la ranura señalada por
  `relatedItemIds` esté entre las visibles. Con el ejemplo dado funciona por
  casualidad.

### I7 — Ni estados de foco, ni teclado, ni ARIA

La maqueta no define foco visible en ningún elemento, y todos sus controles
llevan `cursor: default`. El código actual sí cuida esto: `aria-label` compuesto
por celda, incluida la frase «Señalado por una recomendación»
(`EquipmentPanel.tsx:286-296`); anillo de foco con offset; y `App.tsx:70`
mantiene un `dialogTriggerRef` para **devolver el foco** al elemento que abrió el
detalle al cerrarlo.

El drawer «Editar expediente» que propone la maqueta debe conservar ese
comportamiento y atrapar el foco mientras esté abierto. No se menciona.

### I8 — La maqueta contradice su propia regla anti-tarjetas

«Prohibidos los bordes sólidos `1px solid gray`», dice el sistema visual. La
propia maqueta usa `border-top: 1px solid #64748B` en los cinco acordeones,
`1px dashed #64748B` en la ranura vacía y `1px solid #64748B` en el botón
«Editar Expediente». O se relaja la regla, o se rehace la separación.

### I9 — Solo cubre el estado vacío de dos colecciones

«FRASCOS (0) — Sin información de frascos» coincide literalmente con el código
(`EquipmentPanel.tsx:144-167`) ✔. Pero no hay maqueta para el caso con frascos
equipados, ni para «Otros objetos» (`layout.extraItems`,
`EquipmentPanel.tsx:200-218`), que aparece cuando el perfil trae objetos fuera de
los diez huecos canónicos. Son estados reales, no hipotéticos.

---

## Menores

- **M1** — En «Justificación y Análisis», *Motivo* e *Impacto* repiten palabra
  por palabra el mismo texto. Además «(Alta)» se muestra sin `impact.metric` y
  sin el aviso `isPartialMetric` («Métrica parcial: no es una estimación de DPS
  completa»), ambos presentes hoy en `RecommendationCard.tsx:118-128`.
- **M2** — «Inter (limpieza clínica, monoespaciado para cifras y métricas)»:
  Inter no es monoespaciada. Lo que se busca es `tabular-nums`, que ya se aplica
  en `EquipmentPanel.tsx:235`.
- **M3** — Playfair Display y Lora son recursos remotos. El paperdoll declara
  explícitamente «Sin tipografías ni recursos remotos» (`EquipmentPanel.tsx:37`).
  Si se adoptan, hay que autoalojarlas y actualizar esa declaración.
- **M4** — La maqueta de escritorio está **incompleta**: el HTML empieza a media
  celda `<td>`, sin tabla ni fila de cabecera, y el bloque «Navegación Global»
  —que la relación de bloques nº 1 dice que cumple la Sección B— no tiene marcado
  alguno. Sin esa cabecera, la afirmación «todo el contenido crítico es visible
  sin hacer scroll» a 1440×900 no es verificable.
- **M5** — «Sutiles sombras (`drop-shadow`) para separar módulos»: sobre
  `#090A0F` una sombra proyectada es prácticamente invisible. Lo que de verdad
  separa en la maqueta es el cambio de superficie, que es justo lo que ya hace
  `SURFACE` con una sombra **interior** (`EquipmentPanel.tsx:81`).
- **M6** — La maqueta no dice qué ocurre con el estado de bienvenida
  (`WelcomePanel`, `App.tsx:431`) ni con el aviso `GGG_AFFILIATION_NOTICE`, que
  hoy vive en la cabecera de la aplicación.

---

## Lo que la maqueta acierta

Conviene dejarlo escrito, porque el veredicto no invalida la dirección:

- **La jerarquía «decisión y acción primero» es correcta** y coincide con los
  pasos 1 y 6 del patrón de respuesta. El diagnóstico como titular y la acción
  como párrafo dominante es exactamente lo que pedía el HANDOFF cuando decía que
  el área Mentor «apila hoy diario, sesión, conversación y recomendaciones».
- **El resalte por vínculo estructurado ya existe** y la maqueta respeta la regla
  de no deducir el hueco por el texto (salvo por B3).
- **Encerrar el formulario en un drawer es compatible** con el diseño actual,
  siempre que se respete el `forceMount` que hoy evita perder borradores al
  cambiar de área (`App.tsx:44-52`).
- **La paleta está cerca de la actual, no es una reconstrucción.** El tema oscuro
  ya tiene fondo `240 12% 4%` y `--primary` ámbar `42 92% 55%`
  (`src/index.css:38-44`). Es una migración de tokens, no un tema nuevo.

---

## Decisión documentada sobre el área «Plan y mercado»

La maqueta reduce la aplicación a dos áreas sin decir qué ocurre con la tercera.
Hoy existen tres: Mentor, Personaje y Plan y mercado, esta última con
`TargetSection` + `MarketSection` (`App.tsx:456-485`).

**Decisión: se mantienen las tres áreas.** El rediseño se aplica a Mentor y
Personaje. Motivos:

1. **El dominio lo exige.** `PLAN.md` separa de forma deliberada el
   `CharacterProfileSnapshot` (el personaje real) del `BuildTargetPlan` (un plan
   importado, «un plan, no una captura»). Meter el build objetivo dentro del
   «Expediente del personaje» fusiona visualmente las dos cosas que el modelo de
   datos mantiene separadas a propósito, y que el propio paperdoll advierte al
   usuario que no debe confundir.
2. **Coste sin beneficio.** Son 608 líneas con estado propio (borrador de
   objetivo, resolución de pasivas, avisos de importación). Plegarlas dentro de
   otro panel no simplifica la jerarquía del área Mentor, que es el problema que
   este rediseño venía a resolver.
3. **Rompe los smokes.** `tab-plan` es un `data-testid` afirmado por las pruebas
   de navegador.

**Si aun así se quiere bajar a dos áreas**, la ubicación menos dañina es dentro
del área **Mentor**, como herramienta del caso abierto (el plan objetivo es
material de decisión), nunca dentro del expediente del personaje.

## Impacto en pruebas

El rediseño tocará estos identificadores, hoy afirmados por `tests/` y por los
smokes de `scripts/`:

- Navegación: `tab-mentor`, `tab-personaje`, `tab-plan`.
- Personaje: `cabecera-personaje`, `equipment-grid`, `flask-group`,
  `guardar-correcciones`, `detalle-ilvl`, `detalle-calidad`.
- Mentor: `accion-actual`, `mentor-preguntar`, `mentor-hilo`,
  `mentor-turno-mentor`, `mentor-proxima-accion`, `mentor-guardar-accion`,
  `mentor-evidencia`, `mentor-fuentes`, `mentor-no-verificado`,
  `mentor-sugerencia`, `mentor-accion-recordada`, `mentor-cargando`.
- Sesión: `decision-nueva`, `decision-form-inicio`, `decision-pausar`,
  `decision-cerrada`, `decision-protecciones`, `decision-selector-incognita`.
- Bienvenida: `bienvenida`, `bienvenida-ejemplo`, `bienvenida-importar`.

Mover un bloque a un acordeón cerrado **rompe** las pruebas que hoy lo encuentran
directamente: `mentor-evidencia`, `mentor-fuentes` y `mentor-no-verificado` son
los casos claros. Conservar el identificador no basta si el nodo deja de estar
visible.

## Para dar la maqueta por aprobada

- [ ] B1 — Confianza, procedencia, riesgo e irreversibilidad, en nivel 1.
- [ ] B2 — Maquetar los tres avisos (`role="alert"`) y usar el rojo declarado.
- [ ] B3 — Corregir el ejemplo del resalte, o definir un contrato para huecos.
- [ ] B4 — Un ejemplo por `actionKind`, con su pie y sus controles reales.
- [ ] B5 — Ubicar la sesión adaptativa y el botón «Comprobar esto».
- [ ] I1–I9 — Procedencia por objeto, colisión del ámbar, contraste, diagnóstico
      del equipo, identidad, móvil, foco/ARIA, coherencia anti-tarjetas y estados
      con datos.
- [ ] Aportar la especificación B–H para verificar la «Relación de bloques».
