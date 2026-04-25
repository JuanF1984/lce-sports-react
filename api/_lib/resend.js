import { Resend } from 'resend';

export const resend = new Resend(process.env.RESEND_API_KEY);
export const FROM = 'LC e-SPORTS <no-reply@lcesports.com.ar>';
