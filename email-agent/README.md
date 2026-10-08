# Email agent

Gmail + an LLM (Grok by default, or a local Ollama model). Every email needs your approval before
it's sent — nothing goes out on its own.

**Privacy note:** with the default Grok backend, email content is sent to xAI's API to generate
triage/drafts. Set `EMAIL_AGENT_PROVIDER=ollama` instead if you want everything to stay local.

## Setup
1. Grok (default): create an API key at https://console.x.ai, then `export XAI_API_KEY=...`.
   Local instead: install Ollama, `ollama pull llama3.1:8b`, and `export EMAIL_AGENT_PROVIDER=ollama`.
2. Google Cloud Console: create a project, enable the Gmail API, configure the OAuth consent screen
   (add yourself as a test user), create an OAuth client ID of type **Desktop app**, download it as
   `credentials.json` into this folder.
3. `python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`

## Use
    python agent.py inbox                      # triage unread, draft replies, approve each
    python agent.py compose --to a@b.com "Ask about the delayed order"

Edit `config.py` to change the persona/tone, provider, or model. First run opens a browser for Google sign-in.
