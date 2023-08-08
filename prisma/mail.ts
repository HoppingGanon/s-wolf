import nodemailer from 'nodemailer'

export class Mail {
  constructor() {
    console.log(`e-mailaddress: ${process.env.MAIL_USER_NAME}`)
  }
  private transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.MAIL_USER_NAME, // ユーザー名
      pass: process.env.MAIL_PASSWORD, // パスワード
    },
  })

  async send(to: string, subject: string, text: string) {
    const mail = {
      from: process.env.MAIL_USER_NAME,
      to: to,
      subject: subject,
      text: text,
    }
    return this.transporter.sendMail(mail)
  }
}

export default new Mail()
