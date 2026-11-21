import type { MessageAction, SupportCategory } from './support';

/**
 * Built-in message templates. Placeholders in {braces} are filled from the related record; any left
 * unfilled are removed with their sentence-level brackets kept readable. A template only pre-fills the
 * composer: the admin always reviews the final message before it is sent.
 */
export interface MessageTemplate {
  id: string;
  category: SupportCategory;
  label: string;
  subject: string;
  body: string;
  action?: MessageAction;
}

const thanks = 'Thank you for being part of Testimonies of Praise.';

export const BUILT_IN_TEMPLATES: MessageTemplate[] = [
  // ---------------- choir requests ----------------
  {
    id: 'choir_invalid_link', category: 'choir_request', label: 'Ministration link is invalid',
    subject: 'Action Required – Choir Feature Request',
    body: `Hello {name},\n\nThank you for submitting {groupName} for featuring on Testimonies of Praise.\n\nWe reviewed your submission and noticed that the ministration video link could not be accessed.\n\nKindly provide a valid YouTube, Facebook or Vimeo link so our team can continue reviewing your request.\n\n${thanks}`,
    action: { label: 'Update choir submission', route: 'choir' },
  },
  {
    id: 'choir_new_link', category: 'choir_request', label: 'Please send a different video link',
    subject: 'Choir Feature Request – New Video Link Needed',
    body: `Hello {name},\n\nThank you for your choir feature request for "{songTitle}".\n\nCould you please send us a different video link for this ministration? The current one is not suitable for featuring.\n\n${thanks}`,
    action: { label: 'Update choir submission', route: 'choir' },
  },
  {
    id: 'choir_clarify', category: 'choir_request', label: 'Choir information needs clarification',
    subject: 'Choir Feature Request – Clarification Needed',
    body: `Hello {name},\n\nThank you for submitting {groupName}. Before we continue, we need a little more information about your choir or group.\n\nPlease reply to this message with the details below:\n- \n\n${thanks}`,
  },
  {
    id: 'choir_song_title', category: 'choir_request', label: 'Please correct the song title',
    subject: 'Choir Feature Request – Song Title',
    body: `Hello {name},\n\nThank you for your submission. The song title we received ("{songTitle}") may not be correct. Please confirm or send us the correct title.\n\n${thanks}`,
    action: { label: 'Update choir submission', route: 'choir' },
  },
  {
    id: 'choir_received', category: 'choir_request', label: 'Request received',
    subject: 'Choir Feature Request Received',
    body: `Hello {name},\n\nWe have received your request to feature {groupName}. Our team will review it and let you know.\n\n${thanks}`,
  },
  {
    id: 'choir_approved', category: 'choir_request', label: 'Request approved',
    subject: 'Your Choir Feature Request Was Approved',
    body: `Hello {name},\n\nGood news: your request to feature {groupName} has been approved. We will let you know when it is live in the app.\n\n${thanks}`,
  },
  {
    id: 'choir_declined', category: 'choir_request', label: 'Request declined',
    subject: 'Your Choir Feature Request',
    body: `Hello {name},\n\nThank you for submitting {groupName}. After review, we are unable to feature this ministration at this time.\n\nYou are welcome to submit another ministration in the future.\n\n${thanks}`,
  },
  // ---------------- sponsorships ----------------
  {
    id: 'sponsor_receipt_unclear', category: 'sponsorship', label: 'Receipt is unclear',
    subject: 'Sponsorship Receipt – Additional Information Required',
    body: 'Hello {name},\n\nThank you for supporting Testimonies of Praise.\n\nWe have received your sponsorship submission. However, we need a clearer copy of your transfer receipt to complete verification.\n\nKindly upload a new copy using the button below.\n\nThank you for your partnership and support.',
    action: { label: 'Upload new receipt', route: 'sponsor' },
  },
  {
    id: 'sponsor_receipt_incomplete', category: 'sponsorship', label: 'Receipt is incomplete',
    subject: 'Sponsorship Receipt – Incomplete',
    body: 'Hello {name},\n\nThank you for your sponsorship. The receipt you uploaded does not show all the details we need (date, amount and the receiving account).\n\nKindly upload a complete copy using the button below.\n\nThank you for your partnership and support.',
    action: { label: 'Upload new receipt', route: 'sponsor' },
  },
  {
    id: 'sponsor_verify', category: 'sponsorship', label: 'Payment details need verification',
    subject: 'Sponsorship – Payment Verification',
    body: 'Hello {name},\n\nThank you for your sponsorship. We could not yet match your payment with our records. Please reply with the date of the transfer and the name on the sending account.\n\nThank you for your partnership and support.',
  },
  {
    id: 'sponsor_amount', category: 'sponsorship', label: 'Please clarify the amount',
    subject: 'Sponsorship – Amount Clarification',
    body: 'Hello {name},\n\nThank you for your sponsorship. Please reply to confirm the amount you transferred, so we can complete verification.\n\nThank you for your partnership and support.',
  },
  {
    id: 'sponsor_received', category: 'sponsorship', label: 'Sponsorship received',
    subject: 'Sponsorship Received – Thank You',
    body: 'Hello {name},\n\nWe have received your sponsorship submission and our team is verifying it. Thank you for supporting Testimonies of Praise.',
  },
  {
    id: 'sponsor_approved', category: 'sponsorship', label: 'Sponsorship approved',
    subject: 'Sponsorship Confirmed – Thank You',
    body: 'Hello {name},\n\nYour sponsorship has been verified. Thank you for your generous partnership with Testimonies of Praise. God bless you.',
  },
  {
    id: 'sponsor_unverified', category: 'sponsorship', label: 'Sponsorship could not be verified',
    subject: 'Sponsorship – Unable to Verify',
    body: 'Hello {name},\n\nThank you for your sponsorship. Unfortunately we were not able to verify this payment. Please reply to this message so we can help resolve it.\n\nThank you for your partnership and support.',
  },
  // ---------------- testimonies ----------------
  {
    id: 'testimony_received', category: 'testimony', label: 'Submission received',
    subject: 'Your Testimony Was Received',
    body: `Hello {name},\n\nThank you for sharing your testimony with us. Our team will review it soon.\n\n${thanks}`,
  },
  {
    id: 'testimony_missing', category: 'testimony', label: 'Missing information',
    subject: 'Your Testimony – More Information Needed',
    body: `Hello {name},\n\nThank you for sharing your testimony. Before we can publish it, we need a few more details. Please reply to this message with:\n- \n\n${thanks}`,
  },
  {
    id: 'testimony_approved', category: 'testimony', label: 'Submission approved',
    subject: 'Your Testimony Was Approved',
    body: `Hello {name},\n\nThank you for sharing what God has done. Your testimony has been approved and will be published soon.\n\n${thanks}`,
  },
  {
    id: 'testimony_declined', category: 'testimony', label: 'Submission declined',
    subject: 'Your Testimony Submission',
    body: `Hello {name},\n\nThank you for sharing your testimony. After review, we are not able to publish this submission. You are welcome to share another testimony at any time.\n\n${thanks}`,
  },
  // ---------------- general support ----------------
  {
    id: 'general_account', category: 'account', label: 'Account assistance',
    subject: 'Help With Your Account',
    body: `Hello {name},\n\nThank you for contacting us about your account. \n\nIf you need anything else, just reply to this message.\n\n${thanks}`,
  },
  {
    id: 'general_profile', category: 'account', label: 'Profile correction',
    subject: 'Please Update Your Profile',
    body: `Hello {name},\n\nSome details in your profile need to be updated. Please open your profile using the button below and check your information.\n\n${thanks}`,
    action: { label: 'Open my profile', route: 'profile' },
  },
  {
    id: 'general_followup', category: 'general', label: 'Follow-up',
    subject: 'Following Up',
    body: `Hello {name},\n\nWe are following up on your earlier message. \n\nIf you need anything else, just reply to this message.\n\n${thanks}`,
  },
  {
    id: 'general_feedback', category: 'feedback', label: 'Thanks for your feedback',
    subject: 'Thank You for Your Feedback',
    body: `Hello {name},\n\nThank you for your feedback about the app. \n\n${thanks}`,
  },
];

/** Fills {placeholders}; unknown or empty ones become a neutral word so no braces reach the user. */
export function fillTemplate(text: string, values: Record<string, string | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = values[k]?.trim();
    if (v) return v;
    return k === 'name' ? 'there' : k === 'groupName' ? 'your choir' : k === 'songTitle' ? 'your song' : '';
  });
}
