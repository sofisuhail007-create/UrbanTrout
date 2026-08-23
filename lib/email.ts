import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const resend = new Resend(RESEND_API_KEY);

// Default sender (when domain is unverified, onboarding@resend.dev is used. When urbantrout.in is verified in Resend, switch to orders@urbantrout.in)
const FROM_EMAIL = "Urban Trout <onboarding@resend.dev>";
const ADMIN_EMAIL = "info.urbantrout@gmail.com";

export async function sendOrderConfirmationEmail(order: {
  orderNumber: string;
  customerName: string;
  email?: string;
  phone: string;
  locality?: string;
  address?: string;
  pincode?: string;
  items: Array<{ name: string; quantity: number; unit?: string; price: number }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  paymentMethod: string;
  utrNumber?: string;
}) {
  const itemsHtml = order.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #1e293b;">
        <td style="padding: 12px 0; color: #f1f5f9; font-size: 14px; font-weight: 600;">${item.name}</td>
        <td style="padding: 12px 0; text-align: center; color: #94a3b8; font-size: 14px;">${item.quantity} ${item.unit || "Kg"}</td>
        <td style="padding: 12px 0; text-align: right; color: #38bdf8; font-size: 14px; font-weight: 600;">₹${(item.price * item.quantity).toLocaleString("en-IN")}</td>
      </tr>
    `
    )
    .join("");

  const emailHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Order Confirmation - Urban Trout</title>
  </head>
  <body style="margin: 0; padding: 20px; background-color: #031018; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #dfedf9;">
    <div style="max-width: 600px; margin: 0 auto; background: #0b1b25; border: 1px solid #1a3648; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
      
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #06151e 0%, #10212c 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid #1e3a4e;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #72ddfd; letter-spacing: -0.5px;">URBAN TROUT</h1>
        <p style="margin: 6px 0 0; font-size: 12px; color: #9fadb8; text-transform: uppercase; letter-spacing: 2px;">Fresh Cold-Water Rainbow Trout • Srinagar</p>
      </div>

      <!-- Main Body -->
      <div style="padding: 32px 24px;">
        <div style="text-align: center; margin-bottom: 28px;">
          <div style="display: inline-block; width: 56px; height: 56px; border-radius: 28px; background: rgba(37,211,102,0.15); line-height: 56px; font-size: 28px; color: #25d366; text-align: center; margin-bottom: 12px;">✓</div>
          <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">Order Confirmed &amp; Harvest in Progress!</h2>
          <p style="margin: 8px 0 0; font-size: 14px; color: #9fadb8; line-height: 1.6;">
            Thank you, <strong>${order.customerName}</strong>. Your order has been scheduled for harvest at our Malabagh farm.
          </p>
        </div>

        <!-- Order Summary Box -->
        <div style="background: #06151e; border: 1px solid #152834; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #152834; padding-bottom: 12px; margin-bottom: 12px;">
            <span style="font-size: 12px; color: #6a7782; text-transform: uppercase; font-weight: 700;">Order ID</span>
            <span style="font-size: 14px; color: #72ddfd; font-weight: 700;">#${order.orderNumber}</span>
          </div>

          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid #1a2e3b;">
                <th style="text-align: left; padding-bottom: 8px; font-size: 11px; color: #6a7782; text-transform: uppercase;">Item</th>
                <th style="text-align: center; padding-bottom: 8px; font-size: 11px; color: #6a7782; text-transform: uppercase;">Qty</th>
                <th style="text-align: right; padding-bottom: 8px; font-size: 11px; color: #6a7782; text-transform: uppercase;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div style="border-top: 1px solid #1a2e3b; margin-top: 12px; padding-top: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; color: #9fadb8;">
              <span>Subtotal:</span>
              <span>₹${order.subtotal.toLocaleString("en-IN")}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: #9fadb8;">
              <span>Delivery Fee:</span>
              <span>${order.deliveryFee === 0 ? "FREE (Within 5km)" : "₹" + order.deliveryFee}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #72ddfd; border-top: 1px solid #1a2e3b; padding-top: 8px;">
              <span>Total Paid via UPI:</span>
              <span>₹${order.total.toLocaleString("en-IN")}</span>
            </div>
            ${order.utrNumber ? `<div style="font-size: 11px; color: #6a7782; margin-top: 6px;">UTR / Reference: <code>${order.utrNumber}</code></div>` : ""}
          </div>
        </div>

        <!-- Delivery & Location Details -->
        <div style="background: #06151e; border: 1px solid #152834; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px; font-size: 12px; color: #6a7782; text-transform: uppercase; letter-spacing: 1px;">Delivery Destination</h3>
          <p style="margin: 0; font-size: 14px; color: #dfedf9; line-height: 1.5;">
            <strong>${order.customerName}</strong> (+91 ${order.phone})<br>
            ${order.address ? `${order.address}, ` : ""}${order.locality || "Srinagar"}${order.pincode ? ` - ${order.pincode}` : ""}<br>
            <span style="font-size: 12px; color: #9fadb8;">Harvested &amp; Dispatched from: Malabagh Farm &amp; Live Vending Center</span>
          </p>
        </div>

        <!-- Support Info -->
        <div style="text-align: center; padding-top: 8px;">
          <p style="font-size: 13px; color: #9fadb8; margin: 0 0 14px;">
            Need help or want to track your dispatch rider?
          </p>
          <a href="https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20Checking%20status%20for%20order%20%23${order.orderNumber}" style="display: inline-block; background: #25d366; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;">
            Chat with Farm on WhatsApp
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #06151e; padding: 20px; text-align: center; border-top: 1px solid #152834; font-size: 11px; color: #6a7782;">
        <p style="margin: 0 0 4px;">Urban Trout Aquaculture • Malabagh, Naseem Bagh, Srinagar — 190006</p>
        <p style="margin: 0;">Hotline: +91 84910 06127 | Email: info.urbantrout@gmail.com</p>
      </div>

    </div>
  </body>
  </html>
  `;

  // 1. Send to Customer (if valid email provided)
  if (order.email && order.email.includes("@")) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: order.email,
        subject: `Order Confirmed #${order.orderNumber} - Urban Trout Srinagar`,
        html: emailHtml,
      });
    } catch (err) {
      console.warn("Resend customer email error:", err);
    }
  }

  // 2. Always send Admin copy to info.urbantrout@gmail.com
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `🚨 [NEW ORDER] #${order.orderNumber} - ₹${order.total} by ${order.customerName}`,
      html: emailHtml,
    });
  } catch (err) {
    console.warn("Resend admin copy error:", err);
  }
}

export async function sendContactInquiryEmail(inquiry: {
  name: string;
  phone: string;
  email?: string;
  subject?: string;
  message: string;
}) {
  const emailHtml = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="background-color: #031018; color: #dfedf9; font-family: sans-serif; padding: 20px;">
    <div style="max-width: 550px; margin: 0 auto; background: #0b1b25; border: 1px solid #1a3648; border-radius: 12px; padding: 24px;">
      <h2 style="color: #72ddfd; margin-top: 0;">New Website Inquiry Received</h2>
      <p><strong>Name:</strong> ${inquiry.name}</p>
      <p><strong>Phone:</strong> +91 ${inquiry.phone}</p>
      ${inquiry.email ? `<p><strong>Email:</strong> ${inquiry.email}</p>` : ""}
      <p><strong>Topic:</strong> ${inquiry.subject || "General"}</p>
      <hr style="border-color: #1a3648;">
      <p><strong>Message:</strong></p>
      <blockquote style="background: #06151e; padding: 12px; border-left: 3px solid #72ddfd; margin: 0;">
        ${inquiry.message}
      </blockquote>
    </div>
  </body>
  </html>
  `;

  // Send to Admin
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `📩 [INQUIRY] from ${inquiry.name}: ${inquiry.subject || "Website Contact"}`,
      html: emailHtml,
    });
  } catch (err) {
    console.warn("Resend contact alert error:", err);
  }
}
