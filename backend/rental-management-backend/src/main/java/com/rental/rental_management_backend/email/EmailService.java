
package com.rental.rental_management_backend.email;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${app.frontend.base-url}")
    private String frontendBaseUrl;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    public void sendEmail(String to, String subject, String body) {
        if (to == null || to.isBlank()) {
            throw new IllegalArgumentException("Recipient email is required");
        }

        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
    }

    public void sendEmailVerificationOtp(
            String email,
            String firstName,
            String otp) {

        String subject = "Verify Your AI Smart Rental Email";

        String body = "Hello " + firstName + ",\n\n"
                + "Your email verification OTP is: " + otp + "\n\n"
                + "This OTP expires in 10 minutes.\n"
                + "Do not share this OTP with anyone.\n\n"
                + "If you did not register, you can ignore this email.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(email, subject, body);
    }

    public void sendTenantWelcomeEmail(
            String tenantEmail,
            String tenantName) {

        String subject = "Welcome to AI Smart Rental";
        String body = "Hello " + tenantName + ",\n\n"
                + "Welcome to AI Smart Rental & Property Management System.\n"
                + "Your email has been verified successfully.\n\n"
                + "You can log in when your account is active.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(tenantEmail, subject, body);
    }

    public void sendPropertyCreatedEmail(
            String recipientEmail,
            String propertyName) {

        String subject = "Property Created Successfully";
        String body = "Hello,\n\n"
                + "Your property \"" + propertyName
                + "\" has been created successfully.\n\n"
                + "You can log in to the platform to manage your property.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(recipientEmail, subject, body);
    }

    public void sendAgreementNotification(
            String tenantEmail,
            String tenantName,
            String agreementDetails) {

        String subject = "Rental Agreement Notification";
        String body = "Hello " + tenantName + ",\n\n"
                + "There is an update regarding your rental agreement.\n\n"
                + agreementDetails + "\n\n"
                + "Please log in to the platform to review the details.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(tenantEmail, subject, body);
    }

    public void sendAgreementCreatedEmail(
            String tenantEmail,
            String tenantName,
            Long agreementId,
            String propertyName,
            String unitNumber,
            String startDate,
            String endDate,
            String monthlyRent,
            String status) {

        String subject = "Rental Agreement Created";
        String body = "Hello " + tenantName + ",\n\n"
                + "A rental agreement has been created for you.\n\n"
                + "Agreement ID: " + agreementId + "\n"
                + "Property: " + propertyName + "\n"
                + "Unit: " + unitNumber + "\n"
                + "Status: " + status + "\n"
                + "Start date: " + startDate + "\n"
                + "End date: " + endDate + "\n"
                + "Monthly rent: " + monthlyRent + "\n\n"
                + "Please log in to the platform to review the agreement.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(tenantEmail, subject, body);
    }

    public void sendAgreementStatusChangedEmail(
            String tenantEmail,
            String tenantName,
            Long agreementId,
            String propertyName,
            String unitNumber,
            String previousStatus,
            String newStatus,
            String startDate,
            String endDate,
            String monthlyRent) {

        String subject = "Rental Agreement Status Updated: " + newStatus;
        String body = "Hello " + tenantName + ",\n\n"
                + "The status of your rental agreement has changed.\n\n"
                + "Agreement ID: " + agreementId + "\n"
                + "Property: " + propertyName + "\n"
                + "Unit: " + unitNumber + "\n"
                + "Previous status: " + previousStatus + "\n"
                + "New status: " + newStatus + "\n"
                + "Start date: " + startDate + "\n"
                + "End date: " + endDate + "\n"
                + "Monthly rent: " + monthlyRent + "\n\n"
                + "Please log in to the platform to review the agreement.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(tenantEmail, subject, body);
    }

    public void sendAgreementMoveOutEmail(
            String tenantEmail,
            String tenantName,
            Long agreementId,
            String propertyName,
            String unitNumber,
            String status,
            String moveOutDate,
            String startDate,
            String endDate,
            String monthlyRent) {

        String subject = "Rental Agreement Move-Out Updated";
        String body = "Hello " + tenantName + ",\n\n"
                + "The move-out details for your rental agreement have been updated.\n\n"
                + "Agreement ID: " + agreementId + "\n"
                + "Property: " + propertyName + "\n"
                + "Unit: " + unitNumber + "\n"
                + "Move-out date: " + moveOutDate + "\n"
                + "Current status: " + status + "\n"
                + "Start date: " + startDate + "\n"
                + "End date: " + endDate + "\n"
                + "Monthly rent: " + monthlyRent + "\n\n"
                + "Please log in to the platform to review the agreement.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(tenantEmail, subject, body);
    }

    public void sendRentInvoiceGeneratedEmail(
            String tenantEmail,
            String tenantName,
            String invoiceNumber,
            Long invoiceId,
            Long agreementId,
            Integer billingMonth,
            Integer billingYear,
            String totalAmount,
            String dueDate) {

        String subject = "Rent Invoice Generated: " + invoiceNumber;
        String body = "Hello " + tenantName + ",\n\n"
                + "Your rent invoice has been generated.\n\n"
                + "Invoice number: " + invoiceNumber + "\n"
                + "Invoice ID: " + invoiceId + "\n"
                + "Agreement ID: " + agreementId + "\n"
                + "Billing period: " + billingMonth + "/" + billingYear + "\n"
                + "Total amount: " + totalAmount + "\n"
                + "Due date: " + dueDate + "\n\n"
                + "Please log in to the platform to review your invoice "
                + "and payment options.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(tenantEmail, subject, body);
    }

    public void sendRentInvoiceOverdueEmail(
            String tenantEmail,
            String tenantName,
            String invoiceNumber,
            Long invoiceId,
            String totalAmount,
            String dueDate) {

        String subject = "Rent Invoice Overdue: " + invoiceNumber;
        String body = "Hello " + tenantName + ",\n\n"
                + "Your rent invoice is now overdue.\n\n"
                + "Invoice number: " + invoiceNumber + "\n"
                + "Invoice ID: " + invoiceId + "\n"
                + "Amount due: " + totalAmount + "\n"
                + "Due date: " + dueDate + "\n\n"
                + "Please log in to the platform to review your invoice "
                + "and payment options.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(tenantEmail, subject, body);
    }

    public void sendRentalApplicationSubmittedEmail(
            String recipientEmail,
            String tenantName,
            String propertyName,
            String unitNumber,
            Long applicationId,
            String moveInDate,
            Integer leaseDurationMonths,
            String applicationMessage) {

        String subject = "New Rental Application Submitted";
        String body = "Hello,\n\n"
                + tenantName + " has submitted a rental application.\n\n"
                + "Application ID: " + applicationId + "\n"
                + "Property: " + propertyName + "\n"
                + "Unit: " + unitNumber + "\n"
                + "Preferred move-in date: " + moveInDate + "\n"
                + "Preferred lease duration: " + leaseDurationMonths
                + " months\n"
                + "Message: " + applicationMessage + "\n\n"
                + "Please log in to review the application.\n\n"
                + "AI Smart Rental Team";

        sendEmail(recipientEmail, subject, body);
    }

    public void sendRentalApplicationReviewEmail(
            String tenantEmail,
            String tenantName,
            String propertyName,
            String unitNumber,
            Long applicationId,
            String status,
            String rejectionReason) {

        String subject = "Rental Application " + status;
        String body = "Hello " + tenantName + ",\n\n"
                + "Your rental application has been " + status + ".\n\n"
                + "Application ID: " + applicationId + "\n"
                + "Property: " + propertyName + "\n"
                + "Unit: " + unitNumber + "\n"
                + (rejectionReason == null || rejectionReason.isBlank()
                        ? ""
                        : "Reason: " + rejectionReason + "\n")
                + "\nPlease log in to the platform for details.\n\n"
                + "AI Smart Rental Team";

        sendEmail(tenantEmail, subject, body);
    }

    public void sendRentalApplicationWithdrawnEmail(
            String recipientEmail,
            String tenantName,
            String propertyName,
            String unitNumber,
            Long applicationId) {

        String subject = "Rental Application Withdrawn";
        String body = "Hello,\n\n"
                + tenantName + " has withdrawn a rental application.\n\n"
                + "Application ID: " + applicationId + "\n"
                + "Property: " + propertyName + "\n"
                + "Unit: " + unitNumber + "\n\n"
                + "Please log in to the platform to review your applications.\n\n"
                + "AI Smart Rental Team";

        sendEmail(recipientEmail, subject, body);
    }

    public void sendPaymentSuccessEmail(
            String tenantEmail,
            String tenantName,
            String amount,
            String invoiceNumber) {

        String subject = "Rent Payment Successful";
        String body = "Hello " + tenantName + ",\n\n"
                + "Your rent payment has been verified successfully.\n\n"
                + "Amount paid: " + amount + "\n"
                + "Invoice number: " + invoiceNumber + "\n\n"
                + "Thank you for your payment.\n\n"
                + "AI Smart Rental Team";

        sendEmail(tenantEmail, subject, body);
    }

    public void sendPaymentFailureEmail(
            String tenantEmail,
            String tenantName,
            String invoiceNumber) {

        String subject = "Rent Payment Not Completed";
        String body = "Hello " + tenantName + ",\n\n"
                + "Your rent payment for invoice "
                + invoiceNumber + " has not been confirmed.\n\n"
                + "Please check your payment status in the platform "
                + "before attempting another payment.\n\n"
                + "If your account was charged, please contact support "
                + "before retrying.\n\n"
                + "AI Smart Rental Team";

        sendEmail(tenantEmail, subject, body);
    }

    public void sendMaintenanceUpdateEmail(
            String recipientEmail,
            String recipientName,
            String requestDetails,
            String status) {

        String subject = "Maintenance Request Status Update";
        String body = "Hello " + recipientName + ",\n\n"
                + "Your maintenance request has been updated.\n\n"
                + "Request details: " + requestDetails + "\n"
                + "Current status: " + status + "\n\n"
                + "Please log in to the platform for further details.\n\n"
                + "AI Smart Rental Team";

        sendEmail(recipientEmail, subject, body);
    }

    public void sendLoginNotificationEmail(
            String userEmail,
            String firstName) {

        String subject = "New Login to Your Smart Rental Account";
        String body = "Hello " + firstName + ",\n\n"
                + "A successful login to your AI Smart Rental account was detected.\n\n"
                + "If this was you, no action is required. If you do not recognize "
                + "this activity, please change your password and contact support.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(userEmail, subject, body);
    }

    public void sendPasswordResetEmail(
            String email,
            String firstName,
            String token) {

        String subject = "Reset Your AI Smart Rental Password";
        String baseUrl = frontendBaseUrl.replaceAll("/+$", "");
        String resetUrl = baseUrl + "/reset-password?token="
                + URLEncoder.encode(token, StandardCharsets.UTF_8);
        String safeFirstName = escapeHtml(firstName);
        String body = "<!doctype html><html><body>"
                + "<p>Hello " + safeFirstName + ",</p>"
                + "<p>We received a request to reset your password.</p>"
                + "<p>This link expires in 15 minutes and can be used only once.</p>"
                + "<p><a href=\"" + resetUrl + "\" "
                + "style=\"display:inline-block;padding:12px 20px;"
                + "background-color:#2563eb;color:#ffffff;text-decoration:none;"
                + "border-radius:4px\">Reset Password</a></p>"
                + "<p>If you did not request a password reset, please ignore this email.</p>"
                + "<p>Thank you,<br>AI Smart Rental Team</p>"
                + "</body></html>";

        try {
            var message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(
                    message,
                    false,
                    StandardCharsets.UTF_8.name());
            helper.setTo(email);
            helper.setSubject(subject);
            helper.setText(body, true);
            mailSender.send(message);
        } catch (jakarta.mail.MessagingException ex) {
            throw new IllegalStateException(
                    "Unable to create password reset email", ex);
        }
    }

    private String escapeHtml(String value) {
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
    
    public void sendPasswordChangedEmail(
            String email,
            String firstName) {

        String subject = "Your AI Smart Rental Password Was Changed";

        String body = "Hello " + firstName + ",\n\n"
                + "Your account password was changed successfully.\n\n"
                + "If you made this change, no action is required.\n"
                + "If you did not make this change, please contact support "
                + "and secure your account immediately.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(email, subject, body);
    }

    public void sendPasswordResetSuccessEmail(
            String email,
            String firstName) {

        String subject = "Your AI Smart Rental Password Was Reset";

        String body = "Hello " + firstName + ",\n\n"
                + "Your account password was reset successfully.\n\n"
                + "If you did not make this change, please contact support "
                + "and secure your account immediately.\n\n"
                + "Thank you,\nAI Smart Rental Team";

        sendEmail(email, subject, body);
    }
    

}