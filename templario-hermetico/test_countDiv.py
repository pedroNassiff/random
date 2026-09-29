from countDiv import solution

def test_ejemplo_del_enunciado():
    assert solution(6, 11, 2) == 3

def test_limite_inferior_es_multiplo():
    # A mismo es múltiplo de K -> debe contar
    assert solution(6, 11, 6) == 1

def test_limite_inferior_no_es_multiplo():
    # A mismo es múltiplo de K -> debe contar
    assert solution(7, 7, 3) == 0

def test_k_igual_a_uno_cuenta_todo_el_rango():
    # K = 1 -> todos los enteros del rango son "multiplos"
    assert solution(5, 10, 1) == 6

def test_k_mas_grande_que_el_rango():
    assert solution(1, 5, 100) == 0

def test_ningun_multiplo_en_el_rango():
    assert solution(1, 5, 7) == 0

def test_rango_empieza_en_nultiplo():
    assert solution(4, 10, 4) == 2  # 4 y 8

def test_rango_termina_en_multiplo():
    assert solution(1, 9 ,3) == 3  # 3, 6, 9