# 🧪 Repaso Técnico + Práctica — Codility NielsenIQ
## Web Scraping Software Engineer · Python

---

## 0. Resumen — qué esperar y cómo abordarlo

```
FORMATO DEL TEST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
· 3 tareas, en el orden que quieras
· 75 minutos totales, SIN pausa
· Lenguaje: Python
· Te califican por: correctitud (todos los test cases pasan) +
  eficiencia (complejidad de tu solución) + calidad de código
```

**Dado el dominio del rol (web scraping / procesamiento de datos a
escala), los problemas de Codility para este perfil suelen inclinarse
hacia:**

```
□ Procesamiento y validación de strings/texto (parsear, limpiar,
  extraer patrones — muy cercano al día a día real de scraping)
□ Arrays y estructuras de datos (dicts, sets) para conteo,
  deduplicación, agrupamiento
□ Complejidad — casi siempre te piden identificar el Big-O de tu
  solución, y penalizan soluciones O(n²) cuando existe una O(n) o
  O(n log n)

MENOS PROBABLE (pero no imposible):
□ Grafos complejos, DP pesada, estructuras de árbol avanzadas
```

### Protocolo por problema (aplicalo siempre, en este orden)

```
1. Leé el enunciado DOS veces antes de tocar el teclado
2. Identificá los edge cases explícitamente (input vacío, un solo
   elemento, todos iguales, valores negativos/inválidos) — ANOTALOS
   antes de codear
3. Pensá la complejidad ANTES de escribir — ¿hace falta un loop
   anidado, o hay una forma con un solo pase usando un dict/set?
4. Codeá la solución más simple que funcione primero (aunque no sea
   la óptima) — tener algo que pase los tests básicos > nada
5. Si sobra tiempo, optimizá
6. Agregá tus propios test cases al final del archivo antes de
   confiar en que está bien
```

---

## BLOQUE 1 — Teoría: Complejidad + Manipulación de Strings

### 1.1 Big-O — lo esencial que tenés que poder decir sin pensar

```
O(1)        → acceso directo (dict[key], list[index])
O(log n)    → búsqueda binaria, dividir el problema a la mitad
O(n)        → un solo recorrido del input
O(n log n)  → sorting (Python usa Timsort, O(n log n))
O(n²)       → loop anidado sobre el mismo input (el que hay que
              evitar cuando el input puede ser grande)
```

**La pregunta que te van a hacer implícitamente en cada problema:**
"¿tu solución es O(n) o estás iterando el input más de una vez de forma
innecesaria?" — antes de escribir código, preguntate si podés resolverlo
con UN SOLO recorrido usando un dict o set para no tener que buscar hacia
atrás.

### 1.2 Patrones de manipulación de strings en Python (relevantes al rol)

```python
# Split y limpieza — la base de casi cualquier parsing
text.split()              # split por espacios/whitespace, ignora múltiples espacios
text.split(",")            # split por delimitador específico
text.strip()               # saca espacios/saltos de línea al inicio/final
text.replace(",", "")      # limpieza de caracteres

# Validación de formato — DOS enfoques, saber ambos
# Enfoque A: regex (rápido de escribir, a veces menos legible)
import re
re.match(r'^\$?\d+(\.\d{2})?$', token)   # true/false si matchea el patrón completo

# Enfoque B: manual, char por char (útil si te piden "sin regex",
# o para explicar el trade-off en la entrevista)
def is_valid_price(token: str) -> bool:
    token = token.lstrip('$')
    if '.' in token:
        integer_part, decimal_part = token.split('.', 1)
        return integer_part.isdigit() and len(decimal_part) == 2 and decimal_part.isdigit()
    return token.isdigit()
```

**Por qué importa saber los dos:** en la entrevista técnica (no en
Codility, pero después) te pueden preguntar "¿y si no pudieras usar
regex?" — tener la versión manual lista muestra que entendés qué hace el
regex por debajo, no que solo memorizaste el patrón.

### 1.3 Dicts y sets — la herramienta más usada para bajar de O(n²) a O(n)

```python
# Contar frecuencias en un solo pase — patrón clásico
from collections import Counter
counts = Counter(items)   # dict de item → cantidad, O(n)

# Deduplicar mientras preservás orden
seen = set()
result = []
for item in items:
    if item not in seen:
        seen.add(item)
        result.append(item)
# esto es O(n), vs. usar `if item not in result` que sería O(n²)
# porque buscar en una lista es O(n) cada vez
```

---

## PROBLEMA 1 (18 minutos)

```
Dado un string que representa datos scrapeados de un sitio (texto
con precios en formato inconsistente), encontrá todos los precios
válidos y devolvé el promedio.

Un precio válido tiene el formato: uno o más dígitos, opcionalmente
un punto decimal seguido de exactamente 2 dígitos, y puede tener el
símbolo "$" adelante (opcional).

Ejemplos válidos: "19.99", "$45", "100.00", "5"
Ejemplos inválidos: "19.9", "abc", "$", "19.999", "-5"

Input: raw_text (str) — texto con precios mezclados con otras palabras,
separados por espacios o saltos de línea.

Output: float — el promedio de todos los precios válidos encontrados,
redondeado a 2 decimales. Si no hay precios válidos, devolvé 0.0.

Ejemplo:
Input: "Product A: $19.99 in stock. Price: 45.5 (invalid)
        Product B: $100.00 Product C: 5 units at 25.00 each"
Output: 47.50   (promedio de 19.99, 100.00, 5, 25.00)
```

**Restricción:** hasta 10,000 caracteres de input. Pensá la complejidad
de tu solución antes de escribir.

**Checklist de edge cases a considerar antes de codear:**
```
[ ] Texto vacío
[ ] Texto sin ningún precio válido
[ ] Precio pegado a otra palabra (ej: "Price:45.5,")
[ ] Múltiples precios separados por distintos delimitadores
```

**Espacio para tu solución** (guardala en `problema1.py`, corré ahí, y
pegame el código cuando termines para revisar juntos):

```python
# tu código acá
```

---

## BLOQUE 2 — (se completa después de revisar el Problema 1)

## PROBLEMA 2 — (pendiente)

---

## BLOQUE 3 — (se completa después de revisar el Problema 2)

## PROBLEMA 3 — (pendiente)

📺 "Beat the Codility Coding Interview in Python" 
   youtube.com/watch?v=YkTSNwIrLBo
   → Enfocado 100% en el formato Codility, patrones que se repiten

📺 "Solve the Codility Test - CountDiv Lesson With Me!"
   youtube.com/watch?v=G9-E46cj23Y
   → Resuelve un problema real paso a paso, pensando la complejidad
   en voz alta — justo el proceso que quiero que practiques

📺 Playlist "Codility Lessons"
   youtube.com/playlist?list=PLRq88ERCRTVbaPOTIKD5CTDiHfOFxvrKX


📺 Corey Schafer — "Regular Expressions (Regex) Tutorial"
   Canal: youtube.com/@coreyms
   38 minutos, justo el nivel que necesitás: character sets,
   quantifiers, patrones prácticos (emails, teléfonos — mismo
   tipo de validación que hicimos con precios). Es probablemente
   EL tutorial de regex en Python más recomendado en general,
   nivel muy claro.



📄 "70+ Codility Problems Solved in Python" — programming-review.com
   Los problemas más comunes de las lecciones de Codility, con
   solución y explicación de complejidad para cada uno — bueno
   para después de terminar hoy, como banco de ejercicios extra