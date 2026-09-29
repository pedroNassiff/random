-- Fútbol Vaquero — calendario acordado del grupo (29/09/2026). Idempotente.
-- Partido miércoles 19:00–20:00 · cierra martes 23:59 · abre viernes 00:00 ·
-- cupo 12 (10 en cancha + 2 cambios; del 13 en adelante, lista de espera).

UPDATE futbol.groups
SET match_weekday = 3, match_time = '19:00',
    signup_close_weekday = 2, signup_close_time = '23:59',
    signup_open_weekday = 5, signup_open_time = '00:00',
    capacity = 12
WHERE name = 'Fútbol Vaquero';
