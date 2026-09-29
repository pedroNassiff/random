# Práctica — Coderbyte Case Study estilo Scorp (Payments/Full-Stack)

**IMPORTANTE:** Esto NO es el ejercicio real de Scorp. Es un ejercicio original, del mismo tipo y dominio, para que practiques el patrón de pensamiento antes del assessment real. 3 horas es mucho tiempo para un case study — normalmente se reparte en: 20-30 min entender/diseñar, 90-120 min implementar, 30 min testear y pulir.

---

## PARTE 1 — Cómo pensar cualquier case study de payments/full-stack

Antes del código, el patrón mental que buscan (y que ya practicamos en tus entrevistas de SLOs/incidents):

1. **¿Qué es lo que NO puede pasar?** (en payments, esto es más importante que "qué tiene que pasar")
   - Cobrar dos veces por el mismo evento
   - Dejar un estado a medio camino (usuario pagó, pero el crédito no se acreditó)
   - Perder el registro de una transacción

2. **Idempotencia primero.** Si te piden un endpoint que procesa algo con dinero/créditos, la primera pregunta que te tenés que hacer es: *¿qué pasa si este request llega dos veces?* (red flaky, retry del cliente, webhook duplicado del proveedor)

3. **Diseñá el modelo de datos antes de escribir el endpoint.** Vos mismo lo decís siempre: diseño antes que código.

4. **Transacciones donde haya múltiples escrituras relacionadas** (esto es literalmente la pregunta que ya te hicieron en la primera entrevista — SQL transactions).

---

## PARTE 2 — Ejemplo resuelto: "Virtual Gift Redemption"

### El enunciado (tipo case study):

> Build a small API for a virtual gifting feature. Users can send a "gift" (a fixed-price virtual item, e.g. $5) to another user during a livestream. When a gift is sent:
> - The sender's balance is debited
> - The recipient's balance is credited
> - A transaction record is created
>
> Requirements:
> - `POST /gifts/send` — body: `{ sender_id, recipient_id, gift_id, idempotency_key }`
> - If the sender doesn't have enough balance, reject with a clear error
> - The same `idempotency_key` sent twice should NOT double-charge
> - Provide a way to query a user's transaction history
>
> You have 2 hours. Focus on correctness over polish.

### Cómo lo pienso ANTES de codear (esto es lo que evalúan, no solo el código):

**Modelo de datos:**

```
users
  id, balance_cents

gifts
  id, name, price_cents

transactions
  id, sender_id, recipient_id, gift_id,
  amount_cents, idempotency_key (UNIQUE),
  status (pending/completed/failed),
  created_at
```

**Por qué `idempotency_key` es UNIQUE:** esa es la defensa real contra el doble-cobro. No confío en "chequear antes de insertar" (race condition) — confío en que la base de datos rechace el duplicado.

**Por qué hay una tabla `transactions` separada, no solo actualizar balances:**
Porque si algo falla a mitad de camino, necesito poder reconstruir qué pasó. Es el mismo principio que usé en Calavera Sur con el recovery de productos: nunca confíes en que el estado final es correcto solo porque el job "terminó sin error".

### La implementación:

```python
# models.py
from sqlalchemy import Column, Integer, String, Enum, DateTime, UniqueConstraint
from sqlalchemy.orm import declarative_base
from datetime import datetime
import enum

Base = declarative_base()

class TxStatus(str, enum.Enum):
    completed = "completed"
    failed = "failed"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    balance_cents = Column(Integer, nullable=False, default=0)

class Gift(Base):
    __tablename__ = "gifts"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    price_cents = Column(Integer, nullable=False)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True)
    sender_id = Column(Integer, nullable=False)
    recipient_id = Column(Integer, nullable=False)
    gift_id = Column(Integer, nullable=False)
    amount_cents = Column(Integer, nullable=False)
    idempotency_key = Column(String, nullable=False)
    status = Column(Enum(TxStatus), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("idempotency_key", name="uq_idempotency_key"),
    )
```

```python
# main.py
from fastapi import FastAPI, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

app = FastAPI()

class SendGiftRequest(BaseModel):
    sender_id: int
    recipient_id: int
    gift_id: int
    idempotency_key: str

@app.post("/gifts/send")
def send_gift(req: SendGiftRequest, db: Session = Depends(get_db)):
    # 1. Idempotency check first — if this key already exists, return the
    #    previous result instead of processing again. This handles retries
    #    safely without needing a lock.
    existing = db.query(Transaction).filter_by(
        idempotency_key=req.idempotency_key
    ).first()
    if existing:
        return {
            "status": existing.status,
            "transaction_id": existing.id,
            "note": "idempotent replay — no double charge"
        }

    gift = db.query(Gift).get(req.gift_id)
    if not gift:
        raise HTTPException(404, "Gift not found")

    sender = db.query(User).get(req.sender_id)
    if not sender:
        raise HTTPException(404, "Sender not found")

    if sender.balance_cents < gift.price_cents:
        # Insufficient funds is a valid business outcome, not a 500.
        # I still record it, so the sender's attempt is auditable.
        tx = Transaction(
            sender_id=req.sender_id,
            recipient_id=req.recipient_id,
            gift_id=req.gift_id,
            amount_cents=gift.price_cents,
            idempotency_key=req.idempotency_key,
            status=TxStatus.failed,
        )
        db.add(tx)
        db.commit()
        raise HTTPException(402, "Insufficient balance")

    recipient = db.query(User).get(req.recipient_id)
    if not recipient:
        raise HTTPException(404, "Recipient not found")

    # 2. This is the "two UPDATEs must both succeed or neither" problem —
    #    the exact one from your first Scorp interview. Wrap it in a
    #    transaction explicitly.
    try:
        sender.balance_cents -= gift.price_cents
        recipient.balance_cents += gift.price_cents

        tx = Transaction(
            sender_id=req.sender_id,
            recipient_id=req.recipient_id,
            gift_id=req.gift_id,
            amount_cents=gift.price_cents,
            idempotency_key=req.idempotency_key,
            status=TxStatus.completed,
        )
        db.add(tx)
        db.commit()
    except IntegrityError:
        # Race condition: two identical requests hit at almost the same
        # time and both passed the idempotency check before either
        # committed. The UNIQUE constraint on idempotency_key catches it
        # here — this is the real safety net, not the check above.
        db.rollback()
        existing = db.query(Transaction).filter_by(
            idempotency_key=req.idempotency_key
        ).first()
        return {"status": existing.status, "transaction_id": existing.id}

    return {"status": "completed", "transaction_id": tx.id}


@app.get("/users/{user_id}/transactions")
def get_history(user_id: int, db: Session = Depends(get_db)):
    return db.query(Transaction).filter(
        (Transaction.sender_id == user_id) | (Transaction.recipient_id == user_id)
    ).order_by(Transaction.created_at.desc()).all()
```

### Por qué esta solución es buena (lo que un reviewer va a notar):

1. **Idempotencia con doble capa:** chequeo optimista al principio (rápido, evita trabajo innecesario) + UNIQUE constraint como garantía real contra race conditions. Esto demuestra que entendés que "chequear antes de escribir" NO es una garantía en concurrencia.
2. **Insufficient balance se registra, no se descarta.** Un fallo de negocio sigue siendo auditable.
3. **Transacción explícita** para las dos escrituras relacionadas — exactamente lo que ya sabés explicar de la primera entrevista.
4. **Comentarios que explican el "por qué", no el "qué"** — un reviewer humano entiende tu razonamiento sin tener que preguntarte.

### Qué le faltaría con más tiempo (está bien mencionarlo, no hace falta implementarlo todo):
- Locks pesimistas (`SELECT FOR UPDATE`) si el volumen de concurrencia fuera muy alto
- Rate limiting por usuario
- Tests automatizados (unit + integración)

---

## PARTE 3 — Ejercicio para VOS (practicá esto solo, con timer)

### El enunciado:

> Build a small API for a subscription credits system. Users subscribe to a monthly plan that grants them a fixed number of credits. Credits are consumed when the user unlocks premium content.
>
> Requirements:
> - `POST /subscriptions/activate` — body: `{ user_id, plan_id, idempotency_key }` — grants credits according to the plan
> - `POST /content/unlock` — body: `{ user_id, content_id, idempotency_key }` — consumes 1 credit if the user has any; if not, reject
> - `GET /users/{user_id}/credits` — returns current credit balance
> - The same `idempotency_key` should never be processed twice
> - Handle the case where a user tries to unlock content they've already unlocked (should NOT consume a second credit)

### Timebox recomendado: 60-90 minutos (menos que el ejemplo, porque ya viste el patrón)

### Guía de qué pensar ANTES de escribir código (no te doy la solución, pero sí las preguntas que te tenés que hacer):

1. ¿Qué tablas necesitás? (pensá en: users, plans, credit_transactions, unlocked_content)
2. ¿Dónde va la UNIQUE constraint de idempotencia?
3. ¿Cómo evitás que "unlock del mismo contenido dos veces" consuma dos créditos? (pista: esto es una idempotencia DIFERENTE de la del `idempotency_key` — es idempotencia de negocio, no solo de request)
4. ¿Qué pasa si `unlock` falla a mitad de camino entre "descontar crédito" y "marcar contenido como desbloqueado"?

### Cuando termines:

Pegame tu código (o el diseño si no llegás a implementar todo) y te lo reviso como si fuera un reviewer real — te digo qué está bien, qué le falta, y qué preguntaría un entrevistador senior sobre tus decisiones. Esa review es la parte más valiosa de la práctica.

---

## Antes del assessment real — checklist mental

- [ ] Idempotencia: chequeo + constraint a nivel DB, no solo lógica de aplicación
- [ ] Transacciones explícitas para escrituras relacionadas
- [ ] Fallos de negocio (ej: sin balance) devuelven error claro, no 500
- [ ] Modelo de datos pensado ANTES de escribir el endpoint
- [ ] Comentarios que expliquen decisiones, no que narren el código línea por línea