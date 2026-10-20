-- Festivos 2026: nacionales, Cataluña y Barcelona (municipio del domicilio fiscal del caso piloto).
-- Verificar contra la resolución anual de días inhábiles de la AGE (BOE) y el calendario laboral
-- de la Generalitat (DOGC) antes de dar por bueno un plazo calculado. Idempotente.

INSERT INTO fiscal.holidays (day, territorio, nombre) VALUES
    ('2026-01-01', 'ES', 'Año Nuevo'),
    ('2026-01-06', 'ES', 'Epifanía del Señor'),
    ('2026-04-03', 'ES', 'Viernes Santo'),
    ('2026-05-01', 'ES', 'Fiesta del Trabajo'),
    ('2026-08-15', 'ES', 'Asunción de la Virgen'),
    ('2026-10-12', 'ES', 'Fiesta Nacional de España'),
    ('2026-11-01', 'ES', 'Todos los Santos'),
    ('2026-12-06', 'ES', 'Día de la Constitución'),
    ('2026-12-08', 'ES', 'Inmaculada Concepción'),
    ('2026-12-25', 'ES', 'Natividad del Señor'),
    ('2026-04-06', 'Cataluña', 'Lunes de Pascua Florida'),
    ('2026-06-24', 'Cataluña', 'San Juan'),
    ('2026-09-11', 'Cataluña', 'Diada Nacional de Cataluña'),
    ('2026-12-26', 'Cataluña', 'San Esteban'),
    ('2026-05-25', 'Barcelona', 'Lunes de Pascua Granada'),
    ('2026-09-24', 'Barcelona', 'La Mercè')
ON CONFLICT (day, territorio) DO NOTHING;
