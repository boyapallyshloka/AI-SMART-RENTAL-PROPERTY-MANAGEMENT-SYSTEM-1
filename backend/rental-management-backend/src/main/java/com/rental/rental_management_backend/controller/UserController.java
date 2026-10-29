
package com.rental.rental_management_backend.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.rental.rental_management_backend.User.dto.ChangePasswordRequest;
import com.rental.rental_management_backend.User.dto.ForgotPasswordRequest;
import com.rental.rental_management_backend.User.dto.LoginRequest;
import com.rental.rental_management_backend.User.dto.LoginResponse;
import com.rental.rental_management_backend.User.dto.RegisterRequest;
import com.rental.rental_management_backend.User.dto.ResetPasswordRequest;
import com.rental.rental_management_backend.User.dto.UpdateUserRequest;
import com.rental.rental_management_backend.User.dto.UserResponse;
import com.rental.rental_management_backend.User.dto.VerifyEmailOtpRequest;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.User.enums.UserStatus;
import com.rental.rental_management_backend.User.security.RentalUserDetails;
import com.rental.rental_management_backend.User.service.UserService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    // PUBLIC AUTHENTICATION

    @PostMapping("/auth/register")
    public ResponseEntity<UserResponse> registerUser(
            @Valid @RequestBody RegisterRequest request) {

        UserResponse response = userService.registerUser(request);

        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @DeleteMapping("/auth/account")
    public ResponseEntity<Void> deactivateMyAccount(
            Authentication authentication) {

        userService.deactivateMyAccount(authentication.getName());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/auth/verify-email-otp")
    public ResponseEntity<String> verifyEmailOtp(
            @Valid @RequestBody VerifyEmailOtpRequest request) {

        userService.verifyEmailOtp(request.getEmail(), request.getOtp());

        return ResponseEntity.ok(
                "Email verified successfully. You can log in if your account is active."
        );
    }

    @PostMapping("/auth/resend-email-otp")
    public ResponseEntity<String> resendEmailOtp(
            @RequestParam String email) {

        userService.resendEmailOtp(email);

        return ResponseEntity.ok(
                "If the account is eligible, a verification OTP has been sent."
        );
    }

    @PostMapping("/auth/login")
    public ResponseEntity<LoginResponse> loginUser(
            @Valid @RequestBody LoginRequest request) {

        return ResponseEntity.ok(userService.loginUser(request));
    }

    // CHANGE PASSWORD

    @PreAuthorize("isAuthenticated()")
    @PutMapping("/auth/change-password")
    public ResponseEntity<String> changePassword(
            Authentication authentication,
            @Valid @RequestBody ChangePasswordRequest request) {

        userService.changePassword(
                authentication.getName(),
                request.getCurrentPassword(),
                request.getNewPassword()
        );

        return ResponseEntity.ok("Password changed successfully");
    }

    // SUPER ADMIN - USER MANAGEMENT

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @GetMapping("/users")
    public ResponseEntity<List<UserResponse>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @GetMapping("/users/{id}")
    public ResponseEntity<UserResponse> getUserById(
            @PathVariable Long id) {
        return ResponseEntity.ok(userService.getUserById(id));
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @GetMapping("/users/email")
    public ResponseEntity<UserResponse> getUserByEmail(
            @RequestParam String email) {
        return ResponseEntity.ok(userService.getUserByEmail(email));
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PutMapping("/users/{id}")
    public ResponseEntity<UserResponse> updateUser(
            @PathVariable Long id,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userService.updateUser(id, request));
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @DeleteMapping("/users/{id}")
    public ResponseEntity<String> deactivateUser(
            @PathVariable Long id) {
        userService.deactivateUser(id);
        return ResponseEntity.ok("User deactivated successfully");
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PatchMapping("/users/{id}/reactivate")
    public ResponseEntity<UserResponse> reactivateUser(
            @PathVariable Long id) {
        return ResponseEntity.ok(userService.reactivateUser(id));
    }

    // USER FILTERING - SUPER ADMIN

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @GetMapping("/users/role/{role}")
    public ResponseEntity<List<UserResponse>> getUsersByRole(
            @PathVariable RoleType role) {
        return ResponseEntity.ok(userService.getUsersByRole(role));
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @GetMapping("/users/status/{status}")
    public ResponseEntity<List<UserResponse>> getUsersByStatus(
            @PathVariable UserStatus status) {
        return ResponseEntity.ok(userService.getUsersByStatus(status));
    }

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @GetMapping("/users/filter")
    public ResponseEntity<List<UserResponse>> getUsersByRoleAndStatus(
            @RequestParam RoleType role,
            @RequestParam UserStatus status) {
        return ResponseEntity.ok(
                userService.getUsersByRoleAndStatus(role, status)
        );
    }

    // USER STATUS - SUPER ADMIN

    @PreAuthorize("hasRole('SUPER_ADMIN')")
    @PutMapping("/users/{id}/status")
    public ResponseEntity<UserResponse> updateUserStatus(
            @PathVariable Long id,
            @RequestParam UserStatus status) {
        return ResponseEntity.ok(userService.updateUserStatus(id, status));
    }

    // MY PROFILE

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/users/me")
    public ResponseEntity<UserResponse> getMyProfile(
            Authentication authentication) {

        if (authentication.getPrincipal() instanceof RentalUserDetails userDetails) {
            return ResponseEntity.ok(userService.getMyProfile(userDetails));
        }

        return ResponseEntity.ok(
                userService.getMyProfile(authentication.getName())
        );
    }

    // FORGOT PASSWORD

    @PostMapping("/auth/forgot-password")
    public ResponseEntity<String> forgotPassword(
            @Valid @RequestBody ForgotPasswordRequest request) {

        userService.forgotPassword(request.getEmail());

        return ResponseEntity.ok(
                "Password reset token generated successfully"
        );
    }

    // RESET PASSWORD

    @PostMapping("/auth/reset-password")
    public ResponseEntity<String> resetPassword(
            @Valid @RequestBody ResetPasswordRequest request) {

        userService.resetPassword(
                request.getToken(),
                request.getNewPassword()
        );

        return ResponseEntity.ok("Password reset successfully");
    }
}
