import logging
import re
import sys
from typing import Any

SENSITIVE_PATTERNS = [
    re.compile(r"(key=)[^& \"]+", re.IGNORECASE),
    re.compile(r"(apiKey=)[^& \"]+", re.IGNORECASE),
    re.compile(r"(password=)[^& \"]+", re.IGNORECASE),
    re.compile(r"(token=)[^& \"]+", re.IGNORECASE),
    re.compile(r"(bearer\s+)[^& \"]+", re.IGNORECASE),
]


class RedactingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        orig = super().format(record)
        for pattern in SENSITIVE_PATTERNS:
            orig = pattern.sub(r"\1[REDACTED]", orig)
        return orig


def setup_logging(log_level: str = "INFO") -> logging.Logger:
    level = getattr(logging, log_level.upper(), logging.INFO)
    logger = logging.getLogger("myarea24")
    logger.setLevel(level)

    # Avoid duplicate handlers
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        formatter = RedactingFormatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s (%(module)s:%(lineno)d): %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger


logger = setup_logging()
