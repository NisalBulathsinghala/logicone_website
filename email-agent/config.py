import os

# "xai" (Grok, cloud) or "ollama" (local)
PROVIDER = os.environ.get("EMAIL_AGENT_PROVIDER", "xai")

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("EMAIL_AGENT_MODEL", "llama3.1:8b")

XAI_API_KEY = os.environ.get("XAI_API_KEY", "")
XAI_MODEL = os.environ.get("XAI_MODEL", "grok-4-fast")

MAX_INBOX = int(os.environ.get("EMAIL_AGENT_MAX", "10"))

# Who you are / how you write. Edit freely; it is prepended to every prompt.
PERSONA = """You write emails on behalf of the owner of Logic One SA, a small business.
Tone: friendly, concise, professional. Plain text only. No emojis.
Sign off with the owner's name only. Never invent prices, dates or commitments;
if information is missing, say you'll follow up or ask a question."""
