import React from 'react'
import LegalPageLayout from '../../components/legal/LegalPageLayout'
import {
  FileText,
  Shield,
  Scale,
  Building2,
  Users,
  CreditCard,
  Wrench,
  AlertTriangle,
  Lock,
  FileCheck,
  CheckCircle2,
  Ban,
  HelpCircle,
} from 'lucide-react'

const TABLE_OF_CONTENTS = [
  { id: 'acceptance', title: 'Acceptance of Terms' },
  { id: 'platform-scope', title: 'Platform Scope & Role' },
  { id: 'user-accounts', title: 'User Accounts & Access' },
  { id: 'property-listings', title: 'Property Listings & Availability' },
  { id: 'applications-leases', title: 'Applications & Lease Agreements' },
  { id: 'payments-billing', title: 'Rent Payments & Financial Records' },
  { id: 'maintenance-emergencies', title: 'Maintenance & Emergency Notice' },
  { id: 'prohibited-conduct', title: 'Prohibited Platform Conduct' },
  { id: 'intellectual-property', title: 'Intellectual Property Rights' },
  { id: 'warranties-disclaimer', title: 'Disclaimer of Warranties' },
  { id: 'limitation-liability', title: 'Limitation of Liability' },
  { id: 'termination', title: 'Suspension & Termination' },
  { id: 'governing-law', title: 'General Legal Provisions' },
  { id: 'contact', title: 'Contact Information' },
]

export default function TermsAndConditionsPage() {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      subtitle="These Terms & Conditions govern your access to and use of the SmartEstate Property Management application, including all associated dashboards, lease workflows, and communications."
      lastUpdated="September 2026"
      effectiveDate="September 1, 2026"
      activeDoc="terms"
      tableOfContents={TABLE_OF_CONTENTS}
    >
      {/* 01. Acceptance of Terms */}
      <section
        id="acceptance"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            01
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Acceptance of Terms
            </h2>
            <p className="text-xs text-[#5B6875]">Binding agreement between users and SmartEstate</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            By accessing or using the SmartEstate Property Management application (&ldquo;SmartEstate,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;the platform&rdquo;), you agree to comply with and be bound by these Terms &amp; Conditions and our accompanying Privacy Policy.
          </p>
          <p>
            If you are entering into these terms on behalf of a company, property management firm, or real estate partnership, you represent and warrant that you possess the authority to bind that entity. If you do not agree to these terms, you must discontinue use of the platform.
          </p>
        </div>
      </section>

      {/* 02. Platform Scope & Role */}
      <section
        id="platform-scope"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            02
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Platform Scope & Role
            </h2>
            <p className="text-xs text-[#5B6875]">Nature of SmartEstate software services</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            SmartEstate provides cloud-based software tools for managing rental properties, tracking unit occupancies, drafting lease records, coordinating maintenance dispatches, and logging rental payments.
          </p>

          <div className="p-4 rounded-lg bg-[#EAF2F7] border border-[#D9E0E6] space-y-2 text-xs">
            <p className="font-semibold text-[#243447] flex items-center gap-1.5">
              <Scale className="w-4 h-4 text-[#315A7D]" />
              Clarification of Software Role
            </p>
            <p className="text-[#5B6875] leading-relaxed">
              SmartEstate is an independent technology provider. We are not a licensed real estate broker, leasing agent, landlord, escrow agency, or legal advisor. All rental decisions, lease commitments, property inspections, and contractual terms are established directly between property owners and prospective or active tenants.
            </p>
          </div>
        </div>
      </section>

      {/* 03. User Accounts & Access */}
      <section
        id="user-accounts"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            03
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              User Accounts & Access
            </h2>
            <p className="text-xs text-[#5B6875]">Account creation, credential security, and role boundaries</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            To use SmartEstate, users must register an account and maintain accurate, current contact credentials:
          </p>
          <ul className="space-y-2 text-xs sm:text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#315A7D] shrink-0 mt-0.5" />
              <span><strong>Credential Security:</strong> You are responsible for safeguarding your login credentials and preventing unauthorized access to your account.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#315A7D] shrink-0 mt-0.5" />
              <span><strong>Role Separation:</strong> Users must operate only within their assigned role capabilities (Owner, Tenant, Manager, Administrator). Attempting to bypass role permissions is strictly prohibited.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#315A7D] shrink-0 mt-0.5" />
              <span><strong>Notification of Breach:</strong> You must promptly notify SmartEstate if you suspect unauthorized access or security compromises involving your account.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* 04. Property Listings & Availability */}
      <section
        id="property-listings"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            04
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Property Listings & Availability
            </h2>
            <p className="text-xs text-[#5B6875]">Owner responsibilities regarding unit listings and descriptions</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            Property owners and property managers who publish or configure rental units through SmartEstate agree that:
          </p>
          <ul className="space-y-1.5 text-xs sm:text-sm list-disc list-inside pl-2">
            <li>All property descriptions, rents, fees, and unit amenities must be truthful and accurate.</li>
            <li>Listings must comply with applicable fair housing laws, local rental ordinances, and non-discrimination standards.</li>
            <li>Unit availability statuses must be updated promptly upon lease execution to maintain portfolio accuracy.</li>
          </ul>
        </div>
      </section>

      {/* 05. Applications & Lease Agreements */}
      <section
        id="applications-leases"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            05
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Applications & Lease Agreements
            </h2>
            <p className="text-xs text-[#5B6875]">Contractual framework between owners and tenants</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            SmartEstate provides standardized forms and digital agreement records for leasing convenience. You acknowledge:
          </p>
          <div className="space-y-2.5 text-xs sm:text-sm">
            <p>
              <strong>Direct Contractual Relationship:</strong> Any lease agreement finalized or recorded via SmartEstate is a direct contract between the landlord/owner and the tenant. SmartEstate is not a guarantor, co-signer, or party to any lease agreement.
            </p>
            <p>
              <strong>Local Legal Review:</strong> Tenancy laws, notice periods, and security deposit regulations vary across jurisdictions. Users are advised to review lease terms with qualified legal counsel in their respective region.
            </p>
          </div>
        </div>
      </section>

      {/* 06. Rent Payments & Financial Records */}
      <section
        id="payments-billing"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            06
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Rent Payments & Financial Records
            </h2>
            <p className="text-xs text-[#5B6875]">Recording payment transactions and billing logs</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            The platform records payment events, dates, amounts, and receipt entries for accounting clarity.
          </p>
          <ul className="space-y-1.5 text-xs sm:text-sm list-disc list-inside pl-2">
            <li>Electronic transactions executed through integrated payment gateways are subject to the terms of those respective payment processors.</li>
            <li>SmartEstate is not liable for transaction reversals, bank processing delays, or disputed chargebacks between tenants and property owners.</li>
            <li>Users are responsible for verifying their own financial logs and reconciliation statements.</li>
          </ul>
        </div>
      </section>

      {/* 07. Maintenance & Emergency Notice */}
      <section
        id="maintenance-emergencies"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            07
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Maintenance & Emergency Notice
            </h2>
            <p className="text-xs text-[#5B6875]">Work order workflow and urgent hazard instructions</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            The SmartEstate maintenance module facilitates routine repair logging and dispatch communication.
          </p>

          <div className="p-4 rounded-lg bg-[#FDF4F4] border border-[#F2C0C0] text-xs space-y-2">
            <p className="font-semibold text-[#B94A48] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-[#B94A48]" />
              Critical Emergency Protocol
            </p>
            <p className="text-[#5B6875] leading-relaxed">
              SmartEstate is an administrative ticketing tool and is not monitored continuously for emergencies. For life-threatening situations, active fires, gas leaks, structural collapse, or immediate physical safety hazards, you must dial 911 or your local emergency dispatch immediately before submitting an application ticket.
            </p>
          </div>
        </div>
      </section>

      {/* 08. Prohibited Conduct */}
      <section
        id="prohibited-conduct"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            08
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Prohibited Platform Conduct
            </h2>
            <p className="text-xs text-[#5B6875]">Unacceptable uses and behavioral boundaries</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>When using SmartEstate, you agree not to:</p>
          <ul className="space-y-1.5 text-xs sm:text-sm list-disc list-inside pl-2">
            <li>Submit false, fraudulent, or defamatory rental listings, reviews, or tenant applications.</li>
            <li>Engage in discriminatory housing practices prohibited by applicable law.</li>
            <li>Attempt to reverse-engineer, decompile, or extract proprietary code from the platform.</li>
            <li>Scrape data, crawl, or deploy automated bots to harvest property or user information.</li>
            <li>Interfere with platform infrastructure, servers, or attempt denial-of-service disruptions.</li>
          </ul>
        </div>
      </section>

      {/* 09. Intellectual Property Rights */}
      <section
        id="intellectual-property"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            09
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Intellectual Property Rights
            </h2>
            <p className="text-xs text-[#5B6875]">Platform software ownership and user content licenses</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            SmartEstate retains all right, title, and interest in and to the platform, including user interfaces, designs, software architecture, branding, and documentation.
          </p>
          <p>
            You retain ownership of the property photographs, text descriptions, and lease documents you upload. By uploading content, you grant SmartEstate a limited, non-exclusive license to host, display, and process your data solely as required to provide platform services.
          </p>
        </div>
      </section>

      {/* 10. Disclaimer of Warranties */}
      <section
        id="warranties-disclaimer"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            10
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Disclaimer of Warranties
            </h2>
            <p className="text-xs text-[#5B6875]">Standard operational warranty disclaimers</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            THE SmartEstate PLATFORM AND SERVICES ARE PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
          </p>
          <p className="text-xs">
            We do not warrant that platform operations will be uninterrupted, error-free, or entirely free of security vulnerabilities.
          </p>
        </div>
      </section>

      {/* 11. Limitation of Liability */}
      <section
        id="limitation-liability"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            11
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Limitation of Liability
            </h2>
            <p className="text-xs text-[#5B6875]">Scope of software liability</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, SmartEstate SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, OR USE, INCURRED BY YOU OR ANY THIRD PARTY, ARISING OUT OF OR IN CONNECTION WITH THE USE OF OR INABILITY TO USE THE PLATFORM.
          </p>
        </div>
      </section>

      {/* 12. Suspension & Termination */}
      <section
        id="termination"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            12
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Suspension & Termination
            </h2>
            <p className="text-xs text-[#5B6875]">Conditions for account termination or service restriction</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            We reserve the right to suspend or terminate accounts that violate these Terms, breach platform security, or fail to comply with lawful tenancy practices. Users may close their account at any time by contacting support, subject to the fulfillment of existing lease obligations and statutory record archival requirements.
          </p>
        </div>
      </section>

      {/* 13. General Legal Provisions */}
      <section
        id="governing-law"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            13
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              General Legal Provisions
            </h2>
            <p className="text-xs text-[#5B6875]">Severability, amendments, and legal counsel review</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            <strong>Template Status:</strong> These Terms &amp; Conditions are structured as standard general terms for property management software and are intended to be finalized in accordance with the specific jurisdiction and legal entity requirements designated by company legal counsel.
          </p>
          <p>
            <strong>Severability:</strong> If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary so that these Terms will otherwise remain in full force and effect.
          </p>
        </div>
      </section>

      {/* 14. Contact Information */}
      <section
        id="contact"
        className="bg-white rounded-lg border border-[#D9E0E6] p-6 sm:p-7 shadow-2xs space-y-4"
      >
        <div className="flex items-center gap-3 border-b border-[#D9E0E6] pb-3.5">
          <div className="w-8 h-8 rounded-md bg-[#EAF2F7] flex items-center justify-center text-[#315A7D] shrink-0 font-mono text-xs font-bold">
            14
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#243447]">
              Contact Information
            </h2>
            <p className="text-xs text-[#5B6875]">Questions regarding these terms</p>
          </div>
        </div>

        <div className="text-sm text-[#5B6875] leading-relaxed space-y-3">
          <p>
            If you have questions regarding these Terms &amp; Conditions, please direct inquiries to:
          </p>
          <div className="p-4 rounded-lg bg-[#F7F8FA] border border-[#D9E0E6] text-xs space-y-1.5 font-mono text-[#243447]">
            <p><strong>SmartEstate Legal &amp; Platform Support</strong></p>
            <p>Support and compliance contact addresses are not configured in this application.</p>
            <p>Platform: SmartEstate Property Management SaaS</p>
          </div>
        </div>
      </section>
    </LegalPageLayout>
  )
}
