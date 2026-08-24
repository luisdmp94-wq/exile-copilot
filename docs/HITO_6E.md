# Hito 6E — Mentor IA fundamentado (Mentor v3)

## Objetivo

Entender preguntas naturales sin convertir un modelo generativo en fuente de
verdad de PoE2. El motor determinista, el diario, la sesión y la memoria de build
siguen siendo autoritativos.

## Flujo

1. El servidor carga la memoria real y calcula hasta tres recomendaciones.
2. Construye un contexto compacto: resumen del personaje, presupuesto,
   objetivo, acción activa, memoria de build, candidatos y datos faltantes.
3. Si la flag está activa, la Responses API del proveedor configurado devuelve
   texto natural y uno de cinco resultados estructurados:
   `conversation`,
   `choose_recommendation`, `ask_missing_fact`, `explain_current_case` o
   `no_safe_action`.
4. El servidor comprueba que cada id existe en el contexto y que cada cifra del
   texto aparece en los hechos canónicos. También rechaza ids internos, nombres
   de campos, HTML y enlaces.
5. Cualquier fallo produce `rules_fallback`; la consulta sigue funcionando.

## Mentor v2: contexto de la interfaz

El cliente puede adjuntar `ContextEnvelope` v1 con el área activa y la selección
visible. Es una pista de navegación, no una nueva fuente de verdad:

- personaje, build objetivo, presupuesto, moneda y liga se reconstruyen desde
  los inputs canónicos que ya usa el motor;
- `selectedItem.id` y `activeRecommendationId` solo sobreviven si existen en el
  perfil o en las recomendaciones recién calculadas;
- el objetivo libre de crafting y la última acción del cliente se descartan
  mientras no exista una fuente autoritativa del servidor;
- `activeArea` y `sessionActive` son valores acotados por esquema;
- la respuesta visible solo puede fundamentarse en una recomendación o carencia
  canónica seleccionada.

La interfaz mantiene sincronizada la pieza seleccionada al cambiarla dentro del
guía de Crafting. Al elegir una dirección, el mentor contextual muestra esa
pieza y el siguiente paso legal calculado, sin hacer una llamada automática a
Groq. Solo «Analizar este contexto» consulta al modelo opcional.

## Mentor v3: conversación con vida, sin perder rigor

- Saludos y agradecimientos ya son conversación, no preguntas no soportadas.
- Los últimos ocho turnos viajan con cada consulta para conservar el hilo. Son
  texto no confiable y nunca sustituyen al personaje, diario o motor.
- Groq puede explicar, resumir y formular una pregunta de seguimiento con sus
  propias palabras, siempre citando los ids canónicos que lo fundamentan.
- Una acción activa del diario continúa teniendo prioridad: el modelo no abre
  una segunda decisión mientras la primera siga en curso.
- Si el validador detecta una cifra, id o afirmación fuera del contexto, desecha
  toda la redacción y responde con el respaldo seguro de reglas.

## Límites de seguridad y coste

- `MENTOR_AI_ENABLED=false` por defecto: cero llamadas y cero coste.
- La clave solo se lee desde `GROQ_API_KEY` u `OPENAI_API_KEY` en el backend,
  según el proveedor; nunca se envía al navegador.
- Groq no recibe los campos de OpenAI que no soporta (`store` y
  `safety_identifier`). Tampoco se reutiliza estado remoto de conversación.
- Con OpenAI, `store:false` evita almacenar la respuesta y el id del personaje
  se envía únicamente como hash en `safety_identifier`.
- Contexto acotado a 3 candidatos, 14 objetos, 12 memorias, 12 datos faltantes y
  8 turnos conversacionales de hasta 800 caracteres.
- Tiempo máximo 1–30 s y salida 128–1024 tokens; valores iniciales 12 s/256.
- La pregunta, nombres de objetos, memoria y conversación se marcan
  explícitamente como datos no confiables. El texto libre se valida antes de
  poder llegar al jugador.

## Configuración

```env
MENTOR_AI_ENABLED=true
MENTOR_AI_PROVIDER=groq
GROQ_API_KEY=...
MENTOR_AI_MODEL=openai/gpt-oss-120b
MENTOR_AI_REASONING_EFFORT=low
MENTOR_AI_TIMEOUT_MS=12000
MENTOR_AI_MAX_OUTPUT_TOKENS=256
```

Groq dispone de nivel gratuito sujeto a límites y puede cambiarlo. OpenAI se
mantiene como alternativa mediante `MENTOR_AI_PROVIDER=openai`; su API se
factura por separado de ChatGPT. La implementación nunca incorpora claves al
repositorio.

## Pruebas

- Petición Groq Responses con esquema estricto, sin filtrar la clave y sin los
  campos incompatibles `store`/`safety_identifier`.
- La alternativa OpenAI conserva `store:false` y `safety_identifier`.
- Negativa, falta de clave e ids inventados producen fallback seguro.
- Pregunta libre selecciona una acción exacta del motor.
- Petición de dato faltante usa una carencia canónica.
- Una acción activa no llama a la IA.
- Una escritura concurrente durante la espera conserva el `409` de revisión.
- Un envelope manipulado no puede sustituir personaje, build, mercado, pieza o
  recomendación, ni pasar instrucciones libres al selector.
- IDs inventados y errores del selector conservan la misma próxima acción del
  respaldo determinista.
- Un saludo real llega a Groq, responde sin acción ni evidencia vacía y mantiene
  los turnos siguientes como memoria breve.
- IDs visibles, campos técnicos y cifras inventadas en el texto generado son
  rechazados y activan el respaldo seguro.
