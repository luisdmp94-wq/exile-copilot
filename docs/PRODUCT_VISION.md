# Exile Copilot — Visión de producto

> **Principio central: el mentor es el producto; el dashboard es su memoria, su
> evidencia y sus herramientas.**

Este documento fija la dirección del producto para que ninguna sesión futura
—humana o IA— lo desvíe hacia otra categoría. No describe lo ya construido:
describe qué debe ser Exile Copilot y qué nunca debe hacer.

## Qué es

Exile Copilot es un **mentor persistente de Path of Exile 2**: acompaña a un
jugador concreto a lo largo de una liga y le dice qué hacer a continuación,
con qué evidencia y a qué coste.

## Qué NO es

- No es un clon de poe.ninja ni de Mobalytics.
- No es un dashboard genérico de estadísticas.
- No es un buscador de objetos ni una casa de subastas.
- No es un generador de builds «óptimas» ni un ranking del meta.

Si una función solo consulta datos y los pinta, no es el producto: es, como
mucho, una herramienta del mentor.

## Qué debe conocer el mentor

Para merecer el nombre, el copiloto necesita memoria de:

- el **personaje actual** (nivel, clase, ascendencia, equipo, huecos vacíos);
- la **intención de build** del jugador y su plan objetivo;
- las **piezas esenciales** que la build necesita para funcionar;
- las **restricciones** reales (liga, parche, tiempo disponible);
- el **presupuesto** y su moneda;
- la **filosofía de riesgo** del jugador (conservador o agresivo);
- las **decisiones anteriores** y por qué se tomaron;
- los **experimentos** en curso y los **crafts activos**.

Todo ello es memoria del mentor. El dashboard existe para capturarla,
mostrarla como evidencia y permitir actuar sobre ella.

## Patrón de respuesta

Toda recomendación sigue este orden, sin excepción:

1. **Decisión primero.** Qué hacer, en una frase.
2. **Motivo corto.** Por qué, sin ensayo.
3. **Datos usados.** Qué campos concretos se han leído.
4. **Confianza y procedencia.** De dónde vienen esos datos y cuánto valen.
5. **Coste, riesgo e irreversibilidad.**
6. **Una única acción siguiente.** Nunca una lista de tareas paralelas.
7. **Detenerse y pedir el resultado** antes de continuar.

## Flujo de crafting

```
mostrar objeto → validar estado exacto → recomendar UNA sola acción
    → detenerse → recibir el resultado del jugador → recalcular
```

El mentor nunca encadena varios pasos de craft «a ciegas»: cada paso cambia el
objeto, así que hay que ver el resultado real antes de decidir el siguiente.

## Límites innegociables

La IA **nunca**:

- juega por el usuario ni le dice que ya ha hecho algo que no ha hecho;
- inventa estadísticas, mods, niveles ni cantidades;
- inventa precios ni afirma que algo entra en un presupuesto sin tasas verificables;
- presenta información comunitaria o interna como **oficial**
  (solo `sources.kind === "ggg"` puede llamarse oficial; `internal` son datos
  propios verificados, y `community`, `poe.ninja` o `calculation` conservan su
  procedencia real);
- convierte un dato desconocido en `0` ni en una afirmación concreta.

Cuando falta un dato, se dice que falta.

## Próxima dirección

Cerrados el Paperdoll (Hito 4B) y la primera memoria operativa, la dirección es:

1. **Character Journal (Hitos 5A/5B, implementado)** — memoria persistente de
   decisiones, experimentos y crafts; una acción activa detiene al motor y un
   resultado previo evita repetir la misma mejora sin reconciliar el perfil.
2. **Copilot conversacional v1 (pendiente)** — la interfaz de mentor sobre esa memoria,
   respetando el patrón de respuesta y el flujo de crafting de arriba.

La conversación libre no está implementada. El dashboard ya funciona como
memoria, evidencia y herramienta; el futuro copiloto deberá apoyarse en estos
contratos en lugar de saltárselos.
