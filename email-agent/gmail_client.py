import base64
from email.message import EmailMessage
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]
HERE = Path(__file__).parent


def service():
    token = HERE / "token.json"
    creds = Credentials.from_authorized_user_file(token, SCOPES) if token.exists() else None
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(HERE / "credentials.json", SCOPES)
            creds = flow.run_local_server(port=0)
        token.write_text(creds.to_json())
    return build("gmail", "v1", credentials=creds)


def _text(payload) -> str:
    if payload.get("mimeType") == "text/plain" and payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", "replace")
    for part in payload.get("parts", []):
        t = _text(part)
        if t:
            return t
    return ""


def unread(svc, limit: int) -> list[dict]:
    ids = svc.users().messages().list(userId="me", q="is:unread in:inbox", maxResults=limit).execute().get("messages", [])
    out = []
    for m in ids:
        full = svc.users().messages().get(userId="me", id=m["id"], format="full").execute()
        h = {x["name"].lower(): x["value"] for x in full["payload"]["headers"]}
        out.append({
            "id": m["id"], "thread_id": full["threadId"],
            "from": h.get("from", ""), "subject": h.get("subject", ""),
            "message_id": h.get("message-id", ""), "reply_to": h.get("reply-to", h.get("from", "")),
            "body": _text(full["payload"]) or full.get("snippet", ""),
        })
    return out


def _build(to: str, subject: str, body: str, email: dict | None = None) -> dict:
    msg = EmailMessage()
    msg["To"], msg["Subject"] = to, subject
    msg.set_content(body)
    raw = {}
    if email:
        msg["In-Reply-To"] = msg["References"] = email["message_id"]
        raw["threadId"] = email["thread_id"]
    raw["raw"] = base64.urlsafe_b64encode(msg.as_bytes()).decode()
    return raw


def send(svc, to, subject, body, email=None):
    svc.users().messages().send(userId="me", body=_build(to, subject, body, email)).execute()


def save_draft(svc, to, subject, body, email=None):
    svc.users().drafts().create(userId="me", body={"message": _build(to, subject, body, email)}).execute()


def mark_read(svc, msg_id):
    svc.users().messages().modify(userId="me", id=msg_id, body={"removeLabelIds": ["UNREAD"]}).execute()
