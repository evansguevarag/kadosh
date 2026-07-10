import smtplib
from email.message import EmailMessage

from app.core.config import settings


class EmailService:
    """Envia correos transaccionales del sistema."""

    def is_configured(self) -> bool:
        return bool(settings.smtp_host and settings.smtp_user and settings.smtp_password)

    def send_password_reset_otp(self, recipient_email: str, otp_code: str) -> bool:
        if not self.is_configured():
            print(
                "[Kadosh password reset OTP] SMTP no configurado. "
                f"Correo: {recipient_email}. Codigo: {otp_code}",
            )
            return False

        message = EmailMessage()
        message["Subject"] = "Codigo para restablecer tu contrasena - Kadosh"
        message["From"] = settings.smtp_from_email or settings.smtp_user
        message["To"] = recipient_email
        message.set_content(
            "\n".join(
                [
                    "Hola,",
                    "",
                    "Recibimos una solicitud para restablecer tu contrasena en Kadosh POS.",
                    f"Tu codigo de verificacion es: {otp_code}",
                    "",
                    "Este codigo vence en 10 minutos.",
                    "Si no solicitaste este cambio, puedes ignorar este correo.",
                ],
            ),
        )

        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()

            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(message)

        return True
