import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

def send_email(to_email: str, subject: str, html_content: str):
    logger.info(f"--- EMAIL SEND SIMULATION ---")
    logger.info(f"To: {to_email}")
    logger.info(f"Subject: {subject}")
    logger.info(f"-----------------------------")
    
    # Always print to console so developers can easily extract verification & reset links
    print(f"\n[EMAIL SIMULATION] To: {to_email} | Subject: {subject}\nHTML: {html_content}\n")

    if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        logger.warning("SMTP credentials not configured. Email logged to console but not sent.")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.MAIL_FROM
        msg["To"] = to_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        # Connect and send
        server = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT)
        if settings.MAIL_TLS:
            server.starttls()
        server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
        server.sendmail(settings.MAIL_FROM, to_email, msg.as_string())
        server.quit()
        logger.info("Email successfully sent via SMTP.")
    except Exception as e:
        logger.error(f"Failed to send email via SMTP: {e}")

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
