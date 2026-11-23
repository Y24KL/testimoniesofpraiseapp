import { useState } from 'react';
import { Icon } from './Icon';
import { useToast } from './feedback';
import { MessageComposer, type ComposerContext } from './MessageComposer';

/**
 * "Message user" for any admin record: opens the composer with the recipient, the related record and
 * template placeholders already filled in. After sending, the conversation is in User Communication.
 */
export function MessageUserButton({ uid, context, label = 'Message user', className = 'btn small ghost' }: {
  uid?: string | null;
  context: ComposerContext;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  if (!uid) return null;
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}><Icon name="send" size={14} />{label}</button>
      {open ? (
        <MessageComposer
          uid={uid}
          context={context}
          onClose={() => setOpen(false)}
          onSent={(threadId) => {
            setOpen(false);
            toast.ok(`Message sent (conversation ${threadId.slice(0, 12)}…). Find it in User Communication.`);
          }}
        />
      ) : null}
    </>
  );
}
