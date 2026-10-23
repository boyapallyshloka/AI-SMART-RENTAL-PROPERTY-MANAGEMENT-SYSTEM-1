package com.rental.rental_management_backend.User.security;

import java.util.List;
import java.util.Arrays;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final String allowedOrigins;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            @Value("${app.cors.allowed-origins:http://localhost:5173}")
            String allowedOrigins) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.allowedOrigins = allowedOrigins;
    }

    // =========================================================
    // PASSWORD ENCODER
    // =========================================================

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    // =========================================================
    // CORS CONFIGURATION
    // =========================================================

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {

        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(Arrays.stream(
                        allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList());

        configuration.setAllowedMethods(
                List.of(
                        "GET",
                        "POST",
                        "PUT",
                        "PATCH",
                        "DELETE",
                        "OPTIONS"));

        configuration.setAllowedHeaders(
                List.of(
                        "Authorization",
                        "Content-Type"));

        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", configuration);

        return source;
    }

    // =========================================================
    // SECURITY FILTER CHAIN
    // =========================================================

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http) throws Exception {

        http

                // CORS
                .cors(cors -> cors.configurationSource(
                        corsConfigurationSource()))

                // JWT application - CSRF disabled
                .csrf(csrf -> csrf.disable())

                // JWT is stateless
                .sessionManagement(session -> session.sessionCreationPolicy(
                        SessionCreationPolicy.STATELESS))

                // =================================================
                // AUTHORIZATION
                // =================================================

                .authorizeHttpRequests(auth -> auth

                        // -------------------------------------------------
                        // PUBLIC AUTHENTICATION APIs
                        // -------------------------------------------------


                  .requestMatchers(
        "/api/auth/register",
        "/api/auth/login",
        "/api/auth/forgot-password",
        "/api/auth/reset-password",
        "/api/auth/verify-email-otp",
        "/api/auth/resend-email-otp"
         )
        .permitAll()

                        // -------------------------------------------------
                        // SWAGGER + UPLOADED FILES
                        // -------------------------------------------------

                        .requestMatchers(
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/uploads/property-images/**",
                                "/uploads/tenant-documents/**",
                                "/uploads/maintenance/**")
                        .permitAll()

                        // -------------------------------------------------
                        // CURRENT USER PROFILE
                        // ALL AUTHENTICATED USERS
                        // -------------------------------------------------

                        .requestMatchers(
                                "/api/users/me")
                        .authenticated()

                        // -------------------------------------------------
                        // USER MANAGEMENT
                        // SUPER ADMIN ONLY
                        // -------------------------------------------------

                        .requestMatchers(
                                "/api/users/**")
                        .hasRole("SUPER_ADMIN")

                        // =================================================
                        // PROPERTY LIST & DETAILS
                        // OWNER & TENANT BROWSING
                        // =================================================

                        .requestMatchers(
                                HttpMethod.GET,
                                "/api/owner/properties",
                                "/api/owner/properties/*/details")
                        .hasAnyRole("PROPERTY_OWNER", "TENANT")

                        // =================================================
                        // PROPERTY OWNER APIs
                        // =================================================

                        .requestMatchers(
                                "/api/owner/**")
                        .hasRole("PROPERTY_OWNER")

                        // =================================================
                        // PROPERTY MANAGER APIs
                        // =================================================

                        .requestMatchers(
                                "/api/property-manager/**",
                                "/api/manager/**")
                        .hasRole("PROPERTY_MANAGER")

                        // -------------------------------------------------
                        // TENANT APIs
                        // -------------------------------------------------

                        .requestMatchers(
                                "/api/tenant/**")
                        .hasRole("TENANT")

                        // -------------------------------------------------
                        // MAINTENANCE REQUEST
                        // Authentication required
                        // Actual roles handled by @PreAuthorize
                        // -------------------------------------------------

                        .requestMatchers(
                                "/api/maintenance/**")
                        .authenticated()

                        // -------------------------------------------------
                        // MAINTENANCE WORKER
                        // Authentication required
                        // Actual roles handled by @PreAuthorize
                        // -------------------------------------------------

                        .requestMatchers(
                                "/api/maintenance-workers/**")
                        .authenticated()

                        // -------------------------------------------------
                        // MAINTENANCE ASSIGNMENT
                        // Authentication required
                        // Actual roles handled by @PreAuthorize
                        // -------------------------------------------------

                        .requestMatchers(
                                "/api/maintenance-assignments/**")
                        .authenticated()
                        
                        
                     // -------------------------------------------------
                     // EXPENSE MODULE
                     // SUPER ADMIN, PROPERTY OWNER, PROPERTY MANAGER
                     // Property-level access is checked in ExpenseServiceImpl
                     // -------------------------------------------------

                     .requestMatchers(
                             "/api/expenses/**")
                     .hasAnyRole(
                             "SUPER_ADMIN",
                             "PROPERTY_OWNER",
                             "PROPERTY_MANAGER")
                     
                     
                  // =================================================
                  // NOTIFICATION MODULE
                  // =================================================

                  .requestMatchers(
                          "/api/notifications/**",
                          "/api/v1/notifications/**")
                  .authenticated()

                        // -------------------------------------------------
                        // EVERYTHING ELSE
                        // -------------------------------------------------

                        .anyRequest().authenticated())
                
        

                // =================================================
                // JWT FILTER
                // =================================================

                .addFilterBefore(
                        jwtAuthenticationFilter,
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}