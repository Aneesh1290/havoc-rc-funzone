import nodemailer from "nodemailer";
import { getSlotWristbandColor } from "./slotColors";
import { parseSimPerkDisplay } from "@/components/SimPerkBadgeList";

export interface EmailOrderItem {
  ticketName: string;
  quantity: number;
  date: string;
  timeSlot: string;
  itemTotal: number;
  simulatorName?: string;
  simulatorSlot?: string;
}

export interface BookingConfirmationEmailParams {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  ticketName?: string;
  quantity?: number;
  date?: string;
  timeSlot?: string;
  totalAmount: number;
  simulatorName?: string;
  simulatorSlot?: string;
  paymentStatus?: string;
  items?: EmailOrderItem[];
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

    // Determine order items (support multi-item cart as well as legacy single item)
    const orderItems: EmailOrderItem[] = (params.items && params.items.length > 0)
      ? params.items
      : [{
          ticketName: params.ticketName || 'RC Fun Zone Pass',
          quantity: params.quantity || 1,
          date: params.date || '',
          timeSlot: params.timeSlot || '',
          itemTotal: params.totalAmount,
          simulatorName: params.simulatorName,
          simulatorSlot: params.simulatorSlot
        }];

    // Build items summary HTML table
    const itemsTableRows = orderItems.map((item, idx) => `
      <tr style="${idx > 0 ? 'border-top: 1px solid #E2E8F0;' : ''}">
        <td style="padding: 10px 0;">
          <div style="font-weight: 700; color: #0F172A; font-size: 14px;">${item.ticketName}</div>
          <div style="font-size: 12px; color: #64748B; margin-top: 2px;">
            Visit: <strong style="color: #FF5500;">${item.date}</strong> &nbsp;•&nbsp; Slot: <strong style="color: #0F172A;">${item.timeSlot}</strong>
          </div>
          ${item.simulatorName && item.simulatorSlot ? `
            <div style="font-size: 11px; color: #EA580C; font-weight: 600; margin-top: 3px;">
              🏎️ Attached Sim: ${item.simulatorName} (${item.simulatorSlot})
            </div>
          ` : ''}
        </td>
        <td style="padding: 10px 0; text-align: right; vertical-align: top;">
          <div style="font-weight: 700; color: #0F172A; font-size: 14px;">×${item.quantity}</div>
          <div style="font-size: 12px; font-weight: 600; color: #64748B; margin-top: 2px;">₹${item.itemTotal}</div>
        </td>
      </tr>
    `).join('');

    // Format simulator perk block systematically if present across items
    const allSimBlocks: string[] = [];
    for (const item of orderItems) {
      if (item.simulatorName && item.simulatorSlot) {
        const simSlots = parseSimPerkDisplay(item.simulatorName, item.simulatorSlot);
        if (simSlots.length > 0) {
          allSimBlocks.push(`
            <div style="margin-top: 16px; padding: 14px; background: #FFF7ED; border: 1px solid #FED7AA; border-radius: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px solid #FFEDD5; padding-bottom: 6px;">
                <div style="display: flex; align-items: center;">
                  <span style="font-size: 15px; margin-right: 8px;">🏎️</span>
                  <strong style="color: #9A3412; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Sim Podium Perk (${item.ticketName})</strong>
                </div>
                <span style="font-size: 11px; font-weight: 700; color: #EA580C; background: #FFEDD5; padding: 2px 8px; border-radius: 9999px;">
                  ${simSlots.length} ${simSlots.length > 1 ? 'Sessions' : 'Session'}
                </span>
              </div>
              <table style="width: 100%; border-collapse: separate; border-spacing: 0 4px; font-size: 12px;">
                ${simSlots.map((s) => `
                  <tr>
                    <td style="background: #FFFFFF; padding: 6px 10px; border-radius: 6px 0 0 6px; border: 1px solid #FFEDD5; border-right: none; color: #1E293B; font-weight: 700;">
                      <span style="display: inline-block; background: #0F172A; color: #FFFFFF; font-size: 10px; font-weight: 800; padding: 1px 5px; border-radius: 4px; margin-right: 6px;">
                        ${s.participantNum ? `P${s.participantNum}` : `#${s.sessionNum}`}
                      </span>
                      ${s.simulatorName}
                    </td>
                    <td style="background: #FFFFFF; padding: 6px 10px; border-radius: 0 6px 6px 0; border: 1px solid #FFEDD5; border-left: none; text-align: right;">
                      <span style="background: #FFF7ED; color: #EA580C; border: 1px solid #FED7AA; font-weight: 800; font-size: 11px; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                        ${s.slotLabel}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </table>
            </div>
          `);
        }
      }
    }
    const simBlockHtml = allSimBlocks.join('');

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
              ${itemsTableRows}
              <tr style="border-top: 1px solid #E2E8F0;">
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
            📞 <a href="tel:+918951336255" style="color: #64748B; text-decoration: none;">+91 89513 36255</a> &nbsp;|&nbsp; ✉️ <a href="mailto:havocrcfunzone@gmail.com" style="color: #64748B; text-decoration: none;">havocrcfunzone@gmail.com</a>
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

    // 1. Send confirmation to the customer
    const info = await transporter.sendMail({
      from: fromAddress,
      to: params.customerEmail,
      subject: `Booking Confirmed: ${params.orderId} - Havoc RC Fun Zone`,
      html: htmlContent,
    });

    console.log("Customer confirmation email sent successfully to", params.customerEmail, "messageId:", info.messageId);

    // 2. Send Admin Alert matching the exact Havoc System format to havochobbysim@gmail.com
    try {
      const itemsCount = orderItems.reduce((acc, i) => acc + (i.quantity || 1), 0);
      const formattedTotal = Number(params.totalAmount).toFixed(2);
      
      // Build Experiences lines
      const experiencesText = orderItems.map(i => {
        let line = `- ${i.ticketName} | ${i.date} at ${i.timeSlot} | ${i.quantity} ${i.quantity > 1 ? 'Players' : 'Player'} | ₹${i.itemTotal}`;
        if (i.simulatorName && i.simulatorSlot) {
          line += `\n  * Attached Sim Perk: ${i.simulatorName} (${i.simulatorSlot})`;
        }
        return line;
      }).join('\n');

      const experiencesHtml = orderItems.map(i => `
        <div style="margin-bottom: 6px;">
          - ${i.ticketName} | ${i.date} at ${i.timeSlot} | ${i.quantity} ${i.quantity > 1 ? 'Players' : 'Player'} | ₹${i.itemTotal}
          ${i.simulatorName && i.simulatorSlot ? `<div style="color: #EA580C; font-weight: 600; margin-left: 14px; font-size: 12px;">🏎️ Sim Perk: ${i.simulatorName} (${i.simulatorSlot})</div>` : ''}
        </div>
      `).join('');

      const adminSubject = `New Booking Alert: ${params.orderId} - ${params.customerName} (${itemsCount} ${itemsCount > 1 ? 'items' : 'item'})`;
      
      const adminPlain = `A new order has been booked.\n\nOrder ID: ${params.orderId}\nCustomer Name: ${params.customerName}\nCustomer Email: ${params.customerEmail}\nTotal Amount: ₹${formattedTotal}\n\nExperiences (${itemsCount}):\n${experiencesText}\n\nPlease check the admin dashboard for details.`;

      const adminHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #1E293B; line-height: 1.6;">
          <p style="margin: 0 0 16px 0;">A new order has been booked.</p>
          
          <p style="margin: 0 0 16px 0;">
            Order ID: <strong>${params.orderId}</strong><br>
            Customer Name: ${params.customerName}<br>
            Customer Email: <a href="mailto:${params.customerEmail}" style="color: #2563EB;">${params.customerEmail}</a><br>
            Total Amount: ₹${formattedTotal}
          </p>

          <p style="margin: 0 0 16px 0;">
            Experiences (${itemsCount}):<br>
            ${experiencesHtml}
          </p>

          <p style="margin: 0;">Please check the admin dashboard for details.</p>
        </div>
      `;

      const adminInfo = await transporter.sendMail({
        from: fromAddress,
        to: adminEmail,
        replyTo: params.customerEmail,
        subject: adminSubject,
        text: adminPlain,
        html: adminHtml,
      });

      console.log("Havoc System admin booking alert sent successfully to", adminEmail, "messageId:", adminInfo.messageId);
    } catch (adminErr) {
      console.error("Error sending admin alert email to", adminEmail, adminErr);
    }

    return { success: true };
  } catch (err: any) {
    console.error("Error sending booking confirmation email via Nodemailer:", err);
    return { success: false, error: err.message || "Failed to send email" };
  }
}
