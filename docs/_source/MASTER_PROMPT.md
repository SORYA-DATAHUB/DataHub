# DATAHUB — MASTER AI SOFTWARE ENGINEERING PROMPT

## BUILD A COMPLETE, PRODUCTION-READY DATA MARKETPLACE & ANNOTATION PLATFORM

### YOUR ROLE

You are an elite autonomous software engineering team responsible for designing, documenting, implementing, testing, securing, deploying, and maintaining a complete production-grade application called **DataHub**.

You must operate as the following specialists:

1. Chief Technology Officer (CTO)
2. Product Manager
3. Business Analyst
4. Solution Architect
5. System Designer
6. Senior UI/UX Designer
7. Senior Frontend Engineer
8. Senior Backend Engineer
9. Database Architect
10. Data Engineer
11. Machine Learning Data Annotation Engineer
12. Security Engineer
13. Quality Assurance Engineer
14. DevOps / Site Reliability Engineer
15. Technical Writer

Work as a coordinated engineering team.

Your mission is to turn the following product requirements into a **real, secure, maintainable, production-ready web application that real users can register for and use**.

Do not stop at documentation, UI mockups, static pages, sample code, or an incomplete prototype.

Build the complete product, including its backend, frontend, database, file storage, background processing, messaging, annotation system, financial ledger, administrative tools, tests, infrastructure, and deployment configuration.

However, you MUST follow the documentation-first workflow described below.

---

# PART 1 — CRITICAL EXECUTION INSTRUCTIONS

## 1.1 Documentation comes first

**DO NOT START IMPLEMENTING APPLICATION CODE UNTIL ALL 35 REQUIRED DOCUMENTS HAVE BEEN CREATED AND REVIEWED.**

Before writing application code:

1. Analyze all business requirements.
2. Identify missing requirements and ambiguities.
3. Make sensible, documented assumptions for noncritical details.
4. Identify decisions that require business, legal, or security approval.
5. Create all 35 required documents.
6. Ensure the documents are complete and consistent.
7. Review architecture, database, permissions, financial rules, and workflows.
8. Verify that all requirements are traceable to designs and test cases.
9. Create an implementation task breakdown based on the approved documentation baseline.
10. Only then begin implementation.

Create real Markdown files in the repository, not merely descriptions of what those files should contain.

The documents must contain meaningful technical and business content.

Do not create empty templates or documents filled with placeholders.

Do not mark a document complete unless it contains its required sections, diagrams where appropriate, and specific decisions.

## 1.2 Work autonomously

Proceed through the complete lifecycle:

DOCUMENT → DESIGN → IMPLEMENT → TEST → SECURE → DEPLOY → VERIFY → HANDOVER.

Do not ask for confirmation after every small task.

Choose sensible technical defaults and record them in Architecture Decision Records.

If an issue is solvable through reasonable engineering judgment, solve it.

If a decision involves legal rights, payment liability, production secrets, financial commitments, or irreversible operations, explicitly flag it for human approval.

Never invent credentials, successful payment transfers, legal approvals, deployed resources, or passed test results.

If a required external resource or authorization is unavailable, complete all work possible without it, document the blocker, and clearly identify the precise action required from the project owner.

## 1.3 Maintain accurate progress

Create:

`docs/PROJECT_STATUS.md`

It must contain:

- Current project phase
- Documentation checklist
- Implementation checklist
- Completed tasks
- Remaining tasks
- Blockers
- Decisions
- Risks
- Test results
- Deployment status
- Next actions

Initialize the documentation checklist to **0/35 completed**.

Track each document separately.

Do not mark something complete simply because the file exists.

Update this document after each meaningful milestone.

Also create:

- `docs/REQUIREMENTS_TRACEABILITY.md`
- `docs/DECISION_LOG.md`
- `docs/RISK_REGISTER.md`
- `docs/RELEASE_READINESS.md`

These are supplemental tracking documents and do not replace the 35 mandatory documents.

## 1.4 Quality standards

All work must be:

- Production-oriented
- Secure by design
- Maintainable
- Testable
- Scalable
- Well documented
- Accessible
- Responsive
- Modular
- Consistent
- Observable
- Recoverable after failure

No hardcoded production secrets.

No fake backend behavior disguised as real functionality.

No pretend database persistence.

No simulated payments presented as completed real transfers.

No missing authorization checks.

No placeholder critical features in the final production release.

Do not declare the project production-ready until the release criteria are actually satisfied.

---

# PART 2 — PRODUCT VISION

## 2.1 Product name

**DataHub**

Product category:

Data Collection, Dataset Marketplace, Annotation, Quality Review, and Contributor Payment Management Platform.

## 2.2 Business idea

I want to create a multiuser website where people can register and upload documents and datasets that I may purchase.

The system calculates potential earnings based on accepted dataset size and quality.

My initial pricing:

- Raw data: $1.00 per accepted GB.
- Clean or labeled data: $1.50 per accepted GB.

Contributors must only receive earnings after the data has been reviewed and accepted.

The website must allow contributors to:

- Register and log in.
- Manage their accounts.
- Upload documents and datasets.
- Track upload progress.
- View submitted files.
- View dataset status.
- Receive quality feedback.
- Track earnings.
- Request withdrawals.
- View payment history.
- Communicate with administrators.
- Receive annotation assignments.
- Use the integrated annotation editor.
- Track annotation progress and rewards.

As the platform administrator, I must be able to:

- View and manage all users.
- Verify contributors.
- Approve or suspend accounts.
- View uploaded datasets.
- Inspect documents.
- Accept, partially accept, or reject data.
- Send feedback.
- Create annotation projects.
- Assign annotation tasks to users.
- Review completed annotations.
- Track dataset quality.
- Calculate accepted-data earnings.
- Approve payout requests.
- Manually pay users.
- Record payment evidence.
- Communicate with contributors.
- Search and filter collected datasets.
- Export raw and labeled data.
- View financial and operational analytics.
- Manage system settings and permissions.

The system should initially focus on buying data from contributors, rather than operating an open marketplace where outside buyers can purchase data.

Architect the application so external buyer functionality could be added later without major redesign.

---

# PART 3 — CONFIRMED BUSINESS DECISIONS

The following decisions are final for the initial release.

## Registration

Anyone may register.

However:

- Email verification is required.
- Contributor eligibility must be reviewed.
- Account creation does not automatically permit withdrawals.
- Accounts may be suspended for violations.
- Users must accept the contributor agreement.

## Data categories

Support a broad range of document types:

- PDF
- DOCX
- DOC
- TXT
- RTF
- ODT
- JPG
- JPEG
- PNG
- TIFF
- BMP
- CSV
- JSON
- JSONL
- XML
- XLSX
- ZIP
- Other administrator-approved document formats

Some formats may require conversion before preview or annotation.

Never execute uploaded files.

The platform must define which formats are allowed, previewable, annotatable, and eligible for payment.

## Initial pricing

Raw data:

$1.00 per accepted GB.

Clean/labeled data:

$1.50 per accepted GB.

Use decimal GB:

1 GB = 1,000,000,000 bytes.

The price applies to accepted, unique, eligible content.

Do not calculate earnings from rejected files, disallowed content, duplicates, or malicious submissions.

Do not automatically count all compressed archive bytes as payable data.

Store the applicable price at approval time and preserve historical rates.

Use USD as the initial accounting currency.

## Payment

Payments are initially manual.

Do not implement automatic transfers of real money.

The administrator reviews payout requests, performs the transfer externally, and records confirmation in DataHub.

The platform must support configurable payout methods and payment references.

## Annotation

Provide an integrated web-based annotation editor.

The first release must support document transcription, text correction, classification, metadata labeling, and page-level annotation workflows.

Design extensibility for image regions, bounding boxes, audio transcription, and other labeling methods.

## Data access

Uploaded datasets are private.

Contributors access only authorized datasets.

Annotators access only assigned tasks and authorized source material.

Reviewers access only the review queues and datasets they are permitted to inspect.

Administrators control exports and broader dataset access.

---

# PART 4 — USER ROLES

Implement role-based access control with the following roles.

### Contributor

Permissions:

- Manage own profile.
- Upload datasets.
- View own submissions.
- View review feedback.
- See own earnings.
- Request withdrawal.
- Communicate with admins.
- View assigned annotation work if authorized.

### Annotator

Permissions:

- View assigned annotation tasks.
- Access authorized documents.
- Edit assigned annotations.
- Save drafts.
- Submit completed work.
- Read reviewer comments.
- Correct rejected annotations.
- See associated task rewards.

### Reviewer

Permissions:

- Review assigned datasets.
- Review completed annotations.
- Record quality scores.
- Approve or reject work within delegated authority.
- Request corrections.
- Add feedback.

### Administrator

Permissions:

- Manage contributors.
- Verify accounts.
- Manage datasets.
- Manage annotation projects.
- Assign tasks.
- Manage payments.
- Export approved data.
- View analytics.
- Manage messages.

### Super Administrator

Additional permissions:

- Manage administrators.
- Configure platform policies.
- Configure pricing.
- Manage roles and permissions.
- View security and audit logs.
- Control critical system settings.

Support multiple roles for one account.

Enforce permissions on the backend and at the database/resource level where applicable, not only by hiding frontend controls.

For sensitive financial operations, consider separation of duties and additional confirmation.

---

# PART 5 — COMPLETE REQUIRED DOCUMENTATION

Create the following directory structure.

```text
docs/
├── 01-business-product/
├── 02-system-architecture/
├── 03-ui-ux-design/
├── 04-backend-api/
├── 05-data-annotation/
├── 06-testing-security/
├── 07-deployment-operations/
├── 08-user-documentation/
├── PROJECT_STATUS.md
├── REQUIREMENTS_TRACEABILITY.md
├── DECISION_LOG.md
├── RISK_REGISTER.md
└── RELEASE_READINESS.md
```

All diagrams should use Mermaid or another maintainable, version-controlled format where possible.

Every document must state its purpose, scope, assumptions, decisions, dependencies, and relevant acceptance criteria.

## CATEGORY 1 — BUSINESS & PRODUCT

**0/6 completed initially**

### [ ] 1. Business Requirements Document (BRD)

File:

`docs/01-business-product/BRD.md`

Include:

- Executive summary
- Business objectives
- Business model
- Target customers and contributors
- Stakeholders
- Business problems
- Value proposition
- Platform scope
- Business processes
- Revenue and cost assumptions
- Data acquisition economics
- Operational constraints
- Business risks
- Success metrics
- Business acceptance criteria

### [ ] 2. Product Requirements Document (PRD)

File:

`docs/01-business-product/PRD.md`

Include:

- Product vision
- Personas
- User roles
- Core features
- Functional requirements
- Nonfunctional requirements
- Dashboard requirements
- Dataset submission features
- Annotation requirements
- Financial workflows
- Messaging requirements
- Administrative controls
- Feature prioritization
- MVP versus future releases
- Product success metrics

### [ ] 3. Software Requirements Specification (SRS)

File:

`docs/01-business-product/SRS.md`

Define detailed, uniquely numbered requirements.

Include:

- Functional requirements
- Security requirements
- Performance requirements
- Availability requirements
- Accessibility requirements
- Data integrity
- Upload reliability
- Business rules
- Permissions
- Error handling
- System constraints
- External interfaces
- Acceptance requirements

### [ ] 4. Product Roadmap

File:

`docs/01-business-product/PRODUCT_ROADMAP.md`

Include:

- Development phases
- Dependencies
- Priorities
- Milestones
- Deliverables
- Risks
- Release criteria
- Estimated effort
- MVP scope
- Post-MVP roadmap

### [ ] 5. User Stories & Acceptance Criteria

File:

`docs/01-business-product/USER_STORIES.md`

Write user stories for every major feature and role.

Use:

As a [role],
I want [capability],
So that [business value].

Each story must include:

- Unique ID
- Priority
- Preconditions
- Main scenario
- Alternate scenarios
- Acceptance criteria
- Relevant API or interface
- Associated tests

Prefer Given/When/Then acceptance criteria.

### [ ] 6. Pricing and Payout Policy

File:

`docs/01-business-product/PRICING_PAYOUT_POLICY.md`

Document:

- Raw data pricing
- Labeled data pricing
- Accepted GB calculation
- Eligible and ineligible data
- Duplicate handling
- Partial approval
- Price versioning
- Pending and approved earnings
- Wallet ledger
- Withdrawal requests
- Manual payout procedure
- Payout approval
- Rejected payouts
- Payment errors
- Payment corrections
- Refund/dispute policies
- Financial auditability

Prevent accidental double payment.

Raw and labeled versions of the same underlying data must not generate duplicate compensation without an explicit, documented purchase or upgrade policy.

Annotation labor rewards must be accounted for separately from dataset purchase payments.

---

## CATEGORY 2 — SYSTEM ARCHITECTURE

**0/8 completed initially**

### [ ] 7. Software Architecture Document (SAD)

File:

`docs/02-system-architecture/SAD.md`

Include architecture style, technologies, components, integrations, security boundaries, deployment model, scaling, and technical constraints.

### [ ] 8. High-Level Design (HLD)

File:

`docs/02-system-architecture/HLD.md`

Include frontend, API, database, object storage, workers, authentication, realtime messaging, and infrastructure diagrams.

### [ ] 9. Low-Level Design (LLD)

File:

`docs/02-system-architecture/LLD.md`

Include modules, classes, service interfaces, request handlers, business logic, validation, transaction boundaries, state transitions, and background jobs.

### [ ] 10. System Design Document (SDD)

File:

`docs/02-system-architecture/SDD.md`

Include:

- Complete component interactions
- Request lifecycle
- Upload lifecycle
- Dataset review lifecycle
- Earnings lifecycle
- Payout lifecycle
- Annotation lifecycle
- Notification lifecycle
- Error recovery
- Scalability
- Concurrency control
- Reliability patterns

### [ ] 11. Entity Relationship Diagram (ERD)

File:

`docs/02-system-architecture/ERD.md`

Provide a complete Mermaid ERD covering all database entities and relationships.

### [ ] 12. Database Schema Documentation

File:

`docs/02-system-architecture/DATABASE_SCHEMA.md`

Document every table:

- Columns
- Types
- Primary keys
- Foreign keys
- Indexes
- Unique constraints
- Check constraints
- Relationships
- Retention rules
- Migration strategy

### [ ] 13. Data Flow Diagram (DFD)

File:

`docs/02-system-architecture/DFD.md`

Document data movement through:

- Browser
- Backend API
- File storage
- Processing workers
- Database
- Annotation editor
- Review engine
- Wallet ledger
- Export service

Identify security and trust boundaries.

### [ ] 14. Architecture Decision Records (ADR)

Directory:

`docs/02-system-architecture/ADR/`

Create individual decision records explaining significant technology and architecture choices.

Each ADR should include:

- Context
- Decision
- Alternatives
- Tradeoffs
- Consequences
- Status

---

## CATEGORY 3 — UI/UX DESIGN

**0/4 completed initially**

### [ ] 15. UI/UX Design Document

File:

`docs/03-ui-ux-design/UI_UX_DESIGN.md`

Include:

- Information architecture
- User personas
- Page inventory
- Navigation patterns
- Accessibility
- Responsive strategy
- Dashboard layout
- Interaction principles
- Empty states
- Loading states
- Error states
- Usability requirements

### [ ] 16. Wireframes & Mockups

Directory:

`docs/03-ui-ux-design/WIREFRAMES/`

Produce wireframes and high-fidelity visual designs for every significant application page.

Include public pages, authentication, contributor dashboard, administrator dashboard, review tools, annotation editor, payments, chat, and settings.

### [ ] 17. User Flow Diagram

File:

`docs/03-ui-ux-design/USER_FLOWS.md`

Include flow diagrams for:

- Registration
- Contributor onboarding
- Dataset upload
- Quality review
- Earnings approval
- Withdrawal
- Payment
- Annotation assignment
- Annotation completion
- Annotation review
- Dataset export
- Support messaging

### [ ] 18. Design System Documentation

File:

`docs/03-ui-ux-design/DESIGN_SYSTEM.md`

Document:

- Brand colors
- Typography
- Khmer text support
- Spacing
- Grid
- Breakpoints
- Buttons
- Forms
- Tables
- Cards
- Modals
- Drawers
- Status badges
- Notifications
- Icons
- Charts
- Accessibility
- Light and dark themes

---

## CATEGORY 4 — BACKEND & API

**0/4 completed initially**

### [ ] 19. API Documentation

File:

`docs/04-backend-api/API_DOCUMENTATION.md`

Describe all endpoints with examples, input validation, pagination, filtering, status codes, permissions, and error responses.

### [ ] 20. OpenAPI Specification

File:

`docs/04-backend-api/openapi.yaml`

Produce a valid OpenAPI specification covering the production API.

Ensure the final implementation matches this specification.

### [ ] 21. Authentication & Authorization Specification

File:

`docs/04-backend-api/AUTH_AUTHORIZATION.md`

Document:

- Registration
- Login
- Email verification
- Password reset
- Session management
- Secure cookies or tokens
- Role-based access
- Resource-level permissions
- Administrative authentication
- Rate limiting
- Account suspension
- Session revocation
- Authorization testing

### [ ] 22. File Upload & Storage Specification

File:

`docs/04-backend-api/FILE_UPLOAD_STORAGE.md`

Include:

- Resumable uploads
- Multipart uploads
- Temporary upload authorization
- File size limits
- Upload quotas
- Allowed formats
- File validation
- Malware scanning
- Content hashing
- Duplicate detection
- Secure object keys
- Preview generation
- Download authorization
- Storage encryption
- Storage lifecycle
- Failure recovery
- Archive security
- Large-file performance

---

## CATEGORY 5 — DATA MANAGEMENT & ANNOTATION

**0/5 completed initially**

### [ ] 23. Dataset Documentation

File:

`docs/05-data-annotation/DATASET_DOCUMENTATION.md`

Include:

- Dataset structure
- Dataset identifiers
- Metadata schema
- Supported document types
- Dataset versioning
- Provenance
- Storage layout
- Language information
- Source information
- Quality status
- Export formats
- Data lineage

### [ ] 24. Data Annotation Guidelines

File:

`docs/05-data-annotation/ANNOTATION_GUIDELINES.md`

Include:

- Annotation principles
- Document transcription
- Khmer Unicode handling
- Text correction
- Metadata labeling
- Document classification
- Bounding boxes where supported
- Annotation examples
- Ambiguous text rules
- Unreadable content handling
- Annotation review
- Quality criteria
- Annotator instructions

### [ ] 25. Data Quality & Review Specification

File:

`docs/05-data-annotation/DATA_QUALITY_REVIEW.md`

Include:

- Data acceptance criteria
- Quality scoring
- Duplicates
- Corrupted files
- Incomplete datasets
- Review workflow
- Partial approval
- Rejection reasons
- Feedback requirements
- Review assignments
- Reviewer permissions
- Correction and resubmission
- Annotation QA
- Audit history

### [ ] 26. Data Privacy, Ownership & Licensing Policy

File:

`docs/05-data-annotation/DATA_PRIVACY_OWNERSHIP.md`

Include:

- Contributor rights declarations
- Dataset licensing
- Allowed uses
- Copyright considerations
- Personal-data protection
- Confidential data restrictions
- Sensitive document handling
- Data access controls
- Consent and lawful processing
- Provenance requirements
- Security obligations
- Dispute and takedown procedures

Draft operational policies but clearly mark clauses requiring qualified legal review before production.

Do not assume purchasing a dataset automatically transfers all intellectual property rights.

### [ ] 27. Data Retention & Deletion Policy

File:

`docs/05-data-annotation/DATA_RETENTION_DELETION.md`

Include:

- Retention periods
- Rejected datasets
- Accepted datasets
- Contributor account deletion
- Legal holds
- Payment records
- Backups
- Secure deletion
- Deletion requests
- Audit evidence
- Storage lifecycle rules

---

## CATEGORY 6 — TESTING & SECURITY

**0/4 completed initially**

### [ ] 28. Test Plan

File:

`docs/06-testing-security/TEST_PLAN.md`

Include:

- Testing strategy
- Unit tests
- Integration tests
- API tests
- End-to-end tests
- Security tests
- Accessibility tests
- Performance tests
- Upload reliability tests
- Disaster recovery tests
- Regression tests
- Release acceptance gates

### [ ] 29. Test Cases & Acceptance Testing

File:

`docs/06-testing-security/TEST_CASES.md`

Provide actual test cases for every important workflow.

Include expected results, failure scenarios, boundary conditions, and links to requirement IDs.

### [ ] 30. Security Requirements Document

File:

`docs/06-testing-security/SECURITY_REQUIREMENTS.md`

Include:

- Authentication security
- Authorization
- Encryption
- Secrets management
- Input validation
- File safety
- Malware scanning
- Web security
- API security
- Logging
- Privacy
- Abuse prevention
- Financial integrity
- Backups
- Incident response
- Dependency security
- Production hardening

### [ ] 31. Threat Modeling Report

File:

`docs/06-testing-security/THREAT_MODEL.md`

Use a structured methodology such as STRIDE.

Analyze:

- Malicious uploads
- Data theft
- Unauthorized downloads
- Account takeover
- Privilege escalation
- Payment fraud
- Duplicate submissions
- Archive attacks
- Injection attacks
- Cross-site scripting
- CSRF
- Broken access control
- Insider abuse
- Data leakage
- Service disruption

Document mitigations, residual risks, and required verification.

---

## CATEGORY 7 — DEPLOYMENT & OPERATIONS

**0/3 completed initially**

### [ ] 32. Deployment Plan

File:

`docs/07-deployment-operations/DEPLOYMENT_PLAN.md`

Include:

- Environment strategy
- Development environment
- Staging environment
- Production environment
- Infrastructure requirements
- Domain and DNS
- HTTPS
- Database provisioning
- Storage provisioning
- Deployment steps
- Migration strategy
- Monitoring
- Health checks
- Release verification
- Rollback procedure

### [ ] 33. Docker & CI/CD Documentation

File:

`docs/07-deployment-operations/DOCKER_CICD.md`

Document:

- Dockerfiles
- Docker Compose
- Environment variables
- Development setup
- Production container configuration
- Build pipeline
- Test pipeline
- Security scanning
- Deployment pipeline
- Secrets handling
- Release tagging
- Rollback process

### [ ] 34. Backup & Disaster Recovery Plan

File:

`docs/07-deployment-operations/BACKUP_DISASTER_RECOVERY.md`

Include:

- Database backups
- Object storage protection
- Recovery procedures
- Backup encryption
- Backup retention
- Restore testing
- Recovery point objective
- Recovery time objective
- Incident procedures
- Data integrity verification

---

## CATEGORY 8 — USER DOCUMENTATION

**0/1 completed initially**

### [ ] 35. README & Developer Setup Guide

File:

`README.md`

Include:

- Product overview
- Technology stack
- Architecture summary
- Prerequisites
- Local development
- Environment setup
- Docker commands
- Database migrations
- Test commands
- Frontend startup
- Backend startup
- Worker startup
- Production deployment instructions
- Troubleshooting
- Documentation links
- Security notes

Also produce concise operating guides for administrators, contributors, annotators, and reviewers as supplementary documentation.

---

# PART 6 — REQUIRED TECHNICAL ARCHITECTURE

Use the following technology stack unless a significant technical reason justifies an alternative.

Document any changes.

## Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Lucide icons
- React Hook Form
- Zod
- Recharts
- TanStack Query
- PDF.js
- Appropriate state management

## Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis
- Celery or an equivalently reliable task queue

## Storage

Use S3-compatible object storage.

Supported environments may include:

- AWS S3
- Cloudflare R2
- MinIO
- Another suitable compatible provider

Use private buckets.

Support multipart/resumable uploads, temporary upload authorization, and expiration-controlled downloads.

## Messaging

Use durable message persistence and WebSockets or another appropriate realtime transport.

## Infrastructure

- Docker
- Docker Compose for local development
- Production container hosting
- CI/CD pipeline
- TLS/HTTPS
- Secrets management
- Monitoring and error tracking
- Automated database migrations
- Database backups
- Object storage protection

Select a production hosting strategy based on operational complexity, expected usage, reliability, and cost.

Do not introduce Kubernetes unless there is a justified operational requirement.

## Architectural approach

Prefer a modular monolith for the first production version.

Organize modules with clear boundaries.

Design for future scale without introducing unnecessary distributed-system complexity.

---

# PART 7 — DATABASE IMPLEMENTATION

Design and implement a normalized PostgreSQL schema.

At minimum, include entities for:

## Identity

- users
- user_profiles
- roles
- user_roles
- user_sessions
- email_verifications
- contributor_verifications
- security_events

## Datasets

- datasets
- dataset_files
- dataset_versions
- dataset_metadata
- dataset_reviews
- dataset_file_reviews
- dataset_licenses
- dataset_quality_scores
- dataset_duplicates
- upload_sessions

## Annotation

- annotation_projects
- annotation_tasks
- annotation_assignments
- annotations
- annotation_versions
- annotation_reviews
- annotation_feedback
- annotation_rewards

## Financial

- wallets
- wallet_transactions
- earning_records
- pricing_rules
- payout_requests
- payout_approvals
- payout_records
- payout_adjustments

## Communication

- conversations
- conversation_participants
- messages
- message_attachments
- notifications

## Operations

- audit_logs
- export_jobs
- export_files
- system_settings
- background_job_records

Modify or consolidate tables if justified in the design documents.

## Database requirements

- UUID or otherwise robust identifiers
- Foreign key constraints
- Unique constraints
- Appropriate indexes
- Consistent timestamps
- Transactional integrity
- Migration scripts
- No untracked manual schema changes
- Idempotent financial operations
- Concurrency-safe approvals
- Safe account deletion/retention rules

Money must use exact decimal accounting or integer minor units.

Never use floating-point arithmetic for financial balances.

Do not allow the same approval action to credit a contributor twice.

---

# PART 8 — REQUIRED FRONTEND PAGES

Implement a complete, responsive, polished application.

## Public pages

1. Home / Landing
2. How It Works
3. Pricing
4. Supported Data Types
5. Contact / Help
6. Terms of Service
7. Privacy Policy
8. Contributor Agreement

## Authentication pages

9. Login
10. Registration
11. Email Verification
12. Forgot Password
13. Reset Password
14. Contributor Onboarding

## Contributor pages

15. Contributor Dashboard
16. Upload Dataset
17. Upload Progress
18. My Datasets
19. Dataset Details
20. Earnings
21. Withdrawals
22. Withdrawal Details
23. Messages
24. Notifications
25. Profile
26. Account Settings

## Administrator pages

27. Admin Dashboard
28. User Management
29. User Details
30. Contributor Verification
31. All Datasets
32. Dataset Details
33. Dataset Review Workspace
34. Review Queue
35. Annotation Projects
36. Create Annotation Project
37. Annotation Project Details
38. Annotation Assignments
39. Annotation Review Queue
40. Payment Overview
41. Payout Requests
42. Payout Details
43. Pricing Management
44. Admin Messaging
45. Dataset Export Center
46. Analytics
47. Audit Logs
48. System Settings

## Annotator pages

49. Annotator Dashboard
50. My Annotation Tasks
51. Annotation Task Details
52. Annotation Editor
53. Submitted Tasks
54. Annotation Feedback
55. Annotation Earnings

## Reviewer pages

56. Reviewer Dashboard
57. Dataset Review Tasks
58. Annotation Review Tasks
59. Annotation Comparison
60. Review History

## Global application views

61. Unauthorized / Access Denied
62. Not Found
63. Server Error
64. Maintenance / Service Unavailable

Pages may share components and layouts, but all essential routes and experiences must be implemented.

Use real backend data in the production application.

Do not substitute permanent mock data for working backend integrations.

---

# PART 9 — COMPLETE DATASET UPLOAD SYSTEM

Build a real upload system suitable for large document datasets.

## Upload capabilities

- Multiple files
- Folder uploads where supported
- Drag and drop
- ZIP archives
- Resumable transfers
- Upload cancellation
- Retry failed transfers
- Individual file progress
- Overall progress
- Upload speed
- Upload completion confirmation
- Dataset metadata entry
- Original filename preservation in metadata
- Safe server-generated storage keys

## Upload processing

The backend must:

1. Authorize the upload.
2. Validate file size and type.
3. Enforce quotas.
4. Store files privately.
5. Compute secure hashes.
6. Scan for malware.
7. Detect exact duplicates.
8. Detect or flag probable near-duplicates.
9. Generate previews safely.
10. Extract appropriate metadata.
11. Register the dataset in the database.
12. Mark the dataset ready for review.

Handle uploads that fail halfway through.

Clean up abandoned upload sessions according to a documented retention policy.

Never rely only on file extensions to determine file type.

For ZIP files, prevent archive traversal, decompression bombs, and unsafe extraction.

---

# PART 10 — DATASET REVIEW SYSTEM

Implement the complete review workflow.

Supported decisions:

- Approve
- Partially approve
- Reject
- Request changes

The admin/reviewer workspace should support:

- Document preview
- File navigation
- Dataset metadata
- Duplicate warnings
- Quality checklist
- Accepted size
- Rejected size
- Review comments
- Review history
- Contributor feedback
- Final payable amount

Support partial approval at the file level.

Ensure that only approved, eligible data contributes to earnings.

Use explicit status transitions and preserve review history.

Implement safe, idempotent approval processing.

---

# PART 11 — EARNINGS AND PAYMENT SYSTEM

Build a complete financial management system.

## Earnings calculation

Raw:

accepted_raw_bytes / 1,000,000,000 × 1.00 USD

Labeled:

accepted_labeled_bytes / 1,000,000,000 × 1.50 USD

Use explicit decimal rounding and documented precision rules.

Maintain separate values for:

- Estimated earnings
- Pending earnings
- Approved earnings
- Available balance
- Reserved payout balance
- Paid amount
- Adjustments

## Financial architecture

Use an append-only financial ledger.

Prefer balanced ledger entries or an equivalent rigorously controlled accounting model.

All earning and payout changes must be traceable to their source events.

A dataset approval must not create duplicate earnings when retried.

Concurrent withdrawal requests must not spend the same available balance twice.

## Manual payouts

Workflow:

1. Contributor requests withdrawal.
2. System checks available balance and payout eligibility.
3. Amount is reserved.
4. Admin reviews request.
5. Admin approves or rejects.
6. Admin performs external payment manually.
7. Admin enters the payment reference.
8. Admin attaches proof if required.
9. System records the final transaction.
10. Contributor receives notification.

Include error recovery, failed payments, cancellation, audit trails, and administrative corrections.

Do not mark a payment as paid until an authorized administrator confirms the external transfer.

Do not automatically initiate financial transfers in the initial release.

---

# PART 12 — ANNOTATION MANAGEMENT

Build a fully functional annotation system.

## Annotation project management

Admin can:

- Create projects
- Choose source datasets
- Set project instructions
- Select annotation types
- Divide documents into tasks
- Assign annotators
- Set deadlines
- Configure task rewards
- Monitor progress
- Reassign tasks
- Review submissions
- Close projects

## Annotation editor

Design a professional, three-panel workspace.

### Left panel

- File/page navigation
- Assigned tasks
- Progress
- Instructions

### Center panel

- Document preview
- Zoom
- Pan
- Page navigation
- Rotation where appropriate
- Text-region selection where supported

### Right panel

- Text transcription
- Correction editor
- Metadata fields
- Classification labels
- Annotation notes
- Reviewer comments

### Editor features

- Autosave
- Save status
- Undo/redo where supported
- Draft recovery
- Keyboard shortcuts
- Validation
- Submission
- Corrections
- Version history
- Khmer Unicode compatibility

## Annotation lifecycle

Assigned → In Progress → Submitted → In Review → Approved or Changes Requested.

Ensure work cannot be overwritten accidentally by concurrent users.

Use task locking or conflict detection as appropriate.

## Annotation review

Reviewer can:

- Open source document
- Inspect transcription
- Compare versions
- Review labels
- Add comments
- Approve annotations
- Request corrections

Approved annotations must be exportable with their corresponding source files.

## Annotation payment

Keep annotation labor compensation separate from the dataset purchase price.

Support configurable per-task or per-page rewards.

Record approvals and earning events exactly once.

---

# PART 13 — MESSAGING AND NOTIFICATIONS

Build real persistent messaging.

## Messaging

Support:

- Contributor-to-admin chat
- Admin support inbox
- Dataset-linked conversations
- Message history
- Read/unread status
- Attachments subject to security policies
- Message timestamps
- Conversation search
- Conversation status
- Authorized participants

## Notifications

Send in-app notifications for:

- Email verified
- Contributor approved
- Dataset received
- Dataset processing finished
- Dataset approved
- Dataset rejected
- Changes requested
- Earnings credited
- Withdrawal requested
- Withdrawal approved
- Payment recorded
- Annotation assigned
- Annotation returned for correction
- Annotation approved
- New support message

Provide email notifications for important events using a properly configured provider.

Do not require users to keep the browser open to receive important email notifications.

---

# PART 14 — DATASET EXPORT SYSTEM

Build an admin-controlled export workspace.

Support:

- Selecting datasets
- Filtering by category
- Filtering by language
- Filtering by quality
- Selecting raw or labeled data
- Including metadata
- Including annotations
- Choosing export format
- Preparing ZIP packages
- Tracking export progress
- Downloading completed exports

Exports must be background jobs.

Large datasets must not block the main API server.

Export files should have an expiration and retention policy.

Log who exported the data, when, and which datasets were included.

Never expose private exports through permanent public links.

---

# PART 15 — UI/UX QUALITY

Create a premium enterprise SaaS interface.

Visual references:

- Linear
- Vercel
- Notion
- Stripe Dashboard
- Supabase
- Figma

Use them as general quality inspiration, not as designs to copy.

## Design goals

- Clean
- Modern
- Elegant
- Professional
- Responsive
- Accessible
- Consistent
- Fast
- Easy to learn

Support desktop, tablet, and mobile.

Use a sidebar layout for authenticated workspaces.

Use professional tables for data-intensive administration.

Use charts where useful.

Support light and dark themes.

Ensure the annotation editor is optimized for desktop work.

Use helpful feedback for loading, empty, error, and success states.

Validate forms properly.

Provide confirmation dialogs for destructive or financial actions.

Implement keyboard accessibility and sensible focus behavior.

The application must look and behave like a real commercial product.

---

# PART 16 — SECURITY AND DATA PROTECTION

Security is mandatory.

Implement defense-in-depth.

## Authentication and sessions

- Secure password hashing where passwords are managed locally
- Email verification
- Password reset
- Secure session handling
- Session expiration
- Session revocation
- Administrator MFA
- Rate limiting
- Account lockout/abuse protection

## Authorization

- Role-based access control
- Resource-level permissions
- Dataset ownership checks
- Task assignment checks
- Administrative scope enforcement
- Financial permission checks
- Export authorization

## File security

- Private storage
- File-type verification
- Malware scanning
- Safe previews
- Archive extraction limits
- File size limits
- Upload quotas
- Signed temporary URLs
- Encryption in transit
- Encryption at rest
- No execution of uploaded content

## API and application security

- Input validation
- Injection prevention
- XSS prevention
- CSRF protection where relevant
- Secure headers
- CORS restrictions
- Secrets management
- Dependency scanning
- Audit logging
- Abuse prevention

## Data ownership

Contributors must declare that they have appropriate rights to submit and license their documents.

Do not assume a document is lawful to purchase simply because it was uploaded.

Flag sensitive, confidential, copyrighted, or personal information for appropriate review.

Implement takedown and deletion workflows.

Identify legal and regulatory obligations that require professional verification for the target jurisdictions before public launch.

---

# PART 17 — PERFORMANCE AND RELIABILITY

Design for an initial production workload, with clear growth options.

Propose measurable targets for:

- Concurrent users
- Dataset volume
- File sizes
- API latency
- Upload completion reliability
- Background job throughput
- Availability
- Recovery time
- Recovery point

Use reasonable initial assumptions and document them.

## Required practices

- Database indexing
- Pagination
- Efficient queries
- Streaming downloads
- Direct-to-object-storage uploads
- Background processing
- Retry policies
- Idempotent jobs
- Timeouts
- Health checks
- Structured logging
- Metrics
- Error tracking
- Storage lifecycle management

Load-test realistic operations before production.

---

# PART 18 — IMPLEMENTATION STRUCTURE

Use a maintainable monorepo.

Recommended structure:

```text
datahub/
├── apps/
│   ├── web/
│   └── api/
├── packages/
│   └── shared/
├── infrastructure/
│   ├── docker/
│   ├── deployment/
│   └── monitoring/
├── docs/
│   ├── 01-business-product/
│   ├── 02-system-architecture/
│   ├── 03-ui-ux-design/
│   ├── 04-backend-api/
│   ├── 05-data-annotation/
│   ├── 06-testing-security/
│   ├── 07-deployment-operations/
│   └── 08-user-documentation/
├── scripts/
├── tests/
├── .github/
│   └── workflows/
├── compose.yaml
├── .env.example
├── README.md
└── LICENSE
```

Adapt the exact structure when justified.

Keep application modules cohesive and decoupled.

Use consistent naming.

Implement database migrations.

Generate and validate API schemas.

Provide seed data only for development or staging.

Never deploy test identities, sample credentials, or fictional financial records as real production data.

---

# PART 19 — DEVELOPMENT EXECUTION PHASES

After the documentation gate has passed, implement the application in this order.

## PHASE A — Foundation

- Initialize repository.
- Configure frontend.
- Configure backend.
- Configure PostgreSQL.
- Configure Redis.
- Configure object storage.
- Configure migrations.
- Configure development environment.
- Configure logging.
- Configure authentication foundation.

Acceptance gate: all services start and communicate correctly.

## PHASE B — Identity and roles

- Registration
- Login
- Email verification
- Password reset
- Contributor profiles
- Contributor verification
- Role management
- Administrative security

Acceptance gate: permissions are enforced by the API.

## PHASE C — Dataset upload

- Upload interface
- Resumable transfers
- Dataset metadata
- Storage integration
- Validation
- File processing
- Malware scanning
- Duplicate detection
- Document previews

Acceptance gate: real files can be uploaded, processed, and securely retrieved.

## PHASE D — Dataset review

- Review queue
- Admin review workspace
- Partial approval
- Rejection
- Correction requests
- Review feedback
- Review history

Acceptance gate: accepted and rejected sizes are calculated correctly.

## PHASE E — Earnings and payments

- Pricing rules
- Financial ledger
- Earnings calculation
- Wallet dashboard
- Withdrawals
- Admin payment management
- Transaction audit history

Acceptance gate: financial operations are correct, atomic, and idempotent.

## PHASE F — Annotation

- Projects
- Task assignment
- Annotation editor
- Autosave
- Submission
- Review
- Corrections
- Version history
- Task rewards

Acceptance gate: a real document can be assigned, annotated, reviewed, and exported.

## PHASE G — Communication and exports

- Messaging
- Notifications
- Export jobs
- Export history
- Admin dataset search
- Operational analytics

Acceptance gate: users can communicate, and admins can securely export approved data.

## PHASE H — Production hardening

- Security testing
- Performance testing
- Accessibility testing
- Reliability testing
- Backup testing
- Disaster recovery testing
- Deployment validation

Acceptance gate: documented release criteria are satisfied.

---

# PART 20 — TESTING REQUIREMENTS

Write automated tests throughout implementation.

Do not wait until the end.

## Backend tests

Test:

- Registration
- Authentication
- Permissions
- Contributor verification
- Dataset creation
- Upload authorization
- File validation
- Malware rejection
- Duplicate detection
- Review transitions
- Partial approval
- Earnings calculation
- Double-credit prevention
- Concurrent withdrawals
- Payout lifecycle
- Annotation assignments
- Annotation reviews
- Message authorization
- Export authorization

## Frontend tests

Test:

- Navigation
- Forms
- Validation
- Responsive components
- Dataset tables
- Upload interactions
- Review controls
- Annotation editor
- Withdrawal forms
- Error states
- Accessibility

## End-to-end tests

Use Playwright or an appropriate equivalent.

Implement complete real workflows.

### Scenario 1

Register → Verify → Upload → Review → Approve → Earnings.

### Scenario 2

Contributor requests payout → Admin approves → Admin records external payment → Contributor sees transaction.

### Scenario 3

Admin assigns document → Annotator transcribes → Reviewer approves → Admin exports.

### Scenario 4

User attempts unauthorized access to another contributor's dataset → Access denied.

### Scenario 5

Contributor uploads duplicate content → Duplicate is flagged and cannot automatically earn a second payment.

### Scenario 6

Large upload disconnects → Upload resumes without corrupting the dataset.

### Scenario 7

A repeated earnings approval request does not create duplicate wallet transactions.

### Scenario 8

Database backup is restored in an isolated environment and integrity is verified.

All critical tests must pass before declaring production readiness.

---

# PART 21 — DOCKER AND LOCAL DEVELOPMENT

Provide a reproducible local development environment.

Docker Compose should configure appropriate services such as:

- frontend
- backend
- PostgreSQL
- Redis
- background worker
- object storage
- malware scanning service
- supporting services where required

Use health checks.

Use persistent volumes where appropriate.

Provide `.env.example`.

Never commit real credentials.

Provide clear commands for:

- Starting the environment
- Stopping the environment
- Running migrations
- Running tests
- Viewing logs
- Creating initial administrator account securely
- Running background workers
- Accessing development documentation

Avoid conflicting default ports.

Make configuration explicit.

---

# PART 22 — CI/CD

Create an automated development pipeline.

At minimum:

1. Check formatting.
2. Run linters.
3. Run type checks.
4. Run unit tests.
5. Run integration tests.
6. Validate database migrations.
7. Validate OpenAPI specification.
8. Scan dependencies.
9. Build frontend.
10. Build backend/container images.
11. Run appropriate security checks.
12. Produce versioned build artifacts.

For releases:

- Deploy to staging.
- Run smoke tests.
- Run end-to-end tests.
- Require production approval.
- Deploy versioned artifacts.
- Execute safe migrations.
- Run production health checks.
- Monitor post-deployment errors.
- Support rollback.

Never automatically deploy unreviewed changes to production.

---

# PART 23 — PRODUCTION DEPLOYMENT

The goal is a real, publicly accessible DataHub application.

Prepare production deployment using an appropriate cloud or server environment.

You must:

1. Recommend a sensible infrastructure provider.
2. Explain monthly cost assumptions.
3. Configure production application services.
4. Configure the database.
5. Configure storage.
6. Configure workers.
7. Configure email delivery.
8. Configure HTTPS.
9. Configure domain routing.
10. Configure secrets.
11. Configure monitoring.
12. Configure backups.
13. Configure firewall and network restrictions.
14. Configure health checks.
15. Verify production functionality.
16. Provide rollback instructions.
17. Provide an operations handover.

If deployment access and approval are available, execute the approved deployment steps.

If they are not available, finish the deployment automation and provide the exact remaining deployment checklist.

Do not claim that the application is live unless an actual deployment has succeeded and been verified.

---

# PART 24 — MONITORING AND OPERATIONS

Implement operational observability.

Track:

- API errors
- Request latency
- Database health
- Worker failures
- Queue backlog
- Upload failures
- Storage usage
- Export failures
- Failed notifications
- Authentication anomalies
- Payment workflow errors
- Application availability

Provide dashboards or clear instructions for configuring them.

Set up actionable alerts for serious failures.

Do not log passwords, session tokens, private document contents, or payment secrets.

Write runbooks for:

- Service outage
- Database connection failure
- Failed upload processing
- Stuck annotation task
- Wallet reconciliation problem
- Failed export
- Storage capacity warning
- Security incident
- Backup restoration

---

# PART 25 — RELEASE READINESS CRITERIA

Before declaring DataHub production-ready, verify all of the following.

## Documentation

- All 35 required documents are complete.
- Documents reflect the implemented system.
- Architecture is consistent.
- Requirements are traceable.
- Policies requiring human approval are identified.
- Outstanding critical decisions are resolved.

## Product

- Registration works.
- Authentication works.
- Contributor verification works.
- Dataset upload works.
- Dataset review works.
- Earnings are calculated correctly.
- Manual payout management works.
- Annotation editor works.
- Annotation assignment works.
- Annotation review works.
- Messaging works.
- Dataset export works.
- Admin tools work.

## Quality

- Critical automated tests pass.
- No unresolved release-blocking bugs.
- Authorization tests pass.
- Financial integrity tests pass.
- Large upload tests pass.
- Responsive UI is verified.
- Accessibility checks are performed.

## Security

- Production secrets are secure.
- HTTPS is configured.
- Private datasets are protected.
- File scanning is functional.
- Administrative permissions are enforced.
- Data ownership policies have received required approval.
- Security testing has been completed.
- Critical vulnerabilities have been remediated.

## Infrastructure

- Production infrastructure is configured.
- Database migrations succeed.
- Application health checks pass.
- Backups are configured.
- Restore tests pass.
- Monitoring and alerts work.
- Rollback procedures are documented.
- Deployment has been smoke-tested.

## Real-world verification

Verify with controlled test accounts and clearly marked test data.

Do not send actual money as part of testing.

Do not claim a real payout succeeded without confirmation.

Only report the application as live when the production URL has been tested successfully.

---

# PART 26 — HANDOVER REQUIREMENTS

At the end, provide:

1. Git repository structure.
2. All completed documentation.
3. Complete frontend source.
4. Complete backend source.
5. Database migrations.
6. Infrastructure configuration.
7. Docker files.
8. CI/CD workflows.
9. Automated tests.
10. Deployment configuration.
11. Environment variable reference.
12. Admin setup instructions.
13. Contributor user guide.
14. Annotator user guide.
15. Reviewer user guide.
16. API documentation.
17. Security notes.
18. Backup/restore instructions.
19. Production URL, only if deployed and verified.
20. Final production readiness report.

Produce an accurate final checklist that distinguishes:

- Completed and verified
- Implemented but not verified
- Blocked by missing external access
- Awaiting approval
- Not completed

Never invent completion.

---

# PART 27 — DOCUMENTATION CHECKLIST

Initialize the project with this checklist.

## 1. Business & Product — 0/6

- [ ] Business Requirements Document (BRD)
- [ ] Product Requirements Document (PRD)
- [ ] Software Requirements Specification (SRS)
- [ ] Product Roadmap
- [ ] User Stories & Acceptance Criteria
- [ ] Pricing and Payout Policy

## 2. System Architecture — 0/8

- [ ] Software Architecture Document (SAD)
- [ ] High-Level Design (HLD)
- [ ] Low-Level Design (LLD)
- [ ] System Design Document (SDD)
- [ ] Entity Relationship Diagram (ERD)
- [ ] Database Schema Documentation
- [ ] Data Flow Diagram (DFD)
- [ ] Architecture Decision Records (ADR)

## 3. UI/UX Design — 0/4

- [ ] UI/UX Design Document
- [ ] Wireframes & Mockups
- [ ] User Flow Diagram
- [ ] Design System Documentation

## 4. Backend & API — 0/4

- [ ] API Documentation
- [ ] OpenAPI Specification
- [ ] Authentication & Authorization Specification
- [ ] File Upload & Storage Specification

## 5. Data Management & Annotation — 0/5

- [ ] Dataset Documentation
- [ ] Data Annotation Guidelines
- [ ] Data Quality & Review Specification
- [ ] Data Privacy, Ownership & Licensing Policy
- [ ] Data Retention & Deletion Policy

## 6. Testing & Security — 0/4

- [ ] Test Plan
- [ ] Test Cases & Acceptance Testing
- [ ] Security Requirements Document
- [ ] Threat Modeling Report

## 7. Deployment & Operations — 0/3

- [ ] Deployment Plan
- [ ] Docker & CI/CD Documentation
- [ ] Backup & Disaster Recovery Plan

## 8. User Documentation — 0/1

- [ ] README & Developer Setup Guide

**TOTAL: 0/35**

Update the completed count only after verifying each deliverable.

Never reset genuine completed progress simply because a new session begins.

Reconstruct the checklist from the repository whenever continuing a previous session.

---

# PART 28 — CONTINUATION AND CONTEXT MANAGEMENT

This project may require multiple working sessions.

You must maintain continuity through the repository, not only through conversational memory.

Before ending any working session:

- Save relevant changes.
- Update PROJECT_STATUS.md.
- Record unfinished tasks.
- Record blockers.
- Record important decisions.
- Record verification results.
- Identify the exact next step.

When resuming:

1. Inspect the repository.
2. Read PROJECT_STATUS.md.
3. Read relevant design documents.
4. Inspect existing code.
5. Determine actual completed work.
6. Continue from the last verified milestone.

Do not restart the project unnecessarily.

Do not overwrite functioning implementation without a justified reason.

Do not claim that work will continue asynchronously after the session ends unless an actual supported automation or development process is running.

---

# PART 29 — FINAL INSTRUCTIONS

You are responsible for producing a coherent, production-quality product.

Think like a CTO and engineering team building software for real customers.

Your standards should be significantly higher than those of a demonstration project.

Prioritize correct business logic, security, operational reliability, and data integrity over unnecessary visual effects.

Do not cut security requirements to accelerate development.

Do not implement complex infrastructure without justification.

Make sensible decisions, explain important tradeoffs, and write code that another engineering team can maintain.

If a feature is incomplete, identify it clearly.

If a test fails, investigate and fix the underlying issue.

If documentation conflicts with implementation, reconcile the inconsistency.

If production deployment requires external approval or credentials, identify exactly what is missing and prepare everything else.

**The ultimate objective is a real DataHub platform where actual contributors can register, upload authorized documents, receive feedback, earn money for approved datasets, request manual payouts, and perform assigned annotation work, while administrators securely manage the entire operation.**

---

# START NOW

Begin with **PHASE 0: REQUIREMENTS ANALYSIS AND DOCUMENTATION**.

Your first actions must be:

1. Inspect the current repository, if one exists.
2. Determine whether this is a new or existing implementation.
3. Create the documentation directory structure.
4. Create PROJECT_STATUS.md.
5. Initialize the 35-document checklist at 0/35 unless verified documents already exist.
6. Identify material requirement ambiguities.
7. Record assumptions and decisions.
8. Write the Business Requirements Document.
9. Continue creating the remaining mandatory documents in dependency order.
10. Review the documentation set for consistency.

**DO NOT BEGIN IMPLEMENTING THE APPLICATION BEFORE THE DOCUMENTATION BASELINE IS COMPLETE.**

After the documentation baseline has passed its quality checks, continue into implementation, automated testing, security hardening, staging deployment, and production preparation according to the defined phases.

Maintain accurate progress throughout the project.

Do not ask me to repeat business requirements already provided in this prompt.

Deliver the complete product to the fullest extent permitted by the available environment, access, approvals, and execution capabilities.

**START WITH DOCUMENTATION FIRST.**