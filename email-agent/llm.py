import json
import requests
from config import PROVIDER, OLLAMA_URL, OLLAMA_MODEL, XAI_API_KEY, XAI_MODEL, PERSONA


def _chat_ollama(system: str, user: str, as_json: bool) -> str:
    body = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {"role": "system", "content": f"{PERSONA}\n\n{system}"},
            {"role": "user", "content": user},
        ],
    }
    if as_json:
        body["format"] = "json"
    try:
        r = requests.post(f"{OLLAMA_URL}/api/chat", json=body, timeout=300)
        r.raise_for_status()
    except requests.ConnectionError:
        raise SystemExit(f"Cannot reach Ollama at {OLLAMA_URL}. Run `ollama serve` and `ollama pull {OLLAMA_MODEL}`.")
    return r.json()["message"]["content"].strip()


def _chat_xai(system: str, user: str, as_json: bool) -> str:
    if not XAI_API_KEY:
        raise SystemExit(
            "Set XAI_API_KEY to use the Grok backend (create one at https://console.x.ai), "
            "or set EMAIL_AGENT_PROVIDER=ollama to go back to the local model."
        )
    from openai import OpenAI  # xAI's API is OpenAI-compatible

    client = OpenAI(api_key=XAI_API_KEY, base_url="https://api.x.ai/v1")
    kwargs = {"response_format": {"type": "json_object"}} if as_json else {}
    resp = client.chat.completions.create(
        model=XAI_MODEL,
        messages=[
            {"role": "system", "content": f"{PERSONA}\n\n{system}"},
            {"role": "user", "content": user},
        ],
        **kwargs,
    )
    return resp.choices[0].message.content.strip()


def _chat(system: str, user: str, as_json: bool = False) -> str:
    if PROVIDER == "xai":
        return _chat_xai(system, user, as_json)
    return _chat_ollama(system, user, as_json)


def triage(email: dict) -> dict:
    """Decide whether an email needs a reply."""
    out = _chat(
        'Classify the email. Reply as JSON: {"needs_reply": bool, "reason": str}. '
        "needs_reply is false for newsletters, receipts, automated notifications and spam.",
        f"From: {email['from']}\nSubject: {email['subject']}\n\n{email['body'][:4000]}",
        as_json=True,
    )
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"needs_reply": True, "reason": "triage parse failed"}


def draft_reply(email: dict, guidance: str = "") -> str:
    extra = f"\nExtra guidance from the owner: {guidance}" if guidance else ""
    return _chat(
        "Write the reply body only (no subject line, no quoted original)." + extra,
        f"Reply to this email.\nFrom: {email['from']}\nSubject: {email['subject']}\n\n{email['body'][:6000]}",
    )


def compose(instruction: str) -> dict:
    out = _chat(
        'Write a new email. Reply as JSON: {"subject": str, "body": str}.',
        instruction,
        as_json=True,
    )
    try:
        d = json.loads(out)
        return {"subject": d["subject"], "body": d["body"]}
    except (json.JSONDecodeError, KeyError):
        return {"subject": "", "body": out}
