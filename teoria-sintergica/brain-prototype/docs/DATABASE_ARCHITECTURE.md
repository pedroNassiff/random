# 🗄️ Arquitectura de Base de Datos - Brain Prototype

## Stack Seleccionado

### InfluxDB 2.7 (Time-Series Database)
**Para:** Datos EEG en tiempo real (256 Hz)

**Ventajas:**
- ✅ Optimizado para series temporales
- ✅ Compresión automática (10x menos espacio)
- ✅ Queries agregadas ultra-rápidas
- ✅ Retención automática (borrar datos > 30 días)
- ✅ Downsampling nativo

**Ejemplo de dato:**
```json
{
  "measurement": "brain_state",
  "tags": {
    "user_id": "user_001",
    "session_id": "session_123"
  },
  "fields": {
    "coherence": 0.75,
    "alpha": 0.45,
    "theta": 0.25,
    "beta": 0.15,
    "gamma": 0.10,
    "delta": 0.05
  },
  "timestamp": "2024-12-14T10:30:00Z"
}
```

### PostgreSQL 15 (Relational Database)
**Para:** Usuarios, sesiones, logros

**Ventajas:**
- ✅ ACID transactions
- ✅ Relaciones complejas
- ✅ JSON support (configuraciones)
- ✅ Full-text search
- ✅ Triggers automáticos

**Tablas principales:**
- `users` - Perfiles de usuario
- `practice_sessions` - Sesiones de práctica
- `achievements` - Logros desbloqueados
- `user_stats` - Cache de estadísticas

### Redis 7 (Cache)
**Para:** Estado actual en tiempo real

**Ventajas:**
- ✅ Latencia ultra-baja (<1ms)
- ✅ Pub/Sub para WebSockets
- ✅ TTL automático
- ✅ Structures (hashes, sets)

**Uso:**
```python
# Estado actual del usuario
redis.hset('user:001:current', {
  'coherence': 0.75,
  'state': 'meditation',
  'session_id': 'abc123'
})

# Caché de métricas frecuentes
redis.setex('user:001:stats', 300, json.dumps(stats))
```

## 🐳 Deployment con Docker

### Levantar servicios:
```bash
cd /Users/pedronassiff/Desktop/proyectos/random/teoria-sintergica/brain-prototype
docker-compose up -d
```

### Verificar estado:
```bash
docker-compose ps
docker-compose logs -f influxdb
docker-compose logs -f postgres
```

### Acceder a servicios:
- InfluxDB UI: http://localhost:8086
  - User: `admin`
  - Pass: `sintergic2024`
  - Token: `my-super-secret-auth-token`

- PostgreSQL: `localhost:5432`
  - Database: `brain_prototype`
  - User: `brain_user`
  - Pass: `sintergic2024`

- Redis: `localhost:6379`

- Grafana (opcional): http://localhost:3000
  - User: `admin`
  - Pass: `sintergic2024`

### Detener servicios:
```bash
docker-compose down
# O para borrar datos también:
docker-compose down -v
```

## 📊 Flujo de Datos

```
EEG Hardware (256 Hz)
    │
    ▼
Backend (inference.py)
    │
    ├─────────────────────┬─────────────────────┐
    │                     │                     │
    ▼                     ▼                     ▼
InfluxDB              Redis               PostgreSQL
(write 5Hz)        (publish WS)         (on session end)
    │                     │                     │
    │                     ▼                     │
    │              Frontend (3D)                │
    │                                           │
    └───────────────────────────────────────────┘
              (aggregate on session end)
```

## 🔧 Integración Backend

### requirements.txt adicionales:
```txt
influxdb-client>=1.38.0
psycopg2-binary>=2.9.9
redis>=5.0.1
sqlalchemy>=2.0.23
```

### Ejemplo de uso:

```python
# backend/database/influx_client.py
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

class InfluxDBManager:
    def __init__(self):
        self.client = InfluxDBClient(
            url="http://localhost:8086",
            token="my-super-secret-auth-token",
            org="teoria-sintergica"
        )
        self.write_api = self.client.write_api(write_options=SYNCHRONOUS)
        
    def write_brain_state(self, user_id: str, session_id: str, state: dict):
        point = Point("brain_state") \
            .tag("user_id", user_id) \
            .tag("session_id", session_id) \
            .field("coherence", state['coherence']) \
            .field("alpha", state['bands']['alpha']) \
            .field("theta", state['bands']['theta']) \
            .field("beta", state['bands']['beta']) \
            .field("gamma", state['bands']['gamma']) \
            .field("delta", state['bands']['delta']) \
            .field("plv", state['plv']) \
            .field("entropy", state['entropy'])
        
        self.write_api.write(bucket="eeg-data", record=point)
    
    def get_session_avg(self, session_id: str):
        query = f'''
        from(bucket: "eeg-data")
          |> range(start: -1h)
          |> filter(fn: (r) => r["session_id"] == "{session_id}")
          |> mean()
        '''
        result = self.client.query_api().query(query)
        return result

# backend/database/postgres_client.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

DATABASE_URL = "postgresql://brain_user:sintergic2024@localhost:5432/brain_prototype"

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def create_session(user_id: str, target: float, meditation_type: str):
    db = SessionLocal()
    session = PracticeSession(
        user_id=user_id,
        started_at=datetime.now(),
        target_coherence=target,
        meditation_type=meditation_type
    )
    db.add(session)
    db.commit()
    return session.id

# backend/database/redis_client.py
import redis
import json

redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

def cache_current_state(user_id: str, state: dict):
    redis_client.hset(f'user:{user_id}:current', mapping=state)
    redis_client.expire(f'user:{user_id}:current', 300)  # 5 min TTL

def publish_state(channel: str, state: dict):
    redis_client.publish(channel, json.dumps(state))
```

## 📈 Queries Útiles

### InfluxDB (Flux)

```flux
// Promedio de coherencia últimos 5 minutos
from(bucket: "eeg-data")
  |> range(start: -5m)
  |> filter(fn: (r) => r["_measurement"] == "brain_state")
  |> filter(fn: (r) => r["_field"] == "coherence")
  |> mean()

// Estado sintérgico (coherence > 0.8 AND alpha > 0.6)
from(bucket: "eeg-data")
  |> range(start: -1h)
  |> filter(fn: (r) => r["coherence"] > 0.8 and r["alpha"] > 0.6)
  |> count()
```

### PostgreSQL (SQL)

```sql
-- Top usuarios por tiempo de práctica
SELECT u.name, us.total_practice_time / 3600.0 AS hours_practiced
FROM users u
JOIN user_stats us ON u.id = us.user_id
ORDER BY us.total_practice_time DESC
LIMIT 10;

-- Sesiones con estado sintérgico > 50%
SELECT id, started_at, duration_seconds, syntergic_state_percentage
FROM practice_sessions
WHERE syntergic_state_percentage > 0.5
ORDER BY syntergic_state_percentage DESC;

-- Progreso de logros por usuario
SELECT u.name, 
       us.achievements_count,
       ROUND(us.achievements_count::NUMERIC / 10 * 100, 1) AS completion_percentage
FROM users u
JOIN user_stats us ON u.id = us.user_id
ORDER BY us.achievements_count DESC;
```

## 🎯 Próximos Pasos

1. **Instalar dependencias:**
```bash
cd backend
pip install influxdb-client psycopg2-binary redis sqlalchemy
```

2. **Levantar Docker:**
```bash
docker-compose up -d
```

3. **Crear modelos SQLAlchemy:**
```bash
# backend/models/
touch user.py session.py achievement.py
```

4. **Integrar en inference.py:**
- Escribir a InfluxDB cada 200ms (5 Hz)
- Publicar a Redis para WebSocket
- Agregar a PostgreSQL al finalizar sesión

## 📚 Referencias

- [InfluxDB Documentation](https://docs.influxdata.com/influxdb/v2.7/)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- [Redis Time Series](https://redis.io/docs/stack/timeseries/)
