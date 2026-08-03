#!/usr/bin/env python3
"""Emit a minimal, private-review JSONL projection from twscrape Latest search."""

from __future__ import annotations

import argparse
import asyncio
from importlib.metadata import version
import json
from pathlib import Path
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--health", action="store_true")
    parser.add_argument("--db", type=Path)
    parser.add_argument("--query")
    parser.add_argument("--limit", type=int, default=100)
    return parser.parse_args()


def tweet_row(tweet: object) -> dict[str, object]:
    user = getattr(tweet, "user", None)
    published = getattr(tweet, "date", None)
    return {
        "id": str(getattr(tweet, "id")),
        "url": str(getattr(tweet, "url")),
        "text": str(getattr(tweet, "rawContent")),
        "createdAt": published.isoformat() if published else None,
        "authorId": str(getattr(user, "id")) if user else None,
        "metrics": {
            "replyCount": getattr(tweet, "replyCount", 0),
            "retweetCount": getattr(tweet, "retweetCount", 0),
            "likeCount": getattr(tweet, "likeCount", 0),
            "quoteCount": getattr(tweet, "quoteCount", 0),
            "bookmarkCount": getattr(tweet, "bookmarkedCount", 0),
            "viewCount": getattr(tweet, "viewCount", None),
        },
    }


async def collect(database: Path, query: str, limit: int) -> None:
    from twscrape import API

    api = API(
        str(database),
        raise_when_no_account=True,
        wait_timeout=10,
        wait_interval=1,
    )
    accounts = await api.pool.get_all()
    if not any(account.active for account in accounts):
        raise RuntimeError("no active twscrape account in the isolated database")

    async for tweet in api.search(query, limit=max(1, min(limit, 500))):
        print(json.dumps(tweet_row(tweet), ensure_ascii=False))


def main() -> int:
    args = parse_args()
    if args.health:
        print(json.dumps({"collector": "twscrape", "version": version("twscrape")}))
        return 0
    if not args.db or not args.query:
        print("--db and --query are required", file=sys.stderr)
        return 2
    if not args.db.is_file():
        print("isolated twscrape database does not exist", file=sys.stderr)
        return 2
    try:
        asyncio.run(collect(args.db, args.query, args.limit))
    except Exception as error:  # Keep account and cookie details out of logs.
        print(f"twscrape collection failed: {error.__class__.__name__}: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
