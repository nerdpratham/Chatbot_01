// The model ends a reply with this marker when the user should leave their
// contact details instead of getting an answer. The chat UI swaps it for a form.
export const CONTACT_MARKER = "[[CONTACT_FORM]]";

export type Contact = {
  name: string;
  phone: string;
};

// Splits the marker out of a reply. While a reply is still streaming, the end
// may hold only the start of the marker, so that partial text is hidden too.
export function parseReply(content: string) {
  const index = content.indexOf(CONTACT_MARKER);
  if (index !== -1) {
    const text =
      content.slice(0, index) + content.slice(index + CONTACT_MARKER.length);
    return { text: text.trim(), wantsContact: true };
  }

  for (let i = Math.min(CONTACT_MARKER.length - 1, content.length); i > 0; i--) {
    if (content.endsWith(CONTACT_MARKER.slice(0, i))) {
      return { text: content.slice(0, -i).trimEnd(), wantsContact: false };
    }
  }

  return { text: content, wantsContact: false };
}
