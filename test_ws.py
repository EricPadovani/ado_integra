import asyncio
import websockets
import json
import base64
import datetime

WS_URL = "wss://wymocw0zke.execute-api.us-east-1.amazonaws.com/prod"
JWT = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IlJERTBPVEF3UVVVMk16Z3hPRUpGTkVSRk5qUkRNakkzUVVFek1qZEZOVEJCUkRVMlJrTTRSZyJ9.eyJodHRwczovL3RyLmNvbS9mZWRlcmF0ZWRfdXNlcl9pZCI6IjYxMTY4MzYiLCJodHRwczovL3RyLmNvbS9mZWRlcmF0ZWRfcHJvdmlkZXJfaWQiOiJUUlNTTyIsImh0dHBzOi8vdHIuY29tL2xpbmtlZF9kYXRhIjpbeyJzdWIiOiJvaWRjfHNzby1hdXRofFRSU1NPfDYxMTY4MzYifV0sImh0dHBzOi8vdHIuY29tL2V1aWQiOiJkOTViZTg0OS0xY2I1LTRjYjgtODllZC1kN2IyNDdhODVmYTgiLCJodHRwczovL3RyLmNvbS9hc3NldElEIjoiYTIwODE5OSIsImdpdmVuX25hbWUiOiJFcmljIiwiZmFtaWx5X25hbWUiOiJOYXNjaW1lbnRvIiwicGljdHVyZSI6Imh0dHBzOi8vcy5ncmF2YXRhci5jb20vYXZhdGFyLzQ3YWQ0YjlhM2I2ZTMwYTBhMThjMGE0NjkwMmFlN2IwP3M9NDgwJnI9cGcmZD1odHRwcyUzQSUyRiUyRmNkbi5hdXRoMC5jb20lMkZhdmF0YXJzJTJGZXIucG5nIiwidXBkYXRlZF9hdCI6MTcxMDk1NTA5MSwiZW1haWwiOiJlcmljLnBhZG92YW5pZG9uYXNjaW1lbnRvQHRob21zb25yZXV0ZXJzLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiaXNzIjoiaHR0cHM6Ly9hdXRoLnRob21zb25yZXV0ZXJzLmNvbSIsImF1ZCI6InRnVVZad1hBcVpXV0J5dXM5UVNQaTF5TnlvTjJsZmxJIiwiaWF0IjoxNzEwOTU1MDkyLCJleHAiOjE3MTA5OTEwOTIsInN1YiI6ImF1dGgwfDY1ZWYwNTYxMjU1OTM0YjkxYmQyNDg2NCIsInNpZCI6ImVJOVFFQzI0d1JVZmRDYVgzQld2cXMtdjVObkFRaS1xIiwibm9uY2UiOiJZMEZIVFZoNVVXaE9NMWhvVTBrMVZHTmFiMUYrZHpkUVMzVmtVbFJmZGt0amFpMVVNV3BrYzI5UlF3PT0ifQ.aVujD-L5KDN2UlrByE-GiZ9weHuaAIwJl4fZV63bsJgIB3KaBwzQx-VUnhZIfkWvhqJxDCevCGrOMaskdHSjTHvaIyuBLDf8FnX2tPBLNOEuLfqYmM2FIyAjvSQPJADja8n-TmPC1VOYa93lFd7e1YImhsE2XTN6BGbo-1qR68ZhxcH86sE5wETf1OYG82gN2zY3Io3kvXfSF3odUh-A2waKOV3UWiF4p9M1E_1OHP1_dGpuUWZB9UwUKgjz2T2IIp0TQoDF0a1nkCBOpLce86AZP9s4K7Tf3Jjl0kFuqGsCsNDgAH-evVYpzwLdtj0jdwGf12gpsskgA2giRcZYYg"

def decode_jwt_payload(token):
    try:
        parts = token.split('.')
        payload = parts[1]
        # Adiciona padding se necessário
        payload += '=' * (4 - len(payload) % 4)
        decoded = base64.urlsafe_b64decode(payload)
        return json.loads(decoded)
    except Exception as e:
        return {"error": str(e)}

def check_jwt_expiry(token):
    payload = decode_jwt_payload(token)
    exp = payload.get("exp")
    iat = payload.get("iat")
    if exp:
        exp_dt = datetime.datetime.fromtimestamp(exp)
        iat_dt = datetime.datetime.fromtimestamp(iat) if iat else None
        now = datetime.datetime.now()
        print(f"  Emitido em : {iat_dt}")
        print(f"  Expira em  : {exp_dt}")
        print(f"  Agora      : {now}")
        print(f"  Status     : {'EXPIRADO' if now > exp_dt else 'VÁLIDO'}")
        return now <= exp_dt
    return False

async def test_websocket():
    url = f"{WS_URL}?Authorization={JWT}"
    print(f"Conectando em: {WS_URL}")
    print(f"Token: {JWT[:40]}...")
    print()
    print("=== Verificando JWT ===")
    valid = check_jwt_expiry(JWT)
    print()

    if not valid:
        print("AVISO: Token expirado. Tentando conexão mesmo assim para confirmar o erro...\n")

    try:
        async with websockets.connect(url, open_timeout=10) as ws:
            print("✓ Conexão WebSocket estabelecida com sucesso!")
            payload = {
                "action": "SendMessage",
                "workflow_id": "80f448d2-fd59-440f-ba24-ebc3014e1fdf",
                "query": "Teste de conexão. Responda com: OK",
                "is_persistence_allowed": False,
                "modelparams": {
                    "openai_gpt-4-turbo": {
                        "temperature": "0.7",
                        "top_p": "0.9",
                        "frequency_penalty": "0",
                        "system_prompt": "Você é um assistente de teste.",
                        "max_tokens": "100",
                        "presence_penalty": "0"
                    }
                }
            }
            await ws.send(json.dumps(payload))
            print("✓ Mensagem enviada. Aguardando resposta (10s)...")
            try:
                async for msg in asyncio.wait_for(ws.__aiter__().__anext__(), timeout=10):
                    print(f"✓ Resposta recebida: {msg[:200]}")
                    break
            except asyncio.TimeoutError:
                print("⚠ Timeout: sem resposta em 10 segundos")
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"✗ Erro HTTP {e.status_code}: conexão recusada")
        if e.status_code == 401:
            print("  → Token JWT inválido ou expirado")
        elif e.status_code == 403:
            print("  → Acesso negado")
    except Exception as e:
        print(f"✗ Erro de conexão: {type(e).__name__}: {e}")

asyncio.run(test_websocket())
