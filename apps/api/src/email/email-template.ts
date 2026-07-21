export const HANDOUT_LOGO_URL = "https://app.handout.link/handout-logo.svg";

export type HandoutEmailLayoutInput = {
  title: string;
  preheader: string;
  contentHtml: string;
};

export function renderHandoutEmail(input: HandoutEmailLayoutInput) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light only">
    <meta name="supported-color-schemes" content="light">
    <title>${escapeHtml(input.title)}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .email-shell { padding: 24px 12px !important; }
        .email-header { padding: 32px 28px 0 !important; }
        .email-content { padding: 32px 28px 36px !important; }
        .verification-code { font-size: 30px !important; letter-spacing: 0.14em !important; }
        .email-button { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:#fafafa;color:#171717;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      ${escapeHtml(input.preheader)}
    </div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background-color:#fafafa;">
      <tr>
        <td class="email-shell" align="center" style="padding:48px 16px;">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid #e5e5e5;border-radius:14px;">
            <tr>
              <td class="email-header" style="padding:40px 40px 0;">
                <img src="${HANDOUT_LOGO_URL}" width="100" height="20" alt="Handout" style="display:block;width:100px;height:20px;border:0;outline:none;text-decoration:none;">
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:40px 40px 44px;">
                ${input.contentHtml}
              </td>
            </tr>
          </table>
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;">
            <tr>
              <td style="padding:20px 8px 0;text-align:center;color:#a3a3a3;font-size:12px;line-height:1.5;">
                <a href="https://handout.link" style="color:#737373;text-decoration:none;">handout.link</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function renderEmailHeading(title: string) {
  return `<h1 style="margin:0 0 14px;color:#171717;font-size:28px;line-height:1.2;font-weight:600;letter-spacing:-0.025em;">${escapeHtml(title)}</h1>`;
}

export function renderEmailParagraph(content: string) {
  return `<p style="margin:0;color:#525252;font-size:16px;line-height:1.6;">${escapeHtml(content)}</p>`;
}

export function renderEmailMutedParagraph(content: string, options: { topSpacing?: number } = {}) {
  const topSpacing = options.topSpacing ?? 0;
  return `<p style="margin:${topSpacing}px 0 0;color:#737373;font-size:14px;line-height:1.6;">${escapeHtml(content)}</p>`;
}

export function renderEmailDividerNote(content: string) {
  return `<p style="margin:24px 0 0;padding-top:24px;border-top:1px solid #eeeeee;color:#737373;font-size:13px;line-height:1.6;">${escapeHtml(content)}</p>`;
}

export function renderEmailAction(label: string, href: string) {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
  <tr>
    <td style="border-radius:8px;background-color:#171717;">
      <a class="email-button" href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:13px 18px;color:#ffffff;font-size:15px;line-height:1.2;font-weight:600;text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function renderVerificationCode(code: string) {
  return `<div style="margin:28px 0;padding:20px 18px;background-color:#f5f5f5;border:1px solid #e5e5e5;border-radius:10px;text-align:center;">
  <span class="verification-code" style="display:inline-block;color:#171717;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:32px;line-height:1.25;font-weight:600;letter-spacing:0.18em;white-space:nowrap;">${escapeHtml(code)}</span>
</div>`;
}

export function renderEmailDetails(rows: Array<{ label: string; value: string }>) {
  const rowHtml = rows.map((row, index) => {
    const border = index === 0 ? "" : "border-top:1px solid #e5e5e5;";
    return `<tr>
  <td style="padding:12px 0;${border}color:#737373;font-size:13px;line-height:1.5;">${escapeHtml(row.label)}</td>
  <td align="right" style="padding:12px 0;${border}color:#171717;font-size:13px;line-height:1.5;font-weight:600;">${escapeHtml(row.value)}</td>
</tr>`;
  }).join("\n");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:28px 0;padding:0 16px;background-color:#f5f5f5;border:1px solid #e5e5e5;border-radius:10px;">
${rowHtml}
</table>`;
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
