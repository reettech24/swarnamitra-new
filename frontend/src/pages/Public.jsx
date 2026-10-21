import { Link } from 'react-router-dom';

// Edit the text below to match your business. Replace placeholder copy before going live.
export function Home() {
  return (
    <>
      <section className="hero">
        <h1>Move to a better loan with expert guidance</h1>
        <p>Suvarna Mitra Finance helps you transfer your existing loan to a bank with better terms, with simple online registration, document upload and tracking.</p>
        <p><Link className="btn" to="/register">Get Started</Link></p>
      </section>
      <section className="section">
        <h2>How it works</h2>
        <div className="cards3">
          <div className="card"><h3>1. Register</h3><p>Create your account and share your basic details.</p></div>
          <div className="card"><h3>2. Verify &amp; upload</h3><p>Add Aadhaar, PAN, a live photo and your loan documents securely.</p></div>
          <div className="card"><h3>3. We process</h3><p>Pay the processing fee and track your loan status from your dashboard.</p></div>
        </div>
      </section>
    </>
  );
}

export function About() {
  return (
    <section className="section">
      <h1>About Us</h1>
      <p>Suvarna Mitra Finance is a loan advisory and processing firm that connects customers with banks offering suitable loan terms.</p>
      <p>Replace this paragraph with your company story, years of experience, licences and the team.</p>
    </section>
  );
}

export function Services() {
  const items = [
    ['Loan Balance Transfer', 'Move your existing loan to a bank with a lower rate of interest.'],
    ['Home Loans', 'Guidance and paperwork support for new and existing home loans.'],
    ['Personal & Business Loans', 'Help finding and applying for the right loan product.'],
    ['Documentation Support', 'We help you prepare, verify and submit your documents correctly.'],
  ];
  return (
    <section className="section">
      <h1>Our Services</h1>
      <div className="cards3">
        {items.map(([t, d]) => (
          <div className="card" key={t}><h3>{t}</h3><p>{d}</p></div>
        ))}
      </div>
    </section>
  );
}
