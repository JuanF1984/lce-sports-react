export const MEGAEVENTO_TEMPLATE = `<table style="background-color: #0a0018;" width="100%" cellspacing="0" cellpadding="0">
<tbody>
<tr>
<td style="padding: 30px 15px;" align="center">
<table style="max-width: 600px; width: 100%; background: linear-gradient(180deg,#130030 0%,#0d001f 60%,#0a0018 100%); border-radius: 12px; overflow: hidden; border: 1px solid #4a1080; box-shadow: 0 0 40px rgba(120,0,200,0.4), 0 0 80px rgba(180,0,120,0.15);" width="600" cellspacing="0" cellpadding="0">
<tbody>
<tr>
<td style="background: linear-gradient(135deg,#3d0080 0%,#6a0dad 50%,#9b00d4 100%); padding: 0; position: relative;">
<div style="height: 3px; background: linear-gradient(90deg,transparent,#ff00cc,#b040ff,#00d4ff,transparent);">&nbsp;</div>
<div style="padding: 28px 30px 24px; text-align: center;">
<div style="display: inline-block; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.25); border-radius: 100px; padding: 5px 20px; margin-bottom: 14px;"><span style="color: #e0c0ff; font-size: 11px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase;"> LC e-Sports </span></div>
<h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; text-shadow: 0 0 20px rgba(180,80,255,0.8),0 0 40px rgba(255,0,200,0.4);">MegaEvento</h1>
</div>
<div style="height: 2px; background: linear-gradient(90deg,transparent,#ff00cc,#b040ff,#00d4ff,transparent);">&nbsp;</div>
</td>
</tr>
<tr>
<td style="padding: 32px 35px 16px;">
<p style="margin: 0; font-size: 15px; color: #a080c0;">Hola,</p>
<p style="margin: 4px 0 0; font-size: 22px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 1px; text-shadow: 0 0 12px rgba(160,80,255,0.6);">{{to_name}}</p>
</td>
</tr>
<tr>
<td style="padding: 0 35px;">
<div style="height: 1px; background: linear-gradient(90deg,transparent,#6a0dad,#ff00cc,#6a0dad,transparent); margin-bottom: 20px;">&nbsp;</div>
</td>
</tr>
<tr>
<td style="padding: 0 35px 28px;">
<div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(106,13,173,0.5); border-left: 3px solid #b040ff; border-radius: 8px; padding: 22px 24px;">
<div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(106,13,173,0.5); border-left: 3px solid #b040ff; border-radius: 8px; padding: 22px 24px; color: #e0d0f0; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.85;">
{{message_body}}
</div>
</div>
</td>
</tr>
<tr>
<td style="padding: 0 35px 25px; text-align: center;">{{image_html}}</td>
</tr>
<tr>
<td style="padding: 0 35px 28px; text-align: center;">
<div style="display: inline-block; background: linear-gradient(90deg,#6a0dad,#b040ff,#ff00cc); border-radius: 100px; padding: 2px;">
<div style="background: #0d001f; border-radius: 100px; padding: 10px 28px;"><span style="color: #e0c0ff; font-size: 12px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase;"> &iexcl;Nos vemos en el evento! </span></div>
</div>
</td>
</tr>
<tr>
<td style="padding: 0;">
<div style="height: 2px; background: linear-gradient(90deg,transparent,#6a0dad,#ff00cc,#6a0dad,transparent);">&nbsp;</div>
<div style="background: rgba(0,0,0,0.4); padding: 20px 30px; text-align: center;">
<p style="margin: 0 0 6px; color: #8060a0; font-size: 12px; letter-spacing: 1px;">Este mensaje fue enviado a <span style="color: #b040ff;">{{to_email}}</span></p>
<p style="margin: 0; color: #5a3a7a; font-size: 11px;">&copy; LC E-Sports &mdash; MegaEvento</p>
</div>
</td>
</tr>
</tbody>
</table>
</td>
</tr>
</tbody>
</table>`;

export const renderMegaeventoTemplate = ({ toName, toEmail, messageBody, imageHtml = '' }) =>
    MEGAEVENTO_TEMPLATE
        .replaceAll('{{to_name}}', toName)
        .replaceAll('{{to_email}}', toEmail)
        .replaceAll('{{message_body}}', messageBody)
        .replaceAll('{{image_html}}', imageHtml);
