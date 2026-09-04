# Corpus de tooltips de objetos

Este directorio no es una base de datos de objetos ni una lista de afijos. Es
un catálogo pequeño de **formas de clipboard observadas** que el importador debe
poder reproducir sin perder información.

Cada entrada de `corpus.json` declara:

- el archivo exacto que se vuelve a interpretar;
- idioma, parche declarado y procedencia;
- la estructura mínima que debe conservarse;
- si el resultado está listo o debe detenerse por una mecánica no verificada.

`supportedLocales` enumera los idiomas que deben quedar demostrados antes de
activar un parche. La auditoría de 1.0 exige, para cada uno, al menos una copia
directa del cliente con el parche exacto y fecha igual o posterior a su
lanzamiento. Un ejemplo de otro parche o derivado del foro conserva valor como
regresión de formato, pero nunca autoriza una publicación.

El auditor vuelve a analizar los textos y compara el resultado; el manifiesto
no puede declararse correcto por sí solo. La prueba `itemTextCorpus.test.ts`
recorre todas las entradas. Las copias directas nuevas se incorporan únicamente
con `npm run record:item-sample` siguiendo
`docs/ITEM-TEXT-CORPUS-PROTOCOL.md`; no se edita `corpus.json` a mano ni se
repite el mismo texto en el parser, la API y el navegador.

## Reglas de incorporación

1. Conservar solo texto aportado por el juego o una reproducción mínima cuya
   fuente pública quede enlazada.
2. No atribuir un tooltip a un parche si la fuente no lo declara.
3. No convertir un nombre, afijo o estado observado en una regla universal.
4. Una mecánica sin interacción contrastada debe terminar en
   `mechanic-unverified`, nunca en una recomendación de gasto.
5. Si cambia una expectativa, actualizar primero la evidencia o explicar la
   migración; no suavizar la prueba para hacer pasar el parser.
