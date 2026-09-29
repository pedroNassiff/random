# Guía — Cómo escribir y correr tests manuales (pytest)

Esta guía es para vos: la idea es que escribas los test cases a mano
(como pide el protocolo del 00-spec.md: *"agregá tus propios test cases
al final del archivo antes de confiar en que está bien"*), no que un
agente te los genere. Acá abajo el paso a paso, usando `countDiv.py`
como ejemplo.

> Nota: esto es para practicar. El Gauntlet completo del `CLAUDE.md` raíz
> (cobertura 90-95%, mutmut, mypy --strict) es para el código de
> producción en `backend/`. Acá alcanza con pytest y buen criterio de
> edge cases.

---

## 0. Instalar pytest (una sola vez)

Con el venv activado (ya lo tenés activado, se ve en tu prompt `(venv)`):

```bash
pip install pytest
```

Confirmá que quedó instalado:

```bash
pytest --version
```

---

## 1. Convención de nombres y estructura

pytest descubre automáticamente los archivos que:
- empiezan con `test_` o terminan en `_test.py`
- contienen funciones que empiezan con `test_`

Para cada archivo de ejercicio `X.py`, creá `test_X.py` al lado:

```
templario-hermetico/
├── countDiv.py
├── test_countDiv.py      ← acá van los tests de countDiv.py
```

No hace falta carpeta `tests/` separada para ejercicios sueltos como
estos — al lado del archivo alcanza y es más rápido de navegar.

---

## 2. Anatomía de un test — Arrange / Act / Assert

Todo test tiene tres partes, aunque no se escriban como comentarios:

```python
def test_nombre_descriptivo():
    # Arrange: preparar los inputs
    A, B, K = 6, 11, 2

    # Act: llamar a la función que estás probando
    resultado = solution(A, B, K)

    # Assert: verificar que el resultado es el esperado
    assert resultado == 3
```

**Regla para el nombre del test:** `test_<qué_caso_prueba>`, no
`test_1`, `test_2`. Si falla, el nombre solo ya te dice qué se rompió:
`test_countDiv_devuelve_cero_si_ningun_multiplo_en_rango` es mejor que
`test_case_3`.

---

## 3. Pensá los casos ANTES de escribir el test (así lo pide el protocolo)

Para `countDiv.py`, mirá la firma: `solution(A, B, K)` — cuenta cuántos
múltiplos de `K` hay en el rango `[A, B]`.

Antes de escribir código, hacé la lista de edge cases (esto es literal
lo que pide el paso 2 del protocolo en `00-spec.md`):

```
[ ] Caso del enunciado (A=6, B=11, K=2 → 3)
[ ] A == B y ese número es múltiplo de K
[ ] A == B y ese número NO es múltiplo de K
[ ] K == 1 (todo el rango son "múltiplos")
[ ] K más grande que todo el rango (0 resultados)
[ ] Ningún múltiplo de K cae en el rango
[ ] A o B negativos
[ ] Rango que empieza justo en un múltiplo de K
[ ] Rango que termina justo en un múltiplo de K
```

Esa lista es tu checklist de tests — cada ítem se convierte en una
función `test_...`.

---

## 4. Ejemplo completo — `test_countDiv.py`

Para importar `solution` desde `countDiv.py`, el import es directo
porque están en la misma carpeta:

```python
from countDiv import solution


def test_ejemplo_del_enunciado():
    assert solution(6, 11, 2) == 3


def test_limite_inferior_es_multiplo():
    # A mismo es múltiplo de K -> debe contar
    assert solution(6, 6, 3) == 1


def test_limite_inferior_no_es_multiplo():
    assert solution(7, 7, 3) == 0


def test_k_igual_a_uno_cuenta_todo_el_rango():
    # con K=1, todos los enteros del rango son "múltiplos"
    assert solution(5, 10, 1) == 6


def test_k_mas_grande_que_el_rango():
    assert solution(1, 5, 100) == 0


def test_ningun_multiplo_en_el_rango():
    assert solution(7, 9, 5) == 0


def test_rango_empieza_en_multiplo():
    assert solution(4, 10, 4) == 2   # 4 y 8


def test_rango_termina_en_multiplo():
    assert solution(1, 9, 3) == 3    # 3, 6, 9
```

Guardalo como `templario-hermetico/test_countDiv.py`.

---

## 5. Correr los tests

Desde `templario-hermetico/` con el venv activado:

```bash
# Correr todo el archivo, en modo verboso (ves cada test por nombre)
pytest test_countDiv.py -v

# Correr TODOS los test_*.py de la carpeta
pytest -v

# Correr un solo test por nombre (útil cuando estás iterando en uno)
pytest test_countDiv.py -k test_k_igual_a_uno_cuenta_todo_el_rango -v

# Si algo falla, ver el traceback completo (default) o corto
pytest -v --tb=short
```

### Cómo leer el resultado

- `.` o `PASSED` en verde → el test pasó.
- `F` o `FAILED` en rojo → pytest te muestra el `assert` que falló y
  los dos valores (`assert 3 == 4` te dice: esperabas 4, te dio 3).
- Si `import countDiv` falla con `ModuleNotFoundError`, es porque estás
  corriendo `pytest` desde otra carpeta — pará en `templario-hermetico/`.

---

## 6. Loop de trabajo recomendado

1. Escribí UN test de la checklist del paso 3.
2. Corré `pytest test_countDiv.py -v` — tiene que pasar (si falla,
   arreglá la función, no el test, salvo que el test esté mal escrito).
3. Repetí con el siguiente ítem de la checklist.
4. Cuando termines la lista completa, corré `pytest -v` una vez más
   para confirmar que no rompiste nada de lo anterior.

Esto es básicamente el mismo protocolo que ya tenés en `00-spec.md`,
aplicado con pytest en vez de "correlo a mano y mirá si da bien".

---

## 7. (Opcional) Ver qué % de tu código cubren los tests

Si en algún punto querés saber si te olvidaste de algún `if`/`else` sin
testear:

```bash
pip install pytest-cov
pytest --cov=. --cov-report=term-missing
```

`term-missing` te muestra los números de línea que ningún test tocó.
Para estos ejercicios no hay un umbral que cumplir — es solo para que
veas el hueco, no una puerta de merge como en `backend/`.
