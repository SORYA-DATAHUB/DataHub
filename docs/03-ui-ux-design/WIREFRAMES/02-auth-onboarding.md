# Wireframes 02 — Authentication & onboarding

| Field | Value |
|---|---|
| Document | #16 Wireframes — part 02 (auth & onboarding) |
| Version | v1.0 · 2026-10-26 · Baseline |
| Pages | #9–#14 |

**Purpose.** Layout of sign-in, registration, email verification, password recovery and the contributor onboarding stepper. **Scope.** `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password`, `/onboarding`. **Assumptions.** Auth layout = centered 440 px card on `background`, logo above, theme toggle top-right, legal links below; onboarding uses a wider 720 px card with a stepper. **Decisions.** No social login in v1; password rules: ≥ 12 characters, checked against a breached-password list server-side; MFA step on the same route (`?step=mfa`); forgot-password always shows the same confirmation (no account enumeration). **Dependencies.** Baseline §3 (sessions, CSRF, MFA), §9 (users.status), A-08/A-09; USER_FLOWS §1–§2. **Acceptance criteria.** All fields have visible labels and correct `autocomplete`; paste allowed in password/OTP; errors announced; layouts work at 320 px.

---

## #9 Login — `/login`

```
                         ┌───────────────────────────────────────────┐
                         │                ▤ DataHub                  │
                         │                                           │
                         │  Log in                                   │
                         │                                           │
                         │  Email                                    │
                         │  {name@example.com.......................}│
                         │  Password                    Forgot it?   │
                         │  {•••••••••••••••••••••••••••••••••••• 👁}│
                         │                                           │
                         │  [            Log in                     ]│
                         │                                           │
                         │  New to DataHub?  Create an account       │
                         └───────────────────────────────────────────┘
                           Terms · Privacy · Help              ◐ Theme

 Error (401): inline Alert above button: "Email or password is incorrect."
 Rate limited (429): "Too many attempts. Try again in 58 s." (live countdown, button disabled)
 Suspended: "This account is suspended. Contact support via the Help page."
```

### #9 Login — MFA step `/login?step=mfa` (admin / super_admin, or users with MFA enabled)

```
                         ┌───────────────────────────────────────────┐
                         │  ⛨ Two-step verification                 │
                         │  Enter the 6-digit code from your         │
                         │  authenticator app.                       │
                         │                                           │
                         │  Code                                     │
                         │  { _  _  _  _  _  _ }  (one input,        │
                         │   autocomplete=one-time-code, inputmode=  │
                         │   numeric, paste fills all)               │
                         │                                           │
                         │  [            Verify                     ]│
                         │  Use a recovery code instead              │
                         │  ← Back to log in                         │
                         └───────────────────────────────────────────┘
```

## #10 Registration — `/register`

```
                         ┌───────────────────────────────────────────┐
                         │  Create your account                      │
                         │  Contribute data and get paid for what    │
                         │  we accept.                               │
                         │                                           │
                         │  Display name                             │
                         │  {.......................................}│
                         │  Email                                    │
                         │  {.......................................}│
                         │  Password                                 │
                         │  {.......................................}│
                         │  ▓▓▓▓▓▓▓▓░░░░ Strong · 14 characters      │
                         │  At least 12 characters. Avoid passwords  │
                         │  you use elsewhere.                       │
                         │                                           │
                         │  [x] I agree to the Terms of Service and  │
                         │      Privacy Policy (links open new tab)  │
                         │                                           │
                         │  [          Create account               ]│
                         │                                           │
                         │  Already have an account?  Log in         │
                         └───────────────────────────────────────────┘
 After submit → /verify-email ("Check your inbox"), regardless of whether the email existed.
```

## #11 Email Verification — `/verify-email`

```
 State A — no token (after register / pending_email login)
                         ┌───────────────────────────────────────────┐
                         │            ✉  (48px icon)                 │
                         │  Check your inbox                         │
                         │  We sent a verification link to           │
                         │  s•••••@gmail.com. It expires in 24 h.    │
                         │                                           │
                         │  [ Resend email ]  (disabled 60 s:        │
                         │                     "Resend in 0:42")     │
                         │  Wrong email? Log out and register again  │
                         └───────────────────────────────────────────┘

 State B — ?token=… verifying      → skeleton + "Verifying your email…"
 State C — success                 → ✓ "Email verified" [Continue to onboarding]
 State D — expired/invalid token   → ⚠ "This link has expired or was already used."
                                     [Send a new link] (needs session) / [Log in]
```

## #12 Forgot Password — `/forgot-password`

```
                         ┌───────────────────────────────────────────┐
                         │  Reset your password                      │
                         │  Email                                    │
                         │  {.......................................}│
                         │  [        Send reset link                ]│
                         │  ← Back to log in                         │
                         └───────────────────────────────────────────┘
 Submitted: "If an account exists for that email, we've sent a link. It expires in 1 hour."
```

## #13 Reset Password — `/reset-password?token=…`

```
                         ┌───────────────────────────────────────────┐
                         │  Choose a new password                    │
                         │  New password                             │
                         │  {.......................................}│
                         │  ▓▓▓▓▓▓▓▓▓░░░ Strong                      │
                         │  Confirm new password                     │
                         │  {.......................................}│
                         │  [          Update password              ]│
                         │  All other sessions will be signed out.   │
                         └───────────────────────────────────────────┘
 Success → "Password updated" + [Log in].  Invalid token → State D pattern from #11.
```

## #14 Contributor Onboarding — `/onboarding`

Stepper header shared by all steps (desktop horizontal, mobile "Step 2 of 4" + progress bar):

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ▤ DataHub                                         Finish later →   ◐  (SM)   │
├──────────────────────────────────────────────────────────────────────────────┤
│  ① Profile ──── ② Agreement ──── ③ Rights ──── ④ Verification (optional)     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Step 1 — Profile `?step=profile`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Tell us about you                                                            │
│ Used for payments and identity checks. Only DataHub staff can see it.        │
│                                                                              │
│ Legal name (as on your ID)            Display name                           │
│ {Sophea Chan.................}        {Sophea.........................}      │
│ Legal name in Khmer (optional)                                               │
│ {ចាន់ សុភា.........................................................}  (lang=km)│
│ Country                               Phone                                  │
│ [Cambodia ▾]                          [+855 ▾] {12 345 678.............}     │
│ Date of birth                         Preferred content languages            │
│ {DD}/{MM}/{YYYY}  (must be 18+)       [x] Khmer  [x] English  [ ] Other      │
│                                                                              │
│                                                           [Continue →]       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Step 2 — Contributor Agreement `?step=agreement`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Contributor Agreement · Version 1.0                     [Open full page ↗]   │
│ ┌──────────────────────────────────────────────────────────────────────────┐ │
│ │ Summary (plain language)                                                 │ │
│ │ • You keep ownership. You grant SKAI a perpetual, worldwide, non-        │ │
│ │   exclusive licence to accepted data once it is paid.                    │ │
│ │ • We only pay for accepted, unique, eligible files.                      │ │
│ │ • Don't upload data you don't have rights to, or personal data of others │ │
│ │   without consent.                                                       │ │
│ ├──────────────────────────────────────────────────────────────────────────┤ │
│ │ Full text (scroll area, 360px, keyboard-scrollable, tabindex=0)          │ │
│ │ 1 Definitions …                                                          │ │
│ │ …                                                              ▼ end     │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│ [ ] I have read and accept the Contributor Agreement v1.0                    │
│     (enabled after the full text has been scrolled to the end OR             │
│      "Open full page" was opened)                                            │
│ ← Back                                                     [Continue →]      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Step 3 — Rights declaration `?step=rights`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Confirm your rights                                                          │
│ Each statement is required.                                                  │
│ [ ] I own the data I upload or have permission to license it.                │
│ [ ] My uploads don't include other people's personal data without consent.   │
│ [ ] I won't upload malware, illegal content, or files I've already been      │
│     paid for elsewhere on DataHub.                                           │
│ [ ] I understand payment happens only after review and acceptance.           │
│                                                                              │
│ ← Back                                         [Accept and finish setup]     │
└──────────────────────────────────────────────────────────────────────────────┘
 On success (POST /me/onboarding): inline success panel "You can now upload datasets."
 → continues to Step 4.
```

### Step 4 — Verification (optional now) `?step=verification`

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Get verified to withdraw earnings                     [Skip for now]         │
│ Verification is required before you can withdraw money or receive            │
│ annotation work. Uploading doesn't need it.                                  │
│                                                                              │
│ Payout method                                                                │
│ (•) ABA Pay   ( ) Bank transfer   ( ) Wise   ( ) PayPal   ( ) Other          │
│ Account name {Sophea Chan.............}  ABA account no. {000 123 456.....}   │
│                                                                              │
│ Identity document (optional, speeds up review)                               │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐      │
│   Drop a photo or PDF of your national ID or passport   [Choose file]        │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘      │
│ [x] The details in my profile are correct.                                   │
│                                                                              │
│ ← Back                                      [Submit for verification]        │
└──────────────────────────────────────────────────────────────────────────────┘
 Done → /dashboard with Alert "Verification pending — usually reviewed within 2 business days."
```
