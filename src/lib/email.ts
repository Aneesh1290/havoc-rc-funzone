import nodemailer from "nodemailer";

export interface BookingConfirmationEmailParams {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  ticketName: string;
  quantity: number;
  date: string;
  timeSlot: string;
  totalAmount: number;
  simulatorName?: string;
  simulatorSlot?: string;
  paymentStatus?: string;
}

/**
 * Creates and configures the Nodemailer Gmail SMTP transporter
 */
function getEmailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const secure = process.env.SMTP_SECURE === "true" || port === 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

/**
 * Sends a premium booking confirmation email for Havoc RC Fun Zone
 */
export async function sendBookingConfirmationEmail(
  params: BookingConfirmationEmailParams
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getEmailTransporter();
    if (!transporter) {
      console.warn("Nodemailer SMTP not configured (missing SMTP_USER or SMTP_PASS). Skipping email dispatch.");
      return { success: false, error: "SMTP not configured" };
    }

    if (!params.customerEmail || !params.customerEmail.includes("@")) {
      return { success: false, error: "Invalid customer email" };
    }

    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || "Havoc RC Fun Zone";
    const fromAddress = `"${fromName}" <${fromEmail}>`;

    const isPaid = (params.paymentStatus || "").toUpperCase() === "PAID";
    const paymentLabel = isPaid ? "Paid Online" : "Pay at Desk (Cash / UPI / Card)";
    const paymentBadgeColor = isPaid ? "#10B981" : "#F59E0B";

    // Format simulator perk block if present
    const simBlockHtml = params.simulatorName && params.simulatorSlot ? `
      <div style="margin-top: 20px; padding: 16px; background: linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 100%); border: 1px solid #FED7AA; border-radius: 12px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 16px; margin-right: 8px;">🏎️</span>
          <strong style="color: #9A3412; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Attached Havoc Sim Podium Perk</strong>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #431407;">
          <tr>
            <td style="padding: 4px 0; font-weight: 600;">Simulator:</td>
            <td style="padding: 4px 0; text-align: right; color: #EA580C; font-weight: 700;">${params.simulatorName}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: 600;">Sim Slot Timing:</td>
            <td style="padding: 4px 0; text-align: right; font-weight: 700;">${params.simulatorSlot}</td>
          </tr>
        </table>
        <p style="margin: 8px 0 0 0; font-size: 11px; color: #7C2D12;">
          * Reserved at the Havoc Sim Podium arena. Please report 5 minutes prior to your simulator slot.
        </p>
      </div>
    ` : "";

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Booking Confirmation - ${params.orderId}</title>
    </head>
    <body style="margin: 0; padding: 24px; background-color: #F8FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1E293B;">
      <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); padding: 32px 24px; text-align: center; color: #FFFFFF;">
          <h1 style="margin: 0; font-size: 24px; letter-spacing: 1px; font-weight: 800; text-transform: uppercase;">
            HAVOC <span style="color: #FF5500;">RC FUN ZONE</span>
          </h1>
          <p style="margin: 8px 0 0 0; font-size: 14px; color: #94A3B8;">Official Booking Confirmation</p>
        </div>

        <!-- Body -->
        <div style="padding: 32px 24px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 6px 14px; background: #F1F5F9; border-radius: 9999px; font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 12px;">
              ORDER ID: <span style="color: #FF5500;">${params.orderId}</span>
            </div>
            <h2 style="margin: 0; font-size: 20px; color: #0F172A; font-weight: 700;">You're All Set, ${params.customerName}! 🎉</h2>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #64748B;">
              We have received your booking. Below are your visit and arena pass details:
            </p>
          </div>

          <!-- Ticket Summary Card -->
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 16px; padding: 20px; margin-bottom: 20px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #64748B;">Pass / Ticket Type:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0F172A;">${params.ticketName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B;">Quantity:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0F172A;">${params.quantity} ${params.quantity > 1 ? 'Participants' : 'Participant'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B;">Visit Date:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #FF5500;">${params.date}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B;">Funzone Time Slot:</td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; color: #0F172A;">${params.timeSlot}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748B;">Payment Status:</td>
                <td style="padding: 8px 0; text-align: right;">
                  <span style="font-weight: 700; color: ${paymentBadgeColor};">${paymentLabel}</span>
                </td>
              </tr>
              <tr style="border-top: 1px dashed #CBD5E1;">
                <td style="padding: 12px 0 0 0; font-weight: 700; font-size: 15px; color: #0F172A;">Total Amount:</td>
                <td style="padding: 12px 0 0 0; text-align: right; font-weight: 800; font-size: 18px; color: #0F172A;">₹${params.totalAmount}</td>
              </tr>
            </table>
          </div>

          <!-- Simulator Perk Section if selected -->
          ${simBlockHtml}

          <!-- Important Rules / Arrival Instructions -->
          <div style="margin-top: 24px; padding: 16px; background: #F1F5F9; border-radius: 12px; font-size: 12px; color: #475569; line-height: 1.6;">
            <strong style="color: #0F172A; display: block; margin-bottom: 6px;">Important Instructions:</strong>
            <ul style="margin: 0; padding-left: 18px;">
              <li>Please arrive at the arena reception 10–15 minutes before your slot time.</li>
              <li>Show this email or your Order ID (<strong>${params.orderId}</strong>) at the reception desk to collect your arena wristbands.</li>
              <li>Gripper socks or comfortable closed footwear are recommended for all track zones.</li>
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #F8FAFC; border-top: 1px solid #E2E8F0; padding: 20px 24px; text-align: center; font-size: 12px; color: #94A3B8;">
          <p style="margin: 0 0 6px 0;">Need help or have questions? Contact us:</p>
          <p style="margin: 0; font-weight: 600; color: #64748B;">
            📞 +91 8618796251 &nbsp;|&nbsp; ✉️ havochobbysim@gmail.com
          </p>
          <p style="margin: 12px 0 0 0; font-size: 11px; color: #CBD5E1;">
            © ${new Date().getFullYear()} Havoc RC Fun Zone & Havoc Sim Podium. All rights reserved.
          </p>
        </div>

      </div>
    </body>
    </html>
    `;

    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || "havochobbysim@gmail.com";

    // 1. Send confirmation to the customer with BCC to admin so the admin always receives a copy
    const info = await transporter.sendMail({
      from: fromAddress,
      to: params.customerEmail,
      bcc: adminEmail,
      subject: `Booking Confirmed: ${params.orderId} - Havoc RC Fun Zone`,
      html: htmlContent,
    });

    console.log("Customer confirmation email sent successfully:", info.messageId);

    // 2. If a simulator slot is booked, also send a dedicated Admin Alert to havochobbysim@gmail.com
    if (params.simulatorName && params.simulatorSlot) {
      try {
        await transporter.sendMail({
          from: fromAddress,
          to: adminEmail,
          subject: `🚨 SIMULATOR PERK RESERVED: ${params.simulatorName} (${params.simulatorSlot}) - ${params.orderId}`,
          html: `
            <div style="font-family: sans-serif; padding: 20px; background: #FFF7ED; border: 2px solid #EA580C; border-radius: 12px; max-width: 600px;">
              <h2 style="color: #9A3412; margin-top: 0;">🏎️ New Simulator Booking via RC Fun Zone</h2>
              <p>A participant has reserved a 30-min simulator slot perk through RC Fun Zone.</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
                <tr><td style="padding: 6px; font-weight: bold;">Order ID:</td><td style="padding: 6px;">${params.orderId}</td></tr>
                <tr><td style="padding: 6px; font-weight: bold;">Customer:</td><td style="padding: 6px;">${params.customerName} (${params.customerPhone || 'N/A'})</td></tr>
                <tr><td style="padding: 6px; font-weight: bold;">Email:</td><td style="padding: 6px;">${params.customerEmail}</td></tr>
                <tr><td style="padding: 6px; font-weight: bold;">Simulator:</td><td style="padding: 6px; color: #EA580C; font-weight: bold;">${params.simulatorName}</td></tr>
                <tr><td style="padding: 6px; font-weight: bold;">Slot Time:</td><td style="padding: 6px; font-weight: bold;">${params.simulatorSlot}</td></tr>
                <tr><td style="padding: 6px; font-weight: bold;">Funzone Visit Date:</td><td style="padding: 6px;">${params.date}</td></tr>
                <tr><td style="padding: 6px; font-weight: bold;">Funzone Slot:</td><td style="padding: 6px;">${params.timeSlot}</td></tr>
                <tr><td style="padding: 6px; font-weight: bold;">Total Amount:</td><td style="padding: 6px;">₹${params.totalAmount}</td></tr>
              </table>
            </div>
          `
        });
        console.log("Admin simulator notification email sent to", adminEmail);
      } catch (adminErr) {
        console.error("Error sending admin alert email:", adminErr);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error sending booking confirmation email via Nodemailer:", err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}
