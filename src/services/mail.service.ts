import nodemailer from 'nodemailer'

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const password = process.env.SMTP_PASSWORD
  const from = process.env.SMTP_FROM

  if (!host || !user || !password || !from) {
    throw new Error('Falta configurar el servicio SMTP')
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass: password,
    },
  })

  await transporter.sendMail({
    from,
    to: email,
    subject: 'NOTAR - Recuperación de contraseña',
    text: [
      'Recibimos una solicitud para recuperar tu contraseña de NOTAR.',
      '',
      `Abrí este enlace para establecer una nueva contraseña: ${resetUrl}`,
      '',
      'El enlace vence en 15 minutos y solo puede utilizarse una vez.',
      '',
      'Si no solicitaste este cambio, ignorá este correo.',
    ].join('\n'),
  })
}
