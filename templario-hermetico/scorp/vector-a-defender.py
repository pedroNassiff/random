
CURRENCY_FEES = {
    "TRY": 1,
    "EUR": 2,
    "USD": 2,
}


def process(data: str) -> str:
    balance_section, _, payment_section = data.partition("&")

    balances = _parse_balances(balance_section)
    payments = _parse_payments(payment_section)

    paid = _allocate(balances, payments)

    return _format_output(balances, paid)


#  Parsing 
def _parse_balances(section: str) -> dict:
    balances = {}
    for token in filter(None, section.split("|")):
        currency, amount = token.split(":")
        if currency in CURRENCY_FEES:
            balances[currency] = balances.get(currency, 0) + int(amount)
    return balances


def _parse_payments(section: str) -> list:
    payments = []
    for token in filter(None, section.split("|")):
        streamer_id, currency, requested = token.split(":")
        if currency in CURRENCY_FEES:
            payments.append((streamer_id, currency, int(requested)))
    return payments


# Lógica de negocio 
def _allocate(balances: dict, payments: list) -> dict:
    by_currency = {}
    for streamer_id, currency, requested in payments:
        fee = CURRENCY_FEES[currency]
        actual = requested - fee
        if actual <= 0:
            continue 
        by_currency.setdefault(currency, []).append((streamer_id, actual))

    paid = {}
    for currency, requests in by_currency.items():
        requests.sort(key=lambda r: r[1])
        for streamer_id, actual in requests:
            if balances.get(currency, 0) >= actual:
                balances[currency] -= actual
                paid.setdefault(currency, []).append((streamer_id, actual))
    return paid


#  Output 
def _format_output(balances: dict, paid: dict) -> str:
    ordered_currencies = sorted(balances.keys())
    balance_part = "|".join(f"{c}:{balances[c]}" for c in ordered_currencies)

    payment_tokens = []
    for currency in ordered_currencies:
        for streamer_id, actual in paid.get(currency, []):
            payment_tokens.append(f"{streamer_id}:{currency}:{actual}")
    payment_part = "|".join(payment_tokens)

    return f"{balance_part}&{payment_part}"