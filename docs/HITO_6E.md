# Hito 6E — Mentor IA supervisado

## Objetivo

Entender preguntas naturales sin convertir un modelo generativo en fuente de
verdad de PoE2. El motor determinista, el diario, la sesión y la memoria de build
siguen siendo autoritativos.

## Flujo

1. El servidor carga la memoria real y calcula hasta tres recomendaciones.
2. Construye un contexto compacto: resumen del personaje, presupuesto,
   objetivo, acción activa, memoria de build, candidatos y datos faltantes.
3. Si la flag está activa, Responses API devuelve uno de cuatro resultados:
   `choose_recommendation`, `ask_missing_fact`, `explain_current_case` o
   `no_safe_action`.
4. El servidor comprueba que cada id existe en el contexto y reconstruye la
   respuesta a partir de las estructuras canónicas.
5. Cualquier fallo produce `rules_fallback`; la consulta sigue funcionando.

## Límites de seguridad y coste

- `MENTOR_AI_ENABLED=false` por defecto: cero llamadas y cero coste.
- La clave solo se lee desde `OPENAI_API_KEY` en el backend.
- `store:false`; no se reutiliza el estado remoto de la conversación.
- El id del personaje se envía únicamente como hash en `safety_identifier`.
- Contexto acotado a 3 candidatos, 14 objetos, 12 memorias y 12 datos faltantes.
- Tiempo máximo 1–30 s y salida 128–1024 tokens; valores iniciales 12 s/256.
- La pregunta, nombres de objetos y memoria se marcan explícitamente como datos
  no confiables. La salida estructurada no incluye texto libre de consejo.

## Configuración

```env
MENTOR_AI_ENABLED=true
OPENAI_API_KEY=...
MENTOR_AI_MODEL=gpt-5.4-mini
MENTOR_AI_REASONING_EFFORT=low
MENTOR_AI_TIMEOUT_MS=12000
MENTOR_AI_MAX_OUTPUT_TOKENS=256
```

La API se factura por separado de ChatGPT. La implementación se validó con
dobles de prueba; activar una llamada real requiere clave y presupuesto del
propietario.

## Pruebas

- Petición Responses con `store:false`, esquema estricto y sin filtrar la clave.
- Negativa, falta de clave e ids inventados producen fallback seguro.
- Pregunta libre selecciona una acción exacta del motor.
- Petición de dato faltante usa una carencia canónica.
- Una acción activa no llama a la IA.
- Una escritura concurrente durante la espera conserva el `409` de revisión.
