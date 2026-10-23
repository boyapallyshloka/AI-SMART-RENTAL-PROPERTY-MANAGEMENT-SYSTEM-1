package com.rental.rental_management_backend.notification.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;

import com.rental.rental_management_backend.User.Repository.UserRepository;
import com.rental.rental_management_backend.User.entity.User;
import com.rental.rental_management_backend.User.enums.RoleType;
import com.rental.rental_management_backend.User.enums.UserStatus;
import com.rental.rental_management_backend.User.security.CustomUserDetailsService;
import com.rental.rental_management_backend.User.security.JwtAuthenticationFilter;
import com.rental.rental_management_backend.User.security.JwtService;
import com.rental.rental_management_backend.User.security.RentalUserDetails;
import com.rental.rental_management_backend.User.security.SecurityConfig;
import com.rental.rental_management_backend.notification.dto.DeviceRegistrationResponse;
import com.rental.rental_management_backend.notification.service.NotificationService;
import com.rental.rental_management_backend.notification.serviceImpl.DeviceSubscriptionService;

@WebMvcTest(NotificationController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class})
class NotificationDeviceRegistrationSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DeviceSubscriptionService deviceSubscriptionService;
    @MockBean
    private NotificationService notificationService;
    @MockBean
    private UserRepository userRepository;
    @MockBean
    private JwtService jwtService;
    @MockBean
    private CustomUserDetailsService customUserDetailsService;

    @Test
    void unauthenticatedRegistrationIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/notifications/register-device")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(subscriptionJson()))
                .andExpect(status().is4xxClientError());
    }

    @Test
    void authenticatedRegistrationUsesPrincipalRatherThanClientUserId()
            throws Exception {
        User principalUser = new User();
        principalUser.setId(23L);
        principalUser.setEmail("tenant@example.test");
        principalUser.setPassword("not-used");
        principalUser.setRole(RoleType.TENANT);
        principalUser.setStatus(UserStatus.ACTIVE);
        RentalUserDetails principal = new RentalUserDetails(principalUser);

        when(deviceSubscriptionService.register(eq(23L), any()))
                .thenReturn(new DeviceRegistrationResponse(
                        7L,
                        "WEB",
                        null,
                        null));

        mockMvc.perform(post("/api/v1/notifications/register-device")
                        .with(authentication(
                                UsernamePasswordAuthenticationToken.authenticated(
                                        principal,
                                        null,
                                        principal.getAuthorities())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(subscriptionJsonWithClientUserId()))
                .andExpect(status().isCreated());

        verify(deviceSubscriptionService).register(eq(23L), any());
    }

    private String subscriptionJson() {
        return """
                {
                  "endpoint": "https://fcm.googleapis.com/fcm/send/example",
                  "keys": {
                    "p256dh": "browser-public-key",
                    "auth": "browser-auth-key"
                  },
                  "deviceType": "WEB"
                }
                """;
    }

    private String subscriptionJsonWithClientUserId() {
        return """
                {
                  "userId": 9999,
                  "endpoint": "https://fcm.googleapis.com/fcm/send/example",
                  "keys": {
                    "p256dh": "browser-public-key",
                    "auth": "browser-auth-key"
                  },
                  "deviceType": "WEB"
                }
                """;
    }
}
