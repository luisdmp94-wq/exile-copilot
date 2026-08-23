# Alloys: contrato conservador del asesor

## Qué está verificado

La fuente primaria es la nota oficial de GGG para **Content Update 0.5.0**:

- se añadieron 13 Alloys;
- un Alloy añade un nuevo modificador fabricado reemplazando un modificador existente, de forma semejante a una Essence Perfecta;
- el modificador añadido está garantizado;
- un objeto solo puede contener un modificador fabricado.

Las notas 0.5.2 y 0.5.3 demuestran además que existen restricciones por clase:
Transcendent Alloy dejó de admitir Foci y Varas y volvió a admitirlos después
con valores inferiores. Por eso la app nunca infiere la clase por el nombre.
Fuentes: [GGG 0.5.2](https://www.pathofexile.com/forum/view-thread/3960375)
y [GGG 0.5.3](https://www.pathofexile.com/forum/view-thread/3968601).

Fuente: [GGG — Content Update 0.5.0](https://www.pathofexile.com/forum/view-thread/3932540/filter-account-type/staff), consultada el 23 de agosto de 2026.

## Qué no se afirma

Esas notas no publican la matriz completa de compatibilidad entre los 13 Alloys
y cada tipo o rareza de objeto, ni especifican en esa descripción global cómo
se elige el modificador reemplazado. El producto no rellena esos huecos con
memoria, una wiki o una suposición.

Por eso el flujo exige copiar el tooltip real que ve el jugador y declarar:

1. nombre exacto del Alloy;
2. tooltip completo;
3. clases de objeto descritas por ese tooltip;
4. modificador fabricado garantizado;
5. si el tooltip dice que la retirada es aleatoria o elegida por el jugador.

Si cualquiera de esos datos falta, la acción queda en **Faltan datos**. El
jugador debe confirmar expresamente que la pieza seleccionada pertenece a una
de las clases declaradas. La rareza resultante no se fuerza: se conserva la del
snapshot original porque GGG no documenta una transición de rareza.

## Estados que detienen el flujo

El asesor bloquea objetos corruptos, reflejados, santificados o declarados no
modificables. Mantiene en **Faltan datos** las interacciones no verificadas con
objetos mutados, profanados, divididos, no identificados o con modificadores
fracturados, mutados o profanados.

También se detiene si el objeto ya tiene un modificador fabricado. Aunque GGG
confirma el límite de uno, la regla global no demuestra que el Alloy vaya a
reemplazar precisamente el fabricado existente.

## Comprobación antes/después

Tras aplicar un único Alloy en el juego, el usuario vuelve a copiar el objeto.
La app solo confirma el cambio si:

- sigue siendo la misma base y el mismo nivel de objeto;
- desaparece exactamente un modificador explícito, conforme a «replacing an
  existing modifier»;
- aparece exactamente uno nuevo;
- el nuevo está marcado como fabricado en el texto avanzado;
- el resultado no contiene más de un modificador fabricado.

Esto confirma estructura, no calidad. El jugador sigue decidiendo si el
resultado sirve para su build. No se estiman pesos, probabilidades, precios ni
el modificador que saldrá antes de gastar el Alloy.

La propuesta de tolerar cero retiradas se descartó: no hay una fuente que diga
que un Alloy añada sin reemplazar cuando hay huecos libres, mientras que la
descripción oficial sí exige reemplazar un modificador existente.
