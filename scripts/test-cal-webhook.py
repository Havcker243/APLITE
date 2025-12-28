import argparse
import hashlib
import hmac
import json
import os
import sys
import urllib.request


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a signed Cal webhook payload.")
    parser.add_argument("--url", default="http://127.0.0.1:8000/webhooks/cal")
    parser.add_argument("--secret", default=os.getenv("CAL_WEBHOOK_SECRET", ""))
    parser.add_argument("--email", default="test@example.com")
    parser.add_argument("--event", default="booking.completed")
    args = parser.parse_args()

    payload = {
        "event": args.event,
        "booking": {"attendees": [{"email": args.email}]},
    }
    body = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(args.url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    if args.secret:
        signature = hmac.new(args.secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
        req.add_header("X-Cal-Signature", signature)
    else:
        print("CAL_WEBHOOK_SECRET not set; sending unsigned payload.")

    print(f"POST {args.url}")
    print(f"Event: {args.event}")
    print(f"Email: {args.email}")

    with urllib.request.urlopen(req) as resp:
        print(resp.read().decode("utf-8"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
