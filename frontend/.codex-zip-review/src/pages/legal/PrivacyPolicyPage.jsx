import React from 'react'
import LegalPageLayout from '../../components/legal/LegalPageLayout'
import {
  Shield,
  Database,
  Eye,
  Share2,
  Lock,
  UserCheck,
  Cookie,
  AlertTriangle,
  RefreshCw,
  Mail,
  FileCheck,
  Building2,
  CheckCircle2,
} from 'lucide-react'

const TABLE_OF_CONTENTS = [
  { id: 'introduction', title: 'Introduction & Scope' },
  { id: 'data-collection', title: 'Information We Collect' },
  { id: 'data-usage', title: 'How Information Is Used' },
  { id: 'data-sharing', title: 'Information Sharing & Access' },
  { id: 'data-retention', title: 'Data Retention & Archival' },
  { id: 'security-measures', title: 'Platform Security Measures' },
  { id: 'user-rights', title: 'User Rights & Preferences' },
  { id: 'cookies-storage', title: 'Cookies & Local Storage' },
  { id: 'children-privacy', title: "Children's Privacy" },
  { id: 'policy-updates', title: 'Policy Changes & Updates' },
  { id: 'contact-us', title: 'Contact Information' },
]

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      subtitle="This Privacy Policy describes how the SmartEstate Property Management platform handles personal, tenancy, and operational information when you access our software and related services."
      lastUpdated="September 2026"
      effectiveDate="September 1, 2026"
      activeDoc="privacy"
      tableOfContents={TABLE_OF_CONTENTS}
    >
      {/* 01. Introduction */}
      <section
        id="introduction"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            01
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Introduction & Scope
            </h2>
            <p className="text-xs text-[#5B6875]">Platform overview and applicability</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            SmartEstate (&ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;the platform&rdquo;) provides digital property management software designed to streamline rental operations for <strong className="text-[#243447]">property owners</strong>, <strong className="text-[#243447]">property managers</strong>, <strong className="text-[#243447]">tenants</strong>, and <strong className="text-[#243447]">system administrators</strong>.
          </p>
          <p>
            This Privacy Policy explains how information is gathered, recorded, utilized, and safeguarded when using the SmartEstate application, including unit listings, rental applications, digital lease records, maintenance ticket coordination, and payment tracking.
          </p>
          <p>
            By creating an account, accessing the dashboard, or submitting information through the platform, you acknowledge the data handling practices described in this document.
          </p>
        </div>
      </section>

      {/* 02. Information We Collect */}
      <section
        id="data-collection"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            02
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Information We Collect
            </h2>
            <p className="text-xs text-[#5B6875]">Categories of information handled by the platform</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-4">
          <p>
            We collect information necessary to operate a multi-role property management application. This includes:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="p-3.5 rounded-lg border border-[#D9E0E6] bg-[#F7F8FA] space-y-1.5">
              <p className="font-semibold text-xs text-[#243447] flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-[#315A7D]" />
                Account & Authentication Data
              </p>
              <p className="text-xs text-[#5B6875]">
                Full names, email addresses, phone numbers, assigned roles (Owner, Tenant, Manager, Admin), and secure credential verifications.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-[#D9E0E6] bg-[#F7F8FA] space-y-1.5">
              <p className="font-semibold text-xs text-[#243447] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#315A7D]" />
                Property & Unit Listings
              </p>
              <p className="text-xs text-[#5B6875]">
                Physical property addresses, unit numbers, square footage, bedroom/bathroom configurations, rental rates, and amenities.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-[#D9E0E6] bg-[#F7F8FA] space-y-1.5">
              <p className="font-semibold text-xs text-[#243447] flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-[#315A7D]" />
                Tenancy & Lease Records
              </p>
              <p className="text-xs text-[#5B6875]">
                Rental applications, tenant occupancy terms, lease start and end dates, security deposit amounts, and digital agreement records.
              </p>
            </div>

            <div className="p-3.5 rounded-lg border border-[#D9E0E6] bg-[#F7F8FA] space-y-1.5">
              <p className="font-semibold text-xs text-[#243447] flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-[#315A7D]" />
                Maintenance & Dispatch Logs
              </p>
              <p className="text-xs text-[#5B6875]">
                Work order tickets, category classifications (plumbing, HVAC, electrical), urgency priority, repair notes, and status updates.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-md bg-[#EAF2F7] border border-[#D9E0E6] text-xs space-y-1">
            <p className="font-semibold text-[#243447]">Payment Processing Notice</p>
            <p className="text-[#5B6875] leading-relaxed">
              SmartEstate records payment status metadata (such as payment dates, amounts, receipt numbers, and payment status indicators). Full credit card numbers and bank routing credentials are processed through designated payment gateways and are not stored in plain text within SmartEstate application databases.
            </p>
          </div>
        </div>
      </section>

      {/* 03. How We Use Information */}
      <section
        id="data-usage"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            03
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              How Information Is Used
            </h2>
            <p className="text-xs text-[#5B6875]">Purposes for operational data processing</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>We process collected information strictly for operational property management purposes:</p>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58] shrink-0 mt-0.5" />
              <span><strong>Delivering Core Functionality:</strong> Facilitating unit availability tracking, lease generation, maintenance dispatch, and rent logging.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58] shrink-0 mt-0.5" />
              <span><strong>Operational Communication:</strong> Providing automated rent reminders, lease expiry notices, and maintenance status notifications.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58] shrink-0 mt-0.5" />
              <span><strong>Role Authentication & Access Control:</strong> Ensuring that users only view records permitted for their verified role (e.g. tenants only access their unit records).</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58] shrink-0 mt-0.5" />
              <span><strong>Platform Support & Troubleshooting:</strong> Diagnosing reported errors, responding to support tickets, and ensuring system uptime.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* 04. Information Sharing */}
      <section
        id="data-sharing"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            04
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Information Sharing & Access
            </h2>
            <p className="text-xs text-[#5B6875]">How data is shared across platform roles and service providers</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            SmartEstate respects the sensitivity of rental and financial data. Information is shared only in the following contexts:
          </p>

          <div className="space-y-3 text-xs sm:text-sm">
            <div className="border-l-2 border-[#315A7D] pl-3.5 py-0.5">
              <strong className="text-[#243447] block">Between Owners and Tenants</strong>
              <span>Property owners and designated managers can view tenant application details, lease terms, and maintenance tickets for their properties. Tenants can view property details, unit assignments, and their own payment histories.</span>
            </div>

            <div className="border-l-2 border-[#315A7D] pl-3.5 py-0.5">
              <strong className="text-[#243447] block">Authorized Infrastructure Service Providers</strong>
              <span>We engage trusted cloud hosting, database storage, and transactional notification providers strictly to host and deliver platform functionality. These providers operate under confidentiality agreements.</span>
            </div>

            <div className="border-l-2 border-[#315A7D] pl-3.5 py-0.5">
              <strong className="text-[#243447] block">Legal and Compliance Obligations</strong>
              <span>We may disclose records when required by law, valid court order, administrative subpoena, or to protect the vital interests and safety of users.</span>
            </div>

            <div className="border-l-2 border-[#3F7D58] pl-3.5 py-0.5">
              <strong className="text-[#243447] block">No Selling of Personal Data</strong>
              <span>SmartEstate does not sell, rent, or trade personal contact information, rental history, or financial data to third-party advertisers or data brokers.</span>
            </div>
          </div>
        </div>
      </section>

      {/* 05. Data Retention */}
      <section
        id="data-retention"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            05
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Data Retention & Archival
            </h2>
            <p className="text-xs text-[#5B6875]">Retention timelines for rental and accounting records</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            We retain account details, lease records, payment logs, and maintenance histories for as long as your account is active or as needed to provide services to you.
          </p>
          <p>
            Because rental agreements and payment receipts often represent legal and accounting documents, certain transaction and lease records may be archived in accordance with standard property management record-keeping practices and applicable tax documentation requirements even after tenancy conclusion.
          </p>
        </div>
      </section>

      {/* 06. Security Measures */}
      <section
        id="security-measures"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            06
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Platform Security Measures
            </h2>
            <p className="text-xs text-[#5B6875]">Safeguards implemented to protect platform access</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            We apply standard administrative, technical, and role-based safeguards designed to prevent unauthorized access, loss, or alteration of data. These measures include:
          </p>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#315A7D] shrink-0 mt-0.5" />
              <span>Encrypted transmission in transit using modern Transport Layer Security (HTTPS/TLS).</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#315A7D] shrink-0 mt-0.5" />
              <span>Strict role-based access controls enforcing partition between Owner, Tenant, Manager, and Admin accounts.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#315A7D] shrink-0 mt-0.5" />
              <span>Protected token-based session management and administrative security audit logging.</span>
            </li>
          </ul>
          <p className="text-xs text-[#5B6875] italic pt-1">
            Note: While we implement industry-standard practices, no internet-based service or data transmission can guarantee absolute security. Users are responsible for maintaining the confidentiality of their login credentials.
          </p>
        </div>
      </section>

      {/* 07. User Rights */}
      <section
        id="user-rights"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            07
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              User Rights & Preferences
            </h2>
            <p className="text-xs text-[#5B6875]">Managing your account and information choices</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>Users maintain the following choices regarding their information:</p>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58] shrink-0 mt-0.5" />
              <span><strong>Profile Review & Edits:</strong> You can inspect and update your contact phone number, email address, and profile settings through the application account interface.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58] shrink-0 mt-0.5" />
              <span><strong>Notification Configuration:</strong> Property managers and tenants can adjust notification preferences for routine maintenance and reminder alerts.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#3F7D58] shrink-0 mt-0.5" />
              <span><strong>Account Inquiries:</strong> You may submit an inquiry to our support team to request clarification regarding your stored account records.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* 08. Cookies & Local Storage */}
      <section
        id="cookies-storage"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            08
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Cookies & Local Storage
            </h2>
            <p className="text-xs text-[#5B6875]">Browser storage mechanisms utilized</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            SmartEstate uses essential browser cookies and local storage tokens strictly required for:
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm pl-2">
            <li>Maintaining authenticated user sessions without requiring repeated sign-ins.</li>
            <li>Remembering interface display preferences and active dashboard tabs.</li>
            <li>Protecting against cross-site request forgery and unauthorized state changes.</li>
          </ul>
          <p className="text-xs">
            We do not employ third-party advertising tracking cookies or cross-site tracking beacons.
          </p>
        </div>
      </section>

      {/* 09. Children's Privacy */}
      <section
        id="children-privacy"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            09
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Children&rsquo;s Privacy
            </h2>
            <p className="text-xs text-[#5B6875]">Age restrictions for platform use</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            SmartEstate is designed exclusively for adults managing, leasing, or renting real property. We do not knowingly collect personal information from individuals under the age of 18. If we become aware that an account was created by a minor, we will promptly terminate the account and remove associated data.
          </p>
        </div>
      </section>

      {/* 10. Policy Updates */}
      <section
        id="policy-updates"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            10
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Policy Changes & Updates
            </h2>
            <p className="text-xs text-[#5B6875]">Notification procedures for document amendments</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            We may revise this Privacy Policy from time to time to reflect modifications in platform functionality or operational procedures. When updates are published, the &ldquo;Last Updated&rdquo; date at the top of this page will be revised accordingly. For substantial modifications affecting data practices, we will post an informational notice in the application dashboard.
          </p>
        </div>
      </section>

      {/* 11. Contact Us */}
      <section
        id="contact-us"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            11
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Contact Information
            </h2>
            <p className="text-xs text-[#5B6875]">Support and inquiries regarding privacy</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            If you have questions, comments, or requests regarding this Privacy Policy or SmartEstate data practices, please reach out to our platform administration team:
          </p>
          <div className="p-4 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-xs space-y-1.5 font-mono text-[#243447]">
            <p><strong>SmartEstate Property Management Platform</strong></p>
            <p>Support and privacy contact addresses are not configured in this application.</p>
            <p>Contact channels will be shown here when configured.</p>
          </div>
        </div>
      </section>
    </LegalPageLayout>
  )
}
