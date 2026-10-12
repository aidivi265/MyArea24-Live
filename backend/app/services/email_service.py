import email.mime.multipart
import email.mime.text
import smtplib
from typing import Tuple
from backend.app.core.config import settings
from backend.app.core.logging import logger


def send_otp_email(to_email: str, otp_code: str, purpose: str = "login") -> Tuple[bool, str]:
    """
    Sends an email with the verification OTP using configured SMTP.
    If SMTP_HOST is not configured or fails, logs to system logger and
    allows dev-mode verification.
    """
    subject = f"Your MyArea24 Verification Code: {otp_code}"
    text_content = f"""
Hello,

Your verification code for MyArea24 ({purpose}) is: {otp_code}

This code will expire in 10 minutes. For your security, do not share this OTP with anyone.

Everything Around You, in One Place.
Team MyArea24
"""
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; }}
    .container {{ max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .logo {{ font-size: 24px; font-weight: 800; color: #0284c7; letter-spacing: -0.5px; margin-bottom: 24px; }}
    .otp-box {{ background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 8px; text-align: center; padding: 18px; margin: 24px 0; }}
    .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #15803d; }}
    .meta {{ font-size: 13px; color: #64748b; line-height: 1.5; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">MyArea<span style="color: #0f172a;">24</span></div>
    <h2 style="color: #0f172a; margin-top: 0;">Verify your account</h2>
    <p style="color: #334155; font-size: 15px;">Use the following verification code to proceed with your request on MyArea24:</p>
    <div class="otp-box">
      <div class="otp-code">{otp_code}</div>
    </div>
    <p class="meta">This code will expire in 10 minutes. If you did not request this code, you can safely ignore this email.</p>
    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
    <p class="meta" style="font-size: 11px; text-align: center;">MyArea24 — Everything Around You, in One Place.</p>
  </div>
</body>
</html>
"""

    # 1. Attempt delivery via Resend API if configured
    if getattr(settings, "RESEND_API_KEY", None):
        try:
            import json
            import urllib.request
            payload = json.dumps({
                "from": "MyArea24 <onboarding@resend.dev>",
                "to": [to_email],
                "subject": subject,
                "html": html_content,
                "text": text_content,
            }).encode("utf-8")
            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data=payload,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=8.0) as resp:
                if resp.status in (200, 201):
                    logger.info(f"[EmailService Resend] Verification OTP successfully emailed to {to_email}")
                    return True, "OTP email dispatched via Resend"
        except Exception as e:
            logger.warning(f"[EmailService Resend] Failed to deliver via Resend API: {e}. Falling back to SMTP/Dev mode.")

    # 2. Attempt delivery via traditional SMTP if configured
    if not settings.SMTP_HOST or not settings.SMTP_USER:
        logger.info(f"[EmailService DEV] SMTP not configured. OTP for {to_email} is [{otp_code}] (purpose: {purpose})")
        return True, "Dev mode: OTP logged locally"

    try:
        msg = email.mime.multipart.MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to_email

        part1 = email.mime.text.MIMEText(text_content, "plain")
        part2 = email.mime.text.MIMEText(html_content, "html")
        msg.attach(part1)
        msg.attach(part2)

        server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10.0)
        if settings.SMTP_TLS:
            server.starttls()
        if settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.sendmail(settings.SMTP_FROM, [to_email], msg.as_string())
        server.quit()
        logger.info(f"[EmailService] Verification OTP successfully emailed to {to_email}")
        return True, "OTP email dispatched successfully"
    except Exception as e:
        logger.warning(f"[EmailService] Failed to send email to {to_email} via SMTP: {str(e)}. Fallback to local dev log: OTP=[{otp_code}]")
        return False, str(e)
