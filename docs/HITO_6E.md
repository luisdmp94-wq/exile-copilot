# Hito 6E — Mentor IA supervisado

## Objetivo

Entender preguntas naturales sin convertir un modelo generativo en fuente de
verdad de PoE2. El motor determinista, el diario, la sesión y la memoria de build
siguen siendo autoritativos.

## Flujo

1. El servidor carga la memoria real y calcula hasta tres recomendaciones.
2. Construye un contexto compacto: resumen del personaje, presupuesto,
   objetivo, acción activa, memoria de build, candidatos y datos faltantes.
3. Si la flag está activa, la Responses API del proveedor configurado devuelve
   uno de cuatro resultados:
   `choose_recommendation`, `ask_missing_fact`, `explain_current_case` o
   `no_safe_action`.
4. El servidor comprueba que cada id existe en el contexto y reconstruye la
   respuesta a partir de las estructuras canónicas.
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
- la respuesta visible se vuelve a construir desde la recomendación o carencia
  canónica seleccionada. La salida del modelo no admite texto para el jugador.

La interfaz mantiene sincronizada la pieza seleccionada al cambiarla dentro del
guía de Crafting. Al elegir una dirección, el mentor contextual muestra esa
pieza y el siguiente paso legal calculado, sin hacer una llamada automática a
Groq. Solo «Analizar este contexto» consulta al selector opcional.

## Límites de seguridad y coste

- `MENTOR_AI_ENABLED=false` por defecto: cero llamadas y cero coste.
- La clave solo se lee desde `GROQ_API_KEY` u `OPENAI_API_KEY` en el backend,
  según el proveedor; nunca se envía al navegador.
- Groq no recibe los campos de OpenAI que no soporta (`store` y
  `safety_identifier`). Tampoco se reutiliza estado remoto de conversación.
- Con OpenAI, `store:false` evita almacenar la respuesta y el id del personaje
  se envía únicamente como hash en `safety_identifier`.
- Contexto acotado a 3 candidatos, 14 objetos, 12 memorias y 12 datos faltantes.
- Tiempo máximo 1–30 s y salida 128–1024 tokens; valores iniciales 12 s/256.
- La pregunta, nombres de objetos y memoria se marcan explícitamente como datos
  no confiables. La salida estructurada no incluye texto libre de consejo.

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
