
package com.rental.rental_management_backend.User.serviceImpl;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.rental.rental_management_backend.User.Repository.EmailVerificationOtpRepository;
import com.rental.rental_management_backend.User.Repository.PasswordResetTokenRepository;
import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.dto.LoginRequest;
import com.rental.rental_management_backend.User.dto.LoginResponse;
import com.rental.rental_management_backend.User.dto.RegisterRequest;
import com.rental.rental_management_backend.User.dto.UpdateUserRequest;
import com.rental.rental_management_backend.User.dto.UserResponse;
import com.rental.rental_management_backend.User.entity.EmailVerificationOtp;
import com.rental.rental_management_backend.User.entity.PasswordResetToken;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.User.enums.UserStatus;
import com.rental.rental_management_backend.User.exception.UserAlreadyExistsException;
import com.rental.rental_management_backend.User.security.JwtService;
import com.rental.rental_management_backend.User.security.RentalUserDetails;
import com.rental.rental_management_backend.User.service.UserService;
import com.rental.rental_management_backend.email.EmailService;
import com.rental.rental_management_backend.exception.ResourceNotFoundException;
import com.rental.rental_management_backend.property.entity.PropertyManager;
import com.rental.rental_management_backend.property.repository.PropertyManagerRepository;
import com.rental.rental_management_backend.tenant.entity.Tenant;
import com.rental.rental_management_backend.tenant.repository.TenantRepository;

@Service
@Transactional
public class UserServiceImpl implements UserService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final int OTP_EXPIRY_MINUTES = 10;
    private static final int OTP_RESEND_COOLDOWN_SECONDS = 60;
    private static final int MAX_OTP_ATTEMPTS = 5;

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PropertyManagerRepository propertyManagerRepository;
    private final TenantRepository tenantRepository;
    private final EmailService emailService;
    private final UserAuthEmailDispatcher userAuthEmailDispatcher;
    private final EmailVerificationOtpRepository emailVerificationOtpRepository;

    public UserServiceImpl(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            PasswordResetTokenRepository passwordResetTokenRepository,
            PropertyManagerRepository propertyManagerRepository,
            TenantRepository tenantRepository,
            EmailService emailService,
            UserAuthEmailDispatcher userAuthEmailDispatcher,
            EmailVerificationOtpRepository emailVerificationOtpRepository) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.propertyManagerRepository = propertyManagerRepository;
        this.tenantRepository = tenantRepository;
        this.emailService = emailService;
        this.userAuthEmailDispatcher = userAuthEmailDispatcher;
        this.emailVerificationOtpRepository = emailVerificationOtpRepository;
    }

    // =========================================================
    // REGISTER
    // =========================================================

    @Override
    public UserResponse registerUser(RegisterRequest request) {

        String email = request.getEmail().toLowerCase().trim();

        if (userRepository.existsByEmail(email)) {
            throw new UserAlreadyExistsException("Email already registered");
        }

        if (userRepository.existsByPhone(request.getPhone())) {
            throw new UserAlreadyExistsException("Phone number already registered");
        }

        if (request.getRole() == RoleType.SUPER_ADMIN) {
            throw new IllegalArgumentException(
                    "SUPER_ADMIN cannot be created through public registration");
        }

        User user = new User();
        user.setFirstName(request.getFirstName().trim());
        user.setLastName(request.getLastName().trim());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        user.setPhone(request.getPhone());
        user.setGender(request.getGender());
        user.setRole(request.getRole());

        // Every newly registered account must verify its email.
        user.setEmailVerified(false);

        // Preserve the existing account approval workflow.
        if (request.getRole() == RoleType.PROPERTY_OWNER
                || request.getRole() == RoleType.PROPERTY_MANAGER) {
            user.setStatus(UserStatus.PENDING);
        } else {
            user.setStatus(UserStatus.ACTIVE);
        }

        User savedUser = userRepository.save(user);

        // Preserve automatic tenant profile creation.
        if (savedUser.getRole() == RoleType.TENANT) {

            Tenant tenant = new Tenant();
            tenant.setUser(savedUser);
            tenantRepository.save(tenant);
        }

        // Send OTP instead of sending the welcome email immediately.
        issueOtp(savedUser, false);

        return mapToResponse(savedUser);
    }

    // =========================================================
    // LOGIN
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public LoginResponse loginUser(LoginRequest request) {

        String email = request.getEmail().toLowerCase().trim();

        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Invalid email or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        // Existing accounts are migrated with email_verified = true.
        // Only newly registered or newly changed email addresses require OTP.
        if (!user.isEmailVerified()) {
            throw new IllegalArgumentException(
                    "Please verify your email address before logging in");
        }

        // Preserve existing admin approval requirements.
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new IllegalArgumentException("Account is not active");
        }

        UserDetails userDetails =
                org.springframework.security.core.userdetails.User
                        .withUsername(user.getEmail())
                        .password(user.getPassword())
                        .authorities("ROLE_" + user.getRole().name())
                        .build();

        String token = jwtService.generateToken(userDetails);

        LoginResponse response = new LoginResponse();
        response.setToken(token);
        response.setUserId(user.getId());
        response.setFirstName(user.getFirstName());
        response.setLastName(user.getLastName());
        response.setEmail(user.getEmail());
        response.setRole(user.getRole());

        return response;
    }

    // =========================================================
    // VERIFY EMAIL OTP
    // =========================================================

    @Transactional(noRollbackFor = IllegalArgumentException.class)
    public void verifyEmailOtp(String email, String otp) {

        String normalizedEmail = email.toLowerCase().trim();

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Invalid email or OTP"));

        if (user.isEmailVerified()) {
            return;
        }

        EmailVerificationOtp otpRecord =
                emailVerificationOtpRepository.findByUser_Id(user.getId())
                        .orElseThrow(() -> new IllegalArgumentException(
                                "OTP not found. Please request a new OTP."));

        if (otpRecord.getExpiryDate().isBefore(LocalDateTime.now())) {
            emailVerificationOtpRepository.delete(otpRecord);
            throw new IllegalArgumentException(
                    "OTP has expired. Please request a new OTP.");
        }

        if (otpRecord.getFailedAttempts() >= MAX_OTP_ATTEMPTS) {
            emailVerificationOtpRepository.delete(otpRecord);
            throw new IllegalArgumentException(
                    "Maximum OTP attempts exceeded. Please request a new OTP.");
        }

        if (!passwordEncoder.matches(otp, otpRecord.getOtpHash())) {

            int attempts = otpRecord.getFailedAttempts() + 1;
            otpRecord.setFailedAttempts(attempts);

            if (attempts >= MAX_OTP_ATTEMPTS) {
                emailVerificationOtpRepository.delete(otpRecord);
                throw new IllegalArgumentException(
                        "Maximum OTP attempts exceeded. Please request a new OTP.");
            }

            emailVerificationOtpRepository.save(otpRecord);

            throw new IllegalArgumentException(
                    "Incorrect OTP. Attempts remaining: "
                            + (MAX_OTP_ATTEMPTS - attempts));
        }

        user.setEmailVerified(true);
        userRepository.save(user);
        emailVerificationOtpRepository.delete(otpRecord);

        // Welcome email is sent only after successful verification.
        sendWelcomeEmail(user);
    }

    // =========================================================
    // RESEND EMAIL OTP
    // =========================================================

    public void resendEmailOtp(String email) {

        String normalizedEmail = email.toLowerCase().trim();

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Unable to resend OTP for this email address"));

        if (user.isEmailVerified()) {
            throw new IllegalArgumentException(
                    "Email address is already verified");
        }

        Optional<EmailVerificationOtp> existingOtp =
                emailVerificationOtpRepository.findByUser_Id(user.getId());

        if (existingOtp.isPresent()) {
            LocalDateTime lastSentAt = existingOtp.get().getLastSentAt();

            if (lastSentAt != null
                    && lastSentAt.plusSeconds(OTP_RESEND_COOLDOWN_SECONDS)
                            .isAfter(LocalDateTime.now())) {
                throw new IllegalArgumentException(
                        "Please wait 60 seconds before requesting another OTP");
            }
        }

        issueOtp(user);
    }

    // =========================================================
    // CREATE AND SEND OTP
    // =========================================================

    private void issueOtp(User user) {
        issueOtp(user, true);
    }

    private void issueOtp(User user, boolean replaceExistingOtp) {
        if (replaceExistingOtp) {
            emailVerificationOtpRepository.deleteByUser_Id(user.getId());
            emailVerificationOtpRepository.flush();
        }

        String otp = String.format(
                "%06d",
                SECURE_RANDOM.nextInt(1_000_000));

        LocalDateTime now = LocalDateTime.now();

        EmailVerificationOtp otpRecord = new EmailVerificationOtp();
        otpRecord.setUser(user);
        otpRecord.setOtpHash(passwordEncoder.encode(otp));
        otpRecord.setExpiryDate(now.plusMinutes(OTP_EXPIRY_MINUTES));
        otpRecord.setLastSentAt(now);
        otpRecord.setFailedAttempts(0);

        emailVerificationOtpRepository.save(otpRecord);

        String userEmail = user.getEmail();
        String firstName = user.getFirstName();
        dispatchEmail(
                "Email verification OTP",
                () -> emailService.sendEmailVerificationOtp(
                        userEmail,
                        firstName,
                        otp));
    }

    // =========================================================
    // SEND WELCOME EMAIL AFTER VERIFICATION
    // =========================================================

    private void sendWelcomeEmail(User user) {

        String email = user.getEmail();
        String firstName = user.getFirstName();
        RoleType role = user.getRole();

        dispatchEmail("Welcome", () -> {
            switch (role) {

                case TENANT:
                    emailService.sendTenantWelcomeEmail(
                            email,
                            firstName);
                    break;

                case PROPERTY_OWNER:
                    emailService.sendEmail(
                            email,
                            "Welcome to AI Smart Rental",
                            "Hello " + firstName + ",\n\n"
                                    + "Welcome to AI Smart Rental!\n"
                                    + "Your property owner account has been created.\n"
                                    + "Your account will be available after admin approval.\n\n"
                                    + "Thank you,\nAI Smart Rental Team");
                    break;

                case PROPERTY_MANAGER:
                    emailService.sendEmail(
                            email,
                            "Welcome to AI Smart Rental",
                            "Hello " + firstName + ",\n\n"
                                    + "Welcome to AI Smart Rental!\n"
                                    + "Your property manager account has been created.\n"
                                    + "Your account will be available after admin approval.\n\n"
                                    + "Thank you,\nAI Smart Rental Team");
                    break;

                default:
                    emailService.sendEmail(
                            email,
                            "Welcome to AI Smart Rental",
                            "Hello " + firstName + ",\n\n"
                                    + "Welcome to AI Smart Rental!\n"
                                    + "Thank you for registering with us.\n\n"
                                    + "AI Smart Rental Team");
                    break;
            }
        });
    }

    // =========================================================
    // GET USER BY ID
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUserById(Long id) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found with id: " + id));

        return mapToResponse(user);
    }

    // =========================================================
    // GET USER BY EMAIL
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public UserResponse getUserByEmail(String email) {

        User user = userRepository.findByEmail(
                        email.toLowerCase().trim())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found with email: " + email));

        return mapToResponse(user);
    }

    // =========================================================
    // UPDATE USER
    // =========================================================

    @Override
    public UserResponse updateUser(Long id, UpdateUserRequest request) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found with id: " + id));

        if (request.getFirstName() != null
                && !request.getFirstName().isBlank()) {
            user.setFirstName(request.getFirstName().trim());
        }

        if (request.getLastName() != null
                && !request.getLastName().isBlank()) {
            user.setLastName(request.getLastName().trim());
        }

        if (request.getEmail() != null
                && !request.getEmail().isBlank()
                && !request.getEmail().trim()
                        .equalsIgnoreCase(user.getEmail())) {

            String newEmail = request.getEmail().toLowerCase().trim();

            if (userRepository.existsByEmailAndIdNot(newEmail, id)) {
                throw new UserAlreadyExistsException(
                        "Email already registered by another user");
            }

            user.setEmail(newEmail);
            user.setEmailVerified(false);

            // Any OTP for the old email must no longer be valid.
            emailVerificationOtpRepository.deleteByUser_Id(user.getId());
            emailVerificationOtpRepository.flush();

            User updatedUser = userRepository.save(user);
            issueOtp(updatedUser);

            return mapToResponse(updatedUser);
        }

        if (request.getPhone() != null
                && !request.getPhone().isBlank()
                && !request.getPhone().equals(user.getPhone())) {

            if (userRepository.existsByPhoneAndIdNot(
                    request.getPhone(), id)) {
                throw new UserAlreadyExistsException(
                        "Phone number already registered by another user");
            }

            user.setPhone(request.getPhone());
        }

        if (request.getGender() != null) {
            user.setGender(request.getGender());
        }

        User updatedUser = userRepository.save(user);
        return mapToResponse(updatedUser);
    }

    // =========================================================
    // GET ALL USERS
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getAllUsers() {

        return userRepository.findAll()
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // GET USERS BY ROLE
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getUsersByRole(RoleType role) {

        return userRepository.findByRole(role)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // GET USERS BY STATUS
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getUsersByStatus(UserStatus status) {

        return userRepository.findByStatus(status)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // GET USERS BY ROLE AND STATUS
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public List<UserResponse> getUsersByRoleAndStatus(
            RoleType role, UserStatus status) {

        return userRepository.findByRoleAndStatus(role, status)
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    // =========================================================
    // UPDATE USER STATUS
    // =========================================================

    @Override
    public UserResponse updateUserStatus(Long id, UserStatus status) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found with id: " + id));

        user.setStatus(status);
        User updatedUser = userRepository.save(user);

        // Preserve property manager profile creation on approval.
        if (user.getRole() == RoleType.PROPERTY_MANAGER
                && status == UserStatus.ACTIVE
                && !propertyManagerRepository.existsByUser_Id(user.getId())) {

            PropertyManager propertyManager = new PropertyManager();
            propertyManager.setUser(user);
            propertyManagerRepository.save(propertyManager);
        }

        return mapToResponse(updatedUser);
    }

    // =========================================================
    // DELETE USER
    // =========================================================

    @Override
    public void deleteUser(Long id) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found with id: " + id));

        emailVerificationOtpRepository.deleteByUser_Id(user.getId());
        userRepository.delete(user);
    }

    // =========================================================
    // ENTITY -> DTO
    // =========================================================

    private UserResponse mapToResponse(User user) {

        UserResponse response = new UserResponse();
        response.setId(user.getId());
        response.setFirstName(user.getFirstName());
        response.setLastName(user.getLastName());
        response.setEmail(user.getEmail());
        response.setPhone(user.getPhone());
        response.setGender(user.getGender());
        response.setRole(user.getRole());
        response.setStatus(user.getStatus());
        response.setCreatedAt(user.getCreatedAt());
        response.setUpdatedAt(user.getUpdatedAt());

        return response;
    }

    // =========================================================
    // GET MY PROFILE
    // =========================================================

    @Override
    @Transactional(readOnly = true)
    public UserResponse getMyProfile(String email) {

        User user = userRepository.findByEmail(
                        email.toLowerCase().trim())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found with email: " + email));

        return mapToResponse(user);
    }

    @Override
    @Transactional(readOnly = true)
    public UserResponse getMyProfile(RentalUserDetails userDetails) {
        return userDetails.getUserResponse();
    }

    private void dispatchEmail(String notificationType, Runnable sendEmail) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            userAuthEmailDispatcher.dispatch(notificationType, sendEmail);
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        userAuthEmailDispatcher.dispatch(
                                notificationType,
                                sendEmail);
                    }
                });
    }

    // =========================================================
    // CHANGE PASSWORD
    // =========================================================

    
    @Override
    public void changePassword(
            Long id, String currentPassword, String newPassword) {

        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found with id: " + id));

        changePassword(user, currentPassword, newPassword);
    }

    @Override
    public void changePassword(
            String email, String currentPassword, String newPassword) {

        User user = userRepository.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found with email: " + email));

        changePassword(user, currentPassword, newPassword);
    }

    private void changePassword(
            User user, String currentPassword, String newPassword) {

        if (!passwordEncoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException(
                    "Current password is incorrect");
        }

        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new IllegalArgumentException(
                    "New password must be different from current password");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        String userEmail = user.getEmail();
        String firstName = user.getFirstName();
        dispatchEmail(
                "Password changed",
                () -> emailService.sendPasswordChangedEmail(
                        userEmail,
                        firstName));
    }
    

    // =========================================================
    // FORGOT PASSWORD
    // =========================================================

    
    
    @Override
    public void forgotPassword(String email) {

        String normalizedEmail = email.toLowerCase().trim();

        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "User not found with email: " + email));

        Optional<PasswordResetToken> existingToken =
                passwordResetTokenRepository.findByUserId(user.getId());

        if (existingToken.isPresent()) {
            passwordResetTokenRepository.delete(existingToken.get());
            passwordResetTokenRepository.flush();
        }

        String token = UUID.randomUUID().toString();

        LocalDateTime expiryDate = LocalDateTime.now().plusMinutes(15);

        PasswordResetToken resetToken =
                new PasswordResetToken(token, user, expiryDate);

        passwordResetTokenRepository.save(resetToken);

        String userEmail = user.getEmail();
        String firstName = user.getFirstName();
        dispatchEmail(
                "Password reset",
                () -> emailService.sendPasswordResetEmail(
                        userEmail,
                        firstName,
                        token));
    }
    
    

    // =========================================================
    // RESET PASSWORD
    // =========================================================

    
    @Override
    public void resetPassword(String token, String newPassword) {

        PasswordResetToken resetToken =
                passwordResetTokenRepository.findByToken(token)
                        .orElseThrow(() -> new IllegalArgumentException(
                                "Invalid password reset token"));

        if (resetToken.getExpiryDate().isBefore(LocalDateTime.now())) {
            passwordResetTokenRepository.deleteByToken(token);

            throw new IllegalArgumentException(
                    "Password reset token has expired");
        }

        User user = resetToken.getUser();

        if (passwordEncoder.matches(newPassword, user.getPassword())) {
            throw new IllegalArgumentException(
                    "New password must be different from current password");
        }

        user.setPassword(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        passwordResetTokenRepository.deleteByToken(token);

        String userEmail = user.getEmail();
        String firstName = user.getFirstName();
        dispatchEmail(
                "Password reset success",
                () -> emailService.sendPasswordResetSuccessEmail(
                        userEmail,
                        firstName));
    }
    
}
