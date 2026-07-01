interface SendEmailParams {
  to: string
  toName?: string
  subject: string
  htmlContent: string
}

export async function sendEmail({ to, toName, subject, htmlContent }: SendEmailParams) {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: process.env.BREVO_SENDER_EMAIL!,
        name: process.env.BREVO_SENDER_NAME || '3D Print Shop',
      },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Brevo API error: ${error}`)
  }

  return response.json()
}

function baseTemplate(title: string, body: string, ctaUrl: string, ctaLabel: string) {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
      <div style="border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 24px;">
        <h1 style="margin: 0; font-size: 20px; color: #111827;">DrivenByFaith3D</h1>
      </div>
      <h2 style="color: #111827; margin-top: 0;">${title}</h2>
      ${body}
      <a href="${ctaUrl}"
         style="display: inline-block; background: #111827; color: white; padding: 12px 24px;
                border-radius: 6px; text-decoration: none; margin-top: 20px; font-weight: 600;">
        ${ctaLabel}
      </a>
      <p style="color: #9ca3af; margin-top: 32px; font-size: 13px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
        You're receiving this because you have an order with DrivenByFaith3D.
      </p>
    </div>
  `
}

export function productPurchaseBuyerEmailHtml(productName: string, amount: number, appUrl: string) {
  return baseTemplate(
    `Order confirmed: ${productName}`,
    `
      <p style="color: #374151;">Thank you for your purchase! We've received your order and will be in touch soon.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Product</td><td style="padding: 8px 0; color: #111827; font-weight: 600;">${productName}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount paid</td><td style="padding: 8px 0; color: #111827; font-weight: 600;">$${amount.toFixed(2)}</td></tr>
      </table>
      <p style="color: #374151;">We'll reach out to coordinate delivery. If you have any questions, feel free to reply to this email.</p>
    `,
    appUrl,
    'Visit Our Shop'
  )
}

export function productPurchaseAdminEmailHtml(productName: string, amount: number, buyerEmail: string, appUrl: string) {
  return baseTemplate(
    `New product purchase: ${productName}`,
    `
      <p style="color: #374151;">A customer has purchased a product from your listings.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Product</td><td style="padding: 8px 0; color: #111827; font-weight: 600;">${productName}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Amount</td><td style="padding: 8px 0; color: #111827; font-weight: 600;">$${amount.toFixed(2)}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Buyer</td><td style="padding: 8px 0; color: #111827;">${buyerEmail}</td></tr>
      </table>
    `,
    `${appUrl}/admin`,
    'View Dashboard'
  )
}

export function welcomeEmailHtml(appUrl: string) {
  return baseTemplate(
    'Welcome to DrivenByFaith3D!',
    `
      <p style="color: #374151;">Your email address has been verified and your account is now active. Welcome aboard!</p>
      <p style="color: #374151;">You're all set to place your first custom 3D print order. Upload your STL file, share a reference image, or just describe your idea, and we'll take it from there.</p>
    `,
    `${appUrl}/orders/new`,
    'Start Your First Order'
  )
}

export function verificationEmailHtml(verifyUrl: string) {
  return baseTemplate(
    'Verify your email address',
    `
      <p style="color: #374151;">Thanks for signing up with DrivenByFaith3D! Please verify your email address to activate your account.</p>
      <p style="color: #374151;">Click the button below to verify. This link expires in <strong>24 hours</strong>.</p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">If you didn't create an account, you can safely ignore this email.</p>
    `,
    verifyUrl,
    'Verify Email'
  )
}

export function passwordResetEmailHtml(resetUrl: string) {
  return baseTemplate(
    'Reset your password',
    `
      <p style="color: #374151;">We received a request to reset your DrivenByFaith3D password.</p>
      <p style="color: #374151;">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">If you didn't request a password reset, you can safely ignore this email.</p>
    `,
    resetUrl,
    'Reset Password'
  )
}

export function newOrderEmailHtml(orderId: string, orderLabel: string, orderType: string, description: string, customerEmail: string, appUrl: string) {
  const orderUrl = `${appUrl}/orders/${orderId}`
  const typeLabel = orderType === 'stl' ? 'STL File' : orderType === 'image' ? 'Image Reference' : 'From Scratch'
  return baseTemplate(
    `New order received: ${orderLabel}`,
    `
      <p style="color: #374151;">A new order has been submitted.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 120px;">Order</td><td style="padding: 8px 0; color: #111827; font-weight: 600;">${orderLabel}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Type</td><td style="padding: 8px 0; color: #111827;">${typeLabel}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Customer</td><td style="padding: 8px 0; color: #111827;">${customerEmail}</td></tr>
        <tr><td style="padding: 8px 0; color: #6b7280; font-size: 14px; vertical-align: top;">Description</td><td style="padding: 8px 0; color: #111827;">${description.slice(0, 300)}${description.length > 300 ? '…' : ''}</td></tr>
      </table>
    `,
    orderUrl,
    'View Order'
  )
}

export function newMessageEmailHtml(orderId: string, appUrl: string) {
  const orderUrl = `${appUrl}/orders/${orderId}`
  return baseTemplate(
    'New message on your order',
    '<p style="color: #374151;">You have a new message in your order thread. Click below to view and reply.</p>',
    orderUrl,
    'View Message'
  )
}

export function quoteReadyEmailHtml(orderId: string, orderLabel: string, amount: number, appUrl: string) {
  const orderUrl = `${appUrl}/pay/${orderId}`
  return baseTemplate(
    'Your quote is ready',
    `
      <p style="color: #374151;">Great news! Your quote for order <strong>${orderLabel}</strong> is ready.</p>
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <p style="margin: 0; color: #6b7280; font-size: 14px;">Total Due</p>
        <p style="margin: 8px 0 0; font-size: 36px; font-weight: 700; color: #111827;">$${amount.toFixed(2)}</p>
      </div>
      <p style="color: #374151;">Click below to review your order and complete payment to get it into production.</p>
    `,
    orderUrl,
    'Pay Now →'
  )
}

const STATUS_EMAIL: Record<string, { subject: string; title: string; body: (label: string) => string; cta: string }> = {
  label_created: {
    subject: 'Your order has been shipped',
    title: 'Your order is on its way!',
    body: (label) => `<p style="color: #374151;">Order <strong>${label}</strong> has been packed and a shipping label has been created. You'll get another update once it's picked up by the carrier.</p>`,
    cta: 'Track Order',
  },
  in_transit: {
    subject: 'Your order is in transit',
    title: 'Your order is in transit',
    body: (label) => `<p style="color: #374151;">Order <strong>${label}</strong> is on its way to you! Click below to see live tracking updates.</p>`,
    cta: 'Track Order',
  },
  out_for_delivery: {
    subject: 'Your order is out for delivery today',
    title: 'Out for delivery today!',
    body: (label) => `<p style="color: #374151;">Order <strong>${label}</strong> is out for delivery and should arrive today. Make sure someone is available to receive it!</p>`,
    cta: 'Track Order',
  },
  delivered: {
    subject: 'Your order has been delivered',
    title: 'Your order was delivered',
    body: (label) => `<p style="color: #374151;">Order <strong>${label}</strong> has been delivered. We hope you love your print! If you have any issues, reply in your order thread.</p>`,
    cta: 'View Order',
  },
}

export function statusChangeEmailHtml(orderId: string, orderLabel: string, status: string, appUrl: string): { subject: string; html: string } | null {
  const template = STATUS_EMAIL[status]
  if (!template) return null
  const orderUrl = `${appUrl}/orders/${orderId}`
  return {
    subject: template.subject,
    html: baseTemplate(template.title, template.body(orderLabel), orderUrl, template.cta),
  }
}
