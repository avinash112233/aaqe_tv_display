interface Props {
  contactLabel?: string;
}

export default function HealthBanner({ contactLabel }: Props) {
  const email = contactLabel?.replace(/^PI Contact:\s*/i, '').trim();
  if (!email) return null;
  return (
    <footer className="dash-banner">
      <div className="dash-banner-contact">
        <span className="dash-banner-contact-title">PI Contact</span>
        <span className="dash-banner-contact-email">{email}</span>
      </div>
    </footer>
  );
}
