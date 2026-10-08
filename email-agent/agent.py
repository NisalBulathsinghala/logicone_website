#!/usr/bin/env python3
"""Local email agent: Gmail + Ollama, human approval before anything is sent."""
import argparse
import os
import subprocess
import tempfile

import gmail_client as gc
import llm
from config import MAX_INBOX


def edit(text: str) -> str:
    with tempfile.NamedTemporaryFile("w+", suffix=".txt", delete=False) as f:
        f.write(text)
        path = f.name
    subprocess.call([os.environ.get("EDITOR", "nano"), path])
    return open(path).read().strip()


def approve(svc, to, subject, body, email=None) -> bool:
    """Show the email and act on the choice. Returns True if handled."""
    while True:
        print(f"\n--- To: {to}\n--- Subject: {subject}\n\n{body}\n")
        c = input("[s]end  [d]raft  [e]dit  [r]egenerate w/ guidance  [k]ip  [q]uit > ").strip().lower()
        if c == "s":
            gc.send(svc, to, subject, body, email)
            print("Sent.")
            return True
        if c == "d":
            gc.save_draft(svc, to, subject, body, email)
            print("Saved to Gmail Drafts.")
            return True
        if c == "e":
            body = edit(body)
        elif c == "r" and email:
            body = llm.draft_reply(email, input("Guidance: "))
        elif c == "k":
            return False
        elif c == "q":
            raise SystemExit(0)


def cmd_inbox(svc, args):
    emails = gc.unread(svc, args.limit)
    print(f"{len(emails)} unread email(s).")
    for e in emails:
        print(f"\n=== {e['from']} | {e['subject']}")
        t = llm.triage(e)
        if not t.get("needs_reply"):
            print(f"No reply needed: {t.get('reason')}")
            continue
        subject = e["subject"] if e["subject"].lower().startswith("re:") else f"Re: {e['subject']}"
        if approve(svc, e["reply_to"], subject, llm.draft_reply(e), e):
            gc.mark_read(svc, e["id"])


def cmd_compose(svc, args):
    to = args.to or input("To: ")
    d = llm.compose(args.instruction or input("What should the email say? "))
    approve(svc, to, d["subject"], d["body"])


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="cmd", required=True)
    i = sub.add_parser("inbox", help="triage unread mail and draft replies")
    i.add_argument("--limit", type=int, default=MAX_INBOX)
    c = sub.add_parser("compose", help="write a new email from an instruction")
    c.add_argument("--to")
    c.add_argument("instruction", nargs="?")
    a = p.parse_args()
    svc = gc.service()
    {"inbox": cmd_inbox, "compose": cmd_compose}[a.cmd](svc, a)
