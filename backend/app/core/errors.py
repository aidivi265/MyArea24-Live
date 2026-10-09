class MyArea24Error(Exception):
    """Base exception for MyArea24 platform."""
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class ConfigurationError(MyArea24Error):
    """Raised when configuration is missing, invalid, or conflicting."""
    pass


class ProviderError(MyArea24Error):
    """Base exception for external provider failures."""
    def __init__(self, provider: str, message: str, status_code: int | None = None, details: dict | None = None):
        super().__init__(f"[{provider}] {message}", details)
        self.provider = provider
        self.status_code = status_code


class ProviderAuthError(ProviderError):
    """Raised when credentials are invalid, expired, or missing."""
    pass


class ProviderQuotaError(ProviderError):
    """Raised when provider API quota or account balance is exhausted."""
    pass


class ProviderRateLimitError(ProviderError):
    """Raised when rate limit is exceeded with optional retry-after."""
    def __init__(self, provider: str, retry_after: int | None = None, details: dict | None = None):
        super().__init__(provider, f"Rate limit exceeded (retry after {retry_after}s)", status_code=429, details=details)
        self.retry_after = retry_after


class ProviderTimeoutError(ProviderError):
    """Raised when provider request times out."""
    pass


class NormalizationError(MyArea24Error):
    """Raised when provider response cannot be parsed or normalized."""
    pass


class CorrelationError(MyArea24Error):
    """Raised when intelligence correlation fails due to corrupt inputs."""
    pass
