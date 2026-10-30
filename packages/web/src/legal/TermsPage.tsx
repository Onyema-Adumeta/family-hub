import { Link } from 'react-router-dom';
import { LegalPage } from './LegalPage';
import { LEGAL } from './config';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These terms are an agreement between you and {LEGAL.operator} ("we") for using Kinroost. By creating a family
        or joining one, you agree to them. A parent or guardian accepts these terms for their family, including for any
        children who join.
      </p>

      <h2>Free beta</h2>
      <p>
        Kinroost is currently a free beta. There is no charge and no payment information is collected. Features may
        change, and we may occasionally reset or remove features while we improve the app. If we ever introduce paid
        plans, we will tell you in advance and you will not be charged unless you choose a paid plan.
      </p>

      <h2>Family accounts</h2>
      <ul>
        <li>The parent who creates a family is responsible for it, and for who they invite using the family code.</li>
        <li>Parents are responsible for supervising their children's use of Kinroost and for the rewards and consequences they set.</li>
        <li>Keep your password private. If you think someone else knows it, change it or ask a parent to reset it, and use "Sign out everywhere".</li>
        <li>You must be the parent or legal guardian of any child you allow to join your family.</li>
      </ul>

      <h2>Acceptable use</h2>
      <p>Do not use Kinroost to break the law, harass or harm anyone, share content that is unlawful or inappropriate for children, try to access another family's information, or interfere with the service.</p>

      <h2>Your content</h2>
      <p>
        Your family owns what it puts in Kinroost. You allow us to store and process it only to run the service for
        your family, as described in the <Link to="/privacy">Privacy Policy</Link>. A parent can download it or delete it at any time.
      </p>

      <h2>AI features</h2>
      <p>AI features are optional and off until a parent turns them on. AI-generated suggestions can be wrong; use your own judgement, especially for anything about health, food allergies or safety.</p>

      <h2>Ending your use</h2>
      <p>A parent can delete the family at any time from Settings. We may suspend or close accounts that break these terms, or end the beta, with reasonable notice where possible so you can download your data.</p>

      <h2>No warranty and limits of liability</h2>
      <p>
        Kinroost is provided "as is" during the beta, without warranties of any kind. To the extent the law allows, we
        are not liable for indirect or consequential losses, or for loss of data, arising from your use of Kinroost.
        Nothing in these terms limits rights you have under consumer protection law that cannot be waived.
      </p>

      <h2>Changes</h2>
      <p>If we make important changes, we will update the version and date above and ask a parent to accept them.</p>

      <h2>Governing law</h2>
      <p>These terms are governed by the laws of British Columbia and the federal laws of Canada that apply there.</p>

      <h2>Contact</h2>
      <p><a href={`mailto:${LEGAL.supportEmail}`}>{LEGAL.supportEmail}</a></p>
    </LegalPage>
  );
}
