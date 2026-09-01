const nodemailer = require('nodemailer');
const db = require('../config/db');

// SMTP Transporter initialization
const getTransporter = () => {
  const smtpHost = process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io';
  const smtpPort = parseInt(process.env.SMTP_PORT || '2525', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    return nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  }
  return null;
};

// Send single email notification
const sendEmail = async ({ to, subject, html, text }) => {
  const transporter = getTransporter();
  const smtpFrom = process.env.SMTP_FROM || 'Global Limos Consortium <noreply@globallimos.com>';

  if (!transporter || !to) {
    return { success: false, error: 'SMTP not configured or recipient missing' };
  }

  try {
    const info = await transporter.sendMail({
      from: smtpFrom,
      to,
      subject,
      html,
      text: text || subject
    });
    return { success: true, messageId: info.messageId, response: info.response };
  } catch (error) {
    console.error('[NotificationService] Email error:', error.message);
    return { success: false, error: error.message };
  }
};

// Send SMS notification via Twilio (with simulated fallback)
const sendSms = async ({ to, message }) => {
  if (!to) {
    return { success: false, error: 'Recipient phone number missing' };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (accountSid && authToken && fromPhone) {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
      const params = new URLSearchParams({
        To: to,
        From: fromPhone,
        Body: message
      });
      const authHeader = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });
      const data = await response.json();
      if (response.ok) {
        return { success: true, messageId: data.sid, response: JSON.stringify(data) };
      }
      return { success: false, error: data.message || 'Twilio error' };
    } catch (err) {
      console.error('[NotificationService] Twilio error:', err.message);
      return { success: false, error: err.message };
    }
  } else {
    // Fallback simulation mode
    console.log(`[NotificationService: SMS DISPATCH] To: ${to} | Message: ${message}`);
    return { success: true, messageId: `SIM_SMS_${Date.now()}`, response: 'Simulated SMS dispatch' };
  }
};

// Insert in-app alert for Company owner
const sendInAppNotification = async ({ companyId, title, message, alertKey, requestId }) => {
  try {
    const finalAlertKey = alertKey || `req_${requestId}_${Date.now()}`;
    await db.query(
      `INSERT INTO driver_notification (user_id, title, message, type, alert_key, is_read) 
       VALUES (?, ?, ?, 'consortium_request', ?, 0)`,
      [companyId, title, message, finalAlertKey]
    );
    return { success: true, messageId: finalAlertKey };
  } catch (error) {
    console.error('[NotificationService] In-App alert error:', error.message);
    return { success: false, error: error.message };
  }
};

// Helper: Query complete request details with specialized payload
const getFullRequestData = async (requestId) => {
  const [rows] = await db.query(
    `SELECT r.*, 
            u.email AS company_email, u.cellnumber AS company_phone, u.business_name, u.firstname, u.lastname,
            c.carrier_name, c.phone_no AS carrier_phone, c.email AS carrier_email,
            d.first_name AS driver_first_name, d.last_name AS driver_last_name, d.driver_id_number,
            d.email AS driver_email, d.phone_number AS driver_phone, d.license_number AS driver_license,
            cons.name AS consortium_name,
            dt.test_type, dt.test_reason, dt.scheduled_date, dt.collection_site, dt.result AS drug_result, dt.result_status AS drug_result_status,
            ch.query_type, ch.query_status, ch.result AS ch_result
     FROM consortium_requests r
     JOIN global_limo_user u ON u.id = r.company_id
     LEFT JOIN carriers c ON c.user_id = u.id
     LEFT JOIN drivers d ON d.id = r.driver_id
     LEFT JOIN consortiums cons ON cons.id = r.consortium_id
     LEFT JOIN drug_test_requests dt ON dt.request_id = r.id
     LEFT JOIN clearinghouse_requests ch ON ch.request_id = r.id
     WHERE r.id = ?`,
    [requestId]
  );
  return rows[0] || null;
};

// 1. Dispatch notifications to Company AND Driver upon Request Creation
const notifyCompanyAboutRequest = async (requestId) => {
  try {
    const req = await getFullRequestData(requestId);
    if (!req) return;

    const companyName = req.carrier_name || 'Carrier';
    const recipientEmail = req.carrier_email || req.company_email;
    const recipientPhone = req.carrier_phone || req.company_phone;
    const driverName = req.driver_first_name ? `${req.driver_first_name} ${req.driver_last_name}` : 'Assigned Driver';
    const driverEmail = req.driver_email;
    const driverPhone = req.driver_phone;

    const reqCode = `CR-${10000 + req.id}`;
    const typeLabel = req.request_type === 'drug_test' ? 'Drug & Alcohol Test' : 'FMCSA Clearinghouse Query';
    const formattedDueDate = req.due_date ? new Date(req.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Immediate';
    const formattedScheduledDate = req.scheduled_date ? new Date(req.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : formattedDueDate;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // A. COMPANY NOTIFICATIONS
    // 1. Email to Company
    const companySubject = `Action Required: New Consortium Order ${reqCode} - ${driverName} (${typeLabel})`;
    const companyHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Consortium Compliance Order</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">From ${req.consortium_name || 'Consortium Administration'}</p>
        </div>

        <p style="color: #334155; font-size: 15px; line-height: 1.5;">
          Hello <strong>${companyName}</strong>,
        </p>
        <p style="color: #334155; font-size: 15px; line-height: 1.5;">
          A new DOT compliance order has been scheduled for your driver. Please review the details below and ensure the driver attends the appointment:
        </p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;">Order Number:</td>
              <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${reqCode}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Order Type:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #2563eb;">${typeLabel}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Driver Name:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${driverName}</td>
            </tr>
            ${req.test_reason ? `<tr><td style="padding: 6px 0; color: #64748b;">Test Reason:</td><td style="padding: 6px 0; color: #0f172a;">${req.test_reason}</td></tr>` : ''}
            ${req.collection_site ? `<tr><td style="padding: 6px 0; color: #64748b;">Collection Clinic:</td><td style="padding: 6px 0; color: #0f172a;">${req.collection_site}</td></tr>` : ''}
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Scheduled / Due:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${formattedScheduledDate}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Priority:</td>
              <td style="padding: 6px 0; font-weight: bold; text-transform: uppercase; color: ${req.priority === 'urgent' ? '#dc2626' : (req.priority === 'high' ? '#ea580c' : '#0284c7')};">${req.priority}</td>
            </tr>
          </table>
        </div>

        <div style="text-align: center; margin: 26px 0;">
          <a href="${frontendUrl}/consortium-requests" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block; font-size: 15px;">Open Company Requests Portal</a>
        </div>
      </div>
    `;

    const companyEmailRes = await sendEmail({
      to: recipientEmail,
      subject: companySubject,
      html: companyHtml,
      text: `New Consortium Order ${reqCode} (${typeLabel}) for driver ${driverName}. Due: ${formattedScheduledDate}.`
    });

    await db.query(
      `INSERT INTO request_notifications (request_id, company_id, notification_type, recipient, subject, message, status, provider_response, sent_at)
       VALUES (?, ?, 'email', ?, ?, ?, ?, ?, NOW())`,
      [req.id, req.company_id, recipientEmail || 'N/A', companySubject, `New order ${reqCode} issued for ${driverName}`, companyEmailRes.success ? 'sent' : 'failed', companyEmailRes.messageId || companyEmailRes.error]
    );

    // 2. SMS to Company
    if (recipientPhone) {
      const companySms = `Consortium Order ${reqCode} (${typeLabel}) issued for driver ${driverName}. Scheduled/Due: ${formattedScheduledDate}. Please review in your carrier portal.`;
      const companySmsRes = await sendSms({ to: recipientPhone, message: companySms });
      await db.query(
        `INSERT INTO request_notifications (request_id, company_id, notification_type, recipient, subject, message, status, provider_response, sent_at)
         VALUES (?, ?, 'sms', ?, 'Company Order Alert', ?, ?, ?, NOW())`,
        [req.id, req.company_id, recipientPhone, companySms, companySmsRes.success ? 'sent' : 'failed', companySmsRes.messageId || companySmsRes.response]
      );
    }

    // 3. In-App Notification to Company
    const inAppTitle = `New Compliance Order: ${reqCode}`;
    const inAppMsg = `${typeLabel} scheduled for driver ${driverName}. Due: ${formattedScheduledDate}.`;
    await sendInAppNotification({ companyId: req.company_id, title: inAppTitle, message: inAppMsg, requestId: req.id });

    // B. DRIVER NOTIFICATIONS
    // 1. Email to Driver
    if (driverEmail) {
      const driverSubject = `Important Notice: ${typeLabel} Scheduled - Global Limos Consortium`;
      const driverHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Compliance Testing Notification</h2>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Carrier: ${companyName}</p>
          </div>

          <p style="color: #334155; font-size: 15px; line-height: 1.5;">
            Dear <strong>${driverName}</strong>,
          </p>
          <p style="color: #334155; font-size: 15px; line-height: 1.5;">
            You have been scheduled for a required DOT compliance procedure (<strong>${typeLabel}</strong>). Please review the instructions below carefully:
          </p>

          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #166534; width: 140px;">Reference Code:</td>
                <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${reqCode}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #166534;">Test / Query Type:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #15803d;">${req.test_type || typeLabel}</td>
              </tr>
              ${req.test_reason ? `<tr><td style="padding: 6px 0; color: #166534;">Selection Reason:</td><td style="padding: 6px 0; color: #0f172a;">${req.test_reason}</td></tr>` : ''}
              ${req.collection_site ? `<tr><td style="padding: 6px 0; color: #166534;">Collection Site:</td><td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${req.collection_site}</td></tr>` : ''}
              <tr>
                <td style="padding: 6px 0; color: #166534;">Scheduled Date:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: bold;">${formattedScheduledDate}</td>
              </tr>
            </table>
          </div>

          <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 13.5px; color: #92400e;">
            <strong>Mandatory Driver Instructions:</strong>
            <ul style="margin: 8px 0 0 0; padding-left: 20px;">
              <li>Bring a valid Government-Issued Commercial Driver's License (CDL) or Photo ID.</li>
              <li>Report to the designated clinic on or before the scheduled date.</li>
              <li>Notify your safety coordinator once testing is completed.</li>
            </ul>
          </div>
        </div>
      `;

      const driverEmailRes = await sendEmail({
        to: driverEmail,
        subject: driverSubject,
        html: driverHtml,
        text: `Notice: ${typeLabel} scheduled for ${formattedScheduledDate}. Clinic: ${req.collection_site || 'Designated Clinic'}. Bring your CDL.`
      });

      await db.query(
        `INSERT INTO request_notifications (request_id, company_id, notification_type, recipient, subject, message, status, provider_response, sent_at)
         VALUES (?, ?, 'email', ?, ?, ?, ?, ?, NOW())`,
        [req.id, req.company_id, driverEmail, driverSubject, `Driver notice sent for ${typeLabel}`, driverEmailRes.success ? 'sent' : 'failed', driverEmailRes.messageId || driverEmailRes.error]
      );
    }

    // 2. SMS to Driver
    if (driverPhone) {
      const driverSms = `Hello ${req.driver_first_name || 'Driver'}, you are scheduled for a ${req.test_type || typeLabel}. Date: ${formattedScheduledDate}. Clinic: ${req.collection_site || 'Designated Clinic'}. Please bring your CDL/ID. Ref: ${reqCode}.`;
      const driverSmsRes = await sendSms({ to: driverPhone, message: driverSms });
      await db.query(
        `INSERT INTO request_notifications (request_id, company_id, notification_type, recipient, subject, message, status, provider_response, sent_at)
         VALUES (?, ?, 'sms', ?, 'Driver Appointment SMS', ?, ?, ?, NOW())`,
        [req.id, req.company_id, driverPhone, driverSms, driverSmsRes.success ? 'sent' : 'failed', driverSmsRes.messageId || driverSmsRes.response]
      );
    }

    // Update request status to 'company_notified' if it was 'pending'
    if (req.status === 'pending') {
      await db.query(`UPDATE consortium_requests SET status = 'company_notified', updated_at = NOW() WHERE id = ?`, [req.id]);
      await db.query(
        `INSERT INTO consortium_request_history (request_id, action, old_status, new_status, performed_by_type, comments)
         VALUES (?, 'Notifications Dispatched', 'pending', 'company_notified', 'system', 'Dispatched Email and SMS notifications to Company and Driver')`,
        [req.id]
      );
    }
  } catch (error) {
    console.error('[NotificationService] notifyCompanyAboutRequest error:', error);
  }
};

// 2. Dispatch notifications to Company AND Driver upon Updates / Results / Edits
const notifyCompanyAndDriverAboutRequestUpdate = async (requestId, updateHeadline, updateDetails) => {
  try {
    const req = await getFullRequestData(requestId);
    if (!req) return;

    const companyName = req.carrier_name || 'Carrier';
    const recipientEmail = req.carrier_email || req.company_email;
    const recipientPhone = req.carrier_phone || req.company_phone;
    const driverName = req.driver_first_name ? `${req.driver_first_name} ${req.driver_last_name}` : 'Assigned Driver';
    const driverEmail = req.driver_email;
    const driverPhone = req.driver_phone;

    const reqCode = `CR-${10000 + req.id}`;
    const statusLabel = req.status.replace('_', ' ').toUpperCase();
    const resultSummary = req.drug_result || req.ch_result || req.drug_result_status || 'Updated';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // A. Email to Company
    const companySubject = `Update: Consortium Request ${reqCode} - ${driverName} [${statusLabel}]`;
    const companyHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Compliance Record Updated</h2>
          <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">${updateHeadline || 'Status & Result Update'}</p>
        </div>

        <p style="color: #334155; font-size: 15px;">Hello <strong>${companyName}</strong>,</p>
        <p style="color: #334155; font-size: 15px;">The compliance order for driver <strong>${driverName}</strong> has been updated:</p>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 14px;">
          <p><strong>Order Code:</strong> ${reqCode}</p>
          <p><strong>Status:</strong> <span style="color: #2563eb; font-weight: bold;">${statusLabel}</span></p>
          <p><strong>Result / Summary:</strong> ${resultSummary}</p>
          ${updateDetails ? `<p><strong>Details:</strong> ${updateDetails}</p>` : ''}
        </div>

        <div style="text-align: center; margin: 24px 0;">
          <a href="${frontendUrl}/consortium-requests" style="background-color: #2563eb; color: #ffffff; padding: 10px 24px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block;">View in Company Portal</a>
        </div>
      </div>
    `;

    await sendEmail({
      to: recipientEmail,
      subject: companySubject,
      html: companyHtml,
      text: `Consortium Request ${reqCode} updated to ${statusLabel}. Result: ${resultSummary}.`
    });

    if (recipientPhone) {
      await sendSms({
        to: recipientPhone,
        message: `Consortium Update: Order ${reqCode} for ${driverName} is now ${statusLabel}. Result: ${resultSummary}.`
      });
    }

    // In-App Notification
    await sendInAppNotification({
      companyId: req.company_id,
      title: `Order Updated: ${reqCode}`,
      message: `Status: ${statusLabel}. Result: ${resultSummary}.`,
      requestId: req.id
    });

    // B. Email & SMS to Driver (if result/appointment changed)
    if (driverEmail) {
      const driverSubject = `Update on your Compliance Record (${reqCode}) - Global Limos`;
      const driverHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0;">Compliance Record Update</h2>
          <p>Dear <strong>${driverName}</strong>,</p>
          <p>Your compliance record <strong>${reqCode}</strong> has been updated.</p>
          <div style="background: #f1f5f9; padding: 14px; border-radius: 8px; margin: 16px 0;">
            <p><strong>Current Status:</strong> ${statusLabel}</p>
            <p><strong>Result:</strong> ${resultSummary}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">If you have any questions, please contact your safety department.</p>
        </div>
      `;

      await sendEmail({
        to: driverEmail,
        subject: driverSubject,
        html: driverHtml,
        text: `Your compliance order ${reqCode} has been updated to ${statusLabel}. Result: ${resultSummary}.`
      });
    }

    if (driverPhone) {
      await sendSms({
        to: driverPhone,
        message: `Notice for ${req.driver_first_name || 'Driver'}: Your compliance order ${reqCode} status is ${statusLabel}. Result: ${resultSummary}.`
      });
    }
  } catch (error) {
    console.error('[NotificationService] notifyCompanyAndDriverAboutRequestUpdate error:', error);
  }
};

// Helper: Query Driver and Company details for direct compliance records
const getDriverAndCompanyInfo = async (driverId) => {
  const [rows] = await db.query(
    `SELECT d.id AS driver_id, d.first_name, d.last_name, d.email AS driver_email, d.phone_number AS driver_phone, d.license_number, d.license_state, d.owner_id AS company_id,
            c.carrier_name, c.email AS carrier_email, c.phone_no AS carrier_phone,
            u.email AS company_email, u.cellnumber AS company_phone, u.business_name, u.firstname, u.lastname
     FROM drivers d
     JOIN global_limo_user u ON u.id = d.owner_id
     LEFT JOIN carriers c ON c.user_id = u.id
     WHERE d.id = ?
     LIMIT 1`,
    [driverId]
  );
  return rows[0] || null;
};

// 3. Dispatch notifications upon Drug Test Record Created / Updated from Consortium Manage Records
const notifyCompanyAndDriverAboutDirectDrugRecord = async (driverId, recordData, actionType = 'update') => {
  try {
    const info = await getDriverAndCompanyInfo(driverId);
    if (!info) return;

    const companyName = info.carrier_name || info.business_name || (info.firstname ? `${info.firstname} ${info.lastname}` : 'Carrier');
    const recipientEmail = info.carrier_email || info.company_email;
    const recipientPhone = info.carrier_phone || info.company_phone;
    const driverName = (info.first_name || info.last_name) ? `${info.first_name || ''} ${info.last_name || ''}`.trim() : 'Driver';
    const driverEmail = info.driver_email;
    const driverPhone = info.driver_phone;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const testType = recordData.testType || recordData.test_type || 'Drug Test';
    const testDate = recordData.testDate || recordData.test_date || 'N/A';
    const resultDate = recordData.resultDate || recordData.result_date || testDate;
    const result = recordData.result || 'Negative';
    const mroVerified = recordData.mroVerified || recordData.mro_verified || 'Yes';
    const notes = recordData.collectionNotes || recordData.collection_notes || '';
    const actionLabel = actionType === 'update' ? 'Updated' : 'Logged';

    // A. Company In-App Notification (Visible in Dashboard / Bell Notifications)
    const alertKey = `drug_rec_${driverId}_${Date.now()}`;
    const inAppTitle = `Drug Test Record ${actionLabel}: ${driverName}`;
    const inAppMsg = `${testType} record ${actionLabel.toLowerCase()} by Consortium. Test Date: ${testDate}. Result: ${result}. MRO Verified: ${mroVerified}.`;

    await db.query(
      `INSERT INTO driver_notification (user_id, driver_id, title, message, type, alert_key, is_read) 
       VALUES (?, ?, ?, ?, 'consortium_drug_record', ?, 0)`,
      [info.company_id, driverId, inAppTitle, inAppMsg, alertKey]
    );

    // B. Email to Company
    if (recipientEmail) {
      const companySubject = `Compliance Notice: Drug Test Record ${actionLabel} - ${driverName} (${testType}: ${result})`;
      const companyHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Consortium Compliance Update</h2>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Driver Drug &amp; Alcohol Test Record ${actionLabel}</p>
          </div>

          <p style="color: #334155; font-size: 15px; line-height: 1.5;">
            Hello <strong>${companyName}</strong>,
          </p>
          <p style="color: #334155; font-size: 15px; line-height: 1.5;">
            A drug &amp; alcohol test compliance record has been <strong>${actionLabel.toLowerCase()}</strong> for driver <strong>${driverName}</strong> by Consortium Management:
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Driver:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${driverName} (CDL: ${info.license_number || 'N/A'})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Test Type:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #2563eb;">${testType}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Test Date:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${testDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Result Date:</td>
                <td style="padding: 6px 0; color: #0f172a;">${resultDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Result:</td>
                <td style="padding: 6px 0; font-weight: 700; color: ${result === 'Negative' ? '#16a34a' : '#dc2626'}; font-size: 15px;">${result}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">MRO Verified:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${mroVerified}</td>
              </tr>
              ${notes ? `<tr><td style="padding: 6px 0; color: #64748b;">Notes:</td><td style="padding: 6px 0; color: #475569;">${notes}</td></tr>` : ''}
            </table>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${frontendUrl}/drivers/${driverId}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block; font-size: 14px;">Open Driver Compliance File</a>
          </div>
        </div>
      `;

      await sendEmail({
        to: recipientEmail,
        subject: companySubject,
        html: companyHtml,
        text: `Drug test record ${actionLabel} for driver ${driverName}. Test Type: ${testType}. Result: ${result}. Test Date: ${testDate}.`
      });
    }

    // C. SMS to Company
    if (recipientPhone) {
      const companySms = `Consortium Update: Drug test (${testType}) record ${actionLabel.toLowerCase()} for driver ${driverName}. Result: ${result}. Test Date: ${testDate}.`;
      await sendSms({ to: recipientPhone, message: companySms });
    }

    // D. Email & SMS to Driver
    if (driverEmail) {
      const driverSubject = `Important Notice: Your Drug Test Record Has Been ${actionLabel} - Global Limos`;
      const driverHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 19px;">Drug &amp; Alcohol Compliance Record Notice</h2>
          <p style="color: #334155; font-size: 15px;">Dear <strong>${driverName}</strong>,</p>
          <p style="color: #334155; font-size: 15px;">Your ${testType} test compliance record has been <strong>${actionLabel.toLowerCase()}</strong> in the system:</p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 14px;">
            <p style="margin: 4px 0;"><strong>Test Type:</strong> ${testType}</p>
            <p style="margin: 4px 0;"><strong>Test Date:</strong> ${testDate}</p>
            <p style="margin: 4px 0;"><strong>Result:</strong> <span style="font-weight: bold; color: ${result === 'Negative' ? '#16a34a' : '#dc2626'};">${result}</span></p>
            <p style="margin: 4px 0;"><strong>MRO Verified:</strong> ${mroVerified}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">If you have any questions regarding this record, please contact your safety department or consortium administrator.</p>
        </div>
      `;

      await sendEmail({
        to: driverEmail,
        subject: driverSubject,
        html: driverHtml,
        text: `Your ${testType} test record has been ${actionLabel.toLowerCase()}. Test Date: ${testDate}. Result: ${result}.`
      });
    }

    if (driverPhone) {
      await sendSms({
        to: driverPhone,
        message: `Hello ${info.first_name || 'Driver'}, your ${testType} compliance record has been ${actionLabel.toLowerCase()}. Result: ${result}. Date: ${testDate}.`
      });
    }
  } catch (error) {
    console.error('[NotificationService] notifyCompanyAndDriverAboutDirectDrugRecord error:', error);
  }
};

// 4. Dispatch notifications upon Clearinghouse Query Record Created / Updated from Consortium Manage Records
const notifyCompanyAndDriverAboutDirectClearinghouseRecord = async (driverId, queryData, actionType = 'update') => {
  try {
    const info = await getDriverAndCompanyInfo(driverId);
    if (!info) return;

    const companyName = info.carrier_name || info.business_name || (info.firstname ? `${info.firstname} ${info.lastname}` : 'Carrier');
    const recipientEmail = info.carrier_email || info.company_email;
    const recipientPhone = info.carrier_phone || info.company_phone;
    const driverName = (info.first_name || info.last_name) ? `${info.first_name || ''} ${info.last_name || ''}`.trim() : 'Driver';
    const driverEmail = info.driver_email;
    const driverPhone = info.driver_phone;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const queryType = queryData.queryType || queryData.query_type || 'Full Query';
    const entryDate = queryData.queryEntryDate || queryData.query_entry_date || 'N/A';
    const expDate = queryData.queryExpDate || queryData.query_exp_date || 'N/A';
    const resultStatus = queryData.result_status || queryData.result || 'No Violations Found';
    const notes = queryData.queryNotes || queryData.query_notes || '';
    const actionLabel = actionType === 'update' ? 'Updated' : 'Recorded';

    // A. Company In-App Notification (Visible in Dashboard / Bell Notifications)
    const alertKey = `ch_query_${driverId}_${Date.now()}`;
    const inAppTitle = `Clearinghouse Query ${actionLabel}: ${driverName}`;
    const inAppMsg = `FMCSA Clearinghouse ${queryType} ${actionLabel.toLowerCase()} by Consortium. Entry Date: ${entryDate}. Result: ${resultStatus}. Expiration: ${expDate}.`;

    await db.query(
      `INSERT INTO driver_notification (user_id, driver_id, title, message, type, alert_key, is_read) 
       VALUES (?, ?, ?, ?, 'consortium_clearinghouse_query', ?, 0)`,
      [info.company_id, driverId, inAppTitle, inAppMsg, alertKey]
    );

    // B. Email to Company
    if (recipientEmail) {
      const companySubject = `Compliance Notice: FMCSA Clearinghouse Query ${actionLabel} - ${driverName} [${resultStatus}]`;
      const companyHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="border-bottom: 2px solid #7c3aed; padding-bottom: 16px; margin-bottom: 20px;">
            <h2 style="color: #0f172a; margin: 0; font-size: 20px;">Consortium Clearinghouse Notice</h2>
            <p style="color: #64748b; margin: 4px 0 0 0; font-size: 14px;">Driver Query Record ${actionLabel}</p>
          </div>

          <p style="color: #334155; font-size: 15px; line-height: 1.5;">
            Hello <strong>${companyName}</strong>,
          </p>
          <p style="color: #334155; font-size: 15px; line-height: 1.5;">
            An FMCSA Clearinghouse compliance query has been <strong>${actionLabel.toLowerCase()}</strong> for driver <strong>${driverName}</strong>:
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 150px;">Driver:</td>
                <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${driverName} (CDL: ${info.license_number || 'N/A'})</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Query Type:</td>
                <td style="padding: 6px 0; font-weight: 600; color: #7c3aed;">${queryType}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Date of Query:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${entryDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Expiration Date:</td>
                <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${expDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Result:</td>
                <td style="padding: 6px 0; font-weight: 700; color: ${resultStatus === 'No Violations Found' ? '#16a34a' : '#dc2626'}; font-size: 15px;">${resultStatus}</td>
              </tr>
              ${notes ? `<tr><td style="padding: 6px 0; color: #64748b;">Notes:</td><td style="padding: 6px 0; color: #475569;">${notes}</td></tr>` : ''}
            </table>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${frontendUrl}/drivers/${driverId}" style="background-color: #7c3aed; color: #ffffff; padding: 12px 28px; text-decoration: none; font-weight: 600; border-radius: 6px; display: inline-block; font-size: 14px;">Open Driver Compliance File</a>
          </div>
        </div>
      `;

      await sendEmail({
        to: recipientEmail,
        subject: companySubject,
        html: companyHtml,
        text: `FMCSA Clearinghouse ${queryType} ${actionLabel.toLowerCase()} for driver ${driverName}. Result: ${resultStatus}. Query Date: ${entryDate}. Expiration: ${expDate}.`
      });
    }

    // C. SMS to Company
    if (recipientPhone) {
      const companySms = `Consortium Update: Clearinghouse (${queryType}) ${actionLabel.toLowerCase()} for driver ${driverName}. Result: ${resultStatus}. Date: ${entryDate}.`;
      await sendSms({ to: recipientPhone, message: companySms });
    }

    // D. Email & SMS to Driver
    if (driverEmail) {
      const driverSubject = `FMCSA Clearinghouse Notice: Compliance Query ${actionLabel} - Global Limos`;
      const driverHtml = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <h2 style="color: #0f172a; margin-top: 0; font-size: 19px;">FMCSA Clearinghouse Verification Notice</h2>
          <p style="color: #334155; font-size: 15px;">Dear <strong>${driverName}</strong>,</p>
          <p style="color: #334155; font-size: 15px;">Your ${queryType} record has been <strong>${actionLabel.toLowerCase()}</strong>:</p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 18px 0; font-size: 14px;">
            <p style="margin: 4px 0;"><strong>Query Type:</strong> ${queryType}</p>
            <p style="margin: 4px 0;"><strong>Date of Query:</strong> ${entryDate}</p>
            <p style="margin: 4px 0;"><strong>Result:</strong> <span style="font-weight: bold; color: ${resultStatus === 'No Violations Found' ? '#16a34a' : '#dc2626'};">${resultStatus}</span></p>
            <p style="margin: 4px 0;"><strong>Valid Until:</strong> ${expDate}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">If you have any questions regarding this verification, please contact your safety department.</p>
        </div>
      `;

      await sendEmail({
        to: driverEmail,
        subject: driverSubject,
        html: driverHtml,
        text: `Your FMCSA Clearinghouse ${queryType} has been ${actionLabel.toLowerCase()}. Date: ${entryDate}. Result: ${resultStatus}.`
      });
    }

    if (driverPhone) {
      await sendSms({
        to: driverPhone,
        message: `Hello ${info.first_name || 'Driver'}, your FMCSA Clearinghouse query (${queryType}) has been ${actionLabel.toLowerCase()}. Result: ${resultStatus}. Date: ${entryDate}.`
      });
    }
  } catch (error) {
    console.error('[NotificationService] notifyCompanyAndDriverAboutDirectClearinghouseRecord error:', error);
  }
};

module.exports = {
  sendEmail,
  sendSms,
  sendInAppNotification,
  notifyCompanyAboutRequest,
  notifyCompanyAndDriverAboutRequestUpdate,
  notifyCompanyAndDriverAboutDirectDrugRecord,
  notifyCompanyAndDriverAboutDirectClearinghouseRecord
};
