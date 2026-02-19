const nodemailer = require('nodemailer');

// Verificar se as credenciais SMTP estão configuradas
const smtpConfigurado = process.env.SMTP_USER && process.env.SMTP_PASS;

// Configuração do transporter de email
// Em produção, configure as variáveis de ambiente:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
const transporter = smtpConfigurado ? nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true para 465, false para outras portas
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
}) : null;

// Função para enviar email de recuperação de senha
async function enviarEmailRecuperacao(email, nome, token, host) {
  // Se SMTP não configurado, lançar erro informativo
  if (!transporter) {
    const erro = new Error('SMTP não configurado. Configure as variáveis de ambiente SMTP_USER e SMTP_PASS.');
    erro.code = 'SMTP_NOT_CONFIGURED';
    throw erro;
  }

  const linkRecuperacao = `${host}/auth/redefinir-senha/${token}`;
  
  const mailOptions = {
    from: `"FINAXIS" <${process.env.SMTP_USER || 'noreply@finaxis.com'}>`,
    to: email,
    subject: 'Recuperação de Palavra-passe - FINAXIS',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #2563eb; }
          .logo { font-size: 28px; font-weight: bold; color: #2563eb; }
          .content { padding: 30px 0; }
          .button { 
            display: inline-block; 
            padding: 14px 32px; 
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); 
            color: white !important; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600;
            margin: 20px 0;
          }
          .button:hover { background: #1d4ed8; }
          .footer { 
            padding-top: 20px; 
            border-top: 1px solid #e5e7eb; 
            font-size: 12px; 
            color: #6b7280; 
            text-align: center; 
          }
          .warning { 
            background: #fef3c7; 
            border-left: 4px solid #f59e0b; 
            padding: 12px 16px; 
            margin: 20px 0; 
            border-radius: 4px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">FINAXIS</div>
            <p style="color: #6b7280; margin: 5px 0 0 0;">Gestor Financeiro</p>
          </div>
          
          <div class="content">
            <h2 style="color: #1f2937;">Olá, ${nome}!</h2>
            <p>Recebemos um pedido para redefinir a palavra-passe da sua conta FINAXIS.</p>
            <p>Clique no botão abaixo para criar uma nova palavra-passe:</p>
            
            <div style="text-align: center;">
              <a href="${linkRecuperacao}" class="button">Redefinir Palavra-passe</a>
            </div>
            
            <div class="warning">
              <strong>⚠️ Atenção:</strong> Este link é válido por apenas <strong>1 hora</strong>.
            </div>
            
            <p>Se não solicitou a redefinição da palavra-passe, pode ignorar este email com segurança. A sua conta permanecerá protegida.</p>
            
            <p style="color: #6b7280; font-size: 13px;">
              Se o botão não funcionar, copie e cole o seguinte link no seu navegador:<br>
              <a href="${linkRecuperacao}" style="color: #2563eb; word-break: break-all;">${linkRecuperacao}</a>
            </p>
          </div>
          
          <div class="footer">
            <p>Este email foi enviado automaticamente pelo sistema FINAXIS.</p>
            <p>© ${new Date().getFullYear()} FINAXIS - Todos os direitos reservados</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  return transporter.sendMail(mailOptions);
}

// Verificar conexão SMTP
async function verificarConexaoEmail() {
  if (!transporter) {
    console.warn('⚠️ Aviso: SMTP não configurado. Configure SMTP_USER e SMTP_PASS para enviar emails.');
    return false;
  }
  
  try {
    await transporter.verify();
    console.log('✅ Servidor de email configurado corretamente');
    return true;
  } catch (error) {
    console.warn('⚠️ Aviso: Servidor de email não configurado -', error.message);
    return false;
  }
}

module.exports = {
  transporter,
  enviarEmailRecuperacao,
  verificarConexaoEmail
};
