import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

def send_email(to_email: str, subject: str, html_content: str):
    logger.info(f"Preparing email send to: {to_email} | Subject: {subject}")

    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        logger.warning("SMTP credentials not configured. Email delivery skipped.")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.MAIL_FROM
        msg["To"] = to_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        # Connect and send with short socket timeout (3.0s)
        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=3.0)
        if settings.MAIL_TLS:
            server.starttls()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.sendmail(settings.MAIL_FROM, to_email, msg.as_string())
        server.quit()
        logger.info(f"Email successfully sent to {to_email} via SMTP.")
    except Exception as e:
        logger.warning(f"Failed to send email via SMTP ({e}). Delivery skipped safely.")

def send_verification_email(email: str, token: str):
    link = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    subject = "Verify your AttendWise Account"
    html = f"""
    <h3>Welcome to AttendWise!</h3>
    <p>Please click the link below to verify your email address and activate your account:</p>
    <p><a href="{link}" target="_blank">{link}</a></p>
    <br>
    <p>If you did not sign up for an account, please ignore this email.</p>
    """
    send_email(email, subject, html)

def send_reset_password_email(email: str, token: str):
    link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    subject = "Reset your AttendWise Password"
    html = f"""
    <h3>Password Reset Request</h3>
    <p>You requested to reset your password. Please click the link below to set a new password. This link is valid for 15 minutes:</p>
    <p><a href="{link}" target="_blank">{link}</a></p>
    <br>
    <p>If you did not request a password reset, please ignore this email.</p>
    """
    send_email(email, subject, html)
