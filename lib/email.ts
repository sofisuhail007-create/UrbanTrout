import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Urban Trout <orders@urbantrout.in>";
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
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  utrNumber?: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY is not set. Skipping order confirmation email.");
    return;
  }
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
    <title>Order Confirmed - Urban Trout</title>
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
          <div style="display: inline-block; width: 56px; height: 56px; border-radius: 28px; background: rgba(34,197,94,0.15); line-height: 56px; font-size: 26px; color: #22c55e; text-align: center; margin-bottom: 12px; border: 1px solid rgba(34,197,94,0.3);">✓</div>
          <h2 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">Order Confirmed &amp; Paid!</h2>
          <p style="margin: 8px 0 0; font-size: 13px; color: #4ade80; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
            Payment Verified via Razorpay
          </p>
          <p style="margin: 8px 0 0; font-size: 14px; color: #9fadb8; line-height: 1.6;">
            Thank you, <strong>${order.customerName}</strong>! Your payment has been received and verified. Our aquaculture specialists at Urban Trout Farm (Naseem Bagh) are now preparing your fresh catch for same-day delivery.
          </p>
        </div>

        <!-- Order Summary Box -->
        <div style="background: #06151e; border: 1px solid #152834; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #152834; padding-bottom: 12px; margin-bottom: 12px;">
            <span style="font-size: 12px; color: #6a7782; text-transform: uppercase; font-weight: 700;">Order ID</span>
            <span style="font-size: 14px; color: #72ddfd; font-weight: 700;">#${order.orderNumber}</span>
          </div>

          ${order.razorpayPaymentId ? `
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #152834; padding-bottom: 10px; margin-bottom: 12px; font-size: 12px;">
            <span style="color: #6a7782; text-transform: uppercase; font-weight: 700;">Razorpay Payment ID</span>
            <span style="color: #4ade80; font-family: monospace; font-weight: 600;">${order.razorpayPaymentId}</span>
          </div>
          ` : ""}

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
              <span style="color: #4ade80; font-weight: 600;">${order.deliveryFee === 0 ? "FREE (Farm Fresh Express)" : "₹" + order.deliveryFee}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #72ddfd; border-top: 1px solid #1a2e3b; padding-top: 8px;">
              <span>Total Paid:</span>
              <span>₹${order.total.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        <!-- Harvest & Delivery Window Box -->
        <div style="background: rgba(16,33,44,0.6); border: 1px solid rgba(114,221,253,0.25); border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <div style="font-size: 12px; color: #72ddfd; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">
            🚚 Delivery Window: Within 90 Mins (Same-Day)
          </div>
          <p style="margin: 0; font-size: 13px; color: #9fadb8; line-height: 1.5;">
            Harvested to order from clean groundwater RAS tanks in Naseem Bagh and packed in food-grade crushed ice.
          </p>
        </div>

        <!-- Delivery & Location Details -->
        <div style="background: #06151e; border: 1px solid #152834; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <h3 style="margin: 0 0 8px; font-size: 12px; color: #6a7782; text-transform: uppercase; letter-spacing: 1px;">Delivery Destination</h3>
          <p style="margin: 0; font-size: 14px; color: #dfedf9; line-height: 1.5;">
            <strong>${order.customerName}</strong> (+91 ${order.phone})<br>
            ${order.address ? `${order.address}, ` : ""}${order.locality || "Srinagar"}${order.pincode ? ` - ${order.pincode}` : ""}<br>
            <span style="font-size: 12px; color: #9fadb8;">Farm Source: Urban Trout Farm, Malabagh Naseem Bagh</span>
          </p>
        </div>

        <!-- Support Info -->
        <div style="text-align: center; padding-top: 8px;">
          <p style="font-size: 13px; color: #9fadb8; margin: 0 0 14px;">
            Have questions about preparation or delivery timing?
          </p>
          <a href="https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20Question%20regarding%20my%20confirmed%20order%20%23${order.orderNumber}" style="display: inline-block; background: #25d366; color: #ffffff; text-decoration: none; padding: 11px 22px; border-radius: 10px; font-size: 13px; font-weight: 700;">
            💬 Chat with Farm Support on WhatsApp
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="background: #06151e; padding: 20px; text-align: center; border-top: 1px solid #152834; font-size: 11px; color: #6a7782;">
        <p style="margin: 0 0 4px;">Urban Trout Aquaculture • Malabagh, Naseem Bagh, Srinagar — 190006</p>
        <p style="margin: 0;">Farm Direct Helpline: +91 84910 06127 | Email: info.urbantrout@gmail.com</p>
      </div>

    </div>
  </body>
  </html>
  `;

  if (order.email && order.email.includes("@")) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: order.email,
        replyTo: ADMIN_EMAIL,
        subject: `✅ Order Confirmed: #${order.orderNumber} - Urban Trout Srinagar`,
        html: emailHtml,
      });
    } catch (err) {
      console.warn("Resend customer email error:", err);
    }
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: order.email || ADMIN_EMAIL,
      subject: `🎉 [ORDER PAID & CONFIRMED] #${order.orderNumber} - ₹${order.total} by ${order.customerName}`,
      html: emailHtml,
    });
  } catch (err) {
    console.warn("Resend admin copy error:", err);
  }
}

// 2. Status Transition Email (Confirmed / Out for Delivery / Delivered / Cancelled)
export async function sendOrderStatusUpdateEmail(order: {
  orderNumber: string;
  customerName: string;
  email?: string;
  phone: string;
  total: number;
}, status: "pending" | "processing" | "out_for_delivery" | "delivered" | "cancelled" | "out_of_stock") {

  if (!order.email || !order.email.includes("@")) return;

  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY is not set. Skipping status update email.");
    return;
  }

  const STATUS_DETAILS: Record<string, { title: string; subtitle: string; icon: string; color: string; subject: string }> = {
    processing: {
      title: "Payment Verified & Order Confirmed! 🎉",
      subtitle: "We have confirmed your payment. Our team at Urban Trout Farm is now harvesting and ice-packing your fresh Rainbow Trout.",
      icon: "🐟",
      color: "#25d366",
      subject: `✅ Payment Verified! Order #${order.orderNumber} Confirmed - Urban Trout`,
    },
    out_for_delivery: {
      title: "Your Fresh Catch is Out for Delivery! 🚚",
      subtitle: "Your trout has been harvested fresh from our ponds, packed in crushed ice, and handed over to our delivery rider for same-day delivery to your doorstep.",
      icon: "🛵",
      color: "#38bdf8",
      subject: `🚚 Out for Delivery: Order #${order.orderNumber} is on its way! - Urban Trout`,
    },
    delivered: {
      title: "Order Delivered Successfully! ✨",
      subtitle: "Your fresh Rainbow Trout has been delivered. Thank you for choosing Urban Trout! Cook fresh and enjoy the pristine Himalayan taste.",
      icon: "✅",
      color: "#22c55e",
      subject: `✨ Delivered: Order #${order.orderNumber} - Urban Trout Srinagar`,
    },
    out_of_stock: {
      title: "Order Update: Out of Stock & Refund Processing ⚠️",
      subtitle: "We sincerely apologize for the inconvenience! Due to high sudden demand, the fresh harvest for your order is currently out of stock. If you have already paid, our team has initiated a full refund back to your original payment account (UPI / Bank / Card). You will receive your refund shortly. We truly apologize for this disruption.",
      icon: "⚠️",
      color: "#f59e0b",
      subject: `⚠️ Important Update: Order #${order.orderNumber} Out of Stock & Refund - Urban Trout`,
    },
    cancelled: {
      title: "Order Update: Cancelled",
      subtitle: "Your order has been cancelled. If this was unexpected or if you have questions regarding a refund/payment, please contact our farm hotline on WhatsApp.",
      icon: "❌",
      color: "#f87171",
      subject: `⚠️ Order Update #${order.orderNumber} - Urban Trout`,
    },
    pending: {
      title: "Payment Verification In Progress",
      subtitle: "Our team is currently reviewing your payment reference.",
      icon: "⏳",
      color: "#fbbf24",
      subject: `Order #${order.orderNumber} Payment Verification - Urban Trout`,
    }
  };

  const current = STATUS_DETAILS[status] || STATUS_DETAILS.processing;

  const emailHtml = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="margin: 0; padding: 20px; background-color: #031018; font-family: sans-serif; color: #dfedf9;">
    <div style="max-width: 580px; margin: 0 auto; background: #0b1b25; border: 1px solid #1a3648; border-radius: 16px; overflow: hidden; padding: 32px 24px; text-align: center;">
      <div style="font-size: 36px; margin-bottom: 12px;">${current.icon}</div>
      <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: ${current.color}; font-weight: 800;">Order Status Update</span>
      <h2 style="font-size: 22px; color: #ffffff; margin: 8px 0 12px;">${current.title}</h2>
      <p style="font-size: 14px; color: #9fadb8; line-height: 1.6; max-width: 480px; margin: 0 auto 24px;">
        ${current.subtitle}
      </p>

      <div style="background: #06151e; border: 1px solid #152834; border-radius: 10px; padding: 14px; margin-bottom: 24px; font-size: 13px; color: #9fadb8;">
        <div><strong>Order ID:</strong> #${order.orderNumber} | <strong>Amount:</strong> ₹${order.total}</div>
      </div>

      <a href="https://wa.me/918491006127?text=Hi%20Urban%20Trout!%20Inquiry%20regarding%20Order%20%23${order.orderNumber}" style="display: inline-block; background: #25d366; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 700;">
        Contact Farm on WhatsApp
      </a>

      <div style="margin-top: 32px; border-top: 1px solid #152834; padding-top: 16px; font-size: 11px; color: #6a7782;">
        Urban Trout Aquaculture • Malabagh, Naseem Bagh, Srinagar — 190006
      </div>
    </div>
  </body>
  </html>
  `;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: order.email,
      replyTo: ADMIN_EMAIL,
      subject: current.subject,
      html: emailHtml,
    });
  } catch (err) {
    console.warn("Resend status email error:", err);
  }
}

// 3. Contact Form Alert
export async function sendContactInquiryEmail(inquiry: {
  name: string;
  phone: string;
  email?: string;
  subject?: string;
  message: string;
}) {
  const resend = getResend();
  if (!resend) {
    console.warn("RESEND_API_KEY is not set. Skipping contact inquiry email.");
    return;
  }
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

// 4. Farm Visit Pre-Notification Alerts
export async function sendFarmVisitEmail(visit: {
  visitor_name: string;
  phone: string;
  email?: string | null;
  visit_date: string;
  time_slot: string;
  guest_count: number;
  visit_purpose: string;
  special_requests?: string | null;
}) {
  const resend = getResend();
  if (!resend) return;

  const emailHtml = `
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="background-color: #031018; color: #dfedf9; font-family: sans-serif; padding: 20px;">
    <div style="max-width: 580px; margin: 0 auto; background: #0b1b25; border: 1px solid #1a3648; border-radius: 12px; padding: 28px;">
      <h2 style="color: #72ddfd; margin-top: 0;">🌿 Farm Visit Request Received (Pending Review)</h2>
      <p style="color: #9fadb8;">A visitor has submitted a visit request for the Urban Trout RAS facility in Naseem Bagh:</p>
      
      <div style="background: #06151e; border: 1px solid #152834; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px; line-height: 1.6;">
        <p style="margin: 0 0 8px;"><strong>Visitor Name:</strong> ${visit.visitor_name}</p>
        <p style="margin: 0 0 8px;"><strong>Phone / WhatsApp:</strong> +91 ${visit.phone}</p>
        ${visit.email ? `<p style="margin: 0 0 8px;"><strong>Email:</strong> ${visit.email}</p>` : ""}
        <p style="margin: 0 0 8px;"><strong>Requested Date:</strong> <span style="color: #72ddfd; font-weight: bold;">${visit.visit_date}</span></p>
        <p style="margin: 0 0 8px;"><strong>Requested Time Slot:</strong> <span style="color: #72ddfd; font-weight: bold;">${visit.time_slot}</span></p>
        <p style="margin: 0 0 8px;"><strong>Group Size:</strong> ${visit.guest_count} Person(s)</p>
        <p style="margin: 0 0 8px;"><strong>Purpose:</strong> ${visit.visit_purpose}</p>
        ${visit.special_requests ? `<p style="margin: 0;"><strong>Special Notes:</strong> <em>"${visit.special_requests}"</em></p>` : ""}
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="https://urbantrout.in/admin/dashboard/visits" style="background: #0284c7; color: #fff; text-decoration: none; padding: 10px 18px; border-radius: 6px; font-weight: bold; display: inline-block;">
          Open Admin Panel to Review &amp; Approve
        </a>
      </div>
    </div>
  </body>
  </html>
  `;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      subject: `🌿 [VISIT REQUEST - PENDING APPROVAL] ${visit.visitor_name} on ${visit.visit_date} (${visit.time_slot})`,
      html: emailHtml,
    });
  } catch (err) {
    console.warn("Resend farm visit alert error:", err);
  }

  if (visit.email && visit.email.includes("@")) {
    const confirmationHtml = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="background-color: #031018; color: #dfedf9; font-family: sans-serif; padding: 20px;">
      <div style="max-width: 580px; margin: 0 auto; background: #0b1b25; border: 1px solid #1a3648; border-radius: 12px; padding: 28px; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 8px;">⏳</div>
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #fbbf24; font-weight: 800;">Awaiting Farm Manager Approval</span>
        <h2 style="color: #ffffff; margin: 8px 0 12px;">Visit Request Received</h2>
        <p style="color: #9fadb8; font-size: 14px; line-height: 1.6;">
          Hi <strong>${visit.visitor_name}</strong>, thank you for requesting a visit to Urban Trout Farm. Due to our strict <strong>RAS Bio-Security Protocols</strong> and feeding schedules, all visits must be reviewed and approved by our Farm Manager before entry.
        </p>

        <div style="background: #06151e; border: 1px solid #152834; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: left; font-size: 14px; line-height: 1.6;">
          <p style="margin: 0 0 6px;">📅 <strong>Requested Date:</strong> ${visit.visit_date}</p>
          <p style="margin: 0 0 6px;">⏰ <strong>Requested Slot:</strong> ${visit.time_slot}</p>
          <p style="margin: 0 0 6px;">👥 <strong>Group Size:</strong> ${visit.guest_count} Person(s)</p>
          <p style="margin: 0;">📍 <strong>Location:</strong> Malabagh, Naseem Bagh, Srinagar</p>
        </div>

        <div style="background: rgba(251,191,36,0.1); border: 1px solid rgba(251,191,36,0.3); border-radius: 8px; padding: 12px; font-size: 12px; color: #fbbf24; text-align: left; margin-bottom: 20px;">
          ⚠️ <strong>Please Note:</strong> Please do <strong>not</strong> travel to the farm yet. You will receive an official <strong>Approval Confirmation Email &amp; Entry Pass</strong> once the Farm Manager confirms your slot.
        </div>

        <p style="font-size: 11px; color: #6a7782; margin: 0;">
          Urban Trout Aquaculture • Malabagh, Naseem Bagh, Srinagar — 190006
        </p>
      </div>
    </body>
    </html>
    `;

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: visit.email,
        subject: `[Received - Awaiting Approval] Farm Visit Request: Urban Trout Srinagar`,
        html: confirmationHtml,
      });
    } catch (err) {
      console.warn("Resend visitor confirmation email error:", err);
    }
  }
}

// 5. Official Farm Visit Approval Pass Email (Triggered when Farm Manager approves)
export async function sendFarmVisitApprovedEmail(visit: {
  id?: string;
  visitor_name: string;
  phone: string;
  email?: string | null;
  visit_date: string;
  time_slot: string;
  guest_count: number;
  visit_purpose: string;
  admin_notes?: string | null;
}) {
  if (!visit.email || !visit.email.includes("@")) return;

  const resend = getResend();
  if (!resend) return;

  const passId = visit.id || `UT-PASS-${Date.now().toString().slice(-6)}`;
  const verifyUrl = `https://urbantrout.in/verify-pass/${passId}`;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(verifyUrl)}`;

  const emailHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Official Farm Visit Pass - Urban Trout</title>
  </head>
  <body style="margin: 0; padding: 24px 12px; background-color: #020d14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #dfedf9;">
    <div style="max-width: 580px; margin: 0 auto;">
      
      <!-- Top Title -->
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #34d399; font-weight: 800; background: rgba(52,211,153,0.12); padding: 5px 14px; border-radius: 20px; border: 1px solid rgba(52,211,153,0.3); display: inline-block;">
          ✓ Farm Manager Approved
        </span>
        <h1 style="color: #ffffff; margin: 12px 0 4px; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Your Farm Visit Pass is Ready</h1>
        <p style="color: #9fadb8; font-size: 13px; margin: 0;">Urban Trout Cold-Water RAS Aquaculture Facility • Naseem Bagh, Srinagar</p>
      </div>

      <!-- ─── THE DIGITAL ID CARD PASS ─── -->
      <div style="background: linear-gradient(160deg, #0b2230 0%, #04141e 100%); border: 2px solid #34d399; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.7), 0 0 30px rgba(52,211,153,0.15); margin-bottom: 24px;">
        
        <!-- ID Header -->
        <div style="background: linear-gradient(90deg, #020d14 0%, #061e2b 100%); padding: 18px 24px; border-bottom: 1px solid #1a3648; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 16px; font-weight: 800; color: #72ddfd; letter-spacing: 0.5px;">URBAN TROUT</div>
            <div style="font-size: 10px; text-transform: uppercase; color: #9fadb8; letter-spacing: 1.5px;">Official Admission Pass</div>
          </div>
          <div style="text-align: right;">
            <div style="font-family: monospace; font-size: 12px; font-weight: bold; color: #34d399; background: #020d14; padding: 4px 10px; border-radius: 6px; border: 1px solid #1e3a4e;">
              ${passId}
            </div>
          </div>
        </div>

        <!-- ID Card Body -->
        <div style="padding: 24px;">
          
          <!-- Visitor Name Plate -->
          <div style="border-bottom: 1px dashed #1a3648; padding-bottom: 16px; margin-bottom: 18px;">
            <div style="font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #6a7782; font-weight: bold;">Authorized Visitor</div>
            <div style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 2px 0 4px;">${visit.visitor_name}</div>
            <div style="font-size: 13px; color: #72ddfd;">+91 ${visit.phone.replace(/\D/g, '').slice(-10)} • ${visit.email || ""}</div>
          </div>

          <!-- Schedule Grid Details -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="width: 50%; padding: 8px 10px; background: rgba(2,13,20,0.6); border: 1px solid #152834; border-radius: 8px 0 0 0;">
                <div style="font-size: 10px; text-transform: uppercase; color: #6a7782; font-weight: bold;">Approved Date</div>
                <div style="font-size: 15px; font-weight: 800; color: #ffffff; margin-top: 2px;">${visit.visit_date}</div>
              </td>
              <td style="width: 50%; padding: 8px 10px; background: rgba(2,13,20,0.6); border: 1px solid #152834; border-radius: 0 8px 0 0; border-left: none;">
                <div style="font-size: 10px; text-transform: uppercase; color: #6a7782; font-weight: bold;">Approved Batch</div>
                <div style="font-size: 14px; font-weight: 800; color: #34d399; margin-top: 2px;">${visit.time_slot}</div>
              </td>
            </tr>
            <tr>
              <td style="padding: 8px 10px; background: rgba(2,13,20,0.6); border: 1px solid #152834; border-radius: 0 0 0 8px; border-top: none;">
                <div style="font-size: 10px; text-transform: uppercase; color: #6a7782; font-weight: bold;">Admitted Guests</div>
                <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-top: 2px;">👥 ${visit.guest_count} Person(s)</div>
              </td>
              <td style="padding: 8px 10px; background: rgba(2,13,20,0.6); border: 1px solid #152834; border-radius: 0 0 8px 0; border-top: none; border-left: none;">
                <div style="font-size: 10px; text-transform: uppercase; color: #6a7782; font-weight: bold;">Purpose</div>
                <div style="font-size: 13px; font-weight: 600; color: #dfedf9; margin-top: 2px;">${visit.visit_purpose}</div>
              </td>
            </tr>
          </table>

          ${visit.admin_notes ? `
          <div style="background: rgba(114,221,253,0.08); border: 1px solid rgba(114,221,253,0.25); border-radius: 8px; padding: 12px; margin-bottom: 20px; font-size: 13px; color: #72ddfd;">
            <strong>Farm Manager Note:</strong> ${visit.admin_notes}
          </div>` : ""}

          <!-- ─── QR CODE FOR LIVE SCANNING ─── -->
          <div style="background: #ffffff; border-radius: 16px; padding: 18px; text-align: center; margin-bottom: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);">
            <div style="color: #020d14; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">
              Gate Verification QR Code
            </div>
            <img 
              src="${qrCodeImageUrl}" 
              alt="Scan to Verify Visit Pass" 
              width="200" 
              height="200" 
              style="display: block; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px;"
            />
            <div style="color: #64748b; font-size: 11px; margin-top: 10px; font-weight: 500;">
              Scan at gate for live admission verification • Auto-expires when slot ends
            </div>
          </div>

          <!-- Direct Verification Link Button -->
          <div style="text-align: center;">
            <a 
              href="${verifyUrl}" 
              target="_blank" 
              style="display: block; background: #0284c7; color: #ffffff; text-decoration: none; padding: 14px 20px; border-radius: 10px; font-size: 14px; font-weight: bold; letter-spacing: 0.5px; text-align: center; box-shadow: 0 4px 15px rgba(2,132,199,0.3);"
            >
              Open Live Digital Pass on Mobile
            </a>
          </div>

        </div>

        <!-- ID Card Footer Security Seal -->
        <div style="background: #020d14; padding: 14px 24px; border-top: 1px solid #1a3648; font-size: 11px; color: #6a7782; display: flex; justify-content: space-between; align-items: center;">
          <span>🔒 Cryptographic Seal: ACTIVE</span>
          <span>Urban Trout Aquaculture Srinagar</span>
        </div>

      </div>

      <!-- ─── Mandatory Bio-Security Rules Box ─── -->
      <div style="background: #06151e; border: 1px solid rgba(251,191,36,0.3); border-radius: 14px; padding: 20px; margin-bottom: 24px;">
        <h4 style="margin: 0 0 10px; color: #fbbf24; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
          🛡️ Mandatory RAS Bio-Security Protocols:
        </h4>
        <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #9fadb8; line-height: 1.7;">
          <li><strong>Strict Punctuality:</strong> Arrive strictly within your approved batch window (<strong style="color: #dfedf9;">${visit.time_slot}</strong>) so feeding cycles are not disturbed.</li>
          <li><strong>Disinfection Foot Dip:</strong> All visitors must step onto the sanitizing foot mat upon entering the culture building.</li>
          <li><strong>Zero Contact:</strong> Do not touch the tank water or bring outside fish feeds/objects.</li>
          <li><strong>Child Safety:</strong> Children must be held by hand at all times on paved walkways near deep tanks.</li>
        </ul>
      </div>

      <!-- ─── Location & Driving Directions ─── -->
      <div style="background: #06151e; border: 1px solid #152834; border-radius: 14px; padding: 20px; text-align: center; margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: bold; color: #ffffff; margin-bottom: 4px;">Farm Location</div>
        <p style="font-size: 13px; color: #9fadb8; margin: 0 0 14px; line-height: 1.5;">
          Malabagh, Naseem Bagh, Srinagar — 190006<br>
          <span style="color: #6a7782; font-size: 12px;">Landmark: Near R P School (Girls Wing)</span>
        </p>
        <a 
          href="https://maps.google.com/?q=34.144709,74.824525" 
          target="_blank" 
          style="display: inline-block; background: rgba(114,221,253,0.15); border: 1px solid rgba(114,221,253,0.3); color: #72ddfd; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: bold;"
        >
          📍 Open Google Maps Directions
        </a>
      </div>

      <!-- Footer Info -->
      <div style="text-align: center; font-size: 11px; color: #6a7782; line-height: 1.6;">
        <p style="margin: 0 0 4px;">Need assistance on arrival? Farm Hotline: <strong style="color: #72ddfd;">+91 84910 06127</strong></p>
        <p style="margin: 0;">Urban Trout Aquaculture • Malabagh, Naseem Bagh, Srinagar — 190006</p>
      </div>

    </div>
  </body>
  </html>
  `;

  try {
    const cleanToEmail = visit.email.trim();
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: cleanToEmail,
      subject: `🎟️ [OFFICIAL VISIT PASS] Urban Trout Farm Visit Confirmed for ${visit.visit_date} (${visit.time_slot})`,
      html: emailHtml,
    });
    console.log("Resend approval pass sent successfully to", cleanToEmail, result);
    return result;
  } catch (err) {
    console.error("Resend approval pass email error:", err);
    throw err;
  }
}



