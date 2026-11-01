import nodemailer from "nodemailer";

export async function sendLoginEmail(to: string, link: string) {
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === "production") throw new Error("SMTP_HOST não configurado.");
    console.log(`[desenvolvimento] Ligação de entrada: ${link}`);
    return;
  }
  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Entrar na Voz de Torres Vedras",
    text: `Use esta ligação para entrar. É válida durante 30 minutos e só pode ser usada uma vez:\n\n${link}\n\nSe não pediu esta mensagem, pode ignorá-la.`,
  });
}
