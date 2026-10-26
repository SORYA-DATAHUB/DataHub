import type { LegalSection } from "./legal-doc";

export const UPDATED = "1 October 2026";

export const terms: LegalSection[] = [
  { id: "acceptance", title: "Acceptance of terms", body: ["By creating an account or using DataHub you agree to these Terms of Service and to the Privacy Policy, Contributor Agreement and Data Ownership and Licensing Policy.", "If you use DataHub on behalf of an organization, you confirm that you may bind it to these terms."] },
  { id: "accounts", title: "Accounts and security", body: ["You must provide accurate information, keep your credentials confidential and notify us of any unauthorized access. Each person may hold one contributor account.", "Administrators and reviewers may be required to use multi-factor authentication."] },
  { id: "services", title: "The service", body: ["DataHub lets authorized contributors upload documents and datasets, receive quality review, complete annotation assignments and earn compensation for accepted content.", "We may change, suspend or discontinue features with reasonable notice."] },
  { id: "earnings", title: "Earnings and payments", body: ["Raw data earns USD 1.00 per accepted gigabyte and clean or labeled data earns USD 1.50 per accepted gigabyte, where 1 GB equals 1,000,000,000 bytes. Only accepted, unique and eligible content earns.", "Uploading content does not entitle you to payment. Withdrawals require a minimum available balance, completed identity verification and manual approval by an administrator. We may withhold or reverse earnings obtained through fraud or misdeclared rights."] },
  { id: "conduct", title: "Acceptable use", body: ["You may not upload content you are not authorized to share, malware, unlawful material or content that infringes the rights of others, and you may not attempt to bypass review, duplicate detection or access controls."] },
  { id: "suspension", title: "Suspension and termination", body: ["We may suspend or close accounts that breach these terms. You may close your account at any time; unpaid verified earnings remain payable subject to the approval process."] },
  { id: "liability", title: "Disclaimers and liability", body: ["The service is provided as is to the maximum extent permitted by law. Our aggregate liability is limited to amounts paid or payable to you in the twelve months before the claim."] },
  { id: "contact", title: "Contact", body: ["Questions about these terms can be sent through the Help center contact form."] }
];

export const privacy: LegalSection[] = [
  { id: "collect", title: "What we collect", body: ["Account data (name, email, country), verification data you choose to provide, payout details, the files you upload with their metadata, activity logs and device information needed to secure your session."] },
  { id: "use", title: "How we use data", body: ["To operate the service, review and quality-check content, calculate earnings, process payouts, prevent fraud, provide support and meet legal obligations. We do not sell your personal information."] },
  { id: "uploads", title: "Uploaded content", body: ["Uploaded files are private by default. Access is limited to assigned reviewers, annotators and administrators on a need-to-know basis, and access is logged. Accepted content may be included in datasets under the Data Ownership and Licensing Policy."] },
  { id: "sharing", title: "Sharing", body: ["We share data with infrastructure and payment providers acting on our instructions, and with authorities when legally required."] },
  { id: "retention", title: "Retention", body: ["Account and financial records are kept as long as the law requires. Rejected uploads are deleted after the appeal window. You can request deletion of your personal data at any time, subject to legal retention duties."] },
  { id: "rights", title: "Your rights", body: ["You may access, correct, export or delete your personal data and withdraw consent where processing is consent-based. Use Settings or contact support."] },
  { id: "security", title: "Security", body: ["Data is encrypted in transit and at rest, access is role-based and audited, and sensitive actions require additional verification."] }
];

export const agreement: LegalSection[] = [
  { id: "eligibility", title: "Eligibility", body: ["You confirm that you are at least 18 years old, or the age of majority in your country, and that you may legally contribute the content you upload."] },
  { id: "warranties", title: "Your warranties", body: ["For each dataset you warrant that you own the content or hold written authorization to contribute it, that it does not violate any law or third-party right, and that you removed or are authorized to share any personal data in it."] },
  { id: "quality", title: "Quality and uniqueness", body: ["You will not upload duplicates, synthetic or machine-generated content presented as original, or deliberately degraded files. Reviewers decide acceptance; you may appeal a decision through support."] },
  { id: "compensation", title: "Compensation", body: ["Compensation is calculated on accepted gigabytes at the published rates. Payment is not guaranteed for uploaded content and is subject to manual approval, minimum balance and verification."] },
  { id: "annotation", title: "Annotation work", body: ["Annotators agree to follow the project guidelines, preserve source text exactly, work only on assigned tasks and keep task content confidential."] },
  { id: "breach", title: "Breach", body: ["Misdeclared rights, fraud or abuse may result in content removal, reversal of earnings and account suspension."] }
];

export const ownership: LegalSection[] = [
  { id: "ownership", title: "You keep your rights", body: ["You retain ownership of the content you contribute. Contributing grants DataHub the licence described below; it does not transfer ownership."] },
  { id: "licence", title: "Licence to DataHub", body: ["For content that is accepted, you grant DataHub a worldwide, non-exclusive, perpetual, sublicensable licence to host, process, annotate, combine into datasets, and distribute those datasets for research and commercial purposes. Content that is rejected is not licensed and is deleted."] },
  { id: "declaration", title: "Rights declaration", body: ["During onboarding and for every dataset you declare that you own or are authorized to license the content. Typical authorizations include original works, public-domain material, openly licensed material whose licence permits this use, and material for which the rights holder has given written consent."] },
  { id: "personal", title: "Personal and sensitive data", body: ["Do not upload identifiable personal data unless you are authorized and it is necessary. Reviewers may reject or redact content that exposes private individuals."] },
  { id: "takedown", title: "Takedown and withdrawal", body: ["Rights holders can request removal of content through the Help center. We act on valid requests promptly, and datasets already distributed will be updated in subsequent releases."] },
  { id: "attribution", title: "Attribution", body: ["Datasets are published without attributing individual contributors unless you and DataHub agree otherwise in writing."] }
];
