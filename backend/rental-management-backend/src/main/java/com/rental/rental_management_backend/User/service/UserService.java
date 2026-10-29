
package com.rental.rental_management_backend.User.service;

import java.util.List;

import com.rental.rental_management_backend.User.security.RentalUserDetails;
import com.rental.rental_management_backend.User.dto.LoginRequest;
import com.rental.rental_management_backend.User.dto.LoginResponse;
import com.rental.rental_management_backend.User.dto.RegisterRequest;
import com.rental.rental_management_backend.User.dto.UpdateUserRequest;
import com.rental.rental_management_backend.User.dto.UserResponse;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.User.enums.UserStatus;

public interface UserService {

    void changePassword(
            Long id,
            String currentPassword,
            String newPassword
    );

    void changePassword(
            String email,
            String currentPassword,
            String newPassword
    );

    void forgotPassword(String email);

    void resetPassword(String token, String newPassword);

    UserResponse registerUser(RegisterRequest request);

    void deactivateMyAccount(String email);

    LoginResponse loginUser(LoginRequest request);

    void verifyEmailOtp(String email, String otp);

    void resendEmailOtp(String email);

    UserResponse getUserById(Long id);

    UserResponse getUserByEmail(String email);

    UserResponse updateUser(Long id, UpdateUserRequest request);

    List<UserResponse> getAllUsers();

    List<UserResponse> getUsersByRole(RoleType role);

    List<UserResponse> getUsersByStatus(UserStatus status);

    List<UserResponse> getUsersByRoleAndStatus(
            RoleType role,
            UserStatus status
    );

    UserResponse updateUserStatus(Long id, UserStatus status);

    void deactivateUser(Long id);

    UserResponse reactivateUser(Long id);

    UserResponse getMyProfile(String email);

    UserResponse getMyProfile(RentalUserDetails userDetails);
}